export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductTabsClient from "./ProductTabsClient";
import { Badge } from "@/components/ui/badge"; // optional if you want badges for status

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
    stock: number;
    weight: number | null;
    createdAt: Date;
  }[];
  wishlistCount: number;
}

async function getProductBasics(id: string): Promise<ProductBasics | null> {
  const row = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      images: true,
      category: {
        select: {
          name: true,
          description: true,
        },
      },
      averageRating: true,
      ratingCount: true,
      createdAt: true,
      priceNGN: true,
      priceUSD: true,
      priceEUR: true,
      priceGBP: true,
      status: true,
      sizeMods: true,
      videoUrl: true,
      variants: {
        select: {
          id: true,
          color: true,
          size: true,
          stock: true,
          weight: true,
          createdAt: true,
        },
      },
      wishlistItems: {
        select: {
          id: true,
        },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    images: row.images,
    category: {
      name: row.category.name,
      description: row.category.description,
    },
    averageRating: row.averageRating,
    ratingCount: row.ratingCount,
    createdAt: row.createdAt,
    priceNGN: row.priceNGN,
    priceUSD: row.priceUSD,
    priceEUR: row.priceEUR,
    priceGBP: row.priceGBP,
    status: row.status,
    sizeMods: row.sizeMods,
    videoUrl: row.videoUrl,
    variants: row.variants.map((v) => ({
      id: v.id,
      color: v.color,
      size: v.size,
      stock: v.stock,
      weight: v.weight,
      createdAt: v.createdAt,
    })),
    wishlistCount: row.wishlistItems?.length ?? 0,
  };
}

export default async function ProductViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductBasics(id);
  if (!product) return notFound();

  return (
    <div className="p-6 space-y-6">
      <HeaderSection product={product} />
      <ProductTabsClient product={product} />
    </div>
  );
}

function HeaderSection({ product }: { product: ProductBasics }) {
  const primary = product.images[0] ?? null;

  const statusColor =
    product.status === "Published"
      ? "bg-green-100 text-green-800"
      : product.status === "Draft"
      ? "bg-yellow-100 text-yellow-800"
      : "bg-gray-100 text-gray-800";

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        {primary ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primary}
            alt={product.name}
            className="h-20 w-20 rounded object-cover border"
          />
        ) : (
          <div className="h-20 w-20 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500 border">
            NO IMG
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}
            >
              {product.status}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-600">
            Category: {product.category.name} • Created:{" "}
            {product.createdAt.toLocaleDateString()}
          </div>
          {product.category.description && (
            <div className="mt-1 text-sm text-gray-500">
              {product.category.description}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <RatingBadge
              average={product.averageRating}
              count={product.ratingCount}
            />
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-800 text-sm font-medium">
              Wishlist: <span className="ml-1 font-semibold">{product.wishlistCount}</span>
            </div>
            {product.sizeMods && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-800 text-sm font-medium">
                Size Mods Enabled
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/admin/product-management/${product.id}/edit`}
          className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50 text-sm font-medium"
        >
          Edit Product
        </Link>
        <Link
          href="/admin/product-management"
          className="px-4 py-2 rounded bg-gray-900 text-white text-sm font-medium"
        >
          Back to List
        </Link>
      </div>
    </div>
  );
}

function RatingBadge({
  average,
  count,
}: {
  average: number;
  count: number;
}) {
  const display = count === 0 ? "—" : average.toFixed(2);
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-yellow-100 text-yellow-800 text-sm font-medium">
      <span>{display}</span>
      <Stars value={average} count={count} />
      <span className="text-xs text-gray-700">({count})</span>
    </div>
  );
}

function Stars({ value, count }: { value: number; count: number }) {
  if (count === 0)
    return <span className="text-xs text-gray-500">No reviews</span>;

  const filled = Math.round(value);
  return (
    <span className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i < filled ? "text-yellow-500" : "text-gray-300"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118L10 13.347l-3.37 2.448c-.785.57-1.84-.197-1.54-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.641 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
    </span>
  );
}
