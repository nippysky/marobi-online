// app/api/fx/latest/route.ts
import { ok, bad, fetchOpenErLatest, pickRates } from "../_utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const base = (searchParams.get("base") || "NGN").toUpperCase();
  const symbols = searchParams.get("symbols") || undefined;

  if (!/^[A-Z]{3}$/.test(base)) return bad("Invalid base code.");

  try {
    const data = await fetchOpenErLatest(base);
    const rates = pickRates(data, symbols);
    const now = Date.now();
    const ttlSeconds = Math.max(
      0,
      Math.min(1800, Math.floor(data.time_next_update_unix - now / 1000))
    );

    return ok({
      base,
      timestamp: data.time_last_update_unix,
      nextUpdate: data.time_next_update_unix,
      ttlSeconds,
      rates,
      source: "open.er-api.com",
    });
  } catch (e: any) {
    return bad(e?.message || "FX upstream failed", 503);
  }
}
