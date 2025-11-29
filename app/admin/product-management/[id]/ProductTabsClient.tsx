"use client";

import { useState } from "react";
import ProductReviewsPanel from "./ProductReviewsPanel";
import { Button } from "@/components/ui/button";

interface ProductBasics {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  category: {
    name: string;
    description: string | null;
  };
  averageRating: number;
  ratingCount: number;
  createdAt: Date;
  priceNGN: number | null;
  priceUSD: number | null;
  priceEUR: number | null;
  priceGBP: number | null;
  status: "Draft" | "Published" | "Archived";
  sizeMods: boolean;
  videoUrl: string | null;
  variants: {
    id: string;
    color: string;
    size: string;
    stock: number;      // remaining
    sold: number;       // total sold
    total: number;      // total ever = sold + remaining
    weight: number | null;
    createdAt: Date;
  }[];
  wishlistCount: number;
}

export default function ProductTabsClient({
  product,
}: {
  product: ProductBasics;
}) {
  const [tab, setTab] = useState<"overview" | "reviews">("overview");

  return (
    <div className="space-y-6">
      <div className="flex border-b">
        <TabButton
          label="Overview"
          active={tab === "overview"}
          onClick={() => setTab("overview")}
        />
        <TabButton
          label="Reviews"
          active={tab === "reviews"}
          onClick={() => setTab("reviews")}
        />
      </div>

      {tab === "overview" && <OverviewSection product={product} />}
      {tab === "reviews" && (
        <div>
          <ProductReviewsPanel productId={product.id} />
        </div>
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      className={`rounded-none border-b-2 -mb-px ${
        active
          ? "border-gray-900 text-gray-900"
          : "border-transparent text-gray-500 hover:text-gray-800"
      }`}
    >
      {label}
    </Button>
  );
}

function OverviewSection({ product }: { product: ProductBasics }) {
  const gallery = product.images;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* left side */}
      <div className="md:col-span-2 space-y-6">
        {/* basic info */}
        <div className="p-4 border rounded bg-white">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Basic Info
          </h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">Name</dt>
            <dd>{product.name}</dd>

            <dt className="text-gray-500">Category</dt>
            <dd>{product.category.name}</dd>

            <dt className="text-gray-500">Prices</dt>
            <dd>
              ₦{product.priceNGN ?? "-"} / ${product.priceUSD ?? "-"} / €
              {product.priceEUR ?? "-"} / £{product.priceGBP ?? "-"}
            </dd>

            <dt className="text-gray-500">Rating</dt>
            <dd>
              {product.ratingCount
                ? `${product.averageRating.toFixed(2)} (${product.ratingCount})`
                : "No reviews yet"}
            </dd>

            <dt className="text-gray-500">Status</dt>
            <dd>{product.status}</dd>

            <dt className="text-gray-500">Size Mods</dt>
            <dd>{product.sizeMods ? "Enabled" : "Disabled"}</dd>

            <dt className="text-gray-500">Video</dt>
            <dd>
              {product.videoUrl ? (
                <a
                  href={product.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 underline text-sm"
                >
                  View Video
                </a>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        </div>

        {/* description */}
        <div className="p-4 border rounded bg-white">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Description
          </h2>
          {product.description ? (
            <p className="whitespace-pre-line leading-relaxed text-sm text-gray-700">
              {product.description}
            </p>
          ) : (
            <p className="italic text-sm text-gray-400">
              No description added yet.
            </p>
          )}
        </div>

        {/* variants */}
        <div className="p-4 border rounded bg-white">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Variants
          </h2>
          {product.variants.length === 0 ? (
            <p className="italic text-sm text-gray-400">No variants created.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-2 border-b">Color</th>
                    <th className="text-left p-2 border-b">Size</th>
                    <th className="text-left p-2 border-b">Total Stock</th>
                    <th className="text-left p-2 border-b">Sold</th>
                    <th className="text-left p-2 border-b">Remaining</th>
                    <th className="text-left p-2 border-b">Weight</th>
                    <th className="text-left p-2 border-b">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => (
                    <tr key={v.id} className="odd:bg-gray-50">
                      <td className="p-2 border-b">{v.color || "—"}</td>
                      <td className="p-2 border-b">{v.size || "—"}</td>
                      <td className="p-2 border-b">{v.total}</td>
                      <td className="p-2 border-b">{v.sold}</td>
                      <td className="p-2 border-b">{v.stock}</td>
                      <td className="p-2 border-b">
                        {v.weight != null ? `${v.weight.toFixed(2)} kg` : "—"}
                      </td>
                      <td className="p-2 border-b">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* gallery */}
        <div className="p-4 border rounded bg-white">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Images
          </h2>
          {gallery.length === 0 ? (
            <p className="italic text-sm text-gray-400">
              No images uploaded.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {gallery.map((src, i) => (
                <div
                  key={i}
                  className={`relative aspect-[4/3] overflow-hidden rounded border bg-gray-50 ${
                    i === 0 ? "ring-2 ring-offset-1 ring-indigo-500" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${product.name} ${i + 1}`}
                    className="object-cover w-full h-full"
                  />
                  {i === 0 && (
                    <span className="absolute top-1 left-1 rounded bg-indigo-600 px-1 py-0.5 text-[10px] text-white">
                      PRIMARY
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* right sidebar */}
      <div className="space-y-6">
        <div className="p-4 border rounded bg-white">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Next Steps
          </h2>
          <ul className="space-y-1 list-disc pl-4 text-sm text-gray-600">
            <li>Switch to Reviews to manage feedback.</li>
            <li>Edit product via “Edit Product” above.</li>
            <li>Add more images or description to increase sales.</li>
          </ul>
        </div>
        <div className="p-4 border rounded bg-white">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Tips
          </h2>
          <ul className="space-y-1 list-disc pl-4 text-sm text-gray-600">
            <li>Use consistent aspect‐ratios for images.</li>
            <li>High-res photos build trust.</li>
            <li>Prompt customers to leave reviews.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
