export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

type RC = {
  name?: { common?: string };
  cca2?: string;
  idd?: { root?: string; suffixes?: string[] };
};

function callingCodesFromIdd(idd?: RC["idd"]): string[] {
  if (!idd?.root) return [];
  if (!idd.suffixes?.length) return [idd.root];
  return idd.suffixes.map((s) => `${idd.root}${s}`);
}

export async function GET() {
  // Defensive timeout so the handler never hangs
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(
      "https://restcountries.com/v3.1/all?fields=name,cca2,idd",
      {
        next: { revalidate: 60 * 60 * 24 }, // 1 day edge cache
        signal: controller.signal,
      }
    );

    if (!res.ok) throw new Error(`restcountries ${res.status}`);

    const data = (await res.json()) as RC[];

    const list = data
      .filter(Boolean)
      .map((r) => ({
        name: r.name?.common ?? "",
        iso2: r.cca2 ?? "",
        callingCodes: callingCodesFromIdd(r.idd),
      }))
      .filter((c) => c.name && c.iso2) // keep clean
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(list, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
      },
    });
  } catch (err) {
    console.error("Country proxy error:", err);

    // Tiny fallback so your UI still works if upstream is down
    const fallback = [
      { name: "Ghana", iso2: "GH", callingCodes: ["+233"] },
      { name: "Nigeria", iso2: "NG", callingCodes: ["+234"] },
      { name: "South Africa", iso2: "ZA", callingCodes: ["+27"] },
      { name: "United Kingdom", iso2: "GB", callingCodes: ["+44"] },
      { name: "United States", iso2: "US", callingCodes: ["+1"] },
    ].sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(fallback, {
      status: 200,
      headers: {
        "X-Fallback": "1",
        "Cache-Control": "public, max-age=300",
      },
    });
  } finally {
    clearTimeout(t);
  }
}
