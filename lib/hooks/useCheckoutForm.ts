// lib/hooks/useCheckoutForm.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

/** Countries API returns codes WITH + already. Keep types simple. */
export interface CountryData {
  name: string;
  iso2: string;
  callingCodes: string[]; // e.g. ["+234", "+1"]
}

/** Align with prisma DeliveryOption model */
export interface DeliveryOption {
  id: string;
  name: string;
  provider?: string | null;
  pricingMode: "FIXED" | "EXTERNAL";
  baseFee?: number | null; // may be null for EXTERNAL
  baseCurrency?: "NGN" | "USD" | "EUR" | "GBP" | null;
  active: boolean;
  metadata?: any;
}

/* ---------------------------- Small utilities ---------------------------- */

function normalizePlus(code?: string): string {
  if (!code) return "+234"; // sensible default for your audience
  const c = code.trim();
  return c.startsWith("+") ? c : `+${c}`;
}

function safeFirst<T>(arr?: T[]): T | undefined {
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : undefined;
}

/* ---------------------- Country / State / Phone hook --------------------- */

/**
 * Manages country/state/phone code selection.
 * - Fetches countries from /api/utils/countries (aliased to /api/countries)
 * - Fetches states from /api/utils/states (CSC-backed, no external HTTP)
 * - Exposes loading flags and keeps phone code in sync with country
 */
export function useCountryState(
  initialCountryName?: string,
  initialState?: string
) {
  const [countryList, setCountryList] = useState<CountryData[]>([]);
  const [country, setCountry] = useState<CountryData | null>(null);
  const [stateList, setStateList] = useState<string[]>([]);
  const [state, setState] = useState(initialState ?? "");
  const [phoneCode, setPhoneCode] = useState("+234");

  const [countriesLoading, setCountriesLoading] = useState(false);
  const [statesLoading, setStatesLoading] = useState(false);

  // Load countries
  useEffect(() => {
    let cancelled = false;

    async function loadCountries() {
      try {
        setCountriesLoading(true);

        const res = await fetch("/api/utils/countries");
        if (!res.ok) throw new Error("Failed to fetch countries");
        const data: CountryData[] = await res.json();
        if (cancelled) return;

        setCountryList(data);

        const def =
          data.find((c) => c.name === initialCountryName) ??
          data.find((c) => c.name === "Nigeria") ??
          null;

        setCountry(def);

        const firstCode = normalizePlus(safeFirst(def?.callingCodes));
        setPhoneCode(firstCode);
      } catch (err) {
        console.error("useCountryState.loadCountries error:", err);
        if (!cancelled) {
          setCountryList([]);
          toast.error("Could not load country list.");
        }
      } finally {
        if (!cancelled) setCountriesLoading(false);
      }
    }

    loadCountries();
    return () => {
      cancelled = true;
    };
  }, [initialCountryName]);

  // Load states when country changes
  useEffect(() => {
    let cancelled = false;

    async function loadStates() {
      if (!country) {
        setStateList([]);
        setState("");
        setStatesLoading(false);
        return;
      }

      setStatesLoading(true);
      setStateList([]);
      setState("");

      try {
        const res = await fetch("/api/utils/states", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            countryIso2: country.iso2,
            country: country.name,
          }),
        });
        if (!res.ok) throw new Error("Failed to fetch states");
        const json = await res.json();
        if (cancelled) return;

        setStateList(Array.isArray(json.states) ? json.states : []);
      } catch (err) {
        console.error("useCountryState.loadStates error:", err);
        if (!cancelled) {
          setStateList([]);
          toast.error("Could not load states.");
        }
      } finally {
        if (!cancelled) setStatesLoading(false);
      }

      // Keep phone code in sync with selected country
      const code = normalizePlus(safeFirst(country?.callingCodes));
      setPhoneCode(code);
    }

    loadStates();
    return () => {
      cancelled = true;
    };
  }, [country]);

  // Unique, normalized phone code options derived from countryList
  const phoneOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { code: string; iso2: string }[] = [];

    for (const c of countryList) {
      for (const raw of c.callingCodes || []) {
        const code = normalizePlus(raw);
        if (!seen.has(code)) {
          seen.add(code);
          out.push({ code, iso2: c.iso2 });
        }
      }
    }

    // Sort nicely (numeric-aware)
    return out.sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true })
    );
  }, [countryList]);

  return {
    countryList,
    country,
    setCountry,
    stateList,
    state,
    setState,
    phoneCode,
    setPhoneCode,
    phoneOptions,
    countriesLoading,
    statesLoading,
  };
}

/* --------------------- Delivery options (schema-aligned) --------------------- */

export function useDeliveryOptions(countryName: string | undefined | null) {
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
  const [selectedDeliveryOption, setSelectedDeliveryOption] =
    useState<DeliveryOption | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      if (!countryName) return;

      try {
        const res = await fetch(
          `/api/delivery-options?country=${encodeURIComponent(countryName)}`
        );
        if (!res.ok) throw new Error("Failed to load delivery options");

        const data: DeliveryOption[] = await res.json();
        if (cancelled) return;

        const active = (data || []).filter((o) => o.active);

        setDeliveryOptions(active);

        setSelectedDeliveryOption((prev) => {
          if (prev) {
            const match = active.find((o) => o.id === prev.id);
            if (match) return match;
          }
          return active[0] ?? null;
        });
      } catch (err) {
        console.error("useDeliveryOptions.loadOptions error:", err);
        if (!cancelled) toast.error("Could not load delivery options.");
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [countryName]);

  const deliveryFee =
    selectedDeliveryOption?.baseFee != null
      ? selectedDeliveryOption.baseFee
      : 0;

  return {
    deliveryOptions,
    selectedDeliveryOption,
    setSelectedDeliveryOption,
    deliveryFee,
  };
}

/* --------------------------- Cart totals helpers --------------------------- */

export function useCartTotals(
  items: {
    price: number;
    sizeModFee: number;
    quantity: number;
    unitWeight?: number;
  }[]
) {
  const itemsSubtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (item.price - item.sizeModFee) * item.quantity,
        0
      ),
    [items]
  );

  const sizeModTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.sizeModFee * item.quantity, 0),
    [items]
  );

  const totalWeight = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (item.unitWeight ?? 0) * item.quantity,
        0
      ),
    [items]
  );

  const total = itemsSubtotal + sizeModTotal;

  return { itemsSubtotal, sizeModTotal, totalWeight, total };
}
