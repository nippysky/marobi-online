// app/api/fx/convert/route.ts
import { ok, bad, fetchOpenErLatest, round2 } from "../_utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") || "").toUpperCase();
  const to = (searchParams.get("to") || "").toUpperCase();
  const amountStr = searchParams.get("amount") || "";

  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to))
    return bad("Missing or invalid 'from'/'to' currency codes.");
  const amount = Number(amountStr);
  if (!isFinite(amount)) return bad("Missing or invalid 'amount'.");

  try {
    const data = await fetchOpenErLatest(from);
    const rate = data.rates?.[to];
    if (rate == null) return bad(`Unsupported currency code '${to}'.`, 400);

    const now = Date.now();
    const ttlSeconds = Math.max(
      0,
      Math.min(1800, Math.floor(data.time_next_update_unix - now / 1000))
    );

    return ok({
      from,
      to,
      amount,
      rate,
      converted: round2(amount * rate),
      timestamp: data.time_last_update_unix,
      nextUpdate: data.time_next_update_unix,
      ttlSeconds,
      source: "open.er-api.com",
    });
  } catch (e: any) {
    return bad(e?.message || "FX upstream failed", 503);
  }
}
