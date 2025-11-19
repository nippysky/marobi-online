// app/api/paystack/webhook/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import {
  validateWebhookSignature,
  verifyTransaction,
} from "@/lib/paystack";

/** Safe JSON parse (never throws) */
function safeParse(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  await prismaReady;

  // 1) Read raw body + signature header
  const signature = req.headers.get("x-paystack-signature") || "";
  const rawBody = await req.text();

  // 2) Validate webhook signature
  if (!validateWebhookSignature(rawBody, signature)) {
    console.warn("Invalid Paystack webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // 3) Parse body safely
  const body = safeParse(rawBody);
  if (!body) {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  const event = body?.event as string | undefined;
  const data = body?.data as { reference?: string } | undefined;
  if (!data?.reference) {
    return NextResponse.json(
      { error: "Missing reference in webhook payload" },
      { status: 400 }
    );
  }

  // 4) Dedupe: persist the webhook event (unique on eventId)
  const eventId = (body?.id as string | undefined) || `${event}:${data.reference}`;
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "paystack",
        eventId,
        payload: body, // Prisma Json field
      },
    });
  } catch (err: any) {
    // Ignore duplicates gracefully
    if (
      err?.code === "P2002" &&
      Array.isArray(err?.meta?.target) &&
      (err.meta.target as string[]).includes("eventId")
    ) {
      return NextResponse.json(
        { ok: true, message: "Duplicate event ignored" },
        { status: 200 }
      );
    }
    console.error("Failed to persist webhook event:", err);
    // Non-fatal: continue to try processing
  }

  // 5) We only handle charge.success for now; acknowledge others
  if (event !== "charge.success") {
    return NextResponse.json(
      { ok: true, message: "Event ignored" },
      { status: 200 }
    );
  }

  // 6) For charge.success: verify the transaction, reconcile or flag orphan
  try {
    const tx = await verifyTransaction(data.reference); // throws on invalid

    const existingOrder = await prisma.order.findUnique({
      where: { paymentReference: data.reference },
      include: { customer: true },
    });

    if (!existingOrder) {
      // Orphan payment recorded for later reconciliation/refund
      await prisma.orphanPayment.upsert({
        where: { reference: data.reference },
        create: {
          reference: data.reference,
          amount: tx.amount,
          currency: tx.currency,
          payload: tx as any,
          reconciled: false,
          resolutionNote: "Orphan payment recorded; awaiting manual resolution",
        },
        update: {
          payload: tx as any,
          amount: tx.amount,
          currency: tx.currency,
        },
      });

      return NextResponse.json(
        { ok: true, message: "Orphan payment recorded" },
        { status: 200 }
      );
    }

    // Patch order payment fields if needed
    const updates: Record<string, any> = {};
    if (existingOrder.paymentReference !== data.reference) {
      updates.paymentReference = data.reference;
    }
    const txIdStr = tx?.id != null ? String(tx.id) : null;
    if (txIdStr && existingOrder.paymentProviderId !== txIdStr) {
      updates.paymentProviderId = txIdStr;
    }
    if (!existingOrder.paymentVerified) {
      updates.paymentVerified = true;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.order.update({
        where: { id: existingOrder.id },
        data: updates,
      });
    }

    // Mark any orphans for this reference as reconciled
    await prisma.orphanPayment.updateMany({
      where: { reference: data.reference },
      data: {
        reconciled: true,
        reconciledAt: new Date(),
        resolutionNote: "Payment matched to existing order",
      },
    });

    return NextResponse.json(
      { ok: true, message: "Processed charge.success" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error handling charge.success webhook:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
