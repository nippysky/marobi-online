// components/shared/ProductCard.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface Product {
  id: string;
  name: string;
  imageUrl: string;
}

type ProductCardProps = {
  product: Product;
};

export const ProductCardShowcase: React.FC<ProductCardProps> = ({
  product,
}) => {
  // Track whether the image has finished loading
  const [isLoading, setIsLoading] = useState(true);

  return (
    <Link href={`/product/${product.id}`} className="group block">
      <div className="aspect-[4/5] relative w-full overflow-hidden rounded-lg bg-gray-100">
        {/* 1. Skeleton placeholder */}
        {isLoading && <Skeleton className="absolute inset-0 h-full w-full" />}

        {/* 2. Next.js Image (with onLoad instead of onLoad) */}
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className={`
            object-cover
            transition-transform duration-300 ease-in-out
            ${isLoading ? "opacity-0" : "opacity-100 group-hover:scale-105"}
          `}
          onLoad={() => {
            // Once the image is fully loaded, hide the skeleton
            setIsLoading(false);
          }}
          // Because we're using `fill`, Next.js infers width/height from the parent container's aspect ratio.
        />
      </div>
    </Link>
  );
};

export default ProductCardShowcase;
