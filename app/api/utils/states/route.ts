// app/api/utils/states/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Country, State as CscState } from "country-state-city";

interface StatesRequestBody {
  countryIso2?: string;
  iso2?: string;
  countryCode?: string;
  cca2?: string;
  country?: string; // human name, e.g. "Nigeria"
}

function normalizeCountryName(name: string): string {
  return name
    .toLowerCase()
    // strip common noise words & punctuation
    .replace(/\b(republic|federal|democratic|kingdom|state|states|of|the)\b/g, "")
    .replace(/[^a-z]/g, "")
    .trim();
}

/**
 * POST /api/utils/states
 * Body can be:
 *   { countryIso2: "NG" }   // preferred
 *   { country: "Nigeria" }  // fallback
 *
 * Response:
 *   { states: string[], countryIso2: string }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as StatesRequestBody;

    let iso2 =
      body.countryIso2 ||
      body.iso2 ||
      body.countryCode ||
      body.cca2 ||
      undefined;

    const countryName =
      typeof body.country === "string" && body.country.trim().length > 0
        ? body.country.trim()
        : undefined;

    if (!iso2 && !countryName) {
      return NextResponse.json(
        { error: "countryIso2 or country is required" },
        { status: 400 }
      );
    }

    // If we only have the country name, resolve it to ISO2 using CSC data
    if (!iso2 && countryName) {
      const all = Country.getAllCountries();
      const queryNorm = normalizeCountryName(countryName);

      // strict normalized equality first
      const match =
        all.find(
          (c) => normalizeCountryName(c.name) === queryNorm
        ) ||
        // as a tiny extra, try plain case-insensitive equality
        all.find(
          (c) => c.name.toLowerCase() === countryName.toLowerCase()
        );

      iso2 = match?.isoCode;
    }

    if (!iso2) {
      return NextResponse.json(
        { error: "Could not resolve country ISO code" },
        { status: 400 }
      );
    }

    const statesRaw = CscState.getStatesOfCountry(iso2);

    const states = statesRaw
      .map((s) => s.name?.trim())
      .filter((name): name is string => !!name)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json(
      { states, countryIso2: iso2 },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, s-maxage=86400, stale-while-revalidate=43200",
        },
      }
    );
  } catch (err) {
    console.error("States route error:", err);
    return NextResponse.json(
      { error: "Server error fetching states" },
      { status: 500 }
    );
  }
}
