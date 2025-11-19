// app/api/orders/retry-email/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import { sendReceiptEmailWithRetry } from "@/lib/mail";

/** Exponential backoff in seconds (capped at 1h) */
function computeBackoffSeconds(attempts: number) {
  const base = 60;      // 1 minute initial
  const max = 3600;     // cap at 1 hour
  const val = base * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(val, max);
}

export async function POST(_req: NextRequest) {
  try {
    await prismaReady;

    const now = new Date();

    const pending = await prisma.receiptEmailStatus.findMany({
      where: {
        sent: false,
        OR: [{ nextRetryAt: { lte: now } }, { nextRetryAt: null }],
      },
      include: {
        order: {
          include: {
            items: true,
            customer: true,
          },
        },
      },
    });

    let processed = 0;

    for (const status of pending) {
      const order = status.order;
      if (!order) continue;

      // Build recipient (coerce possible nulls to undefined)
      let recipient:
        | {
            firstName: string;
            lastName: string;
            email: string;
            phone?: string;
            deliveryAddress?: string;
            billingAddress?: string;
          }
        | null = null;

      if (order.customer) {
        const cust = order.customer as any;
        recipient = {
          firstName: cust.firstName,
          lastName: cust.lastName,
          email: cust.email,
          phone: cust.phone ?? undefined,
          deliveryAddress: cust.deliveryAddress ?? undefined,
          billingAddress: cust.billingAddress ?? undefined,
        };
      } else if (order.guestInfo) {
        const guest = order.guestInfo as any;
        recipient = {
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          phone: guest.phone ?? undefined,
          deliveryAddress: guest.deliveryAddress ?? undefined,
          billingAddress: guest.billingAddress ?? undefined,
        };
      }

      if (!recipient) continue;

      const currency = order.currency;
      const deliveryFee = status.deliveryFee ?? 0;

      try {
        await sendReceiptEmailWithRetry({
          order,
          recipient,
          currency,
          deliveryFee,
        });

        await prisma.receiptEmailStatus.update({
          where: { orderId: order.id },
          data: {
            sent: true,
            lastError: null,
            nextRetryAt: null,
          },
        });
      } catch (err: any) {
        const newAttempts = status.attempts + 1;
        const backoffSec = computeBackoffSeconds(newAttempts);
        const nextRetry = new Date(Date.now() + backoffSec * 1000);

        await prisma.receiptEmailStatus.update({
          where: { orderId: order.id },
          data: {
            attempts: newAttempts,
            lastError: (err?.message || String(err)).slice(0, 1000),
            nextRetryAt: nextRetry,
          },
        });

        console.warn(
          `Retry for order ${order.id} failed — scheduling next at ${nextRetry.toISOString()}`
        );
      }

      processed += 1;
    }

    return NextResponse.json({ processed }, { status: 200 });
  } catch (err) {
    console.error("Retry receipts error:", err);
    return NextResponse.json(
      { error: "Failed to process receipt email retries" },
      { status: 500 }
    );
  }
}
