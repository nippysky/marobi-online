import { Currency } from "./context/currencyContext";


/**
 * Given an amount and a target currency, return a localized currency string.
 * E.g. (12.345, "USD") → "$12.35"; (1000, "NGN") → "₦1,000.00"; (10.5, "EUR") → "€10.50".
 */
export function formatAmount(amount: number, currency: Currency): string {
  // Choose a locale that matches each currency:
  const locale =
    currency === "NGN"
      ? "en-NG"
      : currency === "USD"
      ? "en-US"
      : currency === "EUR"
      ? "de-DE"
      : "en-GB";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
