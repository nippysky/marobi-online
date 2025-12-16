export const dynamic = "force-dynamic";

import AdminDashboardClient from "@/components/admin/AdminDashboardClient";
import { prisma } from "@/lib/db";
import type { OrderRow } from "@/types/orders";

/* ──────────────────────────────────────────────────────────────────────────
   Shared helpers (mirrors Order Inventory — FAANG-grade + defensive)
   ────────────────────────────────────────────────────────────────────────── */

function normalizeCustomSize(raw: unknown): Record<string, string> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v !== null && v !== undefined) out[k] = String(v);
    }
    return Object.keys(out).length ? out : null;
  }
  return null;
}

function normalizeAddress(o: {
  customer?: {
    deliveryAddress?: string | null;
    billingAddress?: string | null;
    country?: string | null;
    state?: string | null;
  } | null;
  guestInfo?: unknown;
} = {}): string {
  if (o.customer) {
    return (
      o.customer.deliveryAddress ||
      o.customer.billingAddress ||
      o.customer.country ||
      o.customer.state ||
      "—"
    );
  }
  if (o.guestInfo && typeof o.guestInfo === "object") {
    const g = o.guestInfo as Record<string, unknown>;
    return (
      (g.deliveryAddress as string) ||
      (g.address as string) ||
      (g.billingAddress as string) ||
      (g.country as string) ||
      (g.state as string) ||
      "—"
    );
  }
  return "—";
}

function isPickupText(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const t = raw.trim().toLowerCase();
  return t.startsWith("pickup") || t.includes("in-person pickup") || t.includes("walk-in");
}

/** Extract courierName from deliveryDetails in a defensive way. */
function extractCourierName(raw: unknown): string | null {
  if (!raw) return null;

  // ✅ Don't ever treat pickup markers as a courier
  if (isPickupText(raw)) return null;

  let obj: any = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      const s = raw.trim();
      if (s && s.length <= 64 && !s.includes("{") && !s.includes("}")) {
        return s;
      }
      return null;
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;

  const fromShipbubble = obj.shipbubble?.courierName;
  const direct = obj.courierName;
  const fromMeta = obj.shipbubble?.meta?.courierName;

  const c =
    (typeof fromShipbubble === "string" && fromShipbubble.trim()) ||
    (typeof direct === "string" && direct.trim()) ||
    (typeof fromMeta === "string" && fromMeta.trim()) ||
    null;

  return c || null;
}

/** Extract a numeric kg weight from common fields in provider payloads. */
function extractWeightKg(obj: Record<string, any>): string | null {
  const cand =
    obj.aggregatedWeight ??
    obj.weight ??
    obj.totalWeight ??
    obj.packageWeight ??
    obj.pkg_weight ??
    obj?.meta?.destination?.totalWeightKG;

  if (cand === undefined || cand === null) return null;
  const asStr = String(cand).trim();
  const n = parseFloat(asStr.replace(/[^0-9.]/g, ""));
  if (!isFinite(n)) return null;
  const hasKg = /kg/i.test(asStr);
  return hasKg ? asStr : `${n}kg`;
}

/**
 * Summarize delivery details for the table (Courier • Weight • ETA).
 * Also handles pickup cleanly.
 */
function humanizeDeliveryDetails(
  raw: unknown,
  deliveryOption?: { name?: string | null }
): string {
  // ✅ Pickup: keep it human + optional note
  if (isPickupText(raw)) {
    const s = String(raw).trim();
    const pickupLabel = "In-person Pickup";

    // If it looks like "PICKUP: something", show "In-person Pickup • Note: something"
    const parts = s.split(":");
    const note = parts.length > 1 ? parts.slice(1).join(":").trim() : "";
    return note ? `${pickupLabel} • Note: ${note}` : pickupLabel;
  }

  const derivedCourier = extractCourierName(raw);
  const baseLabel = (derivedCourier || deliveryOption?.name || "—").trim();

  if (!raw) return baseLabel;

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return humanizeDeliveryDetails(parsed, { name: baseLabel });
    } catch {
      const s = raw.trim();
      return s.length <= 64 ? (derivedCourier || s) : baseLabel;
    }
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    const s = String(raw).trim();
    return s.length <= 64 ? (derivedCourier || s) : baseLabel;
  }

  const obj = raw as Record<string, any>;
  const pieces: string[] = [];

  // Always start with the courier’s display name
  pieces.push(baseLabel);

  // Weight
  const weight =
    extractWeightKg(obj) ??
    (obj.meta && extractWeightKg(obj.meta)) ??
    (obj.raw && extractWeightKg(obj.raw));
  if (weight) pieces.push(`Weight: ${weight}`);

  // ETA, if available
  const eta =
    (obj.meta && (obj.meta.eta || obj.meta.ETA)) ||
    (obj.raw && (obj.raw.eta || obj.raw.ETA));
  if (eta) pieces.push(`ETA: ${String(eta)}`);

  return pieces.join(" • ");
}

/* ──────────────────────────────────────────────────────────────────────────
   Recent orders (latest 5) — mirrors inventory mapping 1:1
   ────────────────────────────────────────────────────────────────────────── */
async function fetchRecentOrders(): Promise<OrderRow[]> {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          deliveryAddress: true,
          billingAddress: true,
          country: true,
          state: true,
        },
      },
      items: {
        select: {
          id: true,
          name: true,
          image: true,
          category: true,
          color: true,
          size: true,
          quantity: true,
          lineTotal: true,
          hasSizeMod: true,
          sizeModFee: true,
          customSize: true,
          variant: {
            select: {
              product: {
                select: {
                  priceNGN: true,
                  images: true,
                  name: true,
                  categorySlug: true,
                },
              },
            },
          },
        },
      },
      offlineSale: true,
      deliveryOption: { select: { id: true, name: true, provider: true } },
    },
  });

  return orders.map((o): OrderRow => {
    // customer/guest
    let customerObj: OrderRow["customer"];
    if (o.customer) {
      customerObj = {
        id: o.customer.id,
        name: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
        email: o.customer.email,
        phone: o.customer.phone,
        address: normalizeAddress({ customer: o.customer, guestInfo: o.guestInfo }),
      };
    } else if (
      o.guestInfo &&
      typeof o.guestInfo === "object" &&
      !Array.isArray(o.guestInfo)
    ) {
      const gi = o.guestInfo as Record<string, string>;
      customerObj = {
        id: null,
        name: `${gi.firstName ?? ""} ${gi.lastName ?? ""}`.trim() || "Guest",
        email: gi.email ?? "",
        phone: gi.phone ?? "",
        address: normalizeAddress({ customer: null, guestInfo: o.guestInfo }),
      };
    } else {
      customerObj = { id: null, name: "Guest", email: "", phone: "", address: "—" };
    }

    // NGN ledger subtotal (includes size-mod fee when order currency is NGN).
    const totalNGN: number = o.items.reduce((sum, it) => {
      const base = (it.variant?.product.priceNGN ?? 0) * it.quantity;
      const sizeFeeNGN = o.currency === "NGN" ? (it.sizeModFee ?? 0) * it.quantity : 0;
      return sum + base + sizeFeeNGN;
    }, 0);

    const products = o.items.map((it) => ({
      id: it.id,
      name: it.name,
      image: it.image ?? "",
      category: it.category,
      color: it.color,
      size: it.size,
      quantity: it.quantity,
      lineTotal: it.lineTotal,
      priceNGN: it.variant?.product.priceNGN ?? 0,
      hasSizeMod: it.hasSizeMod,
      sizeModFee: it.sizeModFee,
      customSize: normalizeCustomSize(it.customSize),
    }));

    // ✅ Prefer courier from deliveryDetails only when it's NOT pickup.
    const derivedCourier = extractCourierName(o.deliveryDetails as any);

    const isPickup =
      (o.deliveryOption?.name?.toLowerCase?.() ?? "").includes("pickup") ||
      isPickupText(o.deliveryDetails as any);

    const deliveryOption: OrderRow["deliveryOption"] =
      o.deliveryOption
        ? {
            id: o.deliveryOption.id,
            name:
              (isPickup ? "In-person Pickup" : o.deliveryOption.name)?.trim() ||
              o.deliveryOption.provider?.trim() ||
              "—",
            // ✅ pickup should never look like shipbubble on the client
            provider: isPickup ? null : (o.deliveryOption.provider ?? null),
            type: "COURIER",
          }
        : derivedCourier
        ? {
            id: "shipbubble",
            name: derivedCourier,
            provider: "Shipbubble",
            type: "COURIER",
          }
        : null;

    return {
      id: o.id,
      status: o.status,
      currency: o.currency,
      totalAmount: o.totalAmount,
      totalNGN,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt.toISOString(),
      products,
      customer: customerObj,
      channel: o.channel,
      deliveryOption,
      deliveryFee: o.deliveryFee ?? 0,
      deliveryDetails: humanizeDeliveryDetails(o.deliveryDetails, deliveryOption ?? undefined),
    };
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   Top products (by qty) — unchanged
   ────────────────────────────────────────────────────────────────────────── */
async function fetchTopProducts(limit = 3) {
  const validOrderIds = (
    await prisma.order.findMany({
      where: { status: { not: "Cancelled" } },
      select: { id: true },
    })
  ).map((o) => o.id);

  if (!validOrderIds.length) return [];

  const grouped = await prisma.orderItem.groupBy({
    by: ["variantId"],
    _sum: { quantity: true },
    where: { orderId: { in: validOrderIds } },
    orderBy: { _sum: { quantity: "desc" } },
    take: Math.max(limit * 4, limit),
  });

  const variantIds = grouped.map((g) => g.variantId);
  const variants = await prisma.variant.findMany({
    where: { id: { in: variantIds } },
    include: { product: true },
  });

  const perProduct = new Map<
    string,
    { id: string; name: string; sold: number; revenue: number; image: string; category?: string }
  >();

  for (const g of grouped) {
    const qty = g._sum.quantity ?? 0;
    const v = variants.find((x) => x.id === g.variantId);
    if (!v) continue;
    const p = v.product;
    const price = p.priceNGN ?? 0;

    const agg = perProduct.get(p.id);
    if (agg) {
      agg.sold += qty;
      agg.revenue += Math.round(price * qty);
    } else {
      perProduct.set(p.id, {
        id: p.id,
        name: p.name,
        sold: qty,
        revenue: Math.round(price * qty),
        image: p.images?.[0] ?? "/placeholder.png",
        category: p.categorySlug,
      });
    }
  }

  return Array.from(perProduct.values())
    .sort((a, b) => b.sold - a.sold)
    .slice(0, limit);
}

/* ──────────────────────────────────────────────────────────────────────────
   Revenue series — unchanged
   ────────────────────────────────────────────────────────────────────────── */
async function buildRevenueSeries() {
  const now = new Date();
  const sumRange = async (gte: Date, lte: Date) => {
    const agg = await prisma.order.aggregate({
      where: { createdAt: { gte, lte }, status: { not: "Cancelled" } },
      _sum: { totalNGN: true },
    });
    return agg._sum.totalNGN ?? 0;
  };

  const Day: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    Day.push({ label: d.toLocaleDateString(undefined, { weekday: "short" }), value: await sumRange(start, end) });
  }

  const Month: { label: string; value: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const start = new Date(now.getFullYear(), m, 1);
    if (start > now) break;
    const end = new Date(now.getFullYear(), m + 1, 0, 23, 59, 59, 999);
    Month.push({ label: start.toLocaleDateString(undefined, { month: "short" }), value: await sumRange(start, end) });
  }

  const SixMonths: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    SixMonths.push({ label: d.toLocaleDateString(undefined, { month: "short" }), value: await sumRange(start, end) });
  }

  const Year: { label: string; value: number }[] = [];
  for (let i = 4; i >= 0; i--) {
    const y = now.getFullYear() - i;
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59, 999);
    Year.push({ label: String(y), value: await sumRange(start, end) });
  }

  return { Day, Month, "6 Months": SixMonths, Year };
}

/* ──────────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────────── */
export default async function AdminDashboardPage() {
  const [totalProducts, totalCustomers, orderAgg, top3, recentOrders, revenueSeries] =
    await Promise.all([
      prisma.product.count(),
      prisma.customer.count(),
      prisma.order.aggregate({
        _count: { _all: true },
        _sum: { totalNGN: true },
        where: { status: { not: "Cancelled" } },
      }),
      fetchTopProducts(3),
      fetchRecentOrders(),
      buildRevenueSeries(),
    ]);

  const totalOrders = orderAgg._count._all;
  const totalRevenue = orderAgg._sum.totalNGN ?? 0;

  return (
    <AdminDashboardClient
      totalProducts={totalProducts}
      totalCustomers={totalCustomers}
      totalOrders={totalOrders}
      totalRevenue={totalRevenue}
      top3={top3}
      recentOrders={recentOrders}
      revenueSeries={revenueSeries}
    />
  );
}
