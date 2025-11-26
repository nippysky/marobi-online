// app/api/webhooks/shipbubble/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import {
  OrderStatus,
  ShipmentStatus,
} from "@/lib/generated/prisma-client/client";

export const runtime = "nodejs";

type ShipbubbleWebhook = {
  event?: string; // shipment.label.created | shipment.status.changed | shipment.cancelled | shipment.cod.remitted
  order_id?: string;
  status?: string; // pending | confirmed | picked_up | in_transit | completed | cancelled
  courier?: { name?: string; tracking_code?: string; [k: string]: any };
  tracking_url?: string;
  package_status?: Array<{ status?: string; datetime?: string }>;
  ship_from?: any;
  ship_to?: any;
  payment?: any;
  waybill_document?: string | null;
  date?: string;
  [k: string]: any;
};

function verifySignature(raw: string, headerSig: string | null): boolean {
  const secret = process.env.SHIPBUBBLE_WEBHOOK_SECRET || "";
  if (!secret || !headerSig) return false;
  const expected = crypto
    .createHmac("sha512", secret)
    .update(raw, "utf8")
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(headerSig, "hex")
    );
  } catch {
    return false;
  }
}

function mapShipmentStatus(s?: string): ShipmentStatus {
  const v = String(s || "").toLowerCase();
  if (v === "cancelled") return ShipmentStatus.CANCELLED;
  if (v === "completed") return ShipmentStatus.DELIVERED;
  if (v === "picked_up" || v === "in_transit") return ShipmentStatus.IN_TRANSIT;
  if (v === "pending" || v === "confirmed") return ShipmentStatus.LABEL_CREATED;
  return ShipmentStatus.LABEL_CREATED;
}

// ✅ Always return a concrete OrderStatus (no nulls)
function mapOrderStatusFromShipment(s: ShipmentStatus): OrderStatus {
  switch (s) {
    case ShipmentStatus.IN_TRANSIT:
      return OrderStatus.Shipped;
    case ShipmentStatus.DELIVERED:
      return OrderStatus.Delivered;
    case ShipmentStatus.CANCELLED:
      return OrderStatus.Cancelled;
    case ShipmentStatus.LABEL_CREATED:
    case ShipmentStatus.REQUESTED:
    default:
      return OrderStatus.Processing;
  }
}

function safeJsonMerge(a: any, b: any) {
  try {
    return { ...(typeof a === "object" && a ? a : {}), ...(b || {}) };
  } catch {
    return b;
  }
}

export async function POST(req: Request) {
  // 1) Verify signature on the raw body
  const raw = await req.text();
  const sig = req.headers.get("x-ship-signature");
  if (!verifySignature(raw, sig)) {
    console.warn("[Shipbubble Webhook] signature verification failed");
    // Return 200 to avoid noisy retries, but ignore content.
    return NextResponse.json({ received: true }, { status: 200 });
  }

  let payload: ShipbubbleWebhook;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.error("[Shipbubble Webhook] invalid JSON");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const event = payload.event || "unknown";
  const externalId = payload.order_id || "";
  const sbStatus = (payload.status || "").toLowerCase();

  if (!externalId) {
    console.warn("[Shipbubble Webhook] missing order_id");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // 2) Record webhook (idempotent-ish)
  const eventHash = crypto.createHash("sha256").update(raw, "utf8").digest("hex");
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "SHIPBUBBLE",
        eventId: eventHash,
        payload: payload as any,
      },
    });
  } catch {
    // duplicate — ignore
  }

  try {
    const newShipStatus = mapShipmentStatus(sbStatus);

    // Find existing shipment by external order id
    const existing = await prisma.shipment.findUnique({
      where: {
        provider_externalOrderId: {
          provider: "SHIPBUBBLE",
          externalOrderId: externalId,
        },
      },
      select: {
        id: true,
        orderId: true,
        status: true,
        trackingUrl: true,
        trackingNumber: true,
        order: {
          select: { id: true, deliveryDetails: true, status: true },
        },
      },
    });

    // If we can’t find a Shipment linked to this externalId, just acknowledge.
    // (Shipbubble label may have been created outside our flow.)
    if (!existing?.orderId) {
      console.warn(
        "[Shipbubble Webhook] Shipment not found for externalId:",
        externalId
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Update Shipment
    const updated = await prisma.shipment.update({
      where: {
        provider_externalOrderId: {
          provider: "SHIPBUBBLE",
          externalOrderId: externalId,
        },
      },
      data: {
        status: newShipStatus,
        courierName: payload.courier?.name || undefined,
        trackingUrl: payload.tracking_url || undefined,
        trackingNumber:
          payload.courier?.tracking_code || (payload as any)?.tracking_code || undefined,
        ...(sbStatus === "cancelled"
          ? {
              cancelledAt: new Date(),
              cancelReason:
                (payload as any)?.cancel_reason ||
                (payload as any)?.message ||
                "Cancelled via webhook",
              rawCancel: payload as any,
            }
          : { rawResponse: payload as any }),
      },
      select: {
        id: true,
        orderId: true,
        status: true,
        trackingUrl: true,
        trackingNumber: true,
      },
    });

    // Compute new OrderStatus (always concrete)
    const newOrderStatus = mapOrderStatusFromShipment(updated.status);

    // Patch deliveryDetails snapshot for UI
    const order = await prisma.order.findUnique({
      where: { id: updated.orderId },
      select: { id: true, deliveryDetails: true, status: true },
    });
    if (!order) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const dd = order.deliveryDetails ?? {};
    const patch = {
      shipbubble: {
        ...(typeof dd === "object" && dd ? (dd as any).shipbubble : {}),
        label:
          updated.status === ShipmentStatus.CANCELLED
            ? null
            : {
                order_id: externalId,
                tracking_url: updated.trackingUrl || undefined,
                tracking_number: updated.trackingNumber || undefined,
                status: sbStatus,
                updated_at: new Date().toISOString(),
              },
        last_event: event,
      },
    };
    const merged = safeJsonMerge(dd, patch);

    // ✅ TS-safe update of Order.status using { set: ... }
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: { set: newOrderStatus },
        deliveryDetails: merged as any,
      },
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[Shipbubble Webhook] handler error:", err);
    // Still reply 200 to stop noisy retries; you already logged it.
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
