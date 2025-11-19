"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/lib/products";

export default function AdCarouselClient({ ads }: { ads: Product[] }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * ads.length));

  useEffect(() => {
    const handle = setInterval(() => {
      setIdx((current) => {
        let next = Math.floor(Math.random() * ads.length);
        if (ads.length > 1) {
          while (next === current) {
            next = Math.floor(Math.random() * ads.length);
          }
        }
        return next;
      });
    }, 25000); // every 25s
    return () => clearInterval(handle);
  }, [ads.length]);

  const product = ads[idx];
  const mainImage = product.images?.[0];

  return (
    <div className="relative h-full w-full bg-primary">
      {/* contained background */}
      <div
        className="absolute inset-0 bg-contain bg-center bg-no-repeat transition-all duration-700"
        style={{ backgroundImage: `url(${mainImage})` }}
      />
      {/* overlay */}
      <div className="absolute inset-0 bg-black/40" />
      {/* CTA */}
      <div className="absolute inset-0 flex flex-col justify-end p-8">
        <h2 className="text-3xl font-bold text-white">{product.name}</h2>
        <Link
          href={`/product/${product.id}`}
          className="mt-4 inline-flex items-center text-white hover:underline"
        >
          <span>View Product</span>
          <ArrowRight className="ml-2 w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
