export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { ShipmentProvider, ShipmentStatus } from "@/lib/generated/prisma-client/client";
import { createShipmentLabelExact } from "@/lib/shipping/shipbubble";

const HAS_LABEL = new Set<ShipmentStatus>([
  ShipmentStatus.LABEL_CREATED,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DELIVERED,
]);

function safeParse(s: unknown) {
  if (typeof s !== "string") return s ?? {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function mergeJson(a: any, b: any) {
  try {
    return {
      ...(a && typeof a === "object" ? a : {}),
      ...(b && typeof b === "object" ? b : {}),
    };
  } catch {
    return b;
  }
}

function pickFirstString(...vals: unknown[]) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function extractShipbubbleFields(dd: any) {
  const requestToken = pickFirstString(
    dd?.requestToken,
    dd?.request_token,
    dd?.quote?.quoteId,
    dd?.shipbubble?.requestToken,
    dd?.shipbubble?.request_token,
    dd?.rate?.requestToken,
    dd?.rate?.request_token,
    dd?.raw?.request_token,
    dd?.rate?.raw?.request_token
  );

  const serviceCode = pickFirstString(
    dd?.serviceCode,
    dd?.service_code,
    dd?.quote?.serviceCode,
    dd?.shipbubble?.serviceCode,
    dd?.shipbubble?.service_code,
    dd?.rate?.serviceCode,
    dd?.rate?.service_code,
    dd?.raw?.service_code,
    dd?.rate?.raw?.service_code
  );

  const courierId = pickFirstString(
    dd?.courierId,
    dd?.courier_id,
    dd?.courierCode,
    dd?.courier_code,

    dd?.shipbubble?.courierId,
    dd?.shipbubble?.courier_id,
    dd?.shipbubble?.courierCode,
    dd?.shipbubble?.courier_code,

    dd?.rate?.courierId,
    dd?.rate?.courier_id,
    dd?.rate?.courierCode,
    dd?.rate?.courier_code,

    dd?.raw?.courier_id,
    dd?.raw?.courierId,
    dd?.raw?.courierCode,
    dd?.rate?.raw?.courier_id
  );

  const courierName = pickFirstString(
    dd?.courierName,
    dd?.shipbubble?.courierName,
    dd?.rate?.courierName,
    dd?.raw?.courier_name
  );

  return { requestToken, serviceCode, courierId, courierName };
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id?: string; orderId?: string }> }
) {
  try {
    const { id: idMaybe, orderId: orderIdMaybe } = await context.params;
    const orderId = idMaybe ?? orderIdMaybe;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Missing orderId" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        deliveryDetails: true,
        shipment: { select: { status: true } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    if (order.shipment && HAS_LABEL.has(order.shipment.status)) {
      return NextResponse.json(
        { success: false, error: "Shipment label already exists for this order" },
        { status: 400 }
      );
    }

    const dd = safeParse(order.deliveryDetails) as any;

    const { requestToken, serviceCode, courierId, courierName } =
      extractShipbubbleFields(dd);

    if (!requestToken || !serviceCode || !courierId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing requestToken/serviceCode/courierId on deliveryDetails. Re-quote rates.",
          debug: {
            hasRequestToken: !!requestToken,
            hasServiceCode: !!serviceCode,
            hasCourierId: !!courierId,
            hint:
              "Ensure deliveryDetails saves requestToken + serviceCode + courierId (or courierCode) for Shipbubble orders.",
          },
        },
        { status: 400 }
      );
    }

    const resp = await createShipmentLabelExact({
      requestToken: String(requestToken),
      serviceCode: String(serviceCode),
      courierId: String(courierId),
    });

    const sbOrderId = String((resp as any)?.data?.order_id || "");
    const trackingUrl = (resp as any)?.data?.tracking_url
      ? String((resp as any).data.tracking_url)
      : null;

    const trackingNumber =
      (resp as any)?.data?.tracking_number
        ? String((resp as any).data.tracking_number)
        : (resp as any)?.data?.trackingNo
        ? String((resp as any).data.trackingNo)
        : null;

    const shipment = await prisma.shipment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        provider: ShipmentProvider.SHIPBUBBLE,
        status: ShipmentStatus.LABEL_CREATED,
        externalOrderId: sbOrderId || null,
        requestToken: String(requestToken),
        serviceCode: String(serviceCode),
        courierId: String(courierId),         // ✅ store it
        courierName: courierName || undefined,
        trackingUrl: trackingUrl || undefined,
        trackingNumber: trackingNumber || undefined,
        rawResponse: resp as any,
      },
      update: {
        provider: ShipmentProvider.SHIPBUBBLE,
        status: ShipmentStatus.LABEL_CREATED,
        externalOrderId: sbOrderId || null,
        requestToken: String(requestToken),
        serviceCode: String(serviceCode),
        courierId: String(courierId),         // ✅ store it
        courierName: courierName || undefined,
        trackingUrl: trackingUrl || undefined,
        trackingNumber: trackingNumber || undefined,
        rawResponse: resp as any,
      },
      select: {
        id: true,
        status: true,
        externalOrderId: true,
        trackingUrl: true,
        trackingNumber: true,
      },
    });

    // Patch order.deliveryDetails with label info + keep old content
    const patched = mergeJson(dd, {
      source: dd?.source || "Shipbubble",
      requestToken: dd?.requestToken || dd?.request_token || String(requestToken),
      serviceCode: dd?.serviceCode || dd?.service_code || String(serviceCode),
      courierId: dd?.courierId || dd?.courier_id || dd?.courierCode || String(courierId),
      shipbubble: {
        ...(dd?.shipbubble || {}),
        requestToken: dd?.shipbubble?.requestToken || String(requestToken),
        serviceCode: dd?.shipbubble?.serviceCode || String(serviceCode),
        courierId: dd?.shipbubble?.courierId || String(courierId),
        courierName: dd?.shipbubble?.courierName || courierName || undefined,
        label: {
          order_id: shipment.externalOrderId || undefined,
          tracking_url: shipment.trackingUrl || undefined,
          tracking_number: shipment.trackingNumber || undefined,
          created_at: new Date().toISOString(),
        },
      },
      raw: {
        ...(dd?.raw || {}),
        last_label_response: resp,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { deliveryDetails: patched as any },
    });

    return NextResponse.json({
      success: true,
      shipmentId: shipment.id,
      status: shipment.status,
      shipbubbleOrderId: shipment.externalOrderId,
      trackingUrl: shipment.trackingUrl,
      trackingNumber: shipment.trackingNumber,
    });
  } catch (err: any) {
    console.error("[create-label] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to create label" },
      { status: 400 }
    );
  }
}
