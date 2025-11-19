"use client";

import useSWR from "swr";
import Link from "next/link";
import { X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/context/currencyContext";
import { formatAmount } from "@/lib/formatCurrency";

interface WishlistItem {
  id: string;
  addedAt: string;
  product: {
    id: string;
    name: string;
    images: string[];
    // now correctly typed as an object
    category: { slug: string; name: string; description: string | null };
    priceNGN: number | null;
    priceUSD: number | null;
    priceEUR: number | null;
    priceGBP: number | null;
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function WishlistSection() {
  const { data: items, error, mutate } = useSWR<WishlistItem[]>(
    "/api/account/wishlist",
    fetcher
  );
  const { currency } = useCurrency();

  // IMPORTANT: delete by productId (what the API expects)
  const remove = async (productId: string) => {
    // optimistic update so the card disappears instantly
    const previous = items;
    mutate(
      (prev) => (prev ? prev.filter((w) => w.product.id !== productId) : prev),
      { revalidate: false }
    );

    const res = await fetch(`/api/account/wishlist/${productId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      // rollback on failure
      mutate(previous, false);
    } else {
      // final sync
      mutate();
    }
  };

  if (!items && !error) {
    return <p>Loading your wishlist…</p>;
  }
  if (error) {
    return <p className="text-red-600">Failed to load wishlist.</p>;
  }

  return (
    <Card className="backdrop-blur-sm bg-white/60">
      <CardHeader>
        <CardTitle>Your Wishlist</CardTitle>
      </CardHeader>
      <CardContent>
        {items!.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items!.map((item) => {
              const { product: p } = item;
              // pick the correct price
              const price =
                (currency === "NGN"
                  ? p.priceNGN
                  : currency === "USD"
                  ? p.priceUSD
                  : currency === "EUR"
                  ? p.priceEUR
                  : p.priceGBP) ?? 0;
              // extract the category's name
              const categoryName = p.category.name;

              return (
                <div
                  key={item.id}
                  className="relative group overflow-hidden rounded-2xl shadow-lg"
                >
                  {/* Remove button */}
                  <button
                    onClick={() => remove(p.id)}
                    className="absolute top-2 right-2 z-10 rounded-full bg-white p-1 opacity-0 group-hover:opacity-100 transition"
                    aria-label="Remove from wishlist"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>

                  <Link href={`/product/${p.id}`}>
                    {/* Image */}
                    <div className="h-48 bg-gray-100 flex items-center justify-center">
                      {p.images[0] ? (
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="max-h-full"
                        />
                      ) : (
                        <div className="text-gray-400">No image</div>
                      )}
                    </div>
                    {/* Details */}
                    <div className="p-4 space-y-1">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {p.name}
                      </h3>
                      <p className="text-xs text-gray-500">{categoryName}</p>
                      <p className="mt-2 font-bold">
                        {formatAmount(price, currency)}
                      </p>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4 py-12">
            <p className="text-muted-foreground">Your wishlist is empty.</p>
            <Link href="/all-products">
              <Button className="bg-gradient-to-r from-brand to-green-700">
                Start Shopping
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
