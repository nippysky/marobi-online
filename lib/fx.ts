// lib/fx.ts
export type Currency = "NGN" | "USD" | "EUR" | "GBP";

export type FxTable = {
  base: Currency;
  rates: Record<Currency, number>;
};

export async function loadFx(base: Currency): Promise<FxTable> {
  const res = await fetch(`/api/utils/fx?base=${base}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || json?.result !== "success") {
    throw new Error(json?.error_type || "FX fetch failed");
  }
  const rates = json.rates as Record<Currency, number>;
  return { base, rates };
}

/**
 * Convert an amount from `from` to `to` using the compact table.
 * Er-API returns rates as: 1 base = X target
 */
export function fxConvert(
  amount: number,
  from: Currency,
  to: Currency,
  fx: FxTable | null
): number {
  if (!fx) return amount; // graceful fallback
  if (from === to) return amount;

  // If table base equals `from`: amount_in_to = amount * rate[to]
  if (fx.base === from) return amount * fx.rates[to];

  // If table base equals `to`: amount_in_to = amount / rate[from]
  if (fx.base === to) return amount / fx.rates[from];

  // Otherwise: convert via base
  // from -> base -> to:  amount_in_base = amount / rate[from]; then * rate[to]
  return (amount / fx.rates[from]) * fx.rates[to];
}
