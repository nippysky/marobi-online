// app/api/utils/fx/route.ts
import type { NextRequest } from "next/server";

type Currency = "NGN" | "USD" | "EUR" | "GBP";
type FxResponse = {
  result: "success" | "error";
  base_code?: string;
  rates?: Record<string, number>;
  error_type?: string;
};

const ALLOWED: Currency[] = ["NGN", "USD", "EUR", "GBP"] as const;
const UPSTREAM = "https://open.er-api.com/v6/latest";

type CacheEntry = { ts: number; data: FxResponse };
const TTL_MS = 30 * 60 * 1000; // 30 minutes

// in-memory cache (persists for the serverless/edge worker lifetime)
const g = globalThis as unknown as { __FX_CACHE__?: Map<string, CacheEntry> };
if (!g.__FX_CACHE__) g.__FX_CACHE__ = new Map();

export async function GET(req: NextRequest) {
  try {
    const base = (req.nextUrl.searchParams.get("base") || "NGN")
      .toUpperCase()
      .trim() as Currency;

    if (!ALLOWED.includes(base)) {
      return new Response(
        JSON.stringify({
          result: "error",
          error_type: `Unsupported base currency. Allowed: ${ALLOWED.join(", ")}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // cache hit?
    const cache = g.__FX_CACHE__!;
    const hit = cache.get(base);
    const now = Date.now();
    if (hit && now - hit.ts < TTL_MS) {
      return new Response(JSON.stringify(hit.data), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=1800, stale-while-revalidate=60", // 30m
          "x-fx-cache": "HIT",
        },
      });
    }

    const upstream = await fetch(`${UPSTREAM}/${base}`, {
      // make sure we never serve a stale upstream response
      cache: "no-store",
      // a little guardrail
      headers: { "User-Agent": "marobi-fx/1.0" },
    });

    const json = (await upstream.json()) as FxResponse;

    if (json.result !== "success" || !json.rates) {
      const payload = {
        result: "error",
        error_type:
          json?.error_type ||
          `FX upstream failed for base=${base} (HTTP ${upstream.status})`,
      };
      return new Response(JSON.stringify(payload), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // keep only the 4 currencies we care about for a compact payload
    const filtered: Record<string, number> = {};
    for (const c of ALLOWED) {
      filtered[c] = json.rates[c]!;
    }

    const compact: FxResponse = {
      result: "success",
      base_code: base,
      rates: filtered,
    };

    cache.set(base, { ts: now, data: compact });

    return new Response(JSON.stringify(compact), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800, stale-while-revalidate=60",
        "x-fx-cache": "MISS",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        result: "error",
        error_type: err?.message || "Unknown FX error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
