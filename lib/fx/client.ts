// lib/fx/client.ts
export async function fxConvert(from: string, to: string, amount: number) {
  const u = new URL("/api/fx/convert", window.location.origin);
  u.searchParams.set("from", from.toUpperCase());
  u.searchParams.set("to", to.toUpperCase());
  u.searchParams.set("amount", String(amount));
  const res = await fetch(u.toString(), { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "FX failed");
  return json as {
    from: string;
    to: string;
    amount: number;
    rate: number;
    converted: number;
    timestamp: number;
    nextUpdate: number;
  };
}

export async function fxQuoteNGN(ngn: number, to: string[]) {
  const u = new URL("/api/fx/quote", window.location.origin);
  u.searchParams.set("ngn", String(ngn));
  u.searchParams.set("to", to.map((s) => s.toUpperCase()).join(","));
  const res = await fetch(u.toString(), { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "FX failed");
  return json as {
    base: "NGN";
    amount: number;
    quotes: Record<string, { rate: number; converted: number }>;
    timestamp: number;
    nextUpdate: number;
  };
}
