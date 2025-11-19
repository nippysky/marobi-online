// app/api/products/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";
import { z } from "zod";

/* ────────────────────────────────────────────────────────────
   Validation schema for incoming product payloads
   ──────────────────────────────────────────────────────────── */
const ProductPayload = z.object({
  id: z.string().optional(), // accepted but ignored
  name: z.string().min(1, "Product name is required"),
  category: z.string().min(1, "Category (slug) is required"),
  description: z.string().optional().nullable(),
  price: z.object({
    NGN: z.number(),
    USD: z.number(),
    EUR: z.number(),
    GBP: z.number(),
  }),
  status: z.enum(["Draft", "Published", "Archived"]),
  sizeMods: z.boolean(),
  colors: z.array(z.string()),
  sizeStocks: z.record(z.string(), z.string()), // { "S": "10", "M": "5" }
  customSizes: z.array(z.string()), // accepted for future use (ignored on write)
  images: z.array(z.string()),
  videoUrl: z.string().url().optional().nullable(),
  weight: z.number().min(0.0001, "Weight must be > 0"),
});

/* ────────────────────────────────────────────────────────────
   Formatter: sequential numeric -> branded product ID
   ──────────────────────────────────────────────────────────── */
function formatProductIdFromSerial(serial: bigint | number): string {
  const n = typeof serial === "bigint" ? Number(serial) : serial;
  return `M-PROD-${String(n).padStart(3, "0")}`;
}

/* ────────────────────────────────────────────────────────────
   GET /api/products — Published only
   ──────────────────────────────────────────────────────────── */
export async function GET(_req: NextRequest) {
  try {
    await prismaReady;

    const products = await prisma.product.findMany({
      where: { status: "Published" },
      select: {
        id: true,
        name: true,
        description: true,
        images: true,
        priceNGN: true,
        priceUSD: true,
        priceEUR: true,
        priceGBP: true,
        sizeMods: true,
        status: true,
        videoUrl: true,
        categorySlug: true,
        variants: {
          select: {
            color: true,
            size: true,
            stock: true,
            weight: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const shaped = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      images: p.images,
      prices: {
        NGN: p.priceNGN ?? 0,
        USD: p.priceUSD ?? 0,
        EUR: p.priceEUR ?? 0,
        GBP: p.priceGBP ?? 0,
      },
      sizeMods: p.sizeMods,
      status: p.status,
      videoUrl: p.videoUrl ?? null,
      category: p.categorySlug,
      variants: p.variants.map((v) => ({
        color: v.color,
        size: v.size,
        inStock: v.stock,
        weight: v.weight ?? null,
      })),
    }));

    return NextResponse.json(shaped, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    console.error("GET /api/products error:", err);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}

/* ────────────────────────────────────────────────────────────
   POST /api/products — Create with sequential M-PROD-xxx
   ──────────────────────────────────────────────────────────── */
export async function POST(request: NextRequest) {
  try {
    await prismaReady;

    const json = await request.json();
    const parsed = ProductPayload.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      name,
      category: slug,
      description,
      price,
      status,
      sizeMods,
      colors,
      sizeStocks,
      // customSizes, // currently ignored
      images,
      videoUrl,
      weight,
    } = parsed.data;

    const sizes = Object.keys(sizeStocks);
    if (colors.length === 0 && sizes.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one color or one size" },
        { status: 400 }
      );
    }

    // Ensure category exists & active (do this outside txn to keep lock short)
    const category = await prisma.category.findUnique({
      where: { slug },
      select: { slug: true, isActive: true },
    });
    if (!category) {
      return NextResponse.json(
        { error: `Category '${slug}' not found. Create it first.` },
        { status: 404 }
      );
    }
    if (!category.isActive) {
      return NextResponse.json(
        { error: `Category '${slug}' is not active.` },
        { status: 400 }
      );
    }

    // Build variants array (single `weight` applied to all)
    const variants: Array<{ color: string; size: string; stock: number; weight: number }> = [];
    if (colors.length && sizes.length) {
      for (const color of colors) {
        for (const size of sizes) {
          variants.push({
            color,
            size,
            stock: Number(sizeStocks[size] ?? "0") || 0,
            weight,
          });
        }
      }
    } else if (colors.length) {
      for (const color of colors) {
        variants.push({ color, size: "", stock: 0, weight });
      }
    } else {
      for (const size of sizes) {
        variants.push({
          color: "",
          size,
          stock: Number(sizeStocks[size] ?? "0") || 0,
          weight,
        });
      }
    }

    // Create product under a single transaction with sequential ID reservation
    const created = await prisma.$transaction(async (tx) => {
      // 1) Reserve next serial atomically
      const serial = await tx.productSerial.create({ data: {} });
      const sequentialId = formatProductIdFromSerial(serial.id); // e.g., M-PROD-001

      // 2) Create product with that ID
      const product = await tx.product.create({
        data: {
          id: sequentialId, // override default cuid() with sequential
          name,
          description: description ?? null,
          images,
          priceNGN: price.NGN,
          priceUSD: price.USD,
          priceEUR: price.EUR,
          priceGBP: price.GBP,
          sizeMods,
          status,
          videoUrl: videoUrl ?? null,
          category: { connect: { slug } },
          variants: variants.length
            ? {
                create: variants.map((v) => ({
                  color: v.color,
                  size: v.size,
                  stock: v.stock,
                  weight: v.weight,
                })),
              }
            : undefined,
        },
        select: {
          id: true,
          name: true,
          description: true,
          images: true,
          priceNGN: true,
          priceUSD: true,
          priceEUR: true,
          priceGBP: true,
          sizeMods: true,
          status: true,
          videoUrl: true,
          categorySlug: true,
          variants: {
            select: {
              color: true,
              size: true,
              stock: true,
              weight: true,
            },
          },
        },
      });

      return product;
    });

    const shaped = {
      id: created.id, // e.g., "M-PROD-001"
      name: created.name,
      description: created.description ?? "",
      images: created.images,
      prices: {
        NGN: created.priceNGN ?? 0,
        USD: created.priceUSD ?? 0,
        EUR: created.priceEUR ?? 0,
        GBP: created.priceGBP ?? 0,
      },
      sizeMods: created.sizeMods,
      status: created.status,
      videoUrl: created.videoUrl ?? null,
      category: created.categorySlug,
      variants: created.variants.map((v) => ({
        color: v.color,
        size: v.size,
        inStock: v.stock,
        weight: v.weight ?? null,
      })),
    };

    return NextResponse.json(shaped, { status: 201 });
  } catch (err) {
    console.error("POST /api/products error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}