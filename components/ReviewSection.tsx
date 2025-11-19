"use client";

import React from "react";
import Link from "next/link";
import useSWRInfinite from "swr/infinite";
import { Star, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReviewForm from "./ReviewForm";
import type { Review } from "@/lib/products";
import { TfiCommentsSmiley } from "react-icons/tfi";

/** Helper to fetch and normalize API payload into your UI Review type */
const fetcher = async (url: string): Promise<Review[] & { total?: number }> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch reviews");
  const data = await res.json();

  // If paginated form {items,total}, map to UI shape
  if (Array.isArray(data)) {
    return data.map(mapApiToUi) as any;
  }
  const items: Review[] = (data.items || []).map(mapApiToUi);
  (items as any).total = data.total ?? 0;
  return items as any;
};

function mapApiToUi(item: any): Review {
  const author = `${item.customer?.firstName ?? ""} ${item.customer?.lastName ?? ""}`.trim() || "Anonymous";
  return {
    id: item.id,
    rating: item.rating,
    author,
    content: item.body,
    createdAt: new Date(item.createdAt),
  };
}

interface ReviewSectionProps {
  productId: string;
  user: any;
  reviews: Review[]; // initial SSR fallback
  pageSize?: number;
}

export default function ReviewSection({
  productId,
  user,
  reviews,
  pageSize = 8,
}: ReviewSectionProps) {
  // SWR Infinite for "Load more"
  const getKey = (index: number, prev: Review[] | null) => {
    if (prev && prev.length === 0) return null; // reached the end
    const offset = index * pageSize;
    return `/api/products/${productId}/reviews?limit=${pageSize}&offset=${offset}`;
  };

  const {
    data,
    error,
    size,
    setSize,
    isValidating,
    mutate,
  } = useSWRInfinite<Review[] & { total?: number }>(getKey, fetcher, {
    revalidateOnFocus: true,
    revalidateIfStale: true,
    revalidateOnReconnect: true,
    // Use initial SSR list as the first page (capped to pageSize)
    fallbackData: [reviews.slice(0, pageSize) as any],
  });

  const pages = data || [];
  const flat = pages.flat() as Review[];
  const totalFromApi = (pages[0] as any)?.total as number | undefined;
  // If total not provided (first render from SSR array), assume "has more" when first page filled
  const hasMore =
    typeof totalFromApi === "number"
      ? flat.length < totalFromApi
      : (pages[pages.length - 1] || []).length === pageSize;

  function onAddOptimistic(newReview: Review) {
    // Optimistically prepend to first page and keep page size
    mutate(
      (current) => {
        const copy = (current ? [...current] : []) as (Review[] & { total?: number })[];
        const first = copy[0] ? [...copy[0]] : [];
        const updatedFirst = [newReview, ...first].slice(0, pageSize);
        copy[0] = updatedFirst as any;
        // bump total if we know it
        if (typeof (copy[0] as any)?.total === "number") {
          (copy[0] as any).total = ((copy[0] as any).total as number) + 1;
        }
        return copy;
      },
      { revalidate: true }
    );
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* — Reviews List (2/3 width) — */}
      <div className="lg:col-span-2 space-y-6">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
            Couldn&apos;t load reviews. Please refresh.
          </div>
        )}

        {!error && flat.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <TfiCommentsSmiley className="w-10 h-10" />
            <p className="text-lg">No reviews yet.</p>
            <p>Be the first to share your thoughts!</p>
          </div>
        ) : (
          <>
            <ul className="space-y-4">
              {flat.map((r) => (
                <li
                  key={r.id}
                  className="group relative rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 text-white font-semibold">
                        {r.author?.[0]?.toUpperCase() ?? "U"}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{r.author}</div>
                        <time className="text-xs text-gray-400">
                          {r.createdAt.toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </time>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const filled = i < r.rating;
                        return (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${filled ? "text-yellow-400" : "text-gray-300"}`}
                            fill={filled ? "currentColor" : "none"}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-gray-700 leading-relaxed">{r.content}</p>

                  <div className="pointer-events-none absolute -right-2 -top-2 hidden rounded-full bg-emerald-600 p-1 text-white shadow-sm group-hover:block">
                    <MessageSquareText className="h-4 w-4" />
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex justify-center">
              {hasMore ? (
                <Button
                  variant="outline"
                  onClick={() => setSize(size + 1)}
                  disabled={isValidating}
                  className="mt-2"
                >
                  {isValidating ? "Loading…" : "Load more"}
                </Button>
              ) : (
                <div className="mt-2 text-sm text-gray-400">You’ve reached the end.</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* — Review Form / Login Prompt (1/3 width) — */}
      <div className="lg:col-span-1 sticky top-24 self-start">
        {user ? (
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-xl font-semibold">Leave a Review</h3>
            <ReviewForm
              productId={productId}
              onSubmitted={(uiReview) => {
                // Convert to local Review type if needed (already matches)
                onAddOptimistic(uiReview as unknown as Review);
              }}
            />
          </div>
        ) : (
          <div className="flex justify-center">
            <Link href="/auth/login">
              <Button>Login to Leave a Review</Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
