// app/api/orders/online/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import {
  Currency as CurrencyEnum,
  OrderChannel,
  OrderStatus,
} from "@/lib/generated/prisma-client/client";
import { sendReceiptEmailWithRetry } from "@/lib/mail";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { verifyTransaction, PaystackError } from "@/lib/paystack";
import type {
  CartItemPayload,
  CustomerPayload,
} from "@/lib/hooks/useCheckout";

const ALLOWED_CURRENCIES = ["NGN", "USD", "EUR", "GBP"] as const;
type AllowedCurrency = (typeof ALLOWED_CURRENCIES)[number];

function toLowest(amount: number): number {
  return Math.round(amount * 100);
}

type ShipbubbleShippingPayload = {
  requestToken: string;
  serviceCode: string;
  courierId?: string;
  fee?: number;
  currency?: "NGN" | "USD" | "EUR" | "GBP";
  courierName?: string;
  meta?: any;
};

interface OnlineOrderPayload {
  items: CartItemPayload[];
  customer: CustomerPayload;
  paymentMethod: string;
  currency: string;
  timestamp?: string;
  deliveryFee?: number;
  deliveryOptionId?: string | null;
  paymentReference: string;
  shipping?: {
    source?: "shipbubble" | string;
    shipbubble?: ShipbubbleShippingPayload;
  };
}

function formatOrderIdFromSerial(serial: bigint | number): string {
  const n = typeof serial === "bigint" ? Number(serial) : serial;
  return `M-ORD-${String(n).padStart(3, "0")}`;
}

export async function POST(req: NextRequest) {
  await prismaReady;

  let requestPaymentReference: string | undefined;

  try {
    const payload: OnlineOrderPayload = await req.json();
    const {
      items,
      customer,
      paymentMethod,
      currency,
      timestamp,
      deliveryFee = 0,
      deliveryOptionId,
      paymentReference,
      shipping,
    } = payload;

    requestPaymentReference = paymentReference;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }
    if (!customer || !customer.email) {
      return NextResponse.json(
        { error: "Customer email is required" },
        { status: 400 }
      );
    }
    if (!paymentReference || typeof paymentReference !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid paymentReference" },
        { status: 400 }
      );
    }

    const normalizedCurrency = (currency || "").toString().toUpperCase();
    if (!ALLOWED_CURRENCIES.includes(normalizedCurrency as AllowedCurrency)) {
      return NextResponse.json(
        { error: `Unsupported currency: ${currency}` },
        { status: 400 }
      );
    }

    let paystackTx: any;
    try {
      paystackTx = await verifyTransaction(paymentReference);
    } catch (err: any) {
      const msg =
        err instanceof PaystackError
          ? `Payment verification failed: ${err.message}`
          : "Payment verification failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (String(paystackTx.currency).toUpperCase() !== normalizedCurrency) {
      return NextResponse.json(
        {
          error: `Currency mismatch: expected ${normalizedCurrency}, got ${paystackTx.currency}`,
        },
        { status: 400 }
      );
    }

    const isShipbubbleFlow =
      shipping?.source === "shipbubble" && !!shipping?.shipbubble;

    if (deliveryOptionId && !isShipbubbleFlow) {
      const deliveryOpt = await prisma.deliveryOption.findUnique({
        where: { id: deliveryOptionId },
      });
      if (!deliveryOpt) {
        return NextResponse.json(
          { error: "Invalid deliveryOptionId provided" },
          { status: 400 }
        );
      }
      if (!deliveryOpt.active) {
        return NextResponse.json(
          { error: "Delivery option is not active" },
          { status: 400 }
        );
      }
    }

    const existingOrder = await prisma.order.findUnique({
      where: { paymentReference },
      include: {
        customer: true,
      },
    });

    if (existingOrder) {
      const updates: Record<string, any> = {};
      if (!existingOrder.paymentVerified) updates.paymentVerified = true;
      if (existingOrder.paymentProviderId !== String(paystackTx.id)) {
        updates.paymentProviderId = String(paystackTx.id);
      }
      if (Object.keys(updates).length > 0) {
        await prisma.order.update({
          where: { id: existingOrder.id },
          data: updates,
        });
      }

      try {
        const fullOrder = await prisma.order.findUnique({
          where: { id: existingOrder.id },
          include: {
            items: true,
            customer: true,
          },
        });

        if (fullOrder) {
          const recipientForExisting = fullOrder.customer
            ? {
                firstName: fullOrder.customer.firstName,
                lastName: fullOrder.customer.lastName,
                email: fullOrder.customer.email,
                phone: customer.phone,
                deliveryAddress: customer.deliveryAddress,
                billingAddress: customer.billingAddress,
              }
            : {
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                phone: customer.phone,
                deliveryAddress: customer.deliveryAddress,
                billingAddress: customer.billingAddress,
              };

          await sendReceiptEmailWithRetry({
            order: fullOrder,
            recipient: recipientForExisting,
            currency: normalizedCurrency,
            deliveryFee: typeof deliveryFee === "number" ? deliveryFee : 0,
          });
        }
      } catch (err) {
        console.warn(
          "[orders/online] Failed to send receipt email for existing order",
          err
        );
      }

      return NextResponse.json(
        {
          success: true,
          orderId: existingOrder.id,
          email: existingOrder.customer
            ? existingOrder.customer.email
            : customer.email,
        },
        { status: 200 }
      );
    }

    let itemsSubtotal = 0;
    let totalNGN = 0;
    let aggregatedWeight = 0;
    const itemsCreateData: any[] = [];

    for (const i of items) {
      const where: Record<string, any> = { productId: i.productId };
      if (i.color && i.color !== "N/A") where.color = i.color;
      if (i.size && i.size !== "N/A") where.size = i.size;

      const variant = await prisma.variant.findFirst({
        where,
        include: { product: true },
      });

      if (!variant) {
        return NextResponse.json(
          { error: `Variant not found: ${i.productId} ${i.color}/${i.size}` },
          { status: 400 }
        );
      }

      if (variant.stock < i.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${variant.product.name}` },
          { status: 400 }
        );
      }

      let unitPrice = 0;
      switch (normalizedCurrency) {
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

      let lineTotal = unitPrice * i.quantity;
      if (i.hasSizeMod && i.sizeModFee) {
        lineTotal += i.sizeModFee * i.quantity;
      }
      itemsSubtotal += lineTotal;

      const ngnUnitPrice = variant.product.priceNGN ?? 0;
      totalNGN += ngnUnitPrice * i.quantity;

      const unitWeight =
        typeof i.unitWeight === "number"
          ? i.unitWeight
          : typeof (variant as any).weight === "number"
          ? (variant as any).weight
          : 0;
      aggregatedWeight += unitWeight * i.quantity;

      const customMeasurements =
        (i as any).customMods ?? (i as any).customSize ?? undefined;

      itemsCreateData.push({
        variantId: variant.id,
        name: variant.product.name,
        image: variant.product.images[0] ?? null,
        category: variant.product.categorySlug,
        quantity: i.quantity,
        currency: normalizedCurrency as CurrencyEnum,
        lineTotal,
        color: variant.color || "N/A",
        size: variant.size || "N/A",
        hasSizeMod: !!i.hasSizeMod,
        sizeModFee: i.sizeModFee ?? 0,
        customSize: {
          ...(customMeasurements ?? {}),
          unitWeight,
          totalWeight: parseFloat((unitWeight * i.quantity).toFixed(3)),
        },
      });
    }

    const orderTotal =
      itemsSubtotal + (typeof deliveryFee === "number" ? deliveryFee : 0);

    const expectedLowest = toLowest(orderTotal);
    if (paystackTx.amount !== expectedLowest) {
      try {
        await prisma.orphanPayment.upsert({
          where: { reference: paymentReference },
          create: {
            reference: paymentReference,
            amount: paystackTx.amount,
            currency: paystackTx.currency,
            payload: paystackTx as any,
            reconciled: false,
            resolutionNote:
              "Amount mismatch between expected order total and captured payment",
          },
          update: {
            payload: paystackTx as any,
            amount: paystackTx.amount,
            currency: paystackTx.currency,
            resolutionNote:
              "Updated: amount mismatch between expected and captured payment",
          },
        });
      } catch {
        // swallow
      }

      return NextResponse.json(
        {
          error: `Payment amount mismatch: expected ${expectedLowest}, got ${paystackTx.amount}`,
        },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    let customerId: string | null = null;
    let existingCustomer:
      | { firstName: string; lastName: string; email: string }
      | undefined;
    let guestInfo:
      | {
          firstName?: string;
          lastName?: string;
          email?: string;
          phone?: string;
          deliveryAddress?: string | null;
          billingAddress?: string | null;
          country?: string | null;
          state?: string | null;
        }
      | undefined;

    if (session?.user?.id) {
      const found = await prisma.customer.findUnique({
        where: { id: session.user.id as string },
      });
      if (found) {
        customerId = found.id;
        existingCustomer = {
          firstName: found.firstName,
          lastName: found.lastName,
          email: found.email,
        };
      } else {
        guestInfo = {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          deliveryAddress: customer.deliveryAddress ?? null,
          billingAddress: customer.billingAddress ?? null,
          country: customer.country ?? null,
          state: customer.state ?? null,
        };
      }
    } else if ((customer as any).id) {
      const found = await prisma.customer.findUnique({
        where: { id: (customer as any).id },
      });
      if (found) {
        customerId = found.id;
        existingCustomer = {
          firstName: found.firstName,
          lastName: found.lastName,
          email: found.email,
        };
      } else {
        guestInfo = {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          deliveryAddress: customer.deliveryAddress ?? null,
          billingAddress: customer.billingAddress ?? null,
          country: customer.country ?? null,
          state: customer.state ?? null,
        };
      }
    } else {
      guestInfo = {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        deliveryAddress: customer.deliveryAddress ?? null,
        billingAddress: customer.billingAddress ?? null,
        country: customer.country ?? null,
        state: customer.state ?? null,
      };
    }

    const deliveryDetailsData: any = {
      aggregatedWeight: parseFloat(aggregatedWeight.toFixed(3)),
      deliveryOptionId: deliveryOptionId ?? null,
    };

    if (isShipbubbleFlow) {
      deliveryDetailsData.shipbubble = {
        requestToken: shipping!.shipbubble!.requestToken,
        serviceCode: shipping!.shipbubble!.serviceCode,
        courierId: shipping!.shipbubble!.courierId || null,
        fee:
          typeof shipping!.shipbubble!.fee === "number"
            ? shipping!.shipbubble!.fee
            : deliveryFee,
        currency: shipping!.shipbubble!.currency || normalizedCurrency,
        courierName: shipping!.shipbubble!.courierName || null,
        meta: shipping!.shipbubble!.meta || null,
      };
    }

    const { order } = await prisma.$transaction(
      async (tx) => {
        for (const i of items) {
          const where: Record<string, any> = { productId: i.productId };
          if (i.color && i.color !== "N/A") where.color = i.color;
          if (i.size && i.size !== "N/A") where.size = i.size;

          const variant = await tx.variant.findFirst({
            where,
            include: { product: true },
          });
          if (!variant) {
            throw new Error(
              `Variant not found during transaction: ${i.productId} ${i.color}/${i.size}`
            );
          }
          if (variant.stock < i.quantity) {
            throw new Error(
              `Insufficient stock during transaction for ${variant.product.name}`
            );
          }

          await tx.variant.update({
            where: { id: variant.id },
            data: { stock: { decrement: i.quantity } },
          });
        }

        const serial = await tx.orderSerial.create({ data: {} });
        const newOrderId = formatOrderIdFromSerial(serial.id);

        const orderData: any = {
          id: newOrderId,
          status: OrderStatus.Processing,
          currency: normalizedCurrency as CurrencyEnum,
          totalAmount: itemsSubtotal,
          totalNGN: Math.round(totalNGN),
          paymentMethod,
          paymentReference,
          paymentProviderId: String(paystackTx.id),
          paymentVerified: true,
          createdAt: timestamp ? new Date(timestamp) : new Date(),
          items: { create: itemsCreateData },
          channel: OrderChannel.ONLINE,
          deliveryFee: typeof deliveryFee === "number" ? deliveryFee : 0,
          deliveryDetails: deliveryDetailsData,
          ...(deliveryOptionId &&
            !isShipbubbleFlow && {
              deliveryOption: { connect: { id: deliveryOptionId } },
            }),
        };

        if (customerId) {
          orderData.customer = { connect: { id: customerId } };
        } else if (guestInfo) {
          orderData.guestInfo = guestInfo;
        }

        const createdOrder = await tx.order.create({
          data: orderData,
          include: {
            items: true,
            customer: true,
          },
        });

        return { order: createdOrder };
      },
      { timeout: 15_000 }
    );

    if (customerId && !guestInfo) {
      try {
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            deliveryAddress: customer.deliveryAddress ?? null,
            billingAddress: customer.billingAddress ?? null,
            country: customer.country ?? null,
            state: customer.state ?? null,
          },
        });
      } catch (err) {
        console.warn(
          "[orders/online] Failed to sync saved addresses for customer",
          err
        );
      }
    }

    const recipient = existingCustomer
      ? {
          firstName: existingCustomer.firstName,
          lastName: existingCustomer.lastName,
          email: existingCustomer.email,
          phone: customer.phone,
          deliveryAddress: customer.deliveryAddress,
          billingAddress: customer.billingAddress,
        }
      : (guestInfo as any) ?? {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          deliveryAddress: customer.deliveryAddress,
          billingAddress: customer.billingAddress,
        };

    try {
      await sendReceiptEmailWithRetry({
        order,
        recipient,
        currency: normalizedCurrency,
        deliveryFee: typeof deliveryFee === "number" ? deliveryFee : 0,
      });
    } catch (err) {
      console.warn(
        "[orders/online] Failed to send receipt email for new order",
        err
      );
    }

    return NextResponse.json(
      {
        success: true,
        orderId: order.id,
        email: recipient.email,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err?.code === "P2002" && Array.isArray(err?.meta?.target)) {
      if ((err.meta.target as string[]).includes("paymentReference")) {
        try {
          const refFromError =
            (err as any)?.meta?.targetValue ??
            (err as any)?.params?.paymentReference ??
            requestPaymentReference;

        if (refFromError) {
            const fallbackOrder = await prisma.order.findUnique({
              where: { paymentReference: refFromError as string },
              include: { customer: true },
            });
            if (fallbackOrder) {
              return NextResponse.json(
                {
                  success: true,
                  orderId: fallbackOrder.id,
                  email: fallbackOrder.customer?.email,
                },
                { status: 200 }
              );
            }
          }
        } catch {
          // ignore fallback errors
        }
      }
    }

    return NextResponse.json(
      {
        error: err?.message || "Internal Server Error",
        code: err?.code,
        details: err?.meta,
      },
      { status: err?.message === "Internal Server Error" ? 500 : 400 }
    );
  }
}
