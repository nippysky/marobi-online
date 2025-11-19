// app/api/delivery-options/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

/**
 * GET /api/delivery-options
 * Query params:
 *  - active: "true"|"1" | "false"|"0"
 *  - pricingMode: "FIXED" | "EXTERNAL"
 *  - provider: string
 *  - country: string (filters by metadata.countries if present)
 *
 * NOTE: `type` is no longer supported (PICKUP removed; model has no `type` field).
 */
export async function GET(req: NextRequest) {
  try {
    await prismaReady;

    const url = new URL(req.url);
    const activeParam = url.searchParams.get("active");
    const pricingModeParam = url.searchParams.get("pricingMode"); // FIXED | EXTERNAL
    const providerParam = url.searchParams.get("provider");
    const countryParam = url.searchParams.get("country");
    const legacyTypeParam = url.searchParams.get("type"); // no longer supported

    // Hard fail if legacy `type` is provided to avoid silent confusion
    if (legacyTypeParam !== null) {
      return NextResponse.json(
        { error: "`type` filter is no longer supported. Use pricingMode/provider instead." },
        { status: 400 }
      );
    }

    const where: any = {};

    if (activeParam !== null) {
      const raw = activeParam.toLowerCase();
      if (!["true", "1", "false", "0"].includes(raw)) {
        return NextResponse.json(
          { error: "Invalid `active` value; must be true/false or 1/0" },
          { status: 400 }
        );
      }
      where.active = ["true", "1"].includes(raw);
    }

    if (pricingModeParam) {
      const pm = pricingModeParam.toUpperCase();
      if (pm !== "FIXED" && pm !== "EXTERNAL") {
        return NextResponse.json(
          { error: "Invalid `pricingMode`; must be FIXED or EXTERNAL" },
          { status: 400 }
        );
      }
      where.pricingMode = pm; // matches enum DeliveryPricingMode
    }

    if (providerParam) {
      where.provider = providerParam;
    }

    let options = await prisma.deliveryOption.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Optional country filter via metadata.countries: string[]
    if (countryParam) {
      const wanted = countryParam.trim();
      options = options.filter((opt) => {
        const meta = opt.metadata as any;
        if (meta && Array.isArray(meta.countries)) {
          return meta.countries.includes(wanted);
        }
        // No country restriction present → include
        return true;
      });
    }

    // Shape response explicitly
    const result = options.map((o) => ({
      id: o.id,
      name: o.name,
      provider: o.provider,                 // e.g., "LocalCourier", "DHL", "FedEx"
      pricingMode: o.pricingMode,           // "FIXED" | "EXTERNAL"
      baseFee: o.baseFee,                   // present only for FIXED
      baseCurrency: o.baseCurrency,         // optional, pairs with baseFee
      active: o.active,
      metadata: o.metadata,                 // zones, countries, external IDs, etc.
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("GET /api/delivery-options error:", err);
    return NextResponse.json(
      { error: "Failed to fetch delivery options" },
      { status: 500 }
    );
  }
}
