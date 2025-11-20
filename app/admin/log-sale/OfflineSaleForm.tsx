"use client";

/**
 * Admin Offline Sale form
 * - Adds a virtual "In-person Pickup" delivery option (₦0) ONLY for admin offline sales.
 * - Does NOT modify schema or /api/delivery-options.
 * - When pickup is selected: fee is locked to 0 and fee input is disabled.
 * - On submit: omits deliveryOptionId (so server won't look up a fake id), forces fee 0,
 *   and prefixes details with "PICKUP:" (or just "PICKUP" if empty).
 */

import React, { useState, useRef, useEffect } from "react";
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
import { Trash2, PlusCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

// Local mirror of Prisma's Currency enum for client-side use
enum Currency {
  NGN = "NGN",
  USD = "USD",
  EUR = "EUR",
  GBP = "GBP",
}


/* ──────────────────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────────────────── */
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
  color: string;
  size: string;
  maxQty: number;
  quantity: number;
  hasSizeMod: boolean;
  supportsSizeMod: boolean; // derived from product.sizeMods
  customSize?: CustomSize; // only if hasSizeMod
  productImages: string[];
  prices: {
    NGN: number;
    USD: number;
    EUR: number;
    GBP: number;
  };
}

/** Derived grouping for UI only */
type DeliveryKind = "COURIER" | "PICKUP";

/** Shape used by DeliverySelector (superset of API response with a few UI helpers) */
interface DeliveryOption {
  id: string;
  name: string;
  provider?: string | null;
  pricingMode?: "FIXED" | "EXTERNAL";
  baseFee?: number | null;
  baseCurrency?: Currency | null;
  active: boolean;
  metadata?: Record<string, any>;
  /** derived on the client for grouping in the dropdown */
  _kind?: DeliveryKind;
}

type PaymentMethod = "Cash" | "Transfer" | "Card";

interface Props {
  staffId: string;
}

/* ──────────────────────────────────────────────────────────────────────────
   Debounce helper
   ────────────────────────────────────────────────────────────────────────── */
function useDebounce(callback: (...args: any[]) => void, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (...args: any[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Delivery Selector
   - Compatible with schema (no `type` field).
   - **Adds a virtual "In-person Pickup" option** for admin offline sales.
   - Groups options by derived kind; shows all even if all are courier.
   - When pickup is selected: fee input is disabled (locked to 0).
   ────────────────────────────────────────────────────────────────────────── */
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

  /** Helper: classify an option for grouping in the dropdown */
  function deriveKind(o: any): DeliveryKind {
    const name = String(o?.name ?? "").toLowerCase();
    const provider = String(o?.provider ?? "").toLowerCase();
    const metaKind = String(o?.metadata?.kind ?? "").toLowerCase();
    if (name.includes("pickup") || provider.includes("pickup") || metaKind === "pickup") {
      return "PICKUP";
    }
    return "COURIER";
  }

  /** Build a virtual pickup option (client-only; never saved to DB) */
  function createVirtualPickup(): DeliveryOption {
    return {
      id: "__pickup__", // synthetic id; never sent to server as deliveryOptionId
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

  useEffect(() => {
    let cancelled = false;

    async function fetchOptions() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/delivery-options?active=true");
        if (!res.ok) throw new Error(`Failed to load: ${res.statusText}`);
        const raw = (await res.json()) as any[];

        // Normalize API response to DeliveryOption
        const normalized: DeliveryOption[] = (raw || []).map((o) => ({
          id: o.id,
          name: o.name,
          provider: o.provider ?? null,
          pricingMode: o.pricingMode ?? "FIXED",
          baseFee: typeof o.baseFee === "number" ? o.baseFee : 0,
          baseCurrency: o.baseCurrency ?? null,
          active: o.active ?? true,
          metadata: o.metadata ?? undefined,
          _kind: deriveKind(o),
        }));

        // If no pickup-like option exists in DB, append our virtual pickup
        const hasPickup = normalized.some((o) => (o._kind ?? "COURIER") === "PICKUP");
        const withPickup = hasPickup ? normalized : [...normalized, createVirtualPickup()];

        if (!cancelled) setOptions(withPickup);
      } catch (e) {
        if (!cancelled) setError("Unable to load options");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchOptions();
    return () => {
      cancelled = true;
    };
  }, [currency]); // currency matters for the display currency on the virtual option

  /** Group for nicer UI sectioning */
  const grouped = {
    COURIER: options.filter((o) => (o._kind ?? "COURIER") === "COURIER"),
    PICKUP: options.filter((o) => o._kind === "PICKUP"),
  };

  const currencySym =
    currency === Currency.NGN ? "₦" :
    currency === Currency.USD ? "$" :
    currency === Currency.EUR ? "€" : "£";

  const isPickup = selectedOption?._kind === "PICKUP" || selectedOption?.metadata?.kind === "pickup";

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
        {/* Method select */}
        <div className="flex flex-col">
          <div className="text-xs font-semibold mb-1">Method</div>
          <Select
            value={selectedOption?.id || ""}
            onValueChange={(v) => {
              const opt = options.find((o) => o.id === v);
              if (opt) {
                onOptionChange(opt);
                // Lock fee to 0 for pickup; otherwise use baseFee (or 0 if missing)
                const fee = (opt._kind === "PICKUP" || opt.metadata?.virtual) ? 0 : Number(opt.baseFee ?? 0);
                onFeeChange(fee);
              }
            }}
            disabled={loading || options.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loading ? "Loading..." : "Select delivery option"} />
            </SelectTrigger>
            <SelectContent>
              {/* If both kinds exist, show section headers; otherwise just list all */}
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
              {options.length === 0 && !loading && (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No delivery options available.
                </div>
              )}
            </SelectContent>
          </Select>

          {/* Tiny info line for selected option */}
          {selectedOption && (
            <div className="mt-2 text-xs text-gray-500">
              Pricing: <span className="font-medium">{selectedOption.pricingMode ?? "FIXED"}</span>
              {typeof selectedOption.baseFee === "number" && !isPickup && (
                <>
                  {" • "}Base fee:{" "}
                  <span className="font-mono">
                    {selectedOption.baseCurrency || currency}{" "}
                    {Number(selectedOption.baseFee).toLocaleString()}
                  </span>
                </>
              )}
              {isPickup && <> {" • "}Fee: <span className="font-mono">{currencySym}0</span></>}
              {selectedOption.provider && <> {" • "}Provider: {selectedOption.provider}</>}
            </div>
          )}
        </div>

        {/* Fee input (disabled for pickup) */}
        <div className="flex flex-col">
          <div className="text-xs font-semibold mb-1">Fee</div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              value={deliveryFee}
              onChange={(e) => onFeeChange(Number(e.target.value))}
              placeholder="Fee"
              disabled={!selectedOption || isPickup} // lock for pickup
            />
            <div className="flex items-center text-sm text-gray-500">
              {selectedOption && (
                <div>
                  suggested:&nbsp;
                  <span className="font-mono">
                    {currencySym}
                    {(isPickup ? 0 : Number(selectedOption.baseFee ?? 0)).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="text-[10px] text-gray-500">
            {isPickup
              ? "In-person pickup: fee is always 0."
              : "You can override the base fee if needed."}
          </div>
        </div>
      </div>

      {/* Details / Notes (placeholder adapts for pickup) */}
      <div className="flex flex-col">
        <div className="text-xs font-semibold mb-1">Details / Notes</div>
        <Input
          placeholder={isPickup ? "Pickup note (person, ID, time, etc.)" : "Tracking number, pickup note, etc."}
          value={deliveryDetails}
          onChange={(e) => onDetailsChange(e.target.value)}
          disabled={!selectedOption}
        />
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   - UI refined (clean spacing, modern step tabs)
   - Adds virtual pickup handling on submit (no deliveryOptionId, fee 0)
   ────────────────────────────────────────────────────────────────────────── */
export default function OfflineSaleForm({ staffId }: Props) {
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState<Record<string, DBProduct[]>>({});
  const [searchingProduct, setSearchingProduct] = useState(false);

  const [mode, setMode] = useState<"existing" | "guest">("existing");
  const [existingCustomerId, setExistingCustomerId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerSearch, setCustomerSearch] = useState<any[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  const [guest, setGuest] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    country: "",
    state: "",
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [currency, setCurrency] = useState<Currency>(Currency.NGN);
  const [loading, setLoading] = useState(false);

  const [successSummary, setSuccessSummary] = useState<{
    orderId: string;
    items: LineItem[];
    paymentMethod: PaymentMethod;
    deliveryOption?: string;
    deliveryFee?: number;
  } | null>(null);

  // delivery
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [deliveryDetails, setDeliveryDetails] = useState<string>("");

  // ─── Validation flags ─────────────────────────────────────────────────
  const canNext =
    step === 1
      ? items.length > 0 &&
        items.every(
          (i) =>
            i.productId &&
            i.productName &&
            i.color !== "" &&
            i.size !== "" &&
            i.quantity > 0
        )
      : step === 2
      ? mode === "existing"
        ? !!existingCustomerId
        : !!(
            guest.firstName &&
            guest.lastName &&
            guest.email &&
            guest.phone &&
            guest.address
          )
      : true;

  const canSubmit = step === 3 && canNext && !!deliveryOption; // require delivery method selected

  // ─── Row helpers ───────────────────────────────────────────────────────
  const addRow = () =>
    setItems((s) => [
      ...s,
      {
        id: uuid(),
        productId: "",
        productName: "",
        variants: [],
        colorOptions: ["N/A"],
        sizeOptions: ["N/A"],
        color: "N/A",
        size: "N/A",
        maxQty: 1,
        quantity: 1,
        hasSizeMod: false,
        supportsSizeMod: false,
        customSize: {},
        productImages: [],
        prices: { NGN: 0, USD: 0, EUR: 0, GBP: 0 },
      },
    ]);
  const removeRow = (id: string) => setItems((s) => s.filter((i) => i.id !== id));

  // ─── PRODUCT SEARCH & SELECTION ───────────────────────────────────────
  const fetchProducts = async (rowId: string, q: string) => {
    if (!q || q.length < 2) {
      setProductSearch((p) => ({ ...p, [rowId]: [] }));
      return;
    }
    setSearchingProduct(true);
    try {
      const res = await fetch(`/api/search-products?query=${encodeURIComponent(q)}`);
      const data: DBProduct[] = await res.json();
      setProductSearch((p) => ({ ...p, [rowId]: data }));
    } finally {
      setSearchingProduct(false);
    }
  };
  const debouncedFetchProducts = useDebounce(fetchProducts, 300);

  function selectProduct(rowId: string, product: DBProduct) {
    const normalizedVariants = product.variants.map((v) => ({
      color: v.color.trim() || "N/A",
      size: v.size.trim() || "N/A",
      stock: v.stock,
    }));

    const colors = Array.from(new Set(normalizedVariants.map((v) => v.color)));
    const sizes = Array.from(new Set(normalizedVariants.map((v) => v.size)));

    const selColor = colors[0] || "N/A";
    const selSize = sizes[0] || "N/A";
    const match = normalizedVariants.find((v) => v.color === selColor && v.size === selSize);
    const stock = match ? match.stock : 1;

    const priceNGN = product.priceNGN ?? 0;
    const priceUSD = product.priceUSD ?? 0;
    const priceEUR = product.priceEUR ?? 0;
    const priceGBP = product.priceGBP ?? 0;

    setItems((prev) =>
      prev.map((i) =>
        i.id === rowId
          ? {
              ...i,
              productId: product.id,
              productName: product.name,
              variants: normalizedVariants,
              colorOptions: colors.length > 0 ? colors : ["N/A"],
              sizeOptions: sizes.length > 0 ? sizes : ["N/A"],
              color: selColor,
              size: selSize,
              maxQty: stock,
              quantity: 1,
              hasSizeMod: false,
              supportsSizeMod: product.sizeMods,
              customSize: {},
              productImages: product.images || [],
              prices: {
                NGN: priceNGN,
                USD: priceUSD,
                EUR: priceEUR,
                GBP: priceGBP,
              },
            }
          : i
      )
    );
    setProductSearch((p) => ({ ...p, [rowId]: [] }));
  }

  function updateVariantSelection(rowId: string, newColor: string, newSize: string) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== rowId) return i;
        const m = i.variants.find((v) => v.color === newColor && v.size === newSize);
        const stock = m?.stock ?? 1;
        return {
          ...i,
          color: newColor,
          size: newSize,
          maxQty: stock,
          quantity: Math.min(Math.max(1, i.quantity), stock),
        };
      })
    );
  }

  function updateRow(
    rowId: string,
    field: keyof LineItem | keyof CustomSize,
    value: any
  ) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== rowId) return i;

        if (field === "color") {
          const current = i;
          updateVariantSelection(rowId, value as string, current.size);
          return i;
        }
        if (field === "size") {
          const current = i;
          updateVariantSelection(rowId, current.color, value as string);
          return i;
        }
        if (field === "quantity") {
          return {
            ...i,
            quantity: Math.min(Math.max(1, value), i.maxQty),
          };
        }
        if (field === "hasSizeMod") {
          return {
            ...i,
            hasSizeMod: !!value,
            customSize: !!value ? i.customSize : {},
          };
        }
        if (["chest", "hips", "length", "waist"].includes(field)) {
          return {
            ...i,
            customSize: {
              ...(i.customSize || {}),
              [field]: value,
            },
          };
        }
        return i;
      })
    );
  }

  // ─── CUSTOMER SEARCH ─────────────────────────────────────────────────
  const fetchCustomers = async (q: string) => {
    if (!q || q.length < 2) {
      setCustomerSearch([]);
      return;
    }
    setSearchingCustomer(true);
    try {
      const res = await fetch(`/api/search-customers?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      setCustomerSearch(data);
    } finally {
      setSearchingCustomer(false);
    }
  };
  const debouncedFetchCustomers = useDebounce(fetchCustomers, 300);

  function selectCustomer(c: any) {
    setExistingCustomerId(c.id);
    setSelectedCustomer(c);
    setCustomerSearch([]);
  }

  // ─── Derived helpers ───────────────────────────────────────────────────
  const getUnitPrice = (item: LineItem) => {
    switch (currency) {
      case Currency.USD:
        return item.prices.USD;
      case Currency.EUR:
        return item.prices.EUR;
      case Currency.GBP:
        return item.prices.GBP;
      case Currency.NGN:
      default:
        return item.prices.NGN;
    }
  };

  const computeSizeModFee = (item: LineItem) => {
    if (!item.hasSizeMod) return 0;
    const unitPrice = getUnitPrice(item);
    const base = unitPrice * item.quantity;
    return +(base * 0.05).toFixed(2);
    // Note: A future improvement could be to use a configurable percent.
  };

  // ─── SUBMIT ──────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const isPickup =
        deliveryOption?._kind === "PICKUP" || deliveryOption?.metadata?.virtual === true;

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
                phone: guest.phone,
                address: guest.address,
                country: guest.country,
                state: guest.state,
              },
        paymentMethod,
        currency,
        staffId,
        timestamp: new Date().toISOString(),

        // IMPORTANT:
        // - If pickup: DO NOT send deliveryOptionId; force fee 0; prefix details
        // - Else: use selected delivery option id/fee/details as chosen
        deliveryOptionId: isPickup ? undefined : deliveryOption?.id,
        deliveryFee: isPickup ? 0 : deliveryFee,
        deliveryDetails: isPickup
          ? (deliveryDetails ? `PICKUP: ${deliveryDetails}` : "PICKUP")
          : (deliveryDetails || undefined),
      };

      const res = await fetch("/api/offline-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to log sale");
        return;
      }

      toast.success("Offline sale logged!");
      setSuccessSummary({
        orderId: data.orderId,
        items: [...items],
        paymentMethod,
        deliveryOption: deliveryOption?.name,
        deliveryFee: isPickup ? 0 : deliveryFee,
      });

      // reset form
      setItems([]);
      setMode("existing");
      setExistingCustomerId("");
      setSelectedCustomer(null);
      setGuest({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        country: "",
        state: "",
      });
      setPaymentMethod("Cash");
      setDeliveryOption(null);
      setDeliveryFee(0);
      setDeliveryDetails("");
      setStep(1);
    } catch (e) {
      toast.error("Failed to log sale");
    } finally {
      setLoading(false);
    }
  }

  // ─── UI RENDER ────────────────────────────────────────────────────────
  return (
    <Card className="max-w-6xl mx-auto shadow-2xl ring-1 ring-slate-200">
      <CardHeader className="pb-0">
        <CardTitle>
          {/* Stepper tabs — sleek + responsive */}
          <nav className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-1">
            {["Products", "Customer", "Payment"].map((lbl, i) => {
              const active = step === i + 1;
              return (
                <button
                  key={i}
                  disabled={i + 1 > step || loading}
                  onClick={() => setStep(i + 1)}
                  className={`rounded-md py-2 text-center text-sm transition-all
                    ${active ? "bg-white shadow-sm font-semibold text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
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
              const currencySymbol =
                currency === Currency.NGN
                  ? "₦"
                  : currency === Currency.USD
                  ? "$"
                  : currency === Currency.EUR
                  ? "€"
                  : "£";

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
                    <div className="flex-1">
                      <Input
                        placeholder="Search product…"
                        value={row.productName}
                        onChange={(e) => {
                          setItems((prev) =>
                            prev.map((i) =>
                              i.id === row.id
                                ? {
                                    ...i,
                                    productName: e.target.value,
                                    variants: [],
                                    productId: "",
                                    prices: { NGN: 0, USD: 0, EUR: 0, GBP: 0 },
                                    supportsSizeMod: false,
                                    hasSizeMod: false,
                                    customSize: {},
                                  }
                                : i
                            )
                          );
                          debouncedFetchProducts(row.id, e.target.value);
                        }}
                        disabled={loading}
                      />
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
                        disabled={loading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Color" />
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
                    {productHasSize ? (
                      <Select
                        value={row.size}
                        onValueChange={(v) => updateRow(row.id, "size", v)}
                        disabled={loading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Size" />
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
                    )}
                  </div>

                  {/* Quantity + stock */}
                  <div className="col-span-6 md:col-span-2">
                    <div className="text-xs font-semibold mb-1">
                      Quantity{" "}
                      <span className="text-[10px] text-gray-500">
                        (Available: {row.maxQty})
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <Input
                        type="number"
                        min={1}
                        max={row.maxQty}
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, "quantity", +e.target.value)}
                        disabled={loading}
                      />
                      <div className="text-[10px] text-gray-500 mt-1">
                        Max allowed is {row.maxQty}
                      </div>
                    </div>
                  </div>

                  {/* Custom size block (only if supportsSizeMod) */}
                  <div className="col-span-6 md:col-span-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">Custom Size?</div>
                      {row.supportsSizeMod ? (
                        <div>
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
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-400">Not supported</div>
                      )}
                    </div>

                    {row.hasSizeMod && (
                      <>
                        <div className="text-[12px]">
                          Size modification fee (5%):{" "}
                          <span className="font-mono">
                            {currencySymbol}
                            {sizeModFee.toLocaleString()}
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

                  {/* Unit price & totals */}
                  <div className="col-span-6 md:col-span-3">
                    <div className="text-xs font-semibold mb-1">Pricing</div>
                    <div className="text-sm bg-slate-50 rounded p-2 border">
                      <div>
                        Unit:{" "}
                        <span className="font-mono">
                          {currencySymbol}
                          {unitPrice.toLocaleString()}
                        </span>
                      </div>
                      {row.hasSizeMod && (
                        <div className="text-[12px] text-gray-600">
                          + Size mod fee:{" "}
                          <span className="font-mono">
                            {currencySymbol}
                            {sizeModFee.toLocaleString()}
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
              {["existing", "guest"].map((m) => (
                <label key={m} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="customerMode"
                    checked={mode === m}
                    onChange={() => setMode(m as any)}
                    className="accent-indigo-600"
                  />
                  <span className="capitalize">
                    {m === "existing" ? "Existing Customer" : "Guest"}
                  </span>
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
              <div className="grid grid-cols-2 gap-4">
                {["firstName", "lastName", "email", "phone", "address", "country", "state"].map(
                  (f) => (
                    <Input
                      key={f}
                      placeholder={f.charAt(0).toUpperCase() + f.slice(1)}
                      value={(guest as any)[f]}
                      onChange={(e) => setGuest((g) => ({ ...g, [f]: e.target.value }))}
                      disabled={loading}
                    />
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: PAYMENT, DELIVERY & CURRENCY */}
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
                    {["Cash", "Transfer", "Card"].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col">
                <div className="text-xs font-semibold mb-1">Currency</div>
                <Select
                  value={currency}
                  onValueChange={(v) => setCurrency(v as Currency)}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(Currency).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <DeliverySelector
              currency={currency}
              selectedOption={deliveryOption}
              deliveryFee={deliveryFee}
              deliveryDetails={deliveryDetails}
              onOptionChange={(o) => {
                setDeliveryOption(o);
                // Fee is set inside DeliverySelector on change (0 for pickup, baseFee otherwise)
              }}
              onFeeChange={setDeliveryFee}
              onDetailsChange={setDeliveryDetails}
            />
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={step === 1 || loading}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
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
