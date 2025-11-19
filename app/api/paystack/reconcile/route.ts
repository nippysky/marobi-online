// app/api/paystack/reconcile/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import { verifyTransaction, refundTransaction } from "@/lib/paystack";

const RECONCILE_SECRET = process.env.RECONCILE_SECRET || "";

function requireAuth(req: NextRequest): boolean {
  const header = req.headers.get("x-reconcile-secret") || "";
  return Boolean(RECONCILE_SECRET) && header === RECONCILE_SECRET;
}

export async function POST(req: NextRequest) {
  try {
    await prismaReady;

    if (!RECONCILE_SECRET) {
      console.error("Reconcile secret not configured.");
      return NextResponse.json(
        { error: "Reconcile secret not configured" },
        { status: 500 }
      );
    }

    if (!requireAuth(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null as any);
    const reference: string | undefined = body?.reference;
    if (!reference || typeof reference !== "string") {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }

    // Look up orphan (may not exist yet)
    const orphan = await prisma.orphanPayment.findUnique({
      where: { reference },
    });

    // Verify the transaction with Paystack (authoritative)
    let tx: any;
    try {
      tx = await verifyTransaction(reference);
    } catch (err: any) {
      console.error("Failed to verify transaction during reconciliation:", err);
      return NextResponse.json(
        { error: `Failed to verify transaction: ${err?.message || String(err)}` },
        { status: 400 }
      );
    }

    // If order exists, reconcile payment metadata and mark orphan as resolved if needed
    const existingOrder = await prisma.order.findUnique({
      where: { paymentReference: reference },
      include: { customer: true },
    });

    if (existingOrder) {
      if (orphan && !orphan.reconciled) {
        await prisma.orphanPayment.update({
          where: { reference },
          data: {
            reconciled: true,
            reconciledAt: new Date(),
            resolutionNote: "Manual reconcile: order already existed",
            payload: tx as any,
          },
        });
      }

      const updates: Record<string, any> = {};
      if (!existingOrder.paymentVerified) updates.paymentVerified = true;

      const txIdStr = tx?.id != null ? String(tx.id) : null;
      if (txIdStr && existingOrder.paymentProviderId !== txIdStr) {
        updates.paymentProviderId = txIdStr;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.order.update({
          where: { id: existingOrder.id },
          data: updates,
        });
      }

      return NextResponse.json({
        ok: true,
        message: "Order already exists; reconciled if needed",
      });
    }

    // No order exists for this payment
    if (orphan && orphan.resolutionNote?.includes("Auto-refunded")) {
      return NextResponse.json({
        ok: true,
        message: "Orphan payment already auto-refunded previously",
      });
    }

    // Auto-refund orphan payment and audit
    try {
      const refund = await refundTransaction({
        transaction: tx.id,
        reason:
          "Orphan payment: no matching order found during manual reconciliation",
      });

      const resolutionNote = `Auto-refunded orphan payment during manual reconciliation; refund id=${refund?.id ?? "unknown"}`;

      if (orphan) {
        await prisma.orphanPayment.update({
          where: { reference },
          data: {
            reconciled: true,
            reconciledAt: new Date(),
            resolutionNote,
            payload: tx as any,
          },
        });
      } else {
        await prisma.orphanPayment.create({
          data: {
            reference,
            amount: tx.amount,
            currency: tx.currency,
            payload: tx as any,
            reconciled: true,
            reconciledAt: new Date(),
            resolutionNote,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        message: "Orphan payment refunded",
      });
    } catch (refundErr: any) {
      console.error(
        "Refund failed during manual reconciliation:",
        refundErr
      );
      return NextResponse.json(
        {
          error: "Refund failed",
          details: refundErr?.message || String(refundErr),
        },
        { status: 500 }
      );
    }
  } catch (fatal: any) {
    console.error("Reconcile fatal error:", fatal);
    return NextResponse.json(
      { error: "Internal Server Error", detail: fatal?.message || String(fatal) },
      { status: 500 }
    );
  }
}
