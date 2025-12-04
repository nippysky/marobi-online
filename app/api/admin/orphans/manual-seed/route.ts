// app/api/admin/orphans/manual-seed/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import prisma, { prismaReady } from "@/lib/db";
import { verifyTransaction, PaystackError } from "@/lib/paystack";

export async function POST(req: Request) {
  try {
    await prismaReady;

    // --- Auth: only staff/admin, similar to /api/admin/me ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const staff = await prisma.staff.findUnique({
      where: { email: session.user.email },
      select: { id: true, access: true },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    // You can tighten this to only SuperAdmin / OrderAdmin if you like
    // if (!["SuperAdmin", "OrderAdmin"].includes(staff.access)) { ... }

    const body = await req.json().catch(() => ({}));
    const reference = String(body.reference || "").trim();

    if (!reference) {
      return NextResponse.json(
        { error: "Missing reference in body" },
        { status: 400 }
      );
    }

    // --- Verify with Paystack as source of truth ---
    let tx;
    try {
      tx = await verifyTransaction(reference);
    } catch (err: any) {
      const msg =
        err instanceof PaystackError
          ? err.message
          : "Failed to verify Paystack transaction";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // --- Seed / upsert OrphanPayment row ---
    const orphan = await prisma.orphanPayment.upsert({
      where: { reference: tx.reference },
      create: {
        reference: tx.reference,
        amount: tx.amount,
        currency: tx.currency,
        payload: tx as any,
        reconciled: false,
        resolutionNote: "Manually seeded from admin reconciliation tool",
      },
      update: {
        amount: tx.amount,
        currency: tx.currency,
        payload: tx as any,
        reconciled: false,
        resolutionNote:
          "Updated via manual seed from admin reconciliation tool",
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: orphan,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/admin/orphans/manual-seed] Error:", err);
    return NextResponse.json(
      { error: "Failed to seed orphan payment from Paystack" },
      { status: 500 }
    );
  }
}
