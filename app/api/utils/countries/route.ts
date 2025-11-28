// app/api/utils/countries/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Country } from "country-state-city";

export async function GET() {
  try {
    const all = Country.getAllCountries();

    const list = all
      .map((c) => ({
        name: c.name,
        iso2: c.isoCode, // e.g. "NG"
        // phonecode is usually like "234" or "1"
        callingCodes: c.phonecode ? [String(c.phonecode)] : [],
      }))
      .filter((c) => c.name && c.iso2)
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(list, {
      status: 200,
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=43200",
      },
    });
  } catch (err) {
    console.error("Country list error:", err);
    return NextResponse.json(
      { error: "Failed to load countries" },
      { status: 500 }
    );
  }
}
