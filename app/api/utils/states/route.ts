// app/api/countries/states/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

type CountriesNowStatesResp = {
  data?: { name?: string; states?: Array<{ name?: string }> };
  error?: boolean;
  msg?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const raw = body?.country;
    const country =
      typeof raw === "string" ? raw.trim() : undefined;

    if (!country) {
      return NextResponse.json(
        { error: "Country is required" },
        { status: 400 }
      );
    }

    // Defensive timeout so the route never hangs
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(
      "https://countriesnow.space/api/v0.1/countries/states",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country }),
        signal: controller.signal,
      }
    ).finally(() => clearTimeout(t));

    if (!res.ok) {
      console.error("Upstream states API error:", res.status);
      return NextResponse.json(
        { error: "Failed to fetch states" },
        { status: 502 }
      );
    }

    const json = (await res.json()) as CountriesNowStatesResp;
    const states =
      json?.data?.states?.map((s) => s?.name).filter(Boolean) ?? [];

    return NextResponse.json({ states }, { status: 200 });
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    console.error("States proxy error:", err);
    return NextResponse.json(
      { error: aborted ? "Upstream timeout" : "Server error fetching states" },
      { status: aborted ? 504 : 500 }
    );
  }
}
