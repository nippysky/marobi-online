// app/api/products/[productId]/reviews/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

/** Ensure Node runtime for consistent server APIs */
export const runtime = "nodejs";

// Utility: coerce positive int with bounds
function parsePositiveInt(value: string | null, fallback: number, max: number) {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  try {
    await prismaReady;

    const { productId } = await context.params;

    const url = new URL(req.url);
    const page = parsePositiveInt(url.searchParams.get("page"), 1, 10_000);
    const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 50, 100);
    const ratingParam = url.searchParams.get("rating");
    const q = url.searchParams.get("q")?.trim() || "";

    let ratingFilter: number | undefined;
    if (ratingParam) {
      const r = Number(ratingParam);
      if (Number.isInteger(r) && r >= 1 && r <= 5) ratingFilter = r;
    }

    // Fetch product basics (fast)
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        averageRating: true,
        ratingCount: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // WHERE clause for filtered list & totalFiltered
    const filteredWhere = {
      productId,
      ...(ratingFilter ? { rating: ratingFilter } : {}),
      ...(q
        ? {
            body: {
              contains: q,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const skip = (page - 1) * pageSize;

    // Parallel queries:
    const [totalFiltered, pageData, starGroups] = await Promise.all([
      prisma.review.count({ where: filteredWhere }),
      prisma.review.findMany({
        where: filteredWhere,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          rating: true,
          body: true,
          createdAt: true,
          customer: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.review.groupBy({
        by: ["rating"],
        where: { productId },
        _count: { rating: true },
      }),
    ]);

    // Normalize star breakdown to ensure all 1..5 keys exist
    const starBreakdown: Record<string, number> = {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
    };
    for (const g of starGroups) {
      starBreakdown[String(g.rating)] = g._count.rating;
    }

    return NextResponse.json({
      meta: {
        productId,
        page,
        pageSize,
        totalFiltered,
        averageRating: product.averageRating,
        ratingCount: product.ratingCount,
        starBreakdown,
      },
      data: pageData,
    });
  } catch (err) {
    console.error("[GET /api/products/[productId]/reviews] Error:", err);
    return NextResponse.json(
      { error: "Failed to load reviews" },
      { status: 500 }
    );
  }
}
