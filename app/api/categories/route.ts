// app/api/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAllCategories } from "@/lib/categories";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    // Default: active only. Override with ?active=false or ?active=0
    const activeParam = sp.get("active");
    const activeOnly =
      activeParam === null
        ? true
        : /^(true|1|yes)$/i.test(activeParam) ? true : false;

    const cats = await getAllCategories({ activeOnly });

    return NextResponse.json(cats, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("Error fetching categories:", err);
    return NextResponse.json(
      { error: "Failed to load categories" },
      { status: 500 }
    );
  }
}
