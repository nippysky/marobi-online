// app/api/fx/quote/route.ts
import { ok, bad, fetchOpenErLatest, round2 } from "../_utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const amountStr = searchParams.get("ngn") || "";
  const toCsv = searchParams.get("to") || "";

  const amount = Number(amountStr);
  if (!isFinite(amount)) return bad("Missing or invalid 'ngn' amount.");
  const tos = toCsv
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{3}$/.test(s));

  if (tos.length === 0) return bad("Provide 'to' codes (e.g., USD,EUR,GBP).");

  try {
    const data = await fetchOpenErLatest("NGN");
    const quotes: Record<string, { rate: number; converted: number }> = {};
    for (const t of tos) {
      const r = data.rates?.[t];
      if (r != null) quotes[t] = { rate: r, converted: round2(amount * r) };
    }

    const now = Date.now();
    const ttlSeconds = Math.max(
      0,
      Math.min(1800, Math.floor(data.time_next_update_unix - now / 1000))
    );

    return ok({
      base: "NGN",
      amount,
      timestamp: data.time_last_update_unix,
      nextUpdate: data.time_next_update_unix,
      ttlSeconds,
      quotes,
      source: "open.er-api.com",
    });
  } catch (e: any) {
    return bad(e?.message || "FX upstream failed", 503);
  }
}
