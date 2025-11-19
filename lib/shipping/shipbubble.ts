/**
 * Shipbubble client (production-hardened)
 *
 * … existing header comment left as-is …
 */

type ShipbubbleOk<T> = { status: "success"; message?: string; data: T };
type ShipbubbleErr = { status: "failed" | "error"; message?: string; errors?: any };
type ShipbubbleResp<T> = ShipbubbleOk<T> | ShipbubbleErr;

const API_BASE = process.env.SHIPBUBBLE_API_BASE || "https://api.shipbubble.com/v1";
const API_KEY = process.env.SHIPBUBBLE_API_KEY || "";
const DEBUG = process.env.SHIPBUBBLE_DEBUG === "1";

function assertApiKey() {
  if (!API_KEY) {
    throw new Error("SHIPBUBBLE_API_KEY not set");
  }
}

function redact(v: unknown, left = 8, right = 4) {
  if (typeof v !== "string" || v.length <= left + right) return v ?? "";
  return `${v.slice(0, left)}…${v.slice(-right)}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sbFetch<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number; retry?: number } = {}
): Promise<ShipbubbleOk<T>> {
  assertApiKey();

  const { timeoutMs = 15000, retry = 3, headers, ...rest } = init;

  let attempt = 0;
  const base = 500;

  while (true) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...rest,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
          "X-Client": "marobi/shipbubble",
          ...(headers || {}),
        },
        signal: controller.signal,
        cache: "no-store",
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        const text = await res.text().catch(() => "");
        if (!res.ok) {
          if (DEBUG) {
            console.error("[Shipbubble] Non-JSON error", { path, status: res.status, body: text.slice(0, 500) });
          }
          throw new Error(`Shipbubble HTTP ${res.status}`);
        }
        json = {};
      }

      const isError =
        !res.ok ||
        (json as ShipbubbleErr).status === "failed" ||
        (json as ShipbubbleErr).status === "error";

      if (isError) {
        const errPayload = json as ShipbubbleErr;
        const message = errPayload?.message || `Shipbubble HTTP ${res.status}`;
        const retriable = res.status === 429 || res.status >= 500;

        if (DEBUG) {
          console.error("[Shipbubble] HTTP error", {
            path,
            status: res.status,
            message: errPayload?.message,
            errors: errPayload?.errors,
            retriable,
            attempt,
          });
        }

        if (retriable && attempt < retry) {
          const delay = Math.round(base * Math.pow(2, attempt - 1) * (1 + Math.random()));
          await sleep(delay);
          continue;
        }

        throw new Error(message);
      }

      return json as ShipbubbleOk<T>;
    } catch (err: any) {
      const isAbort = err?.name === "AbortError";
      const retriable = isAbort || /network|fetch/i.test(String(err?.message || err));

      if (DEBUG) {
        console.warn("[Shipbubble] fetch error", { path, attempt, isAbort, message: String(err?.message || err) });
      }

      if (retriable && attempt < retry) {
        const delay = Math.round(base * Math.pow(2, attempt - 1) * (1 + Math.random()));
        await sleep(delay);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ───────────────────────── Address Validation (EXACT) ───────────────────────── */

export interface AddressValidateBody {
  phone: string;
  email: string;
  name: string;
  address: string;
}

export interface ValidatedAddressData {
  address_code: number;
  formatted_address: string;
  country?: string;
  country_code?: string;
  state?: string;
  state_code?: string;
  city?: string;
  city_code?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  [k: string]: any;
}

type ValidateResp = ValidatedAddressData;

export async function validateAddressExact(input: AddressValidateBody): Promise<ValidatedAddressData> {
  if (DEBUG) {
    console.log("[Shipbubble][Address][validate] input:", {
      name: input.name,
      email: input.email,
      phone: input.phone,
      addressSample: input.address?.slice(0, 48),
    });
  }

  const resp = await sbFetch<ValidateResp>("/shipping/address/validate", {
    method: "POST",
    body: JSON.stringify(input),
  });

  const data = (resp as any).data ?? {};
  if (!data?.address_code) {
    if (DEBUG) console.error("[Shipbubble][Address][validate] missing address_code", data);
    throw new Error("Shipbubble could not validate this address.");
  }

  if (DEBUG) {
    console.log("[Shipbubble][Address][validate] success:", {
      address_code: data.address_code,
      formatted_address: data.formatted_address,
    });
  }

  return data as ValidatedAddressData;
}

/* ─────────────────────────────── Boxes (GET) ─────────────────────────────── */

export type BoxSize = {
  box_size_id: number;
  name: string;
  description_image_url?: string;
  height: number;
  width: number;
  length: number;
  max_weight: number;
};

export async function fetchBoxes(): Promise<BoxSize[]> {
  const resp = await sbFetch<BoxSize[]>("/shipping/labels/boxes", { method: "GET" });
  const arr = Array.isArray((resp as any).data) ? ((resp as any).data as BoxSize[]) : [];
  if (DEBUG) console.log("[Shipbubble][Boxes] fetched:", arr.length);
  return arr;
}

export function pickBoxForWeight(totalWeightKg: number, boxes: BoxSize[]): BoxSize | null {
  const sorted = [...boxes].sort((a, b) => Number(a.max_weight) - Number(b.max_weight));
  const chosen = sorted.find((b) => Number(b.max_weight) >= Number(totalWeightKg)) || null;

  if (DEBUG) {
    console.log("[Shipbubble][Boxes] pickBoxForWeight:", {
      totalWeightKg,
      available: boxes.length,
      chosen: chosen ? { name: chosen.name, max_weight: chosen.max_weight } : null,
    });
  }

  return chosen;
}

/* ─────────────────────── Courier Integrations (NEW) ─────────────────────── */

export type CourierIntegration = {
  name: string;          // e.g., "Redstar", "GIG logistics", "Dellyman"
  service_code: string;  // e.g., "red_star_courier", "gigl", "dellyman"
  origin_country?: string;
  international?: boolean;
  domestic?: boolean;
  status?: string;
  [k: string]: any;
};

export async function fetchCourierIntegrations(): Promise<CourierIntegration[]> {
  const resp = await sbFetch<CourierIntegration[]>("/shipping/couriers", { method: "GET" });
  const list = Array.isArray((resp as any)?.data) ? ((resp as any).data as CourierIntegration[]) : [];
  if (DEBUG) console.log("[Shipbubble][Couriers] fetched:", list.length);
  return list;
}

/* ─────────────────────────────── Rates (EXACT) ───────────────────────────── */

export type PackageItem = {
  name: string;
  description?: string;
  unit_weight: number; // KG
  unit_amount: number; // numeric price, currency-less
  quantity: number;
};

export type PackageDimension = {
  length: number;
  width: number;
  height: number;
};

/** Shipbubble field is "reciever_address_code" (sic). */
export type FetchRatesBody = {
  sender_address_code: number;
  reciever_address_code: number;
  pickup_date: string; // YYYY-MM-DD
  category_id: number;
  package_items: PackageItem[];
  package_dimension?: PackageDimension;
  delivery_instructions?: string;
};

export type RatesRespRaw = {
  request_token?: string;
  couriers?: Array<{
    courier_id: string | number;
    courier_name: string;
    service_code: string;
    total: number;
    currency: string;
    delivery_eta?: string;
    pickup_eta?: string;
    [k: string]: any;
  }>;
  [k: string]: any;
};

export async function fetchRatesExact(body: FetchRatesBody): Promise<RatesRespRaw> {
  if (DEBUG) {
    console.log("[Shipbubble][Rates][fetch] body:", {
      sender_address_code: body.sender_address_code,
      reciever_address_code: body.reciever_address_code,
      pickup_date: body.pickup_date,
      category_id: body.category_id,
      package_items_count: body.package_items?.length ?? 0,
    });
  }

  const resp = await sbFetch<RatesRespRaw>("/shipping/fetch_rates", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = (resp as any).data as RatesRespRaw;
  if (DEBUG) {
    console.log("[Shipbubble][Rates][fetch] success:", {
      token: redact(data?.request_token),
      couriers: (data?.couriers || []).length,
    });
  }
  return data;
}

/** NEW: selected-couriers endpoint */
export async function fetchRatesForSelected(serviceCodesCsv: string, body: FetchRatesBody): Promise<RatesRespRaw> {
  if (DEBUG) {
    console.log("[Shipbubble][Rates][selected] codes:", serviceCodesCsv);
  }
  const resp = await sbFetch<RatesRespRaw>(`/shipping/fetch_rates/${encodeURIComponent(serviceCodesCsv)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = (resp as any).data as RatesRespRaw;
  if (DEBUG) {
    console.log("[Shipbubble][Rates][selected] success:", {
      token: redact(data?.request_token),
      couriers: (data?.couriers || []).length,
    });
  }
  return data;
}

/** Normalizers unchanged */
export type NormalizedRate = {
  id: string;
  courierId: string;
  courierName: string;
  serviceCode: string;
  total: number;
  currency: string;
  deliveryEtaText?: string;
  pickupEtaText?: string;
};

export function normalizeRates(raw: RatesRespRaw): NormalizedRate[] {
  const list = raw?.couriers || [];
  return list.map((c) => ({
    id: `${String(c.courier_id)}:${c.service_code}`,
    courierId: String(c.courier_id),
    courierName: c.courier_name,
    serviceCode: c.service_code,
    total: Number(c.total) || 0,
    currency: c.currency,
    deliveryEtaText: c.delivery_eta,
    pickupEtaText: c.pickup_eta,
  }));
}

export function chooseBestRate(
  rates: NormalizedRate[],
  strategy: "cheapest" | "fastest" = "cheapest"
): NormalizedRate | null {
  if (!rates.length) return null;
  if (strategy === "cheapest") {
    return [...rates].sort((a, b) => a.total - b.total)[0];
  }
  const withParsed = rates.map((r) => {
    const num = (r.deliveryEtaText || "").match(/\d+/)?.[0];
    const days = num ? Number(num) : Infinity;
    return { r, days };
  });
  return withParsed.sort((a, b) => a.days - b.days)[0]?.r ?? rates[0];
}

/* ───────────────────────── Label creation (unchanged) ────────────────────── */

export type ShipbubbleShipmentData = {
  order_id?: string;
  courier?: { name?: string; email?: string; phone?: string };
  status?: string;
  ship_from?: any;
  ship_to?: any;
  payment?: any;
  items?: any[];
  tracking_url?: string;
  date?: string;
  [k: string]: any;
};

export type ShipbubbleCreateShipmentResponse = ShipbubbleOk<ShipbubbleShipmentData>;

export async function createShipmentLabelExact({
  requestToken,
  serviceCode,
  courierId,
  insuranceCode,
  isCodLabel,
}: {
  requestToken: string;
  serviceCode: string;
  courierId: string;
  insuranceCode?: string;
  isCodLabel?: boolean;
}): Promise<ShipbubbleCreateShipmentResponse> {
  if (DEBUG) {
    console.log("[Shipbubble][Label][create] about to call API:", {
      token: redact(requestToken),
      serviceCode,
      courierId,
      hasInsurance: !!insuranceCode,
      isCodLabel: !!isCodLabel,
    });
  }

  const body: {
    request_token: string;
    service_code: string;
    courier_id: string;
    insurance_code?: string;
    is_cod_label?: boolean;
  } = {
    request_token: requestToken,
    service_code: serviceCode,
    courier_id: courierId,
  };
  if (insuranceCode) body.insurance_code = insuranceCode;
  if (typeof isCodLabel === "boolean") body.is_cod_label = isCodLabel;

  const resp = await sbFetch<ShipbubbleShipmentData>("/shipping/labels", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: 20000,
  });

  if (DEBUG) {
    console.log("[Shipbubble][Label][create] success:", {
      order_id: (resp as any)?.data?.order_id,
      tracking_url: (resp as any)?.data?.tracking_url,
      status: (resp as any)?.status,
    });
  }

  return resp as ShipbubbleCreateShipmentResponse;
}

/* Optional convenience type kept, unchanged */
export type DeliveryDetailsV1 = {
  version: 1;
  provider: "Shipbubble";
  quote: {
    quoteId?: string;
    serviceCode: string;
    courier: string;
    currency: "NGN" | "USD" | "EUR" | "GBP";
    amount: number;
    deliveryEtaDays?: number;
  };
  parcel: {
    weightKg: number;
    dimensionsCm?: { l: number; w: number; h: number };
    pieces?: number;
  };
  addresses: {
    from: { country: string; city: string; line1: string };
    to: { country: string; city: string; line1: string; phone?: string; email?: string };
  };
  label?: { labelUrl?: string; airwayBill?: string; requestTokenPreview?: string };
  tracking?: { trackingNumber?: string; status?: string; lastUpdateAt?: string };
  raw?: unknown;
};

export function buildDeliveryDetailsV1(args: {
  requestToken?: string;
  rate: NormalizedRate;
  totalWeightKg: number;
  dims?: { l: number; w: number; h: number };
  from: { country: string; city: string; line1: string };
  to: { country: string; city: string; line1: string; phone?: string; email?: string };
  raw?: unknown;
}): DeliveryDetailsV1 {
  return {
    version: 1,
    provider: "Shipbubble",
    quote: {
      quoteId: args.requestToken,
      serviceCode: args.rate.serviceCode,
      courier: args.rate.courierName,
      currency: args.rate.currency as DeliveryDetailsV1["quote"]["currency"],
      amount: args.rate.total,
      deliveryEtaDays: Number(args.rate.deliveryEtaText?.match(/\d+/)?.[0] || ""),
    },
    parcel: { weightKg: args.totalWeightKg, dimensionsCm: args.dims },
    addresses: { from: args.from, to: args.to },
    raw: args.raw,
  };
}
