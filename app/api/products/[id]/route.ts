// app/api/products/[id]/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

const PRODUCT_STATUSES = ["Draft", "Published", "Archived"] as const;
type ProductStatus = (typeof PRODUCT_STATUSES)[number];
const isProductStatus = (v: unknown): v is ProductStatus =>
  typeof v === "string" && PRODUCT_STATUSES.includes(v as any);

// ────────────────────────────────────────────────────────
// UTILITIES
// ────────────────────────────────────────────────────────
const comboKey = (c: string, s: string) => `${c}|||${s}`;
function numOrNull(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function cleanStringArray(
  raw: unknown,
  {
    dedupe = true,
    max = 50,
    maxLen = 500,
  }: { dedupe?: boolean; max?: number; maxLen?: number } = {}
): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (!t) continue;
    const clipped = t.slice(0, maxLen);
    if (dedupe) {
      if (seen.has(clipped)) continue;
      seen.add(clipped);
    }
    out.push(clipped);
    if (out.length >= max) break;
  }
  return out;
}
function cleanSizeStocks(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || typeof v !== "string") continue;
    const label = k.trim();
    const stockStr = v.trim();
    if (!label || !stockStr) continue;
    out[label] = stockStr;
  }
  return out;
}
function cleanColorSizeStocks(
  raw: unknown
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  if (!raw || typeof raw !== "object") return out;

  for (const [colorKey, inner] of Object.entries(
    raw as Record<string, unknown>
  )) {
    if (typeof colorKey !== "string" || !inner || typeof inner !== "object")
      continue;
    const color = colorKey.trim();
    if (!color) continue;

    const innerMap: Record<string, string> = {};
    for (const [sizeKey, val] of Object.entries(
      inner as Record<string, unknown>
    )) {
      if (typeof sizeKey !== "string" || typeof val !== "string") continue;
      const sLabel = sizeKey.trim();
      const stockStr = val.trim();
      if (!sLabel || !stockStr) continue;
      innerMap[sLabel] = stockStr;
    }
    if (Object.keys(innerMap).length > 0) {
      out[color] = innerMap;
    }
  }

  return out;
}
function safePositiveInt(
  str: string,
  { min = 0, max = 1_000_000 }: { min?: number; max?: number } = {}
): number | null {
  const n = parseInt(str, 10);
  if (!Number.isFinite(n)) return null;
  if (n < min) return null;
  if (n > max) return max;
  return n;
}
function safePositiveFloat(val: unknown): number | null {
  if (val === "" || val == null) return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ────────────────────────────────────────────────────────
/** PUT /api/products/[id] */
// ────────────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await prismaReady;

  const { id: productId } = await context.params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  // basic validation
  if (!body?.name || typeof body.name !== "string")
    return jsonError("Product name is required.");
  if (!body?.category || typeof body.category !== "string")
    return jsonError("Category is required.");
  if (!isProductStatus(body.status)) return jsonError("Invalid status.");

  const name = body.name.trim().slice(0, 200);
  const categorySlug = body.category.trim().slice(0, 120);
  const description =
    typeof body.description === "string"
      ? body.description.trim().slice(0, 10_000) || null
      : null;
  const images = cleanStringArray(body.images, { max: 20, maxLen: 500 });
  const colors = cleanStringArray(body.colors, { max: 50, maxLen: 120 });
  const sizeMods = !!body.sizeMods;
  const videoUrl =
    typeof body.videoUrl === "string" && body.videoUrl.trim() !== ""
      ? body.videoUrl.trim()
      : null;

  const priceNGN = numOrNull(body.price?.NGN);
  const priceUSD = numOrNull(body.price?.USD);
  const priceEUR = numOrNull(body.price?.EUR);
  const priceGBP = numOrNull(body.price?.GBP);

  const rawSizeStocks = cleanSizeStocks(body.sizeStocks);
  const rawColorSizeStocks = cleanColorSizeStocks(body.colorSizeStocks);

  const weight = safePositiveFloat(body.weight); // default variant weight
  if (body.status === "Published" && weight == null) {
    return jsonError("Weight is required to publish.");
  }

  // ensure category exists (cleaner error than FK failure)
  const categoryExists = await prisma.category.findUnique({
    where: { slug: categorySlug },
    select: { slug: true, isActive: true },
  });
  if (!categoryExists) return jsonError("Category not found.", 404);
  if (!categoryExists.isActive) return jsonError("Category is not active.", 400);

  // build desired variants
  const trimmedColors = colors;
  const hasColorMatrix =
    trimmedColors.length > 0 && Object.keys(rawColorSizeStocks).length > 0;

  const desiredMap = new Map<
    string,
    { color: string; size: string; stock: number; weight?: number }
  >();

  if (hasColorMatrix) {
    // New behaviour: per-color, per-size stock matrix
    for (const color of trimmedColors) {
      const perColor = rawColorSizeStocks[color] || {};
      for (const [sizeRaw, stockRaw] of Object.entries(perColor)) {
        const size = sizeRaw.trim();
        if (!size) continue;
        const stock = safePositiveInt(stockRaw);
        if (stock == null) continue;

        const entry: {
          color: string;
          size: string;
          stock: number;
          weight?: number;
        } = {
          color,
          size,
          stock,
        };
        if (weight != null) entry.weight = weight;
        desiredMap.set(comboKey(color, size), entry);
      }
    }
  } else {
    // Backwards-compatible logic: one stock per size, replicated across colors
    const sizeLabels = Object.keys(rawSizeStocks);
    const effectiveColors = trimmedColors.length ? trimmedColors : [""];

    for (const sizeRaw of sizeLabels) {
      const size = sizeRaw.trim();
      if (!size) continue;
      const stock = safePositiveInt(rawSizeStocks[sizeRaw]);
      if (stock == null) continue;

      for (const color of effectiveColors) {
        const entry: {
          color: string;
          size: string;
          stock: number;
          weight?: number;
        } = {
          color,
          size,
          stock,
        };
        if (weight != null) entry.weight = weight;
        desiredMap.set(comboKey(color, size), entry);
      }
    }
  }

  if (body.status === "Published" && desiredMap.size === 0) {
    return jsonError(
      "At least one valid size/color/stock entry is required to publish."
    );
  }

  try {
    // 1) transaction
    await prisma.$transaction(async (tx) => {
      const exists = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!exists) throw new Error("NOT_FOUND");

      // update main record
      await tx.product.update({
        where: { id: productId },
        data: {
          name,
          categorySlug,
          description,
          images,
          priceNGN,
          priceUSD,
          priceEUR,
          priceGBP,
          sizeMods,
          status: body.status as ProductStatus,
          videoUrl,
        },
      });

      // sync variants
      const existing = await tx.variant.findMany({
        where: { productId },
        select: { id: true, color: true, size: true },
      });
      const existingMap = new Map(
        existing.map((v) => [comboKey(v.color, v.size), v])
      );

      // upsert/update desired
      for (const desired of desiredMap.values()) {
        const key = comboKey(desired.color, desired.size);
        if (existingMap.has(key)) {
          const ev = existingMap.get(key)!;
          await tx.variant.update({
            where: { id: ev.id },
            data: {
              stock: desired.stock,
              ...(desired.weight !== undefined ? { weight: desired.weight } : {}),
            },
          });
          existingMap.delete(key);
        } else {
          await tx.variant.create({
            data: {
              productId,
              color: desired.color,
              size: desired.size,
              stock: desired.stock,
              ...(desired.weight !== undefined ? { weight: desired.weight } : {}),
            },
          });
        }
      }

      // delete stale variants
      for (const stale of existingMap.values()) {
        await tx.variant.delete({ where: { id: stale.id } });
      }
    });

    // 2) fresh read
    const updated = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        categorySlug: true,
        description: true,
        images: true,
        priceNGN: true,
        priceUSD: true,
        priceEUR: true,
        priceGBP: true,
        sizeMods: true,
        status: true,
        videoUrl: true,
        variants: {
          select: { color: true, size: true, stock: true, weight: true },
          orderBy: [{ color: "asc" }, { size: "asc" }],
        },
      },
    });
    if (!updated) return jsonError("Product not found after update", 404);

    return NextResponse.json({
      success: true,
      product: {
        ...updated,
        category: updated.categorySlug,
      },
    });
  } catch (err: any) {
    if (err?.message === "NOT_FOUND") return jsonError("Product not found.", 404);
    console.error("PUT /api/products/[id] error:", err);
    return jsonError("Update failed", 500);
  }
}

// ────────────────────────────────────────────────────────
/** DELETE /api/products/[id] */
// ────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await prismaReady;

  const { id: productId } = await context.params;
  try {
    await prisma.variant.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/products/[id] error:", err);
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (err?.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Cannot delete this product because it has related records (e.g., past orders).",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Could not delete product" },
      { status: 500 }
    );
  }
}
