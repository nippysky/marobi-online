
"use client";


/**
 * Admin Offline Sale form (Production-safe)
 *
 * Key fixes:
 * - Removed nested setItems() updates (prod batching-safe).
 * - Color/Size start blank (placeholders), user must pick.
 * - Size disabled until color is selected.
 * - Strong types (no `any`), lint-clean.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, PlusCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useCountryState } from "@/lib/hooks/useCheckoutForm";

/* ────────────────────────────────────────────────────────────────
   Currency (client mirror)
   ──────────────────────────────────────────────────────────────── */
enum Currency {
  NGN = "NGN",
  USD = "USD",
  EUR = "EUR",
  GBP = "GBP",
}

/* ────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────── */
interface DBVariant {
  color: string;
  size: string;
  stock: number;
}

interface DBProduct {
  id: string;
  name: string;
  variants: DBVariant[];
  sizeMods: boolean;
  images: string[];
  priceNGN?: number | null;
  priceUSD?: number | null;
  priceEUR?: number | null;
  priceGBP?: number | null;
}

interface CustomSize {
  chest?: string;
  hips?: string;
  length?: string;
  waist?: string;
}

interface LineItem {
  id: string;
  productId: string;
  productName: string;
  variants: DBVariant[];

  colorOptions: string[];
  sizeOptions: string[];

  color: string; // "" means not chosen yet
  size: string;  // "" means not chosen yet

  maxQty: number; // 0 means unknown until chosen
  quantity: number;

  hasSizeMod: boolean;
  supportsSizeMod: boolean;
  customSize?: CustomSize;
  productImages: string[];

  prices: {
    NGN: number;
    USD: number;
    EUR: number;
    GBP: number;
  };
}

type DeliveryKind = "COURIER" | "PICKUP";

interface DeliveryOption {
  id: string;
  name: string;
  provider?: string | null;
  pricingMode?: "FIXED" | "EXTERNAL";
  baseFee?: number | null;
  baseCurrency?: Currency | null;
  active: boolean;
  metadata?: Record<string, unknown>;
  _kind?: DeliveryKind;
}

type PaymentMethod = "Cash" | "Transfer" | "Card";

interface Props {
  staffId: string;
}

interface CustomerSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

/* ────────────────────────────────────────────────────────────────
   Shipbubble types
   ──────────────────────────────────────────────────────────────── */
type ShipbubbleRate = {
  id: string;
  courierName: string;
  serviceCode: string;
  fee: number;
  currency: "NGN" | "USD" | "EUR" | "GBP";
  eta?: string | null;
  raw?: unknown;
};

type ShipbubbleRateApiItem = {
  courierCode: string | null;
  courierName: string;
  serviceCode: string;
  fee: number;
  currency: string;
  eta?: string | null;
  raw?: unknown;
};

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */
function unique(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeVariant(v: DBVariant): DBVariant {
  return {
    color: (v.color || "").trim() || "N/A",
    size: (v.size || "").trim() || "N/A",
    stock: typeof v.stock === "number" ? v.stock : 0,
  };
}

function sizesForColor(variants: DBVariant[], color: string): string[] {
  return unique(variants.filter(v => v.color === color).map(v => v.size));
}

function stockFor(variants: DBVariant[], color: string, size: string): number {
  const m = variants.find(v => v.color === color && v.size === size);
  return typeof m?.stock === "number" ? m.stock : 0;
}

/** Country ISO → flag emoji */
const flagEmoji = (iso2: string) =>
  (iso2 || "")
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );

function buildPhonePlaceholder(dialCode: string): string {
  if ((dialCode || "").startsWith("+234")) return "8112345678";
  return "local number without country code";
}

function normalizeLocalPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  return digits;
}

/* ────────────────────────────────────────────────────────────────
   Debounced callback (no stale closures)
   ──────────────────────────────────────────────────────────────── */
function useDebouncedCallback<T extends (...args: never[]) => void>(
  fn: T,
  delay: number
) {
  const fnRef = useRef(fn);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  return useCallback(
    (...args: Parameters<T>) => {
      if (tRef.current) clearTimeout(tRef.current);
      tRef.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay]
  );
}

/* ────────────────────────────────────────────────────────────────
   Delivery Selector helpers (moved OUT for exhaustive-deps)
   ──────────────────────────────────────────────────────────────── */
function deriveDeliveryKind(o: Pick<DeliveryOption, "name" | "provider" | "metadata">): DeliveryKind {
  const name = String(o?.name ?? "").toLowerCase();
  const provider = String(o?.provider ?? "").toLowerCase();
  const metaKind = String((o?.metadata as Record<string, unknown> | undefined)?.kind ?? "").toLowerCase();
  if (name.includes("pickup") || provider.includes("pickup") || metaKind === "pickup") return "PICKUP";
  return "COURIER";
}

function createVirtualPickup(currency: Currency): DeliveryOption {
  return {
    id: "__pickup__",
    name: "In-person Pickup",
    provider: null,
    pricingMode: "FIXED",
    baseFee: 0,
    baseCurrency: currency,
    active: true,
    metadata: { kind: "pickup", virtual: true },
    _kind: "PICKUP",
  };
}

function createShipbubbleOption(currency: Currency): DeliveryOption {
  return {
    id: "__shipbubble__",
    name: "Shipbubble Delivery (live rates)",
    provider: "Shipbubble",
    pricingMode: "EXTERNAL",
    baseFee: 0,
    baseCurrency: currency,
    active: true,
    metadata: { kind: "shipbubble", virtual: true },
    _kind: "COURIER",
  };
}

/* ────────────────────────────────────────────────────────────────
   Delivery Selector component
   ──────────────────────────────────────────────────────────────── */
interface DeliverySelectorProps {
  currency: Currency;
  selectedOption: DeliveryOption | null;
  deliveryFee: number;
  deliveryDetails: string;
  onOptionChange: (opt: DeliveryOption) => void;
  onFeeChange: (fee: number) => void;
  onDetailsChange: (details: string) => void;
}

const DeliverySelector: React.FC<DeliverySelectorProps> = ({
  currency,
  selectedOption,
  deliveryFee,
  deliveryDetails,
  onOptionChange,
  onFeeChange,
  onDetailsChange,
}) => {
  const [options, setOptions] = useState<DeliveryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOptions() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/delivery-options?active=true");
        if (!res.ok) throw new Error(`Failed to load: ${res.statusText}`);
        const raw = (await res.json()) as unknown;

        const list = Array.isArray(raw) ? raw : [];
        const normalized: DeliveryOption[] = list.map((o: any) => ({
          id: String(o.id),
          name: String(o.name),
          provider: o.provider ?? null,
          pricingMode: o.pricingMode ?? "FIXED",
          baseFee: typeof o.baseFee === "number" ? o.baseFee : 0,
          baseCurrency: (o.baseCurrency as Currency | null) ?? null,
          active: o.active ?? true,
          metadata: (o.metadata as Record<string, unknown> | undefined) ?? undefined,
          _kind: deriveDeliveryKind({
            name: o.name,
            provider: o.provider,
            metadata: o.metadata,
          }),
        }));

        const hasPickup = normalized.some((o) => (o._kind ?? "COURIER") === "PICKUP");
        const withPickup = hasPickup ? normalized : [...normalized, createVirtualPickup(currency)];

        const hasShipbubble = withPickup.some((o) => o.id === "__shipbubble__");
        const finalList = hasShipbubble ? withPickup : [...withPickup, createShipbubbleOption(currency)];

        if (!cancelled) setOptions(finalList);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Unable to load options");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchOptions();
    return () => {
      cancelled = true;
    };
  }, [currency]);

  const grouped = {
    COURIER: options.filter((o) => (o._kind ?? "COURIER") === "COURIER"),
    PICKUP: options.filter((o) => o._kind === "PICKUP"),
  };

  const currencySym =
    currency === Currency.NGN ? "₦" :
    currency === Currency.USD ? "$" :
    currency === Currency.EUR ? "€" : "£";

  const isPickup =
    selectedOption?._kind === "PICKUP" ||
    (selectedOption?.metadata as Record<string, unknown> | undefined)?.kind === "pickup";

  const isShipbubble =
    selectedOption?.id === "__shipbubble__" ||
    (selectedOption?.metadata as Record<string, unknown> | undefined)?.kind === "shipbubble";

  return (
    <div className="space-y-5 border rounded-xl p-5 bg-white shadow-sm">
      <div className="flex justify-between items-center">
        <div className="font-semibold">Delivery / Fulfillment</div>
        {loading && (
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Loader2 className="animate-spin" size={14} /> Loading options
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600">
          Could not load delivery options: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col">
          <div className="text-xs font-semibold mb-1">Method</div>
          <Select
            value={selectedOption?.id || ""}
            onValueChange={(v) => {
              const opt = options.find((o) => o.id === v);
              if (!opt) return;

              onOptionChange(opt);

              const metaKind = String((opt.metadata as Record<string, unknown> | undefined)?.kind ?? "");
              const isPickupNow = opt._kind === "PICKUP" || metaKind === "pickup";
              const isShipbubbleNow = opt.id === "__shipbubble__" || metaKind === "shipbubble";

              if (isPickupNow) {
                onFeeChange(0);
                return;
              }
              if (isShipbubbleNow) return;

              onFeeChange(Number(opt.baseFee ?? 0));
            }}
            disabled={loading || options.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loading ? "Loading..." : "Select delivery option"} />
            </SelectTrigger>
            <SelectContent>
              {grouped.COURIER.length > 0 && grouped.PICKUP.length > 0 && (
                <div className="px-3 py-1 text-[10px] uppercase text-gray-400">
                  Couriers
                </div>
              )}

              {(grouped.PICKUP.length > 0 ? grouped.COURIER : options).map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name} {o.provider ? `(${o.provider})` : ""}
                </SelectItem>
              ))}

              {grouped.PICKUP.length > 0 && (
                <>
                  <div className="px-3 py-1 text-[10px] uppercase text-gray-400">
                    Pickup / Walk-in
                  </div>
                  {grouped.PICKUP.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>

          {selectedOption && (
            <div className="mt-2 text-xs text-gray-500">
              {isShipbubble ? (
                <>
                  Uses live courier quotes from{" "}
                  <span className="font-semibold">Shipbubble</span>. Delivery fee is set from the selected rate.
                </>
              ) : (
                <>
                  Pricing:{" "}
                  <span className="font-medium">{selectedOption.pricingMode ?? "FIXED"}</span>
                  {typeof selectedOption.baseFee === "number" && !isPickup && (
                    <>
                      {" • "}Base fee:{" "}
                      <span className="font-mono">
                        {selectedOption.baseCurrency || currency}{" "}
                        {Number(selectedOption.baseFee).toLocaleString()}
                      </span>
                    </>
                  )}
                  {isPickup && (
                    <>
                      {" • "}Fee: <span className="font-mono">{currencySym}0</span>
                    </>
                  )}
                  {selectedOption.provider && <> {" • "}Provider: {selectedOption.provider}</>}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="text-xs font-semibold mb-1">Fee</div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              value={deliveryFee}
              onChange={(e) => onFeeChange(Number(e.target.value))}
              placeholder="Fee"
              disabled={!selectedOption || isPickup}
            />
            <div className="flex items-center text-sm text-gray-500">
              {selectedOption && !isShipbubble && (
                <div>
                  suggested:&nbsp;
                  <span className="font-mono">
                    {currencySym}{(isPickup ? 0 : Number(selectedOption.baseFee ?? 0)).toLocaleString()}
                  </span>
                </div>
              )}
              {selectedOption && isShipbubble && (
                <div className="text-xs text-gray-500">
                  Auto-filled from Shipbubble rate (override allowed).
                </div>
              )}
            </div>
          </div>
          <div className="text-[10px] text-gray-500">
            {isPickup ? "In-person pickup: fee is always 0." : "You can override the suggested fee if needed."}
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="text-xs font-semibold mb-1">Details / Notes</div>
        <Input
          placeholder={isPickup ? "Pickup note (person, ID, time, etc.)" : "Tracking number, courier ref, etc."}
          value={deliveryDetails}
          onChange={(e) => onDetailsChange(e.target.value)}
          disabled={!selectedOption}
        />
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ──────────────────────────────────────────────────────────────── */
export default function OfflineSaleForm({ staffId }: Props) {
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState<Record<string, DBProduct[]>>({});
  const [searchingProductRowId, setSearchingProductRowId] = useState<string | null>(null);

  const [mode, setMode] = useState<"existing" | "guest">("existing");
  const [existingCustomerId, setExistingCustomerId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [customerSearch, setCustomerSearch] = useState<CustomerSearchResult[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  const [guest, setGuest] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneLocal: "",
    address: "",
  });

  const {
    countryList,
    country,
    setCountry,
    stateList,
    state,
    setState,
    phoneCode,
    setPhoneCode,
    phoneOptions,
  } = useCountryState(undefined, undefined);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const currency = Currency.NGN;
  const [loading, setLoading] = useState(false);

  const [successSummary, setSuccessSummary] = useState<{
    orderId: string;
    items: LineItem[];
    paymentMethod: PaymentMethod;
    deliveryOption?: string;
    deliveryFee?: number;
  } | null>(null);

  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [deliveryDetails, setDeliveryDetails] = useState<string>("");

  const [sbRates, setSbRates] = useState<ShipbubbleRate[]>([]);
  const [sbRequestToken, setSbRequestToken] = useState<string | null>(null);
  const [sbLoading, setSbLoading] = useState(false);
  const [sbError, setSbError] = useState<string | null>(null);
  const [selectedSbRate, setSelectedSbRate] = useState<ShipbubbleRate | null>(null);

  const isShipbubbleSelected =
    deliveryOption?.id === "__shipbubble__" ||
    String((deliveryOption?.metadata as Record<string, unknown> | undefined)?.kind ?? "") === "shipbubble";

  const canNext =
    step === 1
      ? items.length > 0 &&
        items.every((i) => i.productId && i.productName && i.color !== "" && i.size !== "" && i.quantity > 0)
      : step === 2
      ? mode === "existing"
        ? !!existingCustomerId
        : !!(
            guest.firstName &&
            guest.lastName &&
            guest.email &&
            guest.phoneLocal &&
            guest.address &&
            country?.name &&
            state
          )
      : true;

  const canSubmit = step === 3 && canNext && !!deliveryOption && (!isShipbubbleSelected || !!selectedSbRate);

  const addRow = () =>
    setItems((s) => [
      ...s,
      {
        id: uuid(),
        productId: "",
        productName: "",
        variants: [],
        colorOptions: [],
        sizeOptions: [],
        color: "",
        size: "",
        maxQty: 0,
        quantity: 1,
        hasSizeMod: false,
        supportsSizeMod: false,
        customSize: {},
        productImages: [],
        prices: { NGN: 0, USD: 0, EUR: 0, GBP: 0 },
      },
    ]);

  const removeRow = (id: string) => setItems((s) => s.filter((i) => i.id !== id));

  /* ────────────────────────────────────────────────────────────────
     Product search & selection
     ──────────────────────────────────────────────────────────────── */
  const fetchProducts = useCallback(async (rowId: string, q: string) => {
    if (!q || q.length < 2) {
      setProductSearch((p) => ({ ...p, [rowId]: [] }));
      setSearchingProductRowId(null);
      return;
    }

    setSearchingProductRowId(rowId);
    try {
      const res = await fetch(`/api/search-products?query=${encodeURIComponent(q)}`);
      const data = (await res.json()) as DBProduct[];
      setProductSearch((p) => ({ ...p, [rowId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error(err);
      setProductSearch((p) => ({ ...p, [rowId]: [] }));
    } finally {
      setSearchingProductRowId(null);
    }
  }, []);

  const debouncedFetchProducts = useDebouncedCallback(
    (rowId: string, q: string) => fetchProducts(rowId, q),
    300
  );

  function selectProduct(rowId: string, product: DBProduct) {
    const normalizedVariants = (product.variants || []).map(normalizeVariant);

    const colors = unique(normalizedVariants.map((v) => v.color));
    const allSizes = unique(normalizedVariants.map((v) => v.size));

    // Auto-set ONLY when the only option is N/A (meaning: conceptually "no option")
    const autoColor = colors.length === 1 && colors[0] === "N/A" ? "N/A" : "";
    const autoSize = allSizes.length === 1 && allSizes[0] === "N/A" ? "N/A" : "";

    const initialSizeOptions = autoColor ? sizesForColor(normalizedVariants, autoColor) : [];

    const initialMaxQty =
      autoColor !== "" && autoSize !== ""
        ? stockFor(normalizedVariants, autoColor, autoSize)
        : 0;

    setItems((prev) =>
      prev.map((i) =>
        i.id === rowId
          ? {
              ...i,
              productId: product.id,
              productName: product.name,
              variants: normalizedVariants,

              colorOptions: colors,
              sizeOptions: initialSizeOptions,

              color: autoColor,
              size: autoSize,

              maxQty: initialMaxQty,
              quantity: 1,

              hasSizeMod: false,
              supportsSizeMod: !!product.sizeMods,
              customSize: {},

              productImages: product.images || [],
              prices: {
                NGN: product.priceNGN ?? 0,
                USD: product.priceUSD ?? 0,
                EUR: product.priceEUR ?? 0,
                GBP: product.priceGBP ?? 0,
              },
            }
          : i
      )
    );

    setProductSearch((p) => ({ ...p, [rowId]: [] }));
  }

  /**
   * ✅ Production-safe: one setItems() update per change.
   * No nested updates. No side-effect updates inside updater.
   */
  function updateRow(rowId: string, field: "color" | "size" | "quantity" | "hasSizeMod" | keyof CustomSize, value: string | number | boolean) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== rowId) return i;

        // COLOR change: reset size; populate sizeOptions for that color
        if (field === "color") {
          const newColor = String(value);

          const newSizeOptions = newColor ? sizesForColor(i.variants, newColor) : [];
          // force explicit choice unless it's only N/A
          const autoSize = newSizeOptions.length === 1 && newSizeOptions[0] === "N/A" ? "N/A" : "";

          const maxQty =
            newColor !== "" && autoSize !== ""
              ? stockFor(i.variants, newColor, autoSize)
              : 0;

          return {
            ...i,
            color: newColor,
            sizeOptions: newSizeOptions,
            size: autoSize,
            maxQty,
            quantity: 1,
          };
        }

        // SIZE change: compute stock; clamp qty
        if (field === "size") {
          const newSize = String(value);
          const newColor = i.color;

          const maxQty =
            newColor !== "" && newSize !== ""
              ? stockFor(i.variants, newColor, newSize)
              : 0;

          const clampedQty =
            maxQty > 0 ? Math.min(Math.max(1, i.quantity), maxQty) : 1;

          return {
            ...i,
            size: newSize,
            maxQty,
            quantity: clampedQty,
          };
        }

        if (field === "quantity") {
          const qty = Number(value);
          const max = i.maxQty > 0 ? i.maxQty : 1;
          return { ...i, quantity: Math.min(Math.max(1, qty), max) };
        }

        if (field === "hasSizeMod") {
          const checked = Boolean(value);
          return {
            ...i,
            hasSizeMod: checked,
            customSize: checked ? (i.customSize || {}) : {},
          };
        }

        if (["chest", "hips", "length", "waist"].includes(field)) {
          return {
            ...i,
            customSize: {
              ...(i.customSize || {}),
              [field]: String(value),
            },
          };
        }

        return i;
      })
    );
  }

  /* ────────────────────────────────────────────────────────────────
     Customer search
     ──────────────────────────────────────────────────────────────── */
  const fetchCustomers = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setCustomerSearch([]);
      return;
    }

    setSearchingCustomer(true);
    try {
      const res = await fetch(`/api/search-customers?query=${encodeURIComponent(q)}`);
      const data = (await res.json()) as CustomerSearchResult[];
      setCustomerSearch(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setCustomerSearch([]);
    } finally {
      setSearchingCustomer(false);
    }
  }, []);

  const debouncedFetchCustomers = useDebouncedCallback((q: string) => fetchCustomers(q), 300);

  function selectCustomer(c: CustomerSearchResult) {
    setExistingCustomerId(c.id);
    setSelectedCustomer(c);
    setCustomerSearch([]);
  }

  /* ────────────────────────────────────────────────────────────────
     Pricing helpers
     ──────────────────────────────────────────────────────────────── */
  const getUnitPrice = (item: LineItem) => item.prices.NGN;

  const computeSizeModFee = (item: LineItem) => {
    if (!item.hasSizeMod) return 0;
    const base = getUnitPrice(item) * item.quantity;
    return +(base * 0.05).toFixed(2);
  };

  const currencySymbol = "₦";
  const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const itemsSubtotal = items.reduce((sum, item) => {
    const unit = getUnitPrice(item) || 0;
    return sum + unit * (item.quantity || 0);
  }, 0);

  const sizeModsTotal = items.reduce((sum, item) => sum + computeSizeModFee(item), 0);
  const orderTotal = itemsSubtotal + sizeModsTotal + (deliveryFee || 0);

  const deliveryLabel = deliveryOption
    ? deliveryOption.id === "__pickup__" ||
      String((deliveryOption.metadata as Record<string, unknown> | undefined)?.kind ?? "") === "pickup"
      ? "Pickup"
      : deliveryOption.id === "__shipbubble__" ||
        String((deliveryOption.metadata as Record<string, unknown> | undefined)?.kind ?? "") === "shipbubble"
      ? "Shipbubble"
      : deliveryOption.name
    : "Not set";

  /* ────────────────────────────────────────────────────────────────
     Guest phone helpers
     ──────────────────────────────────────────────────────────────── */
  const phonePlaceholder = useMemo(() => buildPhonePlaceholder(phoneCode), [phoneCode]);

  const phoneDigits = `${phoneCode}${guest.phoneLocal}`.replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 8;

  const handleGuestPhoneChange = useCallback((raw: string) => {
    const normalized = normalizeLocalPhone(raw);
    setGuest((g) => ({ ...g, phoneLocal: normalized }));
  }, []);

  /* ────────────────────────────────────────────────────────────────
     Shipbubble
     ──────────────────────────────────────────────────────────────── */
  const shipbubbleFormReady =
    mode === "guest" &&
    guest.firstName.trim() &&
    guest.lastName.trim() &&
    guest.email.trim() &&
    phoneValid &&
    guest.address.trim() &&
    !!country?.name &&
    !!state;

  const totalWeightKg = useMemo(() => +(totalItems * 0.5).toFixed(3), [totalItems]);
  const totalValue = useMemo(() => +(itemsSubtotal + sizeModsTotal).toFixed(2), [itemsSubtotal, sizeModsTotal]);

  const getShipbubbleRates = async () => {
    if (!shipbubbleFormReady) {
      toast.error("Fill guest name, email, phone, address, country & state to fetch Shipbubble rates.");
      return;
    }

    const fullName = `${guest.firstName.trim()} ${guest.lastName.trim()}`.trim();

    try {
      setSbLoading(true);
      setSbError(null);
      setSbRates([]);
      setSbRequestToken(null);
      setSelectedSbRate(null);

      const resp = await fetch("/api/shipping/shipbubble/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: {
            name: fullName,
            email: guest.email,
            phone: `${phoneCode}${guest.phoneLocal}`,
            address: guest.address,
            state,
            country: country?.name,
          },
          total_weight_kg: totalWeightKg,
          total_value: totalValue,
          items: items.map((i) => ({
            name: i.productName || "Item",
            description: i.hasSizeMod ? "Custom sized apparel" : "Offline sale item",
            unitWeightKG: 0.5,
            unitAmount: getUnitPrice(i) + (i.quantity ? computeSizeModFee(i) / i.quantity : 0),
            quantity: i.quantity,
          })),
          pickup_days_from_now: 1,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json?.error || "Could not fetch Shipbubble rates. Please check the address.");
      }

      const rawRates: ShipbubbleRateApiItem[] = Array.isArray(json?.rates) ? json.rates : [];

      const mapped: ShipbubbleRate[] = rawRates.map((r, idx) => ({
        id: `${r.courierCode || r.courierName || "c"}-${r.serviceCode}-${idx}`,
        courierName: r.courierName,
        serviceCode: r.serviceCode,
        fee: Number(r.fee) || 0,
        currency: (r.currency || "NGN") as ShipbubbleRate["currency"],
        eta: r.eta ?? null,
        raw: r.raw ?? r,
      }));

      setSbRates(mapped);
      setSbRequestToken(json?.requestToken || json?.request_token || null);

      if (!mapped.length) {
        toast("No Shipbubble options available for this address.", { icon: "ℹ️" });
      } else {
        toast.success("Shipbubble delivery options loaded.");
      }
    } catch (err: unknown) {
      console.error(err);
      const msg =
        err instanceof Error
          ? err.message
          : "Sorry, we couldn't fetch Shipbubble rates. Make sure the address is complete and valid.";
      setSbError(msg);
      toast.error(msg);
    } finally {
      setSbLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSbRate && isShipbubbleSelected) setDeliveryFee(selectedSbRate.fee || 0);
  }, [selectedSbRate, isShipbubbleSelected]);

  /* ────────────────────────────────────────────────────────────────
     Submit
     ──────────────────────────────────────────────────────────────── */
  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);

    try {
      const isPickup =
        deliveryOption?.id === "__pickup__" ||
        String((deliveryOption?.metadata as Record<string, unknown> | undefined)?.kind ?? "") === "pickup";

      const payload = {
        items: items.map((i) => ({
          productId: i.productId,
          color: i.color,
          size: i.size,
          quantity: i.quantity,
          hasSizeMod: i.hasSizeMod,
          customSize: i.hasSizeMod ? i.customSize : undefined,
        })),
        customer:
          mode === "existing"
            ? { id: existingCustomerId }
            : {
                firstName: guest.firstName,
                lastName: guest.lastName,
                email: guest.email,
                phone: `${phoneCode}${guest.phoneLocal}`,
                address: guest.address,
                country: country?.name,
                state,
              },
        paymentMethod,
        currency: "NGN",
        staffId,
        timestamp: new Date().toISOString(),
        deliveryOptionId: isPickup || isShipbubbleSelected ? undefined : deliveryOption?.id,
        deliveryFee: isPickup ? 0 : deliveryFee,
        deliveryDetails: isPickup
          ? deliveryDetails
            ? `PICKUP: ${deliveryDetails}`
            : "PICKUP"
          : isShipbubbleSelected
          ? {
              source: "Shipbubble",
              requestToken: sbRequestToken,
              rate: selectedSbRate,
              note: deliveryDetails || null,
            }
          : deliveryDetails || undefined,
      };

      const res = await fetch("/api/offline-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to log sale");
        return;
      }

      toast.success("Offline sale logged!");
      setSuccessSummary({
        orderId: data.orderId,
        items: [...items],
        paymentMethod,
        deliveryOption: deliveryLabel,
        deliveryFee: isPickup ? 0 : deliveryFee,
      });

      // reset
      setItems([]);
      setMode("existing");
      setExistingCustomerId("");
      setSelectedCustomer(null);
      setGuest({ firstName: "", lastName: "", email: "", phoneLocal: "", address: "" });
      setPaymentMethod("Cash");
      setDeliveryOption(null);
      setDeliveryFee(0);
      setDeliveryDetails("");
      setSbRates([]);
      setSelectedSbRate(null);
      setSbRequestToken(null);
      setSbError(null);
      setStep(1);
    } catch (err) {
      console.error(err);
      toast.error("Failed to log sale");
    } finally {
      setLoading(false);
    }
  }

  /* ────────────────────────────────────────────────────────────────
     UI
     ──────────────────────────────────────────────────────────────── */
  return (
    <Card className="max-w-6xl mx-auto shadow-2xl ring-1 ring-slate-200">
      <CardHeader className="pb-0">
        <CardTitle>
          <nav className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-1">
            {["Products", "Customer", "Payment"].map((lbl, i) => {
              const active = step === i + 1;
              return (
                <button
                  key={lbl}
                  disabled={i + 1 > step || loading}
                  onClick={() => setStep(i + 1)}
                  className={`rounded-md py-2 text-center text-sm transition-all ${
                    active ? "bg-white shadow-sm font-semibold text-gray-900" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {lbl}
                </button>
              );
            })}
          </nav>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {successSummary && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <h3 className="font-bold text-green-800">Sale Logged!</h3>
            <p className="text-sm">
              <strong>Order ID:</strong> {successSummary.orderId}
            </p>
            <p className="text-sm">
              <strong>Payment:</strong> {successSummary.paymentMethod}
            </p>
            {successSummary.deliveryOption && (
              <p className="text-sm">
                <strong>Delivery:</strong> {successSummary.deliveryOption}{" "}
                {typeof successSummary.deliveryFee === "number" && (
                  <>
                    • Fee: <span className="font-mono">{successSummary.deliveryFee.toFixed(2)}</span>
                  </>
                )}
              </p>
            )}
            <div className="mt-2">
              <ul className="list-disc pl-5 text-sm">
                {successSummary.items.map((it) => (
                  <li key={it.id}>
                    {it.productName} ({it.color}/{it.size}) × {it.quantity}{" "}
                    {it.hasSizeMod && `(Custom sizing applied 5%)`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-full bg-slate-50 px-4 py-2 text-xs border border-slate-200">
            <span className="font-semibold text-slate-800">
              Total:{" "}
              <span className="font-mono">
                {currencySymbol}
                {orderTotal.toLocaleString()}
              </span>
            </span>

            <span className="h-4 w-px bg-slate-300" />

            <span className="text-slate-600">
              Items: <span className="font-medium">{totalItems} {totalItems === 1 ? "item" : "items"}</span>
            </span>

            <span className="h-4 w-px bg-slate-300" />

            <span className="text-slate-600">
              Delivery:{" "}
              <span className={deliveryLabel === "Not set" ? "font-semibold text-amber-700" : "font-medium"}>
                {deliveryLabel}
              </span>
              {deliveryLabel !== "Not set" && (
                <>
                  {" "}• Fee:{" "}
                  <span className="font-mono">
                    {currencySymbol}{(deliveryFee || 0).toLocaleString()}
                  </span>
                </>
              )}
            </span>

            <span className="h-4 w-px bg-slate-300" />

            <span className="text-slate-600">
              Payment: <span className="font-medium">{paymentMethod}</span>
            </span>
          </div>
        )}

        {/* STEP 1: PRODUCTS */}
        {step === 1 && (
          <div className="space-y-6">
            {items.length === 0 && (
              <div className="border border-dashed border-gray-300 rounded-xl py-12 flex flex-col items-center justify-center gap-4 bg-white">
                <div className="text-lg font-semibold">
                  Start by adding a product to log an offline sale
                </div>
                <Button onClick={addRow} disabled={loading} size="lg">
                  <PlusCircle className="mr-2" /> Add Product
                </Button>
              </div>
            )}

            {items.map((row) => {
              const productHasColor =
                row.colorOptions.length > 0 &&
                !(row.colorOptions.length === 1 && row.colorOptions[0] === "N/A");

              const productHasSize =
                row.sizeOptions.length > 0 &&
                !(row.sizeOptions.length === 1 && row.sizeOptions[0] === "N/A");

              const unitPrice = getUnitPrice(row);
              const sizeModFee = computeSizeModFee(row);

              const readyForQty = row.color !== "" && row.size !== "" && row.maxQty > 0;

              return (
                <div
                  key={row.id}
                  className="grid grid-cols-12 gap-4 items-start bg-white p-5 rounded-xl shadow-sm border"
                >
                  {/* Thumbnail & search */}
                  <div className="col-span-12 md:col-span-4 flex gap-3 items-start relative">
                    <div className="w-16 h-16 bg-slate-100 rounded overflow-hidden border flex-shrink-0">
                      {row.productImages[0] ? (
                        <img
                          src={row.productImages[0]}
                          alt={row.productName}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="flex items-center justify-center text-xs text-gray-400 h-full">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="flex-1 relative">
                      <Input
                        placeholder="Search product…"
                        value={row.productName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItems((prev) =>
                            prev.map((i) =>
                              i.id === row.id
                                ? {
                                    ...i,
                                    productName: val,
                                    variants: [],
                                    productId: "",
                                    colorOptions: [],
                                    sizeOptions: [],
                                    color: "",
                                    size: "",
                                    maxQty: 0,
                                    quantity: 1,
                                    prices: { NGN: 0, USD: 0, EUR: 0, GBP: 0 },
                                    supportsSizeMod: false,
                                    hasSizeMod: false,
                                    customSize: {},
                                  }
                                : i
                            )
                          );
                          debouncedFetchProducts(row.id, val);
                        }}
                        disabled={loading}
                      />

                      {searchingProductRowId === row.id && (
                        <div className="absolute right-3 top-3 text-gray-400">
                          <Loader2 className="animate-spin" size={16} />
                        </div>
                      )}

                      {productSearch[row.id]?.length > 0 && (
                        <div className="absolute z-20 bg-white border mt-1 rounded shadow max-h-56 overflow-auto w-[min(560px,90vw)]">
                          {productSearch[row.id].map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer gap-3"
                              onClick={() => selectProduct(row.id, p)}
                            >
                              <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0 border">
                                {p.images?.[0] ? (
                                  <img
                                    src={p.images[0]}
                                    alt={p.name}
                                    className="object-cover w-full h-full"
                                  />
                                ) : (
                                  <div className="text-[10px] text-gray-500 flex items-center justify-center h-full">
                                    No image
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 text-sm">
                                <div className="font-medium">{p.name}</div>
                                <div className="text-xs text-gray-500">{p.id}</div>
                              </div>
                              <div className="text-[11px] px-2 py-1 rounded bg-indigo-50">
                                {p.sizeMods ? "Size mods enabled" : "No size mods"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Color */}
                  <div className="col-span-6 md:col-span-2">
                    <div className="text-xs font-semibold mb-1">Color</div>
                    {productHasColor ? (
                      <Select
                        value={row.color}
                        onValueChange={(v) => updateRow(row.id, "color", v)}
                        disabled={loading || !row.productId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select color" />
                        </SelectTrigger>
                        <SelectContent>
                          {row.colorOptions.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-sm text-gray-600 py-2 px-3 bg-slate-50 rounded">
                        No colors
                      </div>
                    )}
                  </div>

                  {/* Size */}
                  <div className="col-span-6 md:col-span-2">
                    <div className="text-xs font-semibold mb-1">Size</div>
                    {productHasColor ? (
                      <Select
                        value={row.size}
                        onValueChange={(v) => updateRow(row.id, "size", v)}
                        disabled={loading || !row.productId || row.color === "" || row.sizeOptions.length === 0}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {row.sizeOptions.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      // If no real color system, allow size options if they exist; else show "No sizes"
                      productHasSize ? (
                        <Select
                          value={row.size}
                          onValueChange={(v) => updateRow(row.id, "size", v)}
                          disabled={loading || !row.productId}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {row.sizeOptions.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm text-gray-600 py-2 px-3 bg-slate-50 rounded">
                          No sizes
                        </div>
                      )
                    )}
                  </div>

                  {/* Quantity + stock */}
                  <div className="col-span-6 md:col-span-2">
                    <div className="text-xs font-semibold mb-1">
                      Quantity{" "}
                      <span className="text-[10px] text-gray-500">
                        (Available: {readyForQty ? row.maxQty : "—"})
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <Input
                        type="number"
                        min={1}
                        max={readyForQty ? row.maxQty : 1}
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, "quantity", +e.target.value)}
                        disabled={loading || !readyForQty}
                      />
                      <div className="text-[10px] text-gray-500 mt-1">
                        {readyForQty ? `Max allowed is ${row.maxQty}` : "Select color and size to unlock quantity."}
                      </div>
                    </div>
                  </div>

                  {/* Custom size block */}
                  <div className="col-span-6 md:col-span-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">Custom Size?</div>
                      {row.supportsSizeMod ? (
                        <label className="inline-flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={row.hasSizeMod}
                            onChange={(e) => updateRow(row.id, "hasSizeMod", e.target.checked)}
                            disabled={loading}
                            className="h-4 w-4"
                          />
                          <span>Apply</span>
                        </label>
                      ) : (
                        <div className="text-[11px] text-gray-400">Not supported</div>
                      )}
                    </div>

                    {row.hasSizeMod && (
                      <>
                        <div className="text-[12px]">
                          Size modification fee (5%):{" "}
                          <span className="font-mono">
                            {currencySymbol}{sizeModFee.toLocaleString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Chest"
                            value={row.customSize?.chest || ""}
                            onChange={(e) => updateRow(row.id, "chest", e.target.value)}
                            disabled={loading}
                            className="text-sm"
                          />
                          <Input
                            placeholder="Waist"
                            value={row.customSize?.waist || ""}
                            onChange={(e) => updateRow(row.id, "waist", e.target.value)}
                            disabled={loading}
                            className="text-sm"
                          />
                          <Input
                            placeholder="Hips"
                            value={row.customSize?.hips || ""}
                            onChange={(e) => updateRow(row.id, "hips", e.target.value)}
                            disabled={loading}
                            className="text-sm"
                          />
                          <Input
                            placeholder="Length"
                            value={row.customSize?.length || ""}
                            onChange={(e) => updateRow(row.id, "length", e.target.value)}
                            disabled={loading}
                            className="text-sm"
                          />
                        </div>
                      </>
                    )}

                    {!row.hasSizeMod && row.supportsSizeMod && (
                      <div className="text-[10px] text-gray-500">
                        Enable custom sizing if customer wants adjustments (5%).
                      </div>
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="col-span-6 md:col-span-3">
                    <div className="text-xs font-semibold mb-1">Pricing</div>
                    <div className="text-sm bg-slate-50 rounded p-2 border">
                      <div>
                        Unit:{" "}
                        <span className="font-mono">
                          {currencySymbol}{unitPrice.toLocaleString()}
                        </span>
                      </div>
                      {row.hasSizeMod && (
                        <div className="text-[12px] text-gray-600">
                          + Size mod fee:{" "}
                          <span className="font-mono">
                            {currencySymbol}{sizeModFee.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Remove row */}
                  <div className="col-span-12 md:col-span-1 flex md:justify-end items-start">
                    <button
                      onClick={() => removeRow(row.id)}
                      disabled={loading}
                      aria-label="Remove line item"
                      className="text-red-600 hover:bg-red-50 rounded p-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={addRow} disabled={loading}>
                <PlusCircle className="mr-2" /> Add Product
              </Button>
              <div className="text-sm text-gray-500">
                Start by searching for a product. Remove all to reset.
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: CUSTOMER */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-8">
              {(["existing", "guest"] as const).map((m) => (
                <label key={m} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="customerMode"
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    className="accent-indigo-600"
                  />
                  <span className="capitalize">{m === "existing" ? "Existing Customer" : "Guest"}</span>
                </label>
              ))}
            </div>

            {mode === "existing" ? (
              <div className="relative max-w-md">
                <Input
                  placeholder="Search by name, email, or phone…"
                  value={existingCustomerId}
                  onChange={(e) => {
                    setExistingCustomerId(e.target.value);
                    setSelectedCustomer(null);
                    debouncedFetchCustomers(e.target.value);
                  }}
                  disabled={loading}
                />
                {selectedCustomer && (
                  <div className="mt-1 text-sm text-gray-700">
                    Selected:{" "}
                    <span className="font-medium">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </span>
                  </div>
                )}
                {searchingCustomer && (
                  <div className="absolute right-2 top-2 text-gray-400">
                    <Loader2 className="animate-spin" size={16} />
                  </div>
                )}
                {customerSearch.length > 0 && (
                  <div className="absolute z-10 bg-white border mt-1 rounded shadow max-h-60 overflow-auto w-full">
                    {customerSearch.map((c) => (
                      <div
                        key={c.id}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                        onClick={() => selectCustomer(c)}
                      >
                        <div className="text-sm">
                          {c.firstName} {c.lastName}{" "}
                          <span className="text-xs text-gray-500">
                            ({c.email} • {c.phone})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold mb-1 block">First Name</label>
                    <Input
                      value={guest.firstName}
                      onChange={(e) => setGuest((g) => ({ ...g, firstName: e.target.value }))}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1 block">Last Name</label>
                    <Input
                      value={guest.lastName}
                      onChange={(e) => setGuest((g) => ({ ...g, lastName: e.target.value }))}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1 block">Email</label>
                    <Input
                      type="email"
                      value={guest.email}
                      onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1 block">Phone Number</label>
                    <div className="flex">
                      <Select value={phoneCode} onValueChange={setPhoneCode}>
                        <SelectTrigger className="w-32 mr-2">
                          <SelectValue placeholder={phoneCode} />
                        </SelectTrigger>
                        <SelectContent>
                          {phoneOptions.map(({ code, iso2 }) => (
                            <SelectItem key={code} value={code}>
                              <span className="mr-1">{flagEmoji(iso2)}</span>
                              {code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="flex-1">
                        <Input
                          type="tel"
                          value={guest.phoneLocal}
                          placeholder={phonePlaceholder}
                          onChange={(e) => handleGuestPhoneChange(e.currentTarget.value)}
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <p className="mt-1 text-[11px] text-gray-500">
                      Enter only the local number here (no country code or leading zero). We apply{" "}
                      <span className="font-medium">{phoneCode}</span>.
                    </p>

                    {!phoneValid && guest.phoneLocal && (
                      <p className="mt-1 text-[11px] text-red-600">Enter a valid phone number.</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1 block">Country</label>
                    {countryList.length === 0 ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select
                        value={country?.name}
                        onValueChange={(val) => {
                          const sel = countryList.find((c) => c.name === val);
                          if (sel) setCountry(sel);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {countryList.map((c) => (
                            <SelectItem key={c.name} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold mb-1 block">State / Region</label>
                    {country && stateList.length === 0 ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select value={state} onValueChange={setState}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {stateList.map((st) => (
                            <SelectItem key={st} value={st}>
                              {st}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1 block">Address</label>
                  <Textarea
                    value={guest.address}
                    onChange={(e) => setGuest((g) => ({ ...g, address: e.target.value }))}
                    disabled={loading}
                    rows={3}
                    placeholder="e.g., 63 Birnin Kebbi Crescent, Garki 2, Abuja, Nigeria"
                  />
                  {!guest.address.trim() && (
                    <p className="mt-1 text-[11px] text-gray-500">
                      Include street, area, city/town, state and country for accurate delivery.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: PAYMENT */}
        {step === 3 && (
          <div className="space-y-6">
            <section className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col">
                <div className="text-xs font-semibold mb-1">Payment Method</div>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Payment Method" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["Cash", "Transfer", "Card"] as const).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col">
                <div className="text-xs font-semibold mb-1">Currency</div>
                <Input value="NGN" disabled className="bg-slate-50" />
              </div>
            </section>

            <DeliverySelector
              currency={currency}
              selectedOption={deliveryOption}
              deliveryFee={deliveryFee}
              deliveryDetails={deliveryDetails}
              onOptionChange={setDeliveryOption}
              onFeeChange={setDeliveryFee}
              onDetailsChange={setDeliveryDetails}
            />

            {isShipbubbleSelected && (
              <div className="space-y-4 border rounded-xl p-5 bg-slate-50">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-semibold">Shipbubble Rates</div>
                    <p className="text-xs text-gray-600 mt-1">
                      Uses guest customer address to fetch live courier quotes.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-full"
                    onClick={getShipbubbleRates}
                    disabled={sbLoading || !shipbubbleFormReady}
                  >
                    {sbLoading ? "Fetching rates…" : "Get Shipbubble rates"}
                  </Button>
                </div>

                {!shipbubbleFormReady && (
                  <p className="text-xs text-amber-600">
                    Ensure guest details (name, email, phone, address, country and state) are filled before fetching rates.
                  </p>
                )}

                {sbError && <p className="text-xs text-red-600">{sbError}</p>}

                {!sbLoading && sbRates.length > 0 && (
                  <div className="grid gap-3">
                    {sbRates.map((r) => {
                      const isSelected = selectedSbRate?.id === r.id;
                      return (
                        <label
                          key={r.id}
                          className={`border rounded-lg p-3 flex justify-between items-start cursor-pointer ${
                            isSelected ? "ring-2 ring-brand bg-white" : "bg-white"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{r.courierName}</div>
                            <div className="text-xs text-gray-600">
                              {r.eta ? `ETA: ${r.eta}` : "ETA will be provided at label creation"}
                            </div>
                            <div className="text-sm mt-1">
                              Fee: <span className="font-mono">₦{(r.fee || 0).toLocaleString()}</span>
                            </div>
                          </div>
                          <input
                            type="radio"
                            name="shipbubbleRate"
                            checked={isSelected}
                            onChange={() => setSelectedSbRate(r)}
                            className="ml-2 mt-1"
                          />
                        </label>
                      );
                    })}
                  </div>
                )}

                {sbLoading && <p className="text-xs text-gray-600">Fetching live Shipbubble rates…</p>}

                {!sbLoading && sbRates.length === 0 && !sbError && (
                  <p className="text-xs text-gray-600">Click “Get Shipbubble rates” to view available couriers.</p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex gap-2">
          <Button variant="outline" disabled={step === 1 || loading} onClick={() => setStep((s) => Math.max(1, s - 1))}>
            Back
          </Button>
        </div>

        <div className="flex gap-2 ml-auto">
          {step < 3 ? (
            <Button disabled={!canNext || loading} onClick={() => canNext && setStep((s) => s + 1)}>
              Next
            </Button>
          ) : (
            <Button disabled={!canSubmit || loading} onClick={handleSubmit}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={16} />
                  Logging…
                </>
              ) : (
                "Log Offline Sale"
              )}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
