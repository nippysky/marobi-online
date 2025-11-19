"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type Currency = "NGN" | "USD" | "EUR" | "GBP";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (newCurrency: Currency) => void;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({
  children,
  initialCurrency,
}: {
  children: ReactNode;
  initialCurrency: Currency;
}) {
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);

  useEffect(() => {
    const saved = localStorage.getItem("currency") as Currency | null;
    if (!saved) {
      localStorage.setItem("currency", initialCurrency);
    } else if (saved && saved !== currency) {
      setCurrencyState(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCurrency = (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    try {
      localStorage.setItem("currency", newCurrency);
      document.cookie = `CURRENCY=${newCurrency}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax; Secure`;
      document.cookie = `CURRENCY_SOURCE=manual; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax; Secure`;
    } catch {}
  };

  const value = useMemo(() => ({ currency, setCurrency }), [currency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within a CurrencyProvider");
  return ctx;
}
