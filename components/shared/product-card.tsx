"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/lib/context/currencyContext";
import { formatAmount } from "@/lib/formatCurrency";
import type { Product } from "@/lib/products";

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const { currency } = useCurrency();

  // First image if any
  const imgUrl = product.images[0];

  // Price lookup defensively
  const rawPrice = (product.prices as any)[currency] ?? 0;
  const formattedPrice = formatAmount(rawPrice, currency);

  // Slightly richer alt text without guessing extra fields
  const altText = imgUrl
    ? `${product.name} — Marobi womenswear`
    : `${product.name} — product image not available`;

  return (
    <div className="group flex flex-col">
      <div className="relative w-full aspect-[4/5] overflow-hidden rounded-lg bg-gray-100">
        {!imgLoaded && (
          <div className="absolute inset-0" aria-hidden="true">
            <Skeleton className="h-full w-full" />
          </div>
        )}

        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={altText}
            fill
            // Better match your actual grids:
            // - product page: 2–5 cols
            // - showcase: 2–5 cols
            sizes="
              (max-width: 640px) 50vw,
              (max-width: 768px) 50vw,
              (max-width: 1024px) 33vw,
              (max-width: 1536px) 25vw,
              20vw
            "
            className={`object-cover transition-transform duration-300 ease-in-out ${
              imgLoaded ? "opacity-100 group-hover:scale-105" : "opacity-0"
            }`}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-200">
            <span className="text-xs">No Image</span>
          </div>
        )}
      </div>

      <h2
        className="mt-2 text-sm font-medium text-gray-800 truncate"
        title={product.name}
      >
        {product.name}
      </h2>

      <div className="mt-1 text-sm font-semibold text-gray-800">
        {formattedPrice}
      </div>
    </div>
  );
};

export default ProductCard;
