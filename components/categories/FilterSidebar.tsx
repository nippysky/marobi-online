"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Checkbox } from "@/components/ui/checkbox";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { Product } from "@/lib/products";
import { Currency, useCurrency } from "@/lib/context/currencyContext";

export interface Filters {
  priceRange: [number, number];
  colors: string[];
  sizes: string[];
}

interface SidebarProps {
  products: Product[];
  onChange: (f: Filters) => void;
}

const SYMBOLS: Record<Currency, string> = {
  NGN: "₦",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export default function FilterSidebar({ products, onChange }: SidebarProps) {
  const { currency } = useCurrency();
  const symbol = SYMBOLS[currency];

  // Currency-aware price span
  const priceValues = useMemo(
    () => (products ?? []).map((p) => p.prices[currency]),
    [products, currency]
  );
  const min = priceValues.length ? Math.min(...priceValues) : 0;
  const max = priceValues.length ? Math.max(...priceValues) : 0;

  // Colors & sizes
  const colors = useMemo(
    () =>
      Array.from(
        new Set(
          (products ?? [])
            .flatMap((p) => (Array.isArray(p.variants) ? p.variants : []))
            .map((v) => v.color)
            .filter(Boolean)
        )
      ),
    [products]
  );

  const sizes = useMemo(
    () =>
      Array.from(
        new Set(
          (products ?? [])
            .flatMap((p) => (Array.isArray(p.variants) ? p.variants : []))
            .map((v) => v.size)
            .filter(Boolean)
        )
      ),
    [products]
  );

  const [priceRange, setPriceRange] = useState<[number, number]>([min, max]);
  const [selColors, setSelColors] = useState<string[]>([]);
  const [selSizes, setSelSizes] = useState<string[]>([]);

  // Reset slider when span changes
  useEffect(() => {
    setPriceRange([min, max]);
  }, [min, max]);

  // Emit filters upward
  useEffect(() => {
    onChange({
      priceRange,
      colors: selColors,
      sizes: selSizes,
    });
  }, [priceRange, selColors, selSizes, onChange]);

  // Reset all
  const handleReset = useCallback(() => {
    setPriceRange([min, max]);
    setSelColors([]);
    setSelSizes([]);
  }, [min, max]);

  return (
    <aside>
      {/* Tiny header row */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold tracking-wide text-foreground/80">
          Filters
        </h3>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-primary hover:underline"
        >
          Reset
        </button>
      </div>

      <Accordion
        type="multiple"
        // All panels collapsed by default for a clean initial UI
        defaultValue={[]}
        className="space-y-3"
      >
        {/* PRICE */}
        <AccordionItem value="price">
          <AccordionTrigger className="text-sm">
            Price ({symbol})
          </AccordionTrigger>
          <AccordionContent>
            <SliderPrimitive.Root
              className="relative flex w-full items-center"
              value={priceRange}
              min={min}
              max={max}
              step={1}
              onValueChange={(val) => setPriceRange(val as [number, number])}
            >
              <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-primary/20">
                <SliderPrimitive.Range className="absolute h-full bg-primary" />
              </SliderPrimitive.Track>
              <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full bg-white shadow" />
              <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full bg-white shadow" />
            </SliderPrimitive.Root>
            <p className="mt-2 text-sm text-muted-foreground">
              {symbol}
              {priceRange[0].toLocaleString()} – {symbol}
              {priceRange[1].toLocaleString()}
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* COLOR */}
        <AccordionItem value="color">
          <AccordionTrigger className="text-sm">Color</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <label
                  key={c}
                  className="inline-flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selColors.includes(c)}
                    onCheckedChange={(checked: CheckedState) => {
                      const isChecked = checked === true;
                      setSelColors((prev) =>
                        isChecked
                          ? [...prev, c]
                          : prev.filter((x) => x !== c)
                      );
                    }}
                  />
                  <span className="text-sm text-muted-foreground">{c}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SIZE */}
        <AccordionItem value="size">
          <AccordionTrigger className="text-sm">Size</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <label
                  key={s}
                  className="inline-flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selSizes.includes(s)}
                    onCheckedChange={(checked: CheckedState) => {
                      const isChecked = checked === true;
                      setSelSizes((prev) =>
                        isChecked
                          ? [...prev, s]
                          : prev.filter((x) => x !== s)
                      );
                    }}
                  />
                  <span className="text-sm text-muted-foreground">{s}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </aside>
  );
}
