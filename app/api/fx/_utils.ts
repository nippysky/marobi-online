// app/api/fx/_utils.ts

type OpenERApi = {
  result: "success" | "error";
  time_last_update_unix: number;
  time_next_update_unix: number;
  base_code: string;
  rates: Record<string, number>;
};

// Simple in-memory cache (per region)
const mem = new Map<string, { at: number; ttl: number; data: OpenERApi }>();

// 30 minutes default; clamp to provider's nextUpdate
const DEFAULT_TTL = 30 * 60 * 1000;

export function ok(data: any, ttlMs?: number) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    // public cache (CDN) 30 minutes; revalidate in background
    "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=60",
  });
  return new Response(JSON.stringify(data), { status: 200, headers });
}

export function bad(msg: string, code = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status: code,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function fetchOpenErLatest(base: string): Promise<OpenERApi> {
  const key = `latest:${base.toUpperCase()}`;
  const now = Date.now();

  const hit = mem.get(key);
  if (hit && now - hit.at < hit.ttl) {
    return hit.data;
  }

  const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
  const res = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
  if (!res.ok) {
    // serve stale if we have it
    if (hit) return hit.data;
    throw new Error(`open.er-api.com ${res.status}`);
  }
  const json = (await res.json()) as OpenERApi;
  if (json.result !== "success") throw new Error("FX provider returned error");

  const providerNext = Math.max(0, (json.time_next_update_unix * 1000) - now);
  const ttl = Math.min(DEFAULT_TTL, providerNext || DEFAULT_TTL);

  mem.set(key, { at: now, ttl, data: json });
  return json;
}

export function pickRates(
  data: OpenERApi,
  symbolsCsv?: string
): Record<string, number> {
  if (!symbolsCsv) return data.rates;
  const want = symbolsCsv
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const out: Record<string, number> = {};
  for (const s of want) {
    if (data.rates[s] != null) out[s] = data.rates[s];
  }
  return out;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
