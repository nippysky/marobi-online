"use client";

import React, { useState, useCallback, useMemo } from "react";
import FilterSidebar, { Filters } from "./FilterSidebar";
import ProductGrid from "./ProductGrid";
import { Product } from "@/lib/products";
import { useCurrency } from "@/lib/context/currencyContext";
import { Card } from "@/components/ui/card";

interface Props {
  initialProducts: Product[];
  isLoading?: boolean;
}

// No `inStock` here — you already fetch only in-stock products.
const DEFAULT_FILTERS: Filters = {
  priceRange: [0, Infinity],
  colors: [],
  sizes: [],
};

export default function FilterableProductList({
  initialProducts,
  isLoading = false,
}: Props) {
  const { currency } = useCurrency();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const handleFilterChange = useCallback((f: Filters) => {
    setFilters(f);
  }, []);

  const filtered = useMemo(() => {
    if (isLoading) return [];

    return initialProducts.filter((p) => {
      const price = (p.prices as any)[currency] as number;

      // PRICE RANGE
      if (price < filters.priceRange[0] || price > filters.priceRange[1]) {
        return false;
      }

      // COLOR
      if (
        filters.colors.length &&
        !p.variants.some((v) => filters.colors.includes(v.color))
      ) {
        return false;
      }

      // SIZE (only variants that are in stock)
      if (
        filters.sizes.length &&
        !p.variants.some(
          (v) => v.inStock > 0 && filters.sizes.includes(v.size)
        )
      ) {
        return false;
      }

      return true;
    });
  }, [initialProducts, currency, filters, isLoading]);

  return (
    <div className="grid items-start grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
      {/* Sidebar in a subtle card */}
      <Card className="p-4 bg-muted/40 border-muted-foreground/20 shadow-sm rounded-2xl lg:sticky lg:top-24">
        <FilterSidebar products={initialProducts} onChange={handleFilterChange} />
      </Card>

      {/* Product grid */}
      <ProductGrid products={filtered} isLoading={isLoading} />
    </div>
  );
}
