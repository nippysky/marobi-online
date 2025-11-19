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

const mask = (s?: string | null) => (s ? `${String(s).slice(0, 12)}…` : "(none)");
const includesCI = (hay?: string, needle?: string) =>
  (hay || "").toLowerCase().includes((needle || "").toLowerCase());

// Client’s courier policy (by human names)
const LAGOS_NAMES = ["Stallion King", "Dellyman", "Fez Delivery"];
const NIGERIA_OUTSIDE_LAGOS_NAMES = ["Fez Delivery", "Red star", "GIG Logistics"];

/* ───────────────────────────── ORIGIN: dynamic resolver ─────────────────────────────
   We validate the origin address using Shipbubble's global validator to obtain the
   latest authoritative address_code. We cache in-memory for a short TTL to avoid
   repeated validation on every request.
*/

const ORIGIN_ENV = {
  name: process.env.SHIPBUBBLE_ORIGIN_NAME || "",
  email: process.env.SHIPBUBBLE_ORIGIN_EMAIL || "",
  phone: process.env.SHIPBUBBLE_ORIGIN_PHONE || "",
  street: process.env.SHIPBUBBLE_ORIGIN_STREET || "",
  city: process.env.SHIPBUBBLE_ORIGIN_CITY || "",
  state: process.env.SHIPBUBBLE_ORIGIN_STATE || "",
  country: process.env.SHIPBUBBLE_ORIGIN_COUNTRY || "",
  fallbackCode: Number(process.env.SHIPBUBBLE_ORIGIN_ADDRESS_CODE || "0") || 0,
};

/** Build a single-line origin address string per Shipbubble’s recommendation. */
function buildOriginSingleLine(): string {
  const parts = [ORIGIN_ENV.street, ORIGIN_ENV.city, ORIGIN_ENV.state, ORIGIN_ENV.country]
    .map((s) => `${s}`.trim())
    .filter(Boolean);
  return parts.join(", ");
}

/** Basic sanity check so we don’t spam validator with empty inputs */
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

type OriginCache = { code: number; ts: number };
let ORIGIN_CACHE: OriginCache | null = null;
const ORIGIN_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function getOriginAddressCode(): Promise<number> {
  // Cache hit and fresh?
  const now = Date.now();
  if (ORIGIN_CACHE && now - ORIGIN_CACHE.ts < ORIGIN_TTL_MS && ORIGIN_CACHE.code > 0) {
    return ORIGIN_CACHE.code;
  }

  // Validate from env if sane
  if (originEnvIsSane()) {
    try {
      const originBody: AddressValidateBody = {
        name: ORIGIN_ENV.name,
        email: ORIGIN_ENV.email,
        phone: ORIGIN_ENV.phone,
        address: buildOriginSingleLine(),
      };
      const validated = await validateAddressExact(originBody);
      const code = Number(validated?.address_code || 0);
      if (code > 0) {
        ORIGIN_CACHE = { code, ts: now };
        return code;
      }
    } catch (e) {
      // fall through to fallback
      console.warn("[Shipbubble][Origin] validation failed; will use fallback code if available.");
    }
  } else {
    console.warn("[Shipbubble][Origin] env details incomplete; using fallback code if available.");
  }

  // Fallback to env static code if present
  if (ORIGIN_ENV.fallbackCode > 0) {
    ORIGIN_CACHE = { code: ORIGIN_ENV.fallbackCode, ts: now };
    return ORIGIN_ENV.fallbackCode;
  }

  // No way to proceed
  throw new Error(
    "Origin address could not be validated and no SHIPBUBBLE_ORIGIN_ADDRESS_CODE fallback was provided."
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Input:
    // {
    //   destination: { name, email, phone, address },
    //   total_weight_kg: number,
    //   total_value: number,
    //   items?: [{ name, description?, unitWeightKG, unitAmount, quantity }],
    //   pickup_days_from_now?: number
    // }

    const dest = body?.destination as AddressValidateBody;
    const totalWeight = Number(body?.total_weight_kg || 0);
    const totalValue = Number(body?.total_value || 0);
    const pickupDays = Math.min(Math.max(Number(body?.pickup_days_from_now ?? 1), 0), 7);

    if (!dest?.address || !dest?.name || !dest?.email || !dest?.phone) {
      return NextResponse.json(
        { error: "destination { name, email, phone, address } are required" },
        { status: 400 }
      );
    }
    if (!totalWeight || totalWeight <= 0) {
      return NextResponse.json({ error: "total_weight_kg must be > 0" }, { status: 400 });
    }

    // 1) Resolve ORIGIN dynamically (source of truth), with safe fallback.
    const originCode = await getOriginAddressCode();

    // 2) Validate receiver to get address_code & geo hints
    const validated = await validateAddressExact(dest);
    const receiverCode = validated.address_code;

    const countryCode = (validated.country_code || validated.country || "").toUpperCase();
    const stateName = (validated.state || validated.state_code || "").toString();
    const cityName = (validated.city || validated.city_code || "").toString();
    const isNigeria = countryCode === "NG";
    const isLagos = isNigeria && (includesCI(stateName, "Lagos") || includesCI(cityName, "Lagos"));

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
    let appliedFilter: "lagos" | "nigeria-other" | "all" = "all";

    if (isNigeria && isLagos) {
      appliedFilter = "lagos";
      const integrations = await fetchCourierIntegrations();
      const selectedCodes = integrations
        .filter((c) => LAGOS_NAMES.some((n) => includesCI(c.name, n)))
        .map((c) => c.service_code)
        .filter(Boolean);

      raw = selectedCodes.length > 0
        ? await fetchRatesForSelected(selectedCodes.join(","), fetchBody)
        : await fetchRatesExact(fetchBody);
    } else if (isNigeria) {
      appliedFilter = "nigeria-other";
      const integrations = await fetchCourierIntegrations();
      const selectedCodes = integrations
        .filter((c) => NIGERIA_OUTSIDE_LAGOS_NAMES.some((n) => includesCI(c.name, n)))
        .map((c) => c.service_code)
        .filter(Boolean);

      raw = selectedCodes.length > 0
        ? await fetchRatesForSelected(selectedCodes.join(","), fetchBody)
        : await fetchRatesExact(fetchBody);
    } else {
      appliedFilter = "all";
      raw = await fetchRatesExact(fetchBody);
    }

    const token = raw?.request_token || null;

    console.log(
      "[Shipbubble][Rates]",
      "token:", mask(token),
      "couriers:", (raw?.couriers || []).length,
      "country:", countryCode,
      "state:", stateName,
      "city:", cityName,
      "filter:", appliedFilter,
      "originCode:", originCode
    );

    const rates =
      (raw?.couriers || []).map((c) => ({
        courierName: c.courier_name,
        courierCode: c.courier_id,
        courierId: c.courier_id,
        serviceCode: c.service_code,
        fee: Number(c.total || 0),
        currency: c.currency || "NGN",
        eta: c.delivery_eta || c.pickup_eta || "",
        raw: c,
        request_token: token,
        requestToken: token,
      })) ?? [];

    return NextResponse.json(
      {
        rates,
        request_token: token,
        requestToken: token,
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
    console.error("Shipbubble rates error:", err);
    return NextResponse.json(
      { error: err?.message || "Shipbubble rates failed" },
      { status: 502 }
    );
  }
}
