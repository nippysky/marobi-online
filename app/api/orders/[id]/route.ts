// app/api/orders/[id]/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import { OrderStatus } from "@/lib/generated/prisma-client/client";
import { sendStatusEmail } from "@/lib/mail";

// Keep this in sync with your Prisma enum
const ALLOWED_STATUSES = ["Processing", "Shipped", "Delivered", "Cancelled"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await prismaReady;

  const { id: orderId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const status = body?.status as unknown;

  // Validate status
  if (!ALLOWED_STATUSES.includes(status as AllowedStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    // 1) Load existing order with items so we can adjust stock
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
            variantId: true,
            quantity: true,
          },
        },
        customer: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const currentStatus = existing.status;
    const nextStatus = status as OrderStatus;

    // If no change, don't touch stock
    if (currentStatus === nextStatus) {
      return NextResponse.json({ success: true, order: existing });
    }

    const goingToCancelled =
      currentStatus !== OrderStatus.Cancelled &&
      nextStatus === OrderStatus.Cancelled;

    const leavingCancelled =
      currentStatus === OrderStatus.Cancelled &&
      nextStatus !== OrderStatus.Cancelled;

    // 2) Transaction: adjust variant stock if crossing Cancelled boundary,
    //    then update status
    const updated = await prisma.$transaction(async (tx) => {
      if (goingToCancelled || leavingCancelled) {
        for (const item of existing.items) {
          if (goingToCancelled) {
            // Cancel → put stock back
            await tx.variant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });
          } else if (leavingCancelled) {
            // Un-cancel → take stock out again
            await tx.variant.update({
              where: { id: item.variantId },
              data: { stock: { decrement: item.quantity } },
            });
          }
        }
      }

      return tx.order.update({
        where: { id: orderId },
        data: { status: nextStatus },
        include: {
          customer: {
            select: { firstName: true, lastName: true, email: true },
          },
          // NOTE: guestInfo is a scalar Json field, so we DON'T include it here;
          // it is already part of the returned Order object.
        },
      });
    });

    // 3) Derive recipient (registered customer or guestInfo)
    let to: string | undefined;
    let name: string | undefined;

    if (updated.customer) {
      to = updated.customer.email;
      name = `${updated.customer.firstName} ${updated.customer.lastName}`.trim();
    } else if (updated.guestInfo && typeof updated.guestInfo === "object") {
      const gi = updated.guestInfo as {
        firstName?: string;
        lastName?: string;
        email?: string;
      };
      to = gi.email;
      name = `${gi.firstName ?? ""} ${gi.lastName ?? ""}`.trim();
    }

    // 4) Best-effort status email (do not fail request if email fails)
    if (to && name) {
      try {
        await sendStatusEmail({
          to,
          name,
          orderId,
          status: status as AllowedStatus,
        });
      } catch (emailErr) {
        console.warn(
          `⚠️ Failed to send status email for order ${orderId}:`,
          emailErr
        );
      }
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (err: any) {
    // Prisma not found error => 404 (extra safety)
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    console.error("Error updating order status:", err);
    return NextResponse.json({ error: "Could not update status" }, { status: 500 });
  }
}
