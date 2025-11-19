// components/checkout/CheckoutSection.tsx
"use client";

/**
 * Checkout Section — delivery rates are fetched manually on user action:
 *   - fill delivery info
 *   - click "Get delivery rates"
 *   - we call /api/shipping/shipbubble/rates
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FaArrowLeftLong } from "react-icons/fa6";
import { useCartStore, CartItem } from "@/lib/store/cartStore";
import { useCurrency } from "@/lib/context/currencyContext";
import { formatAmount } from "@/lib/formatCurrency";
import { Toaster, toast } from "react-hot-toast";
import { useSession } from "next-auth/react";
import type { CheckoutUser } from "./page";
import OrderSuccessModal from "@/components/OrderSuccessModal";
import { useCheckout, CartItemPayload, CustomerPayload } from "@/lib/hooks/useCheckout";
import { useCountryState, useCartTotals } from "@/lib/hooks/useCheckoutForm";

const PaystackButton = dynamic(() => import("react-paystack").then((m) => m.PaystackButton), { ssr: false });

interface Props {
  user: CheckoutUser | null;
}

const FormField = ({
  label,
  htmlFor,
  children,
  span2 = false,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  span2?: boolean;
}) => (
  <div className={`${span2 ? "md:col-span-2" : ""} flex flex-col gap-2`}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

const flagEmoji = (iso2: string) =>
  (iso2 || "")
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

export default function CheckoutSection({ user }: Props) {
  const router = useRouter();
  const { data: session } = useSession({ required: false });
  const { currency } = useCurrency();

  // Cart & totals
  const items = useCartStore((s) => s.items) as CartItem[];
  const clearCart = useCartStore((s) => s.clear) as () => void;

  const { itemsSubtotal, sizeModTotal, totalWeight, total: baseTotal } = useCartTotals(
    items.map((it) => ({
      price: it.price,
      sizeModFee: it.sizeModFee,
      quantity: it.quantity,
      unitWeight: it.unitWeight,
    }))
  );

  // Country / state / phone logic
  const { countryList, country, setCountry, stateList, state, setState, phoneCode, setPhoneCode, phoneOptions } =
    useCountryState(user?.country, user?.state);

  // Form fields
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone ?? "");
  const [houseAddress, setHouseAddress] = useState(user?.deliveryAddress ?? "");
  const [billingSame, setBillingSame] = useState(true);
  const [billingAddress, setBillingAddress] = useState(user?.billingAddress ?? "");

  // Validation helpers
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneDigits = `${phoneCode}${phoneNumber}`.replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 8;

  // Single-line address for Shipbubble
  const fullName = `${(firstName || "").trim()} ${(lastName || "").trim()}`.trim();
  const singleLineAddress = useMemo(() => {
    const parts = [houseAddress?.trim(), state?.trim(), country?.name?.trim()].filter(Boolean);
    return parts.join(", ");
  }, [houseAddress, state, country?.name]);

  // Items → optional per-item exposure
  const packageItems = useMemo(
    () =>
      items.map((it) => ({
        name: it.product?.name || "Item",
        description: it.hasSizeMod ? "Custom sized apparel" : "Cart item",
        unitWeightKG: Number(it.unitWeight ?? 0) || 0.5,
        unitAmount: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
      })),
    [items]
  );

  // Ready to fetch rates only when essentials are present
  const formReadyForRates =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    emailRx.test(email) &&
    phoneValid &&
    houseAddress.trim() !== "" &&
    !!country?.iso2 &&
    !!state;

  // ───────────── Manual Shipbubble rates state ─────────────
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [sbRates, setSbRates] = useState<any[]>([]);
  const [requestToken, setRequestToken] = useState<string | null>(null);
  const [boxUsed, setBoxUsed] = useState<any | null>(null);

  const getRates = async () => {
    if (!formReadyForRates) {
      toast.error("Please complete delivery information first.");
      return;
    }
    try {
      setRatesLoading(true);
      setRatesError(null);
      setSbRates([]);
      setRequestToken(null);
      setBoxUsed(null);

      const resp = await fetch("/api/shipping/shipbubble/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: {
            name: fullName,
            email,
            phone: `${phoneCode}${phoneNumber}`,
            address: singleLineAddress,
          },
          total_weight_kg: totalWeight,
          total_value: baseTotal,
          items: packageItems,
          pickup_days_from_now: 1,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json?.error || "Could not fetch delivery rates.");
      }

      setSbRates(Array.isArray(json?.rates) ? json.rates : []);
      setRequestToken(json?.requestToken || json?.request_token || null);
      setBoxUsed(json?.box_used || null);

      if ((json?.rates || []).length === 0) {
        toast("No delivery options available for this address.", { icon: "ℹ️" });
      } else {
        toast.success("Delivery options loaded.");
      }
    } catch (e: any) {
      setRatesError(e?.message || "Failed to fetch rates.");
      toast.error(e?.message || "Failed to fetch rates.");
    } finally {
      setRatesLoading(false);
    }
  };

  // Selected rate — include courierId for label creation
  type SelectedShipRate = {
    requestToken: string;
    serviceCode: string;
    courierId: string;
    fee: number;
    currency: "NGN" | "USD" | "EUR" | "GBP";
    courierName: string;
    eta?: string | null;
    raw?: any;
    _id: string;
  };
  const [selectedShipRate, setSelectedShipRate] = useState<SelectedShipRate | null>(null);

  // Totals
  const shipFee = selectedShipRate?.fee ?? 0;
  const total = baseTotal + shipFee;

  // Checkout hook
  const { isProcessing, error, result, createOrder, reset } = useCheckout();

  const isPaymentReady =
    items.length > 0 &&
    emailRx.test(email) &&
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    houseAddress.trim() !== "" &&
    !!country?.iso2 &&
    !!state &&
    !!selectedShipRate;

  // Paystack
  const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_KEY || "";
  const [paystackReference, setPaystackReference] = useState<string>(
    `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  );
  useEffect(() => {
    if (!isProcessing) {
      setPaystackReference(`${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, email]);

  const amountInLowestDenomination = Math.round(total * 100);
  const paystackConfig = useMemo(
    () => ({
      reference: paystackReference,
      email,
      amount: amountInLowestDenomination,
      publicKey: paystackPublicKey,
    }),
    [paystackReference, email, amountInLowestDenomination, paystackPublicKey]
  );

  // Payloads for order API
  const customerPayload: CustomerPayload = {
    firstName,
    lastName,
    email,
    phone: `${phoneCode}${phoneNumber}`,
    deliveryAddress: houseAddress,
    billingAddress: billingSame ? houseAddress : billingAddress,
    country: country?.name,
    state,
    ...(session?.user?.id && session.user.role === "customer" ? { id: session.user.id } : {}),
  };

  const buildCartItemsPayload = useCallback((): CartItemPayload[] => {
    return items.map((it) => {
      const cm = (it as any).customMods as Record<string, string | number> | undefined;
      const payload: CartItemPayload = {
        productId: it.product.id,
        color: it.color || "N/A",
        size: it.size || "N/A",
        quantity: it.quantity,
        hasSizeMod: !!it.hasSizeMod,
        sizeModFee: it.sizeModFee || 0,
        unitWeight: it.unitWeight ?? 0,
        ...(it.hasSizeMod && cm ? { customMods: { ...cm } } : {}),
      };
      return payload;
    });
  }, [items]);

  const buildShipbubbleShipping = () => {
    if (!selectedShipRate) return undefined;
    return {
      source: "shipbubble",
      shipbubble: {
        requestToken: selectedShipRate.requestToken,
        serviceCode: selectedShipRate.serviceCode,
        courierId: selectedShipRate.courierId,
        fee: selectedShipRate.fee,
        currency: selectedShipRate.currency,
        courierName: selectedShipRate.courierName,
        meta: {
          eta: selectedShipRate.eta,
          raw: selectedShipRate.raw,
          destination: {
            address: singleLineAddress,
            totalWeightKG: totalWeight,
            totalValue: baseTotal,
          },
          package: boxUsed
            ? {
                boxName: boxUsed.name,
                length: boxUsed.length,
                width: boxUsed.width,
                height: boxUsed.height,
                maxWeight: boxUsed.max_weight,
              }
            : null,
        },
      },
    };
  };

  async function createShipbubbleLabelAfterOrder() {
    if (!selectedShipRate) return;
    try {
      const resp = await fetch("/api/shipping/shipbubble/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestToken: selectedShipRate.requestToken,
          serviceCode: selectedShipRate.serviceCode,
          courierId: selectedShipRate.courierId,
        }),
      });
      const json = await resp.json();
      if (!resp.ok || json?.status !== "success") {
        throw new Error(json?.message || "Label creation failed");
      }
      const tracking = json?.data?.tracking_url;
      if (tracking) toast.success("Shipping label created. Tracking is available.");
      else toast.success("Shipping label created.");
      return json?.data;
    } catch (e: any) {
      console.error("Shipbubble label creation error:", e);
      toast.error(e?.message || "Could not create shipping label. You can retry from your orders page.");
      return null;
    }
  }

  const [hasAttemptedPayment, setHasAttemptedPayment] = useState(false);
  const [customerEmailForModal, setCustomerEmailForModal] = useState<string>("");
  const [lastPaymentReference, setLastPaymentReference] = useState<string | null>(null);
  const [orderCreatingFromReference, setOrderCreatingFromReference] = useState(false);

  const handlePaystackSuccess = async (reference: any) => {
    try {
      setHasAttemptedPayment(true);
      if (isProcessing || orderCreatingFromReference) return;

      const refString = reference?.reference || reference?.ref || paystackReference || "";
      if (!refString) {
        toast.error("Could not determine payment reference.");
        return;
      }
      if (!selectedShipRate) {
        toast.error("Select a delivery option to continue.");
        return;
      }

      setLastPaymentReference(refString);
      setOrderCreatingFromReference(true);

      const cartItems = buildCartItemsPayload();

      const order = await createOrder({
        items: cartItems,
        customer: customerPayload,
        paymentMethod: "Paystack",
        currency,
        deliveryFee: selectedShipRate.fee,
        timestamp: new Date().toISOString(),
        deliveryOptionId: undefined,
        paymentReference: refString,
        // @ts-ignore backend accepts `shipping`
        shipping: buildShipbubbleShipping(),
      });

      if (!order) {
        toast.error("Order creation failed after payment. We kept the payment reference so you can retry.");
        setOrderCreatingFromReference(false);
        return;
      }

      setCustomerEmailForModal(order.email);
      toast.success("Order created successfully.");
      await createShipbubbleLabelAfterOrder();
      setOrderCreatingFromReference(false);
    } catch (err: any) {
      console.error("Order creation after payment failed:", err);
      toast.error(err?.message || "Something went wrong creating your order.");
      setOrderCreatingFromReference(false);
    }
  };

  const retryOrderCreation = async () => {
    setHasAttemptedPayment(true);
    if (!lastPaymentReference) return;
    if (isProcessing || orderCreatingFromReference) return;
    if (!selectedShipRate) {
      toast.error("Select a delivery option to continue.");
      return;
    }

    setOrderCreatingFromReference(true);
    try {
      const cartItems = buildCartItemsPayload();

      const order = await createOrder({
        items: cartItems,
        customer: customerPayload,
        paymentMethod: "Paystack",
        currency,
        deliveryFee: selectedShipRate.fee,
        timestamp: new Date().toISOString(),
        deliveryOptionId: undefined,
        paymentReference: lastPaymentReference,
        // @ts-ignore backend accepts `shipping`
        shipping: buildShipbubbleShipping(),
      });

      if (!order) {
        toast.error("Retry failed. Please contact support.");
        setOrderCreatingFromReference(false);
        return;
      }

      setCustomerEmailForModal(order.email);
      toast.success("Order created successfully on retry.");
      await createShipbubbleLabelAfterOrder();
    } catch (err: any) {
      console.error("Retry order creation error:", err);
      toast.error("Retry failed. Please contact support.");
    } finally {
      setOrderCreatingFromReference(false);
    }
  };

  const [showSuccess, setShowSuccess] = useState(false);
  useEffect(() => {
    if (result?.orderId) {
      setCustomerEmailForModal(result?.email);
      setShowSuccess(true);
    }
  }, [result]);

  const paymentDisabled = !isPaymentReady || isProcessing || orderCreatingFromReference;

  return (
    <>
      <Toaster position="top-right" />

      <section className="px-5 md:px-10 lg:px-20 xl:px-40 py-20">
        <nav className="text-sm text-gray-600 mb-4">
          <Link href="/" className="hover:underline">Home</Link> /{" "}
          <span className="font-medium text-gray-900 dark:text-gray-100">Checkout</span>
        </nav>

        <Button
          variant="link"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <FaArrowLeftLong /> Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0">
          {/* Left: Delivery & Billing */}
          <div className="lg:col-span-2 space-y-8 flex flex-col">
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-md">
              <h2 className="text-xl font-semibold mb-4">Delivery Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="First Name" htmlFor="firstName">
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} />
                </FormField>
                <FormField label="Last Name" htmlFor="lastName">
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} />
                </FormField>

                <FormField label="Email" htmlFor="email">
                  <div>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
                    {!emailRx.test(email) && email.length > 0 && (
                      <p className="mt-1 text-xs text-red-600">Enter a valid email address.</p>
                    )}
                  </div>
                </FormField>

                <FormField label="Phone Number" htmlFor="phone">
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
                      <Input id="phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.currentTarget.value)} />
                      {!phoneValid && phoneNumber.length > 0 && (
                        <p className="mt-1 text-xs text-red-600">Enter a valid phone number.</p>
                      )}
                    </div>
                  </div>
                </FormField>

                <FormField label="Country" htmlFor="country">
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
                </FormField>

                <FormField label="State / Region" htmlFor="state">
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
                </FormField>

                <FormField label="House address" htmlFor="houseAddress" span2>
                  <Textarea
                    id="houseAddress"
                    value={houseAddress}
                    onChange={(e) => setHouseAddress(e.currentTarget.value)}
                    rows={3}
                    placeholder="e.g., 63 Birnin Kebbi Crescent"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    We’ll send a single-line address like:{" "}
                    <em className="text-gray-700">
                      “{houseAddress || "63 Birnin Kebbi"}, {state || "Federal Capital Territory"}, {country?.name || "Nigeria"}”.
                    </em>
                  </p>
                </FormField>
              </div>

              {/* NEW: Manual fetch button */}
              <div className="mt-4">
                <Button
                  onClick={getRates}
                  disabled={!formReadyForRates || ratesLoading}
                  className="rounded-full"
                >
                  {ratesLoading ? "Fetching delivery rates…" : "Get delivery rates"}
                </Button>
                {!formReadyForRates && (
                  <p className="text-xs text-gray-500 mt-2">Fill in your name, email, phone, country, state and address to fetch options.</p>
                )}
                {ratesError && <p className="text-xs text-red-600 mt-2">{ratesError}</p>}
              </div>
            </div>

            {/* Billing */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-md">
              <div className="flex items-center mb-4">
                <input
                  id="sameBilling"
                  type="checkbox"
                  checked={billingSame}
                  onChange={() => setBillingSame((v) => !v)}
                  className="mr-2"
                />
                <label htmlFor="sameBilling" className="font-medium">
                  Billing same as delivery
                </label>
              </div>
              {!billingSame && (
                <FormField label="Billing Address" htmlFor="billingAddress" span2>
                  <Textarea
                    id="billingAddress"
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.currentTarget.value)}
                    rows={3}
                  />
                </FormField>
              )}
            </div>

            {/* Delivery Options list (after click) */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-md">
              <h2 className="text-xl font-semibold mb-4">Delivery Option</h2>

              {boxUsed && (
                <div className="mb-4 text-sm text-gray-700 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                  <span className="font-medium">Estimated package:</span>{" "}
                  {boxUsed.name} — {boxUsed.length}×{boxUsed.width}×{boxUsed.height} cm (max {boxUsed.max_weight} kg)
                </div>
              )}

              {!ratesLoading && Array.isArray(sbRates) && sbRates.length > 0 && (
                <div className="grid gap-4">
                  {sbRates.map((r: any, idx: number) => {
                    const id = `sb-rate-${r.courierId || r.courierCode || r.raw?.courier_id}-${r.serviceCode}-${idx}`;
                    const isSelected = selectedShipRate?._id === id;

                    return (
                      <div
                        key={id}
                        className={`border rounded-lg p-4 flex justify-between items-start ${isSelected ? "ring-2 ring-brand" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{r.courierName}</div>
                          <div className="text-xs text-gray-600">
                            {r.eta ? `ETA: ${r.eta}` : "Estimated delivery at label creation"}
                          </div>
                          <div className="text-sm mt-1">Fee: {formatAmount(r.fee, r.currency || currency)}</div>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="deliveryOption"
                            checked={isSelected}
                            onChange={() =>
                              setSelectedShipRate({
                                requestToken: (requestToken as string) || r.requestToken || "",
                                serviceCode: r.serviceCode,
                                courierId: r.courierId || r.courierCode || r.raw?.courier_id || "",
                                fee: Number(r.fee) || 0,
                                currency: (r.currency as any) || (currency as any) || "NGN",
                                courierName: r.courierName,
                                eta: r.eta,
                                raw: r.raw,
                                _id: id,
                              })
                            }
                            aria-label={`Select ${r.courierName}`}
                            className="ml-2"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {ratesLoading && <p className="text-sm text-gray-500">Fetching live rates…</p>}

              {!ratesLoading && Array.isArray(sbRates) && sbRates.length === 0 && requestToken == null && (
                <p className="text-sm text-gray-500">Click “Get delivery rates” to view options.</p>
              )}
            </div>
          </div>

          {/* Right: Cart + Summary */}
          <div className="space-y-6 flex flex-col min-h-0">
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-md flex flex-col">
              <h2 className="text-lg font-semibold mb-4">Your Cart</h2>
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-60">
                  <ul className="divide-y divide-gray-200">
                    {items.map((item, idx) => {
                      const unitWeight = item.unitWeight ?? 0;
                      const lineWeight = parseFloat(((unitWeight * item.quantity) || 0).toFixed(3));
                      const cm = (item.customMods as Record<string, string | number> | undefined) || undefined;
                      const hasAnyCustom = !!cm && Object.values(cm).some((v) => `${v ?? ""}`.trim() !== "");

                      return (
                        <li key={`${item.product.id}-${item.color}-${item.size}-${idx}`} className="py-3 flex justify-between items-start">
                          <div className="flex items-start gap-3">
                            {item.product.images[0] && (
                              <img src={item.product.images[0]} alt={item.product.name} className="w-12 h-12 rounded object-cover border" />
                            )}
                            <div className="text-sm">
                              <p className="font-medium text-gray-900">{item.product.name}</p>
                              <p className="text-xs text-gray-500">
                                {item.color}, {item.hasSizeMod ? "Custom" : item.size} × {item.quantity}
                              </p>

                              {item.hasSizeMod && (
                                <div className="text-xs text-yellow-600 mt-1">
                                  +5% size-mod fee: <span className="font-medium">{formatAmount(item.sizeModFee, currency)}</span>
                                </div>
                              )}

                              {item.hasSizeMod && hasAnyCustom && (
                                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 shadow-sm">
                                  <div className="font-semibold mb-1">Custom measurements</div>
                                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                                    <div><span className="text-amber-800">Chest/Bust:</span> <span className="font-medium">{cm?.chest ?? "-"}</span></div>
                                    <div><span className="text-amber-800">Waist:</span> <span className="font-medium">{cm?.waist ?? "-"}</span></div>
                                    <div><span className="text-amber-800">Hip:</span> <span className="font-medium">{cm?.hip ?? "-"}</span></div>
                                    <div><span className="text-amber-800">Length:</span> <span className="font-medium">{cm?.length ?? "-"}</span></div>
                                  </div>
                                </div>
                              )}

                              <p className="text-xs text-gray-600 mt-1">
                                Unit weight: {unitWeight.toFixed(3)}kg • Total: {lineWeight.toFixed(3)}kg
                              </p>
                            </div>
                          </div>
                          <div className="text-sm font-medium text-gray-900 whitespace-nowrap">
                            {formatAmount(item.price * item.quantity, currency)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-md flex flex-col">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
              <div className="space-y-2 text-sm flex-1">
                <div className="flex justify-between"><span>Items Subtotal:</span><span>{formatAmount(itemsSubtotal, currency)}</span></div>
                <div className="flex justify-between"><span>Size Mods:</span><span>{formatAmount(sizeModTotal, currency)}</span></div>
                <div className="flex justify-between"><span>Delivery Fee:</span><span>{formatAmount(selectedShipRate?.fee ?? 0, currency)}</span></div>
                <div className="flex justify-between"><span>Total Weight:</span><span>{totalWeight.toFixed(3)}kg</span></div>
                <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                  <span>Total:</span><span>{formatAmount(total, currency)}</span>
                </div>
              </div>

              <div className="mt-6">
                {!isPaymentReady ? (
                  <Button disabled className="w-full py-3 rounded-full">Complete required fields</Button>
                ) : (
                  <div className="space-y-2">
                    <PaystackButton
                      {...paystackConfig}
                      text={isProcessing || orderCreatingFromReference ? "Finalizing order..." : `Pay ${formatAmount(total, currency)}`}
                      onSuccess={handlePaystackSuccess}
                      onClose={() => {
                        setHasAttemptedPayment(true);
                        toast.error("Payment cancelled. Please try again.");
                      }}
                      className="w-full py-3 rounded-full bg-brand text-white font-medium disabled:opacity-60"
                      disabled={paymentDisabled || !paystackPublicKey}
                    />

                    {orderCreatingFromReference && lastPaymentReference && !result?.orderId && (
                      <div className="text-center text-sm">
                        Payment succeeded with reference <code>{lastPaymentReference}</code>, creating order...
                      </div>
                    )}
                    {!orderCreatingFromReference && lastPaymentReference && !result?.orderId && (
                      <Button variant="outline" className="w-full" onClick={retryOrderCreation} disabled={isProcessing}>
                        Retry Order Creation
                      </Button>
                    )}
                    {isProcessing && <p className="mt-2 text-center text-sm text-gray-600">We’re confirming your order. This should take a moment.</p>}
                  </div>
                )}
              </div>
            </div>

            {hasAttemptedPayment && error && (
              <div className="mt-2 px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm shadow-sm">
                {typeof error === "string" ? error : error.error}
                {error.code && <div className="text-xs mt-1">Code: {error.code}</div>}
                {error.details && <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(error.details, null, 2)}</pre>}
              </div>
            )}
          </div>
        </div>
      </section>

      <OrderSuccessModal
        open={showSuccess}
        orderId={result?.orderId || ""}
        email={customerEmailForModal || result?.email || email}
        onClose={() => {
          setShowSuccess(false);
          try { clearCart(); } catch {}
          reset();
          router.push("/all-products");
        }}
      />
    </>
  );
}
