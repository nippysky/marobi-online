// app/api/shipping/shipbubble/rates/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  AddressValidateBody,
  validateAddressExact,
  fetchRatesExact,
  fetchBoxes,
  pickBoxForWeight,
  type PackageItem,
  fetchCourierIntegrations,
  fetchRatesForSelected,
} from "@/lib/shipping/shipbubble";

// Helpers
function isoDatePlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const CATEGORY_ID = Number(process.env.SHIPBUBBLE_CATEGORY_ID || "90097994");
const DEFAULT_INSTRUCTIONS = "Handle with care";

const includesCI = (hay?: string, needle?: string) =>
  (hay || "").toLowerCase().includes((needle || "").toLowerCase());

/** Normalize country strings for address lines (e.g. "NG" -> "Nigeria"). */
function normalizeCountryForAddress(country: string | undefined | null) {
  const raw = (country || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) {
    if (upper === "NG") return "Nigeria";
    return raw;
  }
  return raw;
}

/** Avoid "Lagos, Lagos" in `"city, state"` when they are the same. */
function pushCityState(parts: string[], city?: string | null, state?: string | null) {
  const c = (city || "").trim();
  const s = (state || "").trim();
  if (c && s && c.toLowerCase() !== s.toLowerCase()) {
    parts.push(c, s);
  } else if (c) {
    parts.push(c);
  } else if (s) {
    parts.push(s);
  }
}

// Client’s courier policy (by human names)
const LAGOS_NAMES = ["Stallion King", "Dellyman", "Fez Delivery"];
const NIGERIA_OUTSIDE_LAGOS_NAMES = ["Fez Delivery", "Red star", "GIG Logistics"];

/* ───────────────────────────── ORIGIN: dynamic resolver ───────────────────────────── */

const ORIGIN_ENV = {
  name: process.env.SHIPBUBBLE_ORIGIN_NAME || "",
  email: process.env.SHIPBUBBLE_ORIGIN_EMAIL || "",
  phone: process.env.SHIPBUBBLE_ORIGIN_PHONE || "",
  street: process.env.SHIPBUBBLE_ORIGIN_STREET || "",
  city: process.env.SHIPBUBBLE_ORIGIN_CITY || "",
  state: process.env.SHIPBUBBLE_ORIGIN_STATE || "",
  country: process.env.SHIPBUBBLE_ORIGIN_COUNTRY || "",
};

/** Build a single-line origin address string per Shipbubble’s recommendation. */
function buildOriginSingleLine(): string {
  const parts: string[] = [];
  const street = ORIGIN_ENV.street.trim();
  const city = ORIGIN_ENV.city.trim();
  const state = ORIGIN_ENV.state.trim();
  const country = normalizeCountryForAddress(ORIGIN_ENV.country);

  if (street) parts.push(street);
  pushCityState(parts, city, state);
  if (country) parts.push(country);

  return parts.join(", ");
}

function originEnvIsSane(): boolean {
  return (
    ORIGIN_ENV.name.trim() !== "" &&
    ORIGIN_ENV.email.trim() !== "" &&
    ORIGIN_ENV.phone.trim() !== "" &&
    ORIGIN_ENV.street.trim() !== "" &&
    ORIGIN_ENV.city.trim() !== "" &&
    ORIGIN_ENV.state.trim() !== "" &&
    ORIGIN_ENV.country.trim() !== ""
  );
}

/**
 * Resolve ORIGIN on every request via /shipping/address/validate
 * - No memory cache
 * - Throws if validation fails or address_code is missing
 */
async function getOriginAddressCode(): Promise<number> {
  if (!originEnvIsSane()) {
    throw new Error(
      "Shipbubble origin env is incomplete. Check SHIPBUBBLE_ORIGIN_* variables."
    );
  }

  const originAddress = buildOriginSingleLine();
  const originBody: AddressValidateBody = {
    name: ORIGIN_ENV.name,
    email: ORIGIN_ENV.email,
    phone: ORIGIN_ENV.phone,
    address: originAddress,
  };

  const validated = await validateAddressExact(originBody);
  const code = Number(validated?.address_code || 0);

  if (!code || Number.isNaN(code)) {
    throw new Error(
      "Shipbubble could not validate the origin address. Please review the SHIPBUBBLE_ORIGIN_* values."
    );
  }

  return code;
}

/* ───────────────────────── Destination helpers ───────────────────────── */

type DestinationPayload = AddressValidateBody & {
  city?: string;
  state?: string;
  country?: string;
};

/**
 * Build the exact address string Shipbubble likes.
 */
function buildDestinationSingleLine(dest: DestinationPayload): string {
  const parts: string[] = [];
  const base = (dest.address || "").trim();
  const city = (dest.city || "").trim();
  const state = (dest.state || "").trim();
  const country = normalizeCountryForAddress(dest.country);

  if (base) parts.push(base);
  pushCityState(parts, city, state);
  if (country) parts.push(country);

  return parts.join(", ");
}

/* ─────────────────────────────────────────────────────────────────────────── */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const destRaw = body?.destination as DestinationPayload;
    const totalWeight = Number(body?.total_weight_kg || 0);
    const totalValue = Number(body?.total_value || 0);
    const pickupDays = Math.min(Math.max(Number(body?.pickup_days_from_now ?? 1), 0), 7);

    if (!destRaw?.address || !destRaw?.name || !destRaw?.email || !destRaw?.phone) {
      return NextResponse.json(
        { error: "destination { name, email, phone, address } are required for rates lookup" },
        { status: 400 }
      );
    }
    if (!totalWeight || totalWeight <= 0) {
      return NextResponse.json({ error: "total_weight_kg must be > 0" }, { status: 400 });
    }

    // Build the single-line address we validate with Shipbubble
    const destAddress = buildDestinationSingleLine(destRaw);
    const destForValidate: AddressValidateBody = {
      name: destRaw.name,
      email: destRaw.email,
      phone: destRaw.phone,
      address: destAddress,
    };

    // 1) Resolve ORIGIN dynamically (source of truth).
    const originCode = await getOriginAddressCode();

    // 2) Validate receiver to get address_code & geo hints
    const validated = await validateAddressExact(destForValidate);
    const receiverCode = validated.address_code;

    const countryCode = (validated.country_code || validated.country || "").toUpperCase();
    const stateName = (validated.state || validated.state_code || "").toString();
    const cityName = (validated.city || validated.city_code || "").toString();
    const isNigeria = countryCode === "NG";
    const isLagos =
      isNigeria && (includesCI(stateName, "Lagos") || includesCI(cityName, "Lagos"));

    // 3) Boxes
    const boxes = await fetchBoxes().catch(() => [] as any[]);
    const chosen = pickBoxForWeight(totalWeight, boxes || []);

    // 4) package_items
    const itemsFromClient = Array.isArray(body?.items) ? body.items : [];
    let package_items: PackageItem[];

    if (itemsFromClient.length) {
      package_items = itemsFromClient.map((it: any) => ({
        name: String(it?.name ?? "Item"),
        description: String(it?.description ?? "Cart item"),
        unit_weight: Number(it?.unitWeightKG ?? it?.unit_weight ?? 0.5) || 0.5,
        unit_amount: Number(it?.unitAmount ?? it?.unit_amount ?? 0),
        quantity: Number(it?.quantity ?? 1) || 1,
      }));
    } else {
      package_items = [
        {
          name: "Cart items",
          description: "Consolidated package",
          unit_weight: Math.max(totalWeight, 0.1),
          unit_amount: Math.max(totalValue, 0),
          quantity: 1,
        },
      ];
    }

    const fetchBody = {
      sender_address_code: originCode,
      reciever_address_code: receiverCode,
      pickup_date: isoDatePlus(pickupDays),
      category_id: CATEGORY_ID,
      package_items,
      ...(chosen
        ? {
            package_dimension: {
              length: Number(chosen.length),
              width: Number(chosen.width),
              height: Number(chosen.height),
            },
          }
        : {}),
      delivery_instructions: DEFAULT_INSTRUCTIONS,
    };

    // 5) Filter couriers based on destination policy
    let raw;
    if (isNigeria && isLagos) {
      const integrations = await fetchCourierIntegrations();
      const selectedCodes = integrations
        .filter((c) => LAGOS_NAMES.some((n) => includesCI(c.name, n)))
        .map((c) => c.service_code)
        .filter(Boolean);

      raw =
        selectedCodes.length > 0
          ? await fetchRatesForSelected(selectedCodes.join(","), fetchBody)
          : await fetchRatesExact(fetchBody);
    } else if (isNigeria) {
      const integrations = await fetchCourierIntegrations();
      const selectedCodes = integrations
        .filter((c) => NIGERIA_OUTSIDE_LAGOS_NAMES.some((n) => includesCI(c.name, n)))
        .map((c) => c.service_code)
        .filter(Boolean);

      raw =
        selectedCodes.length > 0
          ? await fetchRatesForSelected(selectedCodes.join(","), fetchBody)
          : await fetchRatesExact(fetchBody);
    } else {
      raw = await fetchRatesExact(fetchBody);
    }

    const requestToken = raw?.request_token ? String(raw.request_token) : null;

    // ✅ Canonical rates response shape (client & server agree forever)
    const rates =
      (raw?.couriers || []).map((c: any) => {
        const courierId = c?.courier_id != null ? String(c.courier_id) : null;
        return {
          courierId,                 // ✅ canonical
          courierCode: courierId,    // ✅ kept for backward compatibility
          courierName: String(c?.courier_name || ""),
          serviceCode: String(c?.service_code || ""),
          fee: Number(c?.total || 0),
          currency: String(c?.currency || "NGN"),
          eta: String(c?.delivery_eta || c?.pickup_eta || ""),
          raw: c,
        };
      }) ?? [];

    return NextResponse.json(
      {
        rates,
        requestToken,        // ✅ canonical
        request_token: requestToken, // ✅ kept for backward compatibility
        box_used: chosen
          ? {
              name: chosen.name,
              length: chosen.length,
              width: chosen.width,
              height: chosen.height,
              max_weight: chosen.max_weight,
            }
          : null,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Shipbubble rates error:", {
      message: err?.message,
      httpStatus: err?.httpStatus,
      shipbubble: err?.shipbubble,
      stack: err?.stack,
    });

    return NextResponse.json(
      {
        error: err?.shipbubble?.message || err?.message || "Shipbubble rates failed",
        details: err?.shipbubble?.errors || undefined,
      },
      { status: 502 }
    );
  }
}
