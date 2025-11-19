"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useCurrency } from "@/lib/context/currencyContext";
import { formatAmount } from "@/lib/formatCurrency";
import type { Product } from "@/lib/products";

interface SearchBarProps {
  className?: string;
}

// simple debounce hook
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function SearchBar({ className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 300);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { currency } = useCurrency();
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // keyboard navigation
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, 5));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          const p = results[highlightedIndex];
          window.location.href = `/product/${p.id}`;
        }
      } else if (e.key === "Escape") {
        setOpen(false);
        setHighlightedIndex(-1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, highlightedIndex]
  );

  // fetch matching products via React Query
  const {
    data: products = [],
    isFetching,
    isError,
  } = useQuery<Product[], Error>({
    queryKey: ["search-bar", debouncedQuery.toLowerCase()],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/search?query=${encodeURIComponent(debouncedQuery)}`,
        { signal }
      );
      if (!res.ok) throw new Error("Search failed");
      return (await res.json()) as Product[];
    },
    enabled: debouncedQuery.length >= 1,
    staleTime: 1000 * 60 * 5, // if your version accepts it; remove if type errors persist
  });

  const results = (products || []).slice(0, 6);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <SearchIcon
          size={16}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
        />
        <Input
          placeholder="Search products…"
          className="pl-10 pr-4 py-2 rounded-full"
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-label="Search products"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-activedescendant={
            highlightedIndex >= 0 ? `search-result-${highlightedIndex}` : undefined
          }
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 w-full max-h-80 overflow-y-auto rounded-lg bg-white shadow-lg z-50 ring-1 ring-gray-200"
          >
            {debouncedQuery === "" ? (
              <p className="p-4 text-gray-500 text-sm">Type to search…</p>
            ) : isFetching ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 py-4 px-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse space-y-2 px-2">
                    <div className="h-12 w-12 bg-gray-100 rounded" />
                    <div className="h-4 w-3/4 bg-gray-100 rounded" />
                    <div className="h-3 w-1/2 bg-gray-100 rounded" />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <p className="p-4 text-red-600 text-sm">
                Error loading results. Try again.
              </p>
            ) : results.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm">No products found.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {results.map((p: Product, idx: number) => {
                  const price = formatAmount(
                    (p.prices as any)[currency] as number,
                    currency
                  );
                  const imgSrc =
                    p.images && p.images.length > 0 ? p.images[0] : undefined;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <li
                      key={p.id}
                      id={`search-result-${idx}`}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                        isHighlighted ? "bg-gray-100" : "hover:bg-gray-50"
                      }`}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      <Link
                        href={`/product/${p.id}`}
                        className="flex items-center gap-3 flex-1"
                        onClick={() => setOpen(false)}
                      >
                        <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                          {imgSrc ? (
                            <Image
                              src={imgSrc}
                              alt={p.name}
                              width={48}
                              height={48}
                              className="object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="text-xs text-gray-500">No Img</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-gray-900">
                            {p.name}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-600">{price}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {p.category}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
