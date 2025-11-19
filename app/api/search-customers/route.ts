// app/api/customers/search/route.ts
export const dynamic = "force-dynamic";

import prisma, { prismaReady } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  await prismaReady;

  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("query") ?? "").trim();

    // Require at least 2 characters to avoid heavy scans
    if (q.length < 2) {
      return NextResponse.json([], { status: 200 });
    }

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
      take: 8,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return NextResponse.json(customers, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (err) {
    console.error("GET /api/customers/search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
