"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Currency, useCurrency } from "@/lib/context/currencyContext";
import clsx from "clsx";

const currencies: Currency[] = ["NGN", "USD", "EUR", "GBP"];

export const CurrencySelector: React.FC<{ tone?: "light" | "dark" }> = ({
  tone = "dark",
}) => {
  const [open, setOpen] = useState(false);
  const { currency, setCurrency } = useCurrency();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const colorClass =
    tone === "light"
      ? "text-white hover:text-white/90"
      : "text-gray-700 hover:text-gray-900";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          "flex items-center text-sm font-medium focus:outline-none",
          colorClass
        )}
      >
        <span>{currency}</span>
        <ChevronDown className="w-4 h-4 ml-1" />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-24 bg-white border border-gray-200 rounded-md shadow-lg z-50"
        >
          <ul className="flex flex-col text-sm text-gray-700">
            {currencies.map((cur) => (
              <li key={cur}>
                <button
                  onClick={() => {
                    setCurrency(cur);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 hover:bg-gray-100 text-left"
                >
                  {cur}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
