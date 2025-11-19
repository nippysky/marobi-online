// app/api/products/search/route.ts
export const dynamic = "force-dynamic";

import prisma, { prismaReady } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  await prismaReady;

  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("query") ?? "").trim();

    if (q.length < 2) {
      return NextResponse.json([], { status: 200 });
    }

    const products = await prisma.product.findMany({
      where: {
        status: "Published",
        OR: [
          { id:   { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        variants: {
          select: {
            color: true,
            size:  true,
            stock: true,
          },
        },
        sizeMods: true,
        images:   true,
        priceNGN: true,
        priceUSD: true,
        priceEUR: true,
        priceGBP: true,
      },
      take: 8,
      orderBy: [{ name: "asc" }],
    });

    return NextResponse.json(products, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (err) {
    console.error("GET /api/products/search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
