"use client";

import React, { useMemo } from "react";
import { useProducts } from "@/lib/hooks/useProducts";
import FilterableProductList from "./FilterableProductList";
import type { Product } from "@/lib/products";

// Fisher–Yates shuffle (client-side, once)
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const ProductListClient: React.FC = () => {
  const { data: products = [], isLoading, isError } = useProducts();

  const shuffled = useMemo<Product[]>(() => {
    if (!products || !products.length) return [];
    return shuffle(products);
  }, [products]);

  return (
    <>
      {isError && (
        <div className="mb-4 text-red-600">
          Failed to load products. Please refresh.
        </div>
      )}
      <FilterableProductList
        initialProducts={shuffled}
        isLoading={isLoading}
      />
    </>
  );
};

export default ProductListClient;
