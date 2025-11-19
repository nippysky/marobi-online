"use client";

import Link from "next/link";
import React from "react";
import { Product } from "@/lib/products";
import ProductCard from "@/components/shared/product-card";
import ProductCardSkeleton from "@/components/shared/ProductCardSkeleton";

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  fallbackCount?: number;
}

/**
 * Responsive grid:
 * - base: 2 columns
 * - md (>=768): 3 columns
 * - lg (>=1024): 4 columns  ← 13/14″ laptops
 * - xl (>=1280): 5 columns  ← 15″+ screens
 */
export default function ProductGrid({
  products,
  isLoading = false,
  fallbackCount = 12,
}: ProductGridProps) {
  const gridClasses = "grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  if (isLoading) {
    return (
      <section className={gridClasses}>
        {Array.from({ length: fallbackCount }).map((_, i) => (
          <div key={i} className="block">
            <ProductCardSkeleton />
          </div>
        ))}
      </section>
    );
  }

  if (!products.length) {
    return <div className="text-center py-20">No products found.</div>;
  }

  return (
    <section className={gridClasses}>
      {products.map((prod) => (
        <Link key={prod.id} href={`/product/${prod.id}`} className="block">
          <ProductCard product={prod} />
        </Link>
      ))}
    </section>
  );
}
