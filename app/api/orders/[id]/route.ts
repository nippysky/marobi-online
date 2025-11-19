// app/api/orders/[id]/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import { OrderStatus } from "@/lib/generated/prisma-client";
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
    // Update order and include customer relation for notification
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: status as OrderStatus },
      include: {
        customer: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    // Derive recipient (registered customer or guestInfo)
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

    // Best-effort status email (do not fail request if email fails)
    if (to && name) {
      try {
        await sendStatusEmail({
          to,
          name,
          orderId,
          status: status as AllowedStatus,
        });
      } catch (emailErr) {
        console.warn(`⚠️ Failed to send status email for order ${orderId}:`, emailErr);
      }
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (err: any) {
    // Prisma not found error => 404
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    console.error("Error updating order status:", err);
    return NextResponse.json({ error: "Could not update status" }, { status: 500 });
  }
}
