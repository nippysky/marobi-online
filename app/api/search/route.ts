// app/api/search/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

/**
 * Search endpoint for published products by name or category (name/slug).
 * Query: ?query=...   (case-insensitive, partial)
 */
export async function GET(req: NextRequest) {
  await prismaReady;

  try {
    const url = new URL(req.url);
    const rawQuery = url.searchParams.get("query") || "";
    const q = rawQuery.trim();

    if (!q) {
      return NextResponse.json([], { status: 200 });
    }

    const products = await prisma.product.findMany({
      where: {
        status: "Published",
        OR: [
          // product name
          { name: { contains: q, mode: "insensitive" } },
          // category name (through relation)
          {
            category: {
              is: { name: { contains: q, mode: "insensitive" } },
            },
          },
          // category slug
          { categorySlug: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 50,
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
      },
      orderBy: [{ createdAt: "desc" }],
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
      category: p.categorySlug, // frontend expects `category`
      variants: [], // keep payload light for search previews
    }));

    return NextResponse.json(shaped, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("GET /api/search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
