// lib/hooks/useShipbubbleRates.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ShipbubbleRate = {
  courierCode: string | null;
  courierName: string;
  serviceCode: string;
  fee: number;
  currency: string;
  eta: string | null;
  raw: any;
};

export type ShipbubbleBoxUsed = {
  name: string;
  length: number;
  width: number;
  height: number;
  max_weight: number;
} | null;

export function useShipbubbleRates(params: {
  // Minimal destination pieces to produce single-line address and contact
  fullName: string;
  email: string;
  phone: string;          // already including prefix e.g. +234...
  singleLineAddress: string; // "63 ... , Federal Capital Territory, Nigeria"
  // Cart totals
  totalWeightKG: number;
  totalValue: number;
  // Optional: detailed items so package_items match docs (recommended but optional)
  items?: Array<{ name: string; description?: string; unitWeightKG: number; unitAmount: number; quantity: number }>;
  pickupDaysFromNow?: number; // default 1
}) {
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<ShipbubbleRate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requestToken, setRequestToken] = useState<string | null>(null);
  const [boxUsed, setBoxUsed] = useState<ShipbubbleBoxUsed>(null);

  const ready = useMemo(() => {
    return (
      !!params.singleLineAddress &&
      !!params.fullName &&
      !!params.email &&
      !!params.phone &&
      params.totalWeightKG > 0
    );
  }, [params.singleLineAddress, params.fullName, params.email, params.phone, params.totalWeightKG]);

  const debounce = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!ready) {
      setRates([]);
      setError(null);
      setRequestToken(null);
      setBoxUsed(null);
      return;
    }

    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/shipping/shipbubble/rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destination: {
              name: params.fullName,
              email: params.email,
              phone: params.phone,
              address: params.singleLineAddress,
            },
            total_weight_kg: params.totalWeightKG,
            total_value: params.totalValue,
            items: params.items?.map((i) => ({
              name: i.name,
              description: i.description ?? "Cart item",
              unitWeightKG: i.unitWeightKG,
              unitAmount: i.unitAmount,
              quantity: i.quantity,
            })),
            pickup_days_from_now: params.pickupDaysFromNow ?? 1,
          }),
        });

        const json = await res.json();
        if (!res.ok || json?.error) throw new Error(json?.error || "Rate lookup failed");
        setRates(Array.isArray(json?.rates) ? json.rates : []);
        setRequestToken(json?.request_token ?? null);
        setBoxUsed(json?.box_used ?? null);
      } catch (e: any) {
        setRates([]);
        setRequestToken(null);
        setBoxUsed(null);
        setError(e?.message || "Could not fetch rates");
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [
    ready,
    params.singleLineAddress,
    params.fullName,
    params.email,
    params.phone,
    params.totalWeightKG,
    params.totalValue,
    params.items?.length,
    params.pickupDaysFromNow,
  ]);

  return { loading, rates, error, requestToken, boxUsed };
}
