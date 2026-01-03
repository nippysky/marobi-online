// app/api/offline-sales/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import {
  Prisma,
  Currency as CurrencyEnum,
  OrderChannel,
  OrderStatus,
} from "@/lib/generated/prisma-client/client";
import { sendGenericEmail } from "@/lib/mail";

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */
type IncomingItem = {
  productId: string;
  color: string; // "N/A" allowed
  size: string; // "N/A" allowed
  quantity: number;
  hasSizeMod?: boolean;
  customSize?: {
    chest?: string;
    hips?: string;
    length?: string;
    waist?: string;
  };
};

type IncomingCustomer = {
  id?: string; // existing customer id (optional)
  firstName?: string; // required for guests
  lastName?: string; // required for guests
  email?: string; // required for guests
  phone?: string; // required for guests
  address?: string;
  country?: string;
  state?: string;
};

/* ────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────── */

/** Format sequential numeric serial into branded order id: M-ORD-001, 002, ... */
function formatOrderIdFromSerial(serial: bigint | number): string {
  const s = typeof serial === "bigint" ? serial.toString() : String(serial);
  return `M-ORD-${s.padStart(3, "0")}`;
}

const CURRENCIES = ["NGN", "USD", "EUR", "GBP"] as const;
type CurrencyCode = (typeof CURRENCIES)[number];

/** Safely coerce unknown to Prisma JSON input */
function toPrismaJson(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  try {
    JSON.stringify(value);
    return value as Prisma.InputJsonValue;
  } catch {
    return JSON.parse(
      JSON.stringify({ invalid: true, original: String(value) })
    ) as Prisma.InputJsonValue;
  }
}

function safeJsonParse(input: unknown): unknown {
  if (typeof input !== "string") return input;
  const t = input.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return input;
  try {
    return JSON.parse(t);
  } catch {
    return input;
  }
}

function isShipbubbleDetails(dd: unknown): boolean {
  const obj = safeJsonParse(dd);
  if (!obj || typeof obj !== "object") return false;

  const anyObj: any = obj;
  const src = String(anyObj?.source ?? "").toLowerCase();
  if (src === "shipbubble") return true;

  // common markers from different shapes
  if (anyObj?.shipbubble) return true;
  if (anyObj?.requestToken || anyObj?.request_token) return true;
  if (anyObj?.courierId || anyObj?.courier_id) return true;
  if (anyObj?.serviceCode || anyObj?.service_code) return true;
  if (anyObj?.quote?.quoteId) return true;
  if (anyObj?.rate?.courierName || anyObj?.rate?.serviceCode) return true;

  return false;
}

function normalizeShipbubbleDeliveryDetails(dd: unknown): unknown {
  const parsed = safeJsonParse(dd);

  // leave non-objects (e.g. "PICKUP: ...") untouched
  if (!parsed || typeof parsed !== "object") return parsed;

  const o: any = parsed;

  const requestToken =
    o?.quote?.quoteId ??
    o?.shipbubble?.requestToken ??
    o?.requestToken ??
    o?.request_token ??
    o?.raw?.request_token ??
    null;

  const serviceCode =
    o?.quote?.serviceCode ??
    o?.shipbubble?.serviceCode ??
    o?.rate?.serviceCode ??
    o?.serviceCode ??
    o?.service_code ??
    o?.raw?.service_code ??
    null;

  const courierId =
    o?.shipbubble?.courierId ??
    o?.shipbubble?.courier_id ??
    o?.shipbubble?.courierCode ?? // ✅ ADD
    o?.shipbubble?.courier_code ?? // ✅ ADD
    o?.rate?.courierId ??
    o?.rate?.courier_id ??
    o?.rate?.courierCode ?? // ✅ ADD
    o?.rate?.courier_code ?? // ✅ ADD
    o?.courierId ??
    o?.courier_id ??
    o?.courierCode ?? // ✅ ADD
    o?.courier_code ?? // ✅ ADD
    o?.raw?.courier_id ??
    o?.raw?.courierId ??
    o?.raw?.courierCode ?? // ✅ ADD
    null;

  const courierName =
    o?.shipbubble?.courierName ??
    o?.rate?.courierName ??
    o?.courierName ??
    o?.raw?.courier_name ??
    null;

  // Merge without destroying existing data
  const shipbubble = {
    ...(o?.shipbubble && typeof o.shipbubble === "object" ? o.shipbubble : {}),
    ...(requestToken ? { requestToken: String(requestToken) } : {}),
    ...(serviceCode ? { serviceCode: String(serviceCode) } : {}),
    ...(courierId ? { courierId: String(courierId) } : {}),
    ...(courierName ? { courierName: String(courierName) } : {}),
  };

  const out = {
    ...o,
    source: "Shipbubble", // helps your email + makes it consistent
    ...(requestToken ? { requestToken: String(requestToken) } : {}),
    ...(serviceCode ? { serviceCode: String(serviceCode) } : {}),
    ...(courierId ? { courierId: String(courierId) } : {}),
    ...(courierName ? { courierName: String(courierName) } : {}),
    shipbubble,
    raw: {
      ...(o?.raw && typeof o.raw === "object" ? o.raw : {}),
      normalized_at: new Date().toISOString(),
    },
  };

  return out;
}

/* ────────────────────────────────────────────────────────────
   POST /api/offline-sales
   ──────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    await prismaReady;

    const {
      items,
      customer,
      paymentMethod,
      currency,
      staffId,
      timestamp,
      deliveryOptionId,
      deliveryFee: incomingDeliveryFee,
      deliveryDetails,
    }: {
      items: IncomingItem[];
      customer?: IncomingCustomer;
      paymentMethod: string;
      currency: string;
      staffId: string;
      timestamp?: string | number | Date;
      deliveryOptionId?: string;
      deliveryFee?: number;
      deliveryDetails?: unknown;
    } = await req.json();

    // ── Basic validations
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }
    if (!paymentMethod || typeof paymentMethod !== "string") {
      return NextResponse.json(
        { error: "paymentMethod is required" },
        { status: 400 }
      );
    }
    if (!staffId || typeof staffId !== "string") {
      return NextResponse.json(
        { error: "staffId is required" },
        { status: 400 }
      );
    }
    if (!CURRENCIES.includes(currency as CurrencyCode)) {
      return NextResponse.json(
        { error: "Invalid or missing currency" },
        { status: 400 }
      );
    }
    const currencyEnum = currency as CurrencyEnum;

    // ── Validate staff
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    // ── Resolve customer (existing or guest)
    let customerId: string | null = null;
    let existingCustomer:
      | { firstName: string; lastName: string; email: string }
      | undefined;
    let guestInfo:
      | {
          firstName: string;
          lastName: string;
          email: string;
          phone: string;
          address?: string;
          country?: string;
          state?: string;
        }
      | undefined;

    if (customer?.id) {
      const found = await prisma.customer.findUnique({
        where: { id: customer.id },
      });
      if (!found) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }
      customerId = found.id;
      existingCustomer = {
        firstName: found.firstName,
        lastName: found.lastName,
        email: found.email,
      };
    } else {
      if (
        !customer?.firstName ||
        !customer?.lastName ||
        !customer?.email ||
        !customer?.phone
      ) {
        return NextResponse.json(
          { error: "Guest customer info incomplete" },
          { status: 400 }
        );
      }
      guestInfo = {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address || "",
        country: customer.country || "",
        state: customer.state || "",
      };
    }

    // ── Normalize + detect Shipbubble delivery JSON (important!)
    const shipbubbleUsed = isShipbubbleDetails(deliveryDetails);
    const normalizedDeliveryDetails = shipbubbleUsed
      ? normalizeShipbubbleDeliveryDetails(deliveryDetails)
      : safeJsonParse(deliveryDetails);

    // ── Optional delivery option
    // FIX: If Shipbubble is used but deliveryOptionId wasn't passed,
    // auto-attach an active deliveryOption whose provider/name indicates Shipbubble.
    let deliveryOptionRecord: | { id: string; baseFee: number | null } | null =
      null;

    if (deliveryOptionId) {
      const opt = await prisma.deliveryOption.findUnique({
        where: { id: deliveryOptionId },
      });
      if (!opt || !opt.active) {
        return NextResponse.json(
          { error: "Invalid or inactive delivery option" },
          { status: 400 }
        );
      }
      deliveryOptionRecord = { id: opt.id, baseFee: opt.baseFee ?? null };
    } else if (shipbubbleUsed) {
      const opt = await prisma.deliveryOption.findFirst({
        where: {
          active: true,
          OR: [
            // provider matches (recommended)
            { provider: { equals: "shipbubble", mode: "insensitive" } },
            // fallback: name contains shipbubble
            { name: { contains: "shipbubble", mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "asc" as any },
      });

      if (opt) {
        deliveryOptionRecord = { id: opt.id, baseFee: opt.baseFee ?? null };
      }
      // If none exists, we won't block the order creation—
      // BUT (important) your admin UI "Create Label" button relies on deliveryOption.provider,
      // so you should ensure you have at least one Shipbubble deliveryOption in DB.
    }

    // Normalize JSON input for Prisma storage
    const deliveryDetailsInput = toPrismaJson(normalizedDeliveryDetails);

    // ─────────────────────────────────────────────────────────
    // Transaction: stock checks → reserve serial → create order
    // ─────────────────────────────────────────────────────────
    const { order, lineItems } = await prisma.$transaction(
      async (tx) => {
        // Pre-validate items
        for (const it of items) {
          if (
            !it.productId ||
            typeof it.quantity !== "number" ||
            it.quantity <= 0 ||
            typeof it.color !== "string" ||
            typeof it.size !== "string"
          ) {
            throw new Error("Invalid item format");
          }
        }

        // Bulk-load variants
        const variantFilters = items.map((it) => {
          const where: any = { productId: it.productId };
          if (it.color !== "N/A") where.color = it.color;
          if (it.size !== "N/A") where.size = it.size;
          return where;
        });

        const variants = await tx.variant.findMany({
          where: { OR: variantFilters },
          include: { product: true },
        });

        const keyOf = (pId: string, color: string, size: string) =>
          `${pId}|${(color || "N/A").trim()}|${(size || "N/A").trim()}`;

        const variantMap = new Map<string, (typeof variants)[number]>();
        for (const v of variants) {
          variantMap.set(
            keyOf(v.productId, v.color || "N/A", v.size || "N/A"),
            v
          );
        }

        let totalAmount = 0; // in selected currency
        let totalNGN = 0; // mirror in NGN
        const itemsCreateData: any[] = [];

        for (const raw of items) {
          const vKey = keyOf(raw.productId, raw.color, raw.size);
          const variant = variantMap.get(vKey);
          if (!variant)
            throw new Error(
              `Variant not found: ${raw.productId} ${raw.color}/${raw.size}`
            );
          if (variant.stock < raw.quantity)
            throw new Error(`Insufficient stock for ${variant.product.name}`);

          // decrement stock
          await tx.variant.update({
            where: { id: variant.id },
            data: { stock: { decrement: raw.quantity } },
          });

          // unit price in selected currency
          let unitPrice = 0;
          switch (currencyEnum) {
            case "USD":
              unitPrice = variant.product.priceUSD ?? 0;
              break;
            case "EUR":
              unitPrice = variant.product.priceEUR ?? 0;
              break;
            case "GBP":
              unitPrice = variant.product.priceGBP ?? 0;
              break;
            case "NGN":
            default:
              unitPrice = variant.product.priceNGN ?? 0;
              break;
          }

          // size mod (5%) only if product allows and user requested
          let lineTotal = unitPrice * raw.quantity;
          const applicableSizeMod =
            !!raw.hasSizeMod && !!variant.product.sizeMods;
          const sizeModFee = applicableSizeMod
            ? +(unitPrice * raw.quantity * 0.05).toFixed(2)
            : 0;
          if (applicableSizeMod) lineTotal += sizeModFee;

          totalAmount += lineTotal;
          const ngnUnit = variant.product.priceNGN ?? 0;
          totalNGN += ngnUnit * raw.quantity;

          const orderItem: any = {
            variantId: variant.id,
            name: variant.product.name,
            image: Array.isArray(variant.product.images)
              ? variant.product.images[0] ?? null
              : null,
            category: variant.product.categorySlug,
            quantity: raw.quantity,
            currency: currencyEnum,
            lineTotal,
            color: variant.color || "N/A",
            size: variant.size || "N/A",
            hasSizeMod: applicableSizeMod,
            sizeModFee,
          };
          if (applicableSizeMod && raw.customSize) {
            orderItem.customSize = raw.customSize;
          }
          itemsCreateData.push(orderItem);
        }

        // delivery fee: request override > option.baseFee > 0
        const resolvedDeliveryFee =
          typeof incomingDeliveryFee === "number"
            ? incomingDeliveryFee
            : deliveryOptionRecord?.baseFee ?? 0;

        // ── Reserve the next sequential serial and format the branded ID
        const nextSerial = await tx.orderSerial.create({ data: {} });
        const orderId = formatOrderIdFromSerial(nextSerial.id);

        if (!/^M-ORD-\d{3,}$/.test(orderId)) {
          throw new Error(
            `Order ID formatting failed for serial ${nextSerial.id}`
          );
        }

        const createdOrder = await tx.order.create({
          data: {
            id: orderId,
            status: OrderStatus.Processing,
            currency: currencyEnum,
            totalAmount, // items only
            totalNGN: Math.round(totalNGN),
            paymentMethod,
            createdAt: timestamp ? new Date(timestamp) : new Date(),
            ...(customerId ? { customerId } : {}),
            staffId,
            channel: OrderChannel.OFFLINE,
            items: { create: itemsCreateData },
            ...(guestInfo ? { guestInfo } : {}),
            receiptEmailStatus: {
              create: {
                attempts: 0,
                sent: false,
                deliveryFee: resolvedDeliveryFee,
              },
            },
            ...(deliveryOptionRecord
              ? { deliveryOptionId: deliveryOptionRecord.id }
              : {}),
            deliveryFee: resolvedDeliveryFee,
            ...(deliveryDetailsInput !== undefined
              ? { deliveryDetails: deliveryDetailsInput }
              : {}),
          },
          include: {
            items: true,
            customer: true,
            deliveryOption: true, // <-- include for email summary
          },
        });

        await tx.offlineSale.create({
          data: {
            orderId: createdOrder.id,
            staffId,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
          },
        });

        return { order: createdOrder, lineItems: itemsCreateData };
      },
      { timeout: 15_000 }
    );

    // ── Best-effort receipt email (updates ReceiptEmailStatus if present)
    let to: string | undefined,
      name: string | undefined;
    if (existingCustomer) {
      to = existingCustomer.email;
      name = `${existingCustomer.firstName} ${existingCustomer.lastName}`;
    } else if (guestInfo) {
      to = guestInfo.email;
      name = `${guestInfo.firstName} ${guestInfo.lastName}`;
    }

    if (to && name) {
      const receiptStatus = await prisma.receiptEmailStatus.findUnique({
        where: { orderId: order.id },
      });

      try {
        // ✅ VAT REMOVED: totals are now Subtotal + Delivery only
        const subtotal = +order.totalAmount.toFixed(2);
        const deliveryCharge = order.deliveryFee ?? 0;
        const grandTotal = +(subtotal + deliveryCharge).toFixed(2);

        const sym =
          order.currency === "NGN"
            ? "₦"
            : order.currency === "USD"
            ? "$"
            : order.currency === "EUR"
            ? "€"
            : "£";

        // ── Delivery summary for email (method + details)
        let deliveryMethodLabel = "Not specified";
        let deliveryDetailsText = "";

        // From relation (normal courier option)
        if (order.deliveryOption) {
          deliveryMethodLabel = order.deliveryOption.name;
          if (order.deliveryOption.provider) {
            deliveryMethodLabel += ` (${order.deliveryOption.provider})`;
          }
        }

        // From JSON deliveryDetails (pickup or Shipbubble)
        const rawDetails = order.deliveryDetails as any;

        if (typeof rawDetails === "string" && rawDetails) {
          if (rawDetails.toUpperCase().startsWith("PICKUP")) {
            if (!order.deliveryOption) {
              deliveryMethodLabel = "In-person pickup";
            }
            deliveryDetailsText = rawDetails;
          } else {
            deliveryDetailsText = rawDetails;
          }
        } else if (rawDetails && typeof rawDetails === "object") {
          // normalized: source === "Shipbubble"
          if (rawDetails.source === "Shipbubble") {
            const rate = rawDetails.rate || {};
            const note = rawDetails.note;
            if (!order.deliveryOption) {
              deliveryMethodLabel = "Shipbubble Delivery";
            }

            const courierName =
              rate.courierName || rawDetails.courierName || "Courier";
            const serviceCode = (rate.serviceCode || rawDetails.serviceCode)
              ? ` (${rate.serviceCode || rawDetails.serviceCode})`
              : "";
            const eta = rate.eta ? ` • ETA: ${rate.eta}` : "";
            const feePart =
              typeof rate.fee === "number"
                ? ` • Quoted fee: ${sym}${Number(rate.fee).toLocaleString()}`
                : "";

            deliveryDetailsText = `${courierName}${serviceCode}${eta}${feePart}`;
            if (note) {
              deliveryDetailsText += ` • Note: ${note}`;
            }
          } else {
            try {
              deliveryDetailsText = JSON.stringify(rawDetails);
            } catch {
              deliveryDetailsText = "";
            }
          }
        }

        const deliveryBlockHtml =
          deliveryMethodLabel === "Not specified" &&
          deliveryCharge === 0 &&
          !deliveryDetailsText
            ? ""
            : `
            <h3 style="margin-top:24px;margin-bottom:8px">Delivery</h3>
            <p style="margin:4px 0">
              Method:
              <strong> ${deliveryMethodLabel}</strong>
            </p>
            <p style="margin:4px 0">
              Delivery fee:
              <strong> ${sym}${deliveryCharge.toLocaleString()}</strong>
            </p>
            ${
              deliveryDetailsText
                ? `<p style="margin:4px 0">Details: ${deliveryDetailsText}</p>`
                : ""
            }
          `;

        const bodyHtml = `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#333">
            <h2 style="margin-bottom:12px">Your Receipt — ${order.id}</h2>
            <p>Hi ${name},<br/>Thank you for your purchase!</p>

            <p>Here’s what you bought in order <strong>${order.id}</strong>:</p>
            <table width="100%" cellpadding="4" cellspacing="0" style="border-collapse:collapse">
              ${order.items
                .map(
                  (p: any) => `
                <tr style="border-bottom:1px solid #e1e1e1">
                  <td style="vertical-align:middle">
                    ${
                      p.image
                        ? `<img src="${p.image}" width="40" alt="" style="vertical-align:middle;border-radius:4px;margin-right:8px" />`
                        : ""
                    }
                    ${p.name} × ${p.quantity}<br/>
                    <small>
                      Color: ${p.color} &bull; Size: ${p.size}
                      ${
                        p.hasSizeMod
                          ? `&bull; Custom Size (5%): ${sym}${Number(
                              p.sizeModFee
                            ).toFixed(2)}`
                          : ""
                      }
                    </small>
                  </td>
                  <td align="right" style="font-family:monospace">
                    ${sym}${Number(p.lineTotal).toLocaleString()}
                  </td>
                </tr>`
                )
                .join("")}
            </table>

            ${deliveryBlockHtml}

            <div style="margin-top:24px;font-family:monospace">
              <p style="margin:6px 0">Subtotal: <strong>${sym}${subtotal.toLocaleString()}</strong></p>
              <p style="margin:6px 0">Delivery: <strong>${sym}${deliveryCharge.toLocaleString()}</strong></p>
              <p style="margin:6px 0">Grand Total: <strong>${sym}${grandTotal.toLocaleString()}</strong></p>
            </div>

            <p style="margin-top:32px;font-size:12px;color:#777">
              Your order is currently being processed. If you have any questions, just reply to this email.
            </p>
          </div>
        `;

        await sendGenericEmail({
          to,
          subject: `Thank you for shopping! Order ${order.id}`,
          title: `Your Receipt — ${order.id}`,
          intro: `Hi ${name},<br/>Thank you for your purchase!`,
          bodyHtml,
          button: {
            label: "View Your Orders",
            url: `${
              process.env.NEXTAUTH_URL ?? "http://localhost:3000"
            }/account`,
          },
          preheader: `Your order ${order.id} is being processed.`,
          footerNote: "If you have any questions, just reply to this email.",
        });

        if (receiptStatus) {
          await prisma.receiptEmailStatus.update({
            where: { orderId: order.id },
            data: {
              attempts: { increment: 1 },
              sent: true,
              lastError: null,
              nextRetryAt: null,
            },
          });
        }
      } catch (emailErr: any) {
        console.warn("Failed to send receipt email:", emailErr);
        const receiptStatus2 = await prisma.receiptEmailStatus.findUnique({
          where: { orderId: order.id },
        });
        if (receiptStatus2) {
          const attempts = receiptStatus2.attempts;
          const delayMs = Math.min(
            24 * 60 * 60 * 1000,
            60 * 60 * 1000 * Math.pow(2, attempts)
          );
          const nextRetryAt = new Date(Date.now() + delayMs);
          await prisma.receiptEmailStatus.update({
            where: { orderId: order.id },
            data: {
              attempts: { increment: 1 },
              sent: false,
              lastError: String(emailErr?.message || emailErr),
              nextRetryAt,
            },
          });
        }
      }
    }

    return NextResponse.json(
      { success: true, orderId: order.id },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Offline-sale POST error:", err);
    const msg =
      typeof err?.message === "string" && err.message.startsWith("Insufficient")
        ? err.message
        : "Internal Server Error";
    const status = msg === "Internal Server Error" ? 500 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
