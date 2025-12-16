// app/api/admin/orders/[id]/shipbubble/status/route.ts

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { listShipmentsByIds, mapShipbubbleStatus } from "@/lib/shipping/shipbubble";
import { ShipmentStatus } from "@/lib/generated/prisma-client/client";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id?: string; orderId?: string }> }
) {
  let order: {
    id: string;
    shipment: {
      externalOrderId: string | null;
      status: ShipmentStatus;
      trackingUrl: string | null;
      trackingNumber: string | null;
    } | null;
  } | null = null;

  try {
    const { id: idMaybe, orderId: orderIdMaybe } = await context.params;
    const orderId = idMaybe ?? orderIdMaybe;
    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        shipment: {
          select: {
            externalOrderId: true,
            status: true,
            trackingUrl: true,
            trackingNumber: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // No local shipment at all → no label
    if (!order.shipment?.externalOrderId) {
      return NextResponse.json({ hasLabel: false, status: null, trackingUrl: null });
    }

    // ✅ FAST + NO-RETRY for polling
    let list: any[] = [];
    try {
      list = await listShipmentsByIds([order.shipment.externalOrderId], {
        timeoutMs: 5000,
        retry: 1, // one attempt only
      });
    } catch (e: any) {
      // ✅ Don’t fail the endpoint for polling — fallback to local DB
      const hasLocal =
        !!order.shipment && order.shipment.status !== ShipmentStatus.CANCELLED;
      return NextResponse.json({
        hasLabel: hasLocal,
        status: order.shipment?.status ?? null,
        trackingUrl: order.shipment?.trackingUrl ?? null,
        degraded: true,
        reason: "shipbubble_unreachable",
      });
    }

    const remote = list.find(
      (r) => String(r.order_id) === String(order!.shipment!.externalOrderId)
    );

    if (!remote) {
      const hasLocal =
        !!order.shipment && order.shipment.status !== ShipmentStatus.CANCELLED;
      return NextResponse.json({
        hasLabel: hasLocal,
        status: order.shipment?.status ?? null,
        trackingUrl: order.shipment?.trackingUrl ?? null,
      });
    }

    const mapped = mapShipbubbleStatus(remote.status);

    if (
      mapped !== order.shipment.status ||
      remote.tracking_url !== order.shipment.trackingUrl
    ) {
      await prisma.shipment.update({
        where: { orderId: order.id },
        data: {
          status: mapped,
          trackingUrl: remote.tracking_url ?? null,
          trackingNumber:
            remote?.courier?.tracking_code ?? order.shipment.trackingNumber ?? null,
          updatedAt: new Date(),
        },
      });
    }

    const hasLabel = mapped !== ShipmentStatus.CANCELLED && mapped !== ShipmentStatus.FAILED;

    return NextResponse.json({
      hasLabel,
      status: mapped,
      trackingUrl: remote.tracking_url ?? null,
    });
  } catch (err: any) {
    console.error("[shipbubble status] error:", err);

    // ✅ Final fallback: still return 200 so dashboard doesn’t lag/crash
    const hasLocal =
      !!order?.shipment && order.shipment.status !== ShipmentStatus.CANCELLED;

    return NextResponse.json(
      {
        hasLabel: hasLocal,
        status: order?.shipment?.status ?? null,
        trackingUrl: order?.shipment?.trackingUrl ?? null,
        degraded: true,
        reason: "status_route_error",
      },
      { status: 200 }
    );
  }
}
