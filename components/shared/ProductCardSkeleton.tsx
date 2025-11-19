"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="group flex flex-col animate-[fadein_0.3s_ease-in-out]">
      {/* Image */}
      <div className="relative w-full aspect-[4/5] overflow-hidden rounded-lg bg-gray-800">
        <Skeleton className="absolute inset-0" />
      </div>

      {/* Title */}
      <div className="mt-2 h-4 w-3/4">
        <Skeleton className="h-full w-full rounded" />
      </div>

      {/* Price */}
      <div className="mt-1 h-4 w-1/3">
        <Skeleton className="h-full w-full rounded" />
      </div>
    </div>
  );
};

export default ProductCardSkeleton;
