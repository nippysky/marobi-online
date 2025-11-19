"use client";

import React from "react";
import Link from "next/link";
import { Box } from "lucide-react";
import ProductCard from "@/components/shared/product-card";
import { Product } from "@/lib/products";
import useMediaQuery from "@/lib/useMediaQuery";

type Category = {
  name: string;
  viewMoreHref: string;
  products: Product[];
};

interface ShowcaseProps {
  categories: Category[];
}

const ProductShowcase: React.FC<ShowcaseProps> = ({ categories }) => {
  const is2xlUp = useMediaQuery("(min-width: 1536px)"); // >= 1536px

  return (
    <section className="py-20 space-y-20 max-w-[1920px] mx-auto px-5 md:px-10 lg:px-40">
      {categories.map(({ name, viewMoreHref, products }) => {
        // Show 4 products everywhere except big desktops (5)
        const visibleProducts = is2xlUp
          ? products.slice(0, 5)
          : products.slice(0, 4);

        return (
          <section key={viewMoreHref}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                {name}
              </h2>
              <Link
                href={viewMoreHref}
                className="hidden sm:flex uppercase tracking-wider items-center gap-2 text-sm font-semibold underline text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-[0.8rem]"
              >
                View More
              </Link>
            </div>

            {/* Grid */}
            {visibleProducts.length > 0 ? (
              <div
                className="
                  grid gap-5
                  grid-cols-2         /* mobile */
                  sm:grid-cols-3      /* tablets */
                  lg:grid-cols-4      /* 13–14″ laptops */
                  2xl:grid-cols-5     /* ≥15″ screens */
                "
              >
                {visibleProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/product/${product.id}`}
                    prefetch={false}
                    className="block"
                    aria-label={product.name}
                  >
                    <ProductCard product={product} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <Box className="w-12 h-12 mb-4" />
                <p className="text-lg">No products available.</p>
              </div>
            )}

            {/* Mobile “View More” */}
            <div className="mt-6 sm:hidden">
              <Link
                href={viewMoreHref}
                className="block w-full text-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-2.5 rounded-md transition-colors duration-200"
              >
                View More
              </Link>
            </div>
          </section>
        );
      })}
    </section>
  );
};

export default ProductShowcase;
