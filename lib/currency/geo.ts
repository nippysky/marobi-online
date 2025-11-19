// lib/currency/geo.ts
export type Currency = "NGN" | "USD" | "EUR" | "GBP";

const EU_COUNTRIES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT",
  "LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"
]);

export function countryToCurrency(country?: string): Currency {
  if (!country) return "USD";
  const c = country.toUpperCase();
  if (c === "NG") return "NGN";             // Nigeria → NGN
  if (c === "GB") return "GBP";             // United Kingdom → GBP
  if (EU_COUNTRIES.has(c)) return "EUR";    // EU countries → EUR
  return "USD";                             // Rest of world → USD
}
