// lib/shipping/quote.cjs
/**
 * Minimal dynamic quote façade.
 * - For FIXED options, use the DeliveryOption.baseFee at checkout.
 * - For EXTERNAL options, call getExternalQuote(...) below.
 *
 * Replace the stub in getExternalQuote with your provider (DHL/FedEx) SDK call.
 */

const DEFAULTS = {
  currency: "NGN",
  // Fallbacks for mock pricing
  basePerKg: { NGN: 3500, USD: 4.5, EUR: 4.2, GBP: 3.8 },
  zoneMultiplier: { local: 1.0, regional: 1.25, international: 1.75 },
};

/**
 * Calculate a *mock* external quote so your flow works pre-integration.
 * Replace with real provider request/response mapping.
 */
async function getExternalQuote({
  provider = process.env.DEFAULT_INTL_PROVIDER || "DHL",
  weightKg,
  fromCountry,
  toCountry,
  currency = DEFAULTS.currency,
}) {
  const isInternational = fromCountry && toCountry && fromCountry !== toCountry;
  const zone = isInternational ? "international" : "regional";
  const perKg = DEFAULTS.basePerKg[currency] ?? DEFAULTS.basePerKg.NGN;
  const mult = DEFAULTS.zoneMultiplier[zone] ?? 1.5;

  const minBillable = Math.max(weightKg, 0.5);
  const amount = Math.round(perKg * minBillable * mult * 100) / 100;

  return {
    provider,
    currency,
    amount,
    meta: {
      computedAt: new Date().toISOString(),
      zone,
      minBillable,
    },
  };
}

module.exports = {
  getExternalQuote,
};
