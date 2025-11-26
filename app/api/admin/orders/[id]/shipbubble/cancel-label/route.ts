export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { ShipmentStatus } from "@/lib/generated/prisma-client/client";
import { cancelShipmentLabel } from "@/lib/shipping/shipbubble";

function safeParse(s: unknown) {
  if (typeof s !== "string") return s ?? {};
  try { return JSON.parse(s); } catch { return {}; }
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id?: string; orderId?: string }> }
) {
  try {
    const { id: idMaybe, orderId: orderIdMaybe } = await context.params;
    const orderId = idMaybe ?? orderIdMaybe;
    if (!orderId) {
      return NextResponse.json({ success: false, error: "Missing orderId" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, deliveryDetails: true, shipment: { select: { externalOrderId: true } } },
    });
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });

    if (!order.shipment?.externalOrderId) {
      return NextResponse.json(
        { success: false, error: "No Shipbubble label exists for this order" },
        { status: 400 }
      );
    }

    await cancelShipmentLabel(order.shipment.externalOrderId);

    await prisma.shipment.update({
      where: { orderId: order.id },
      data: {
        status: ShipmentStatus.CANCELLED,
        cancelledAt: new Date(),
        rawCancel: { at: new Date().toISOString() },
        trackingUrl: null,
        trackingNumber: null,
      },
    });

    const dd = safeParse(order.deliveryDetails) as any;
    await prisma.order.update({
      where: { id: order.id },
      data: {
        deliveryDetails: {
          ...(dd || {}),
          shipbubble: {
            ...(dd?.shipbubble || {}),
            label: null,
            canceled_at: new Date().toISOString(),
          },
        } as any,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[cancel-label] error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to cancel label" }, { status: 400 });
  }
}
