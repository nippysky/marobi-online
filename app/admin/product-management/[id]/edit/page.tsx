export const dynamic = "force-dynamic";

import BackButton from "@/components/BackButton";
import EditProductSection from "./EditProductSection";
import { prisma } from "@/lib/db";
import { getAllCategories } from "@/lib/categories";
import { notFound } from "next/navigation";
import type { ProductPayload } from "@/types/product";

const CONVENTIONAL_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"] as const;

async function loadProductPayload(id: string): Promise<ProductPayload | null> {
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      // only grab the slug from the relation:
      category: { select: { slug: true } },
      description: true,
      images: true,
      priceNGN: true,
      priceUSD: true,
      priceEUR: true,
      priceGBP: true,
      status: true,
      sizeMods: true,
      videoUrl: true,
      variants: {
        select: { color: true, size: true, stock: true, weight: true },
        orderBy: [{ color: "asc" }, { size: "asc" }],
      },
    },
  });
  if (!product) return null;

  // 1) Distinct list of colors (empty = no color-dimension)
  const distinctColors = Array.from(
    new Set(product.variants.map((v) => v.color).filter((c) => !!c))
  );

  // 2) Build sizeStocks: first‐seen variant.stock per size
  const sizeStocks: Record<string, string> = {};
  for (const v of product.variants) {
    if (sizeStocks[v.size] === undefined) {
      sizeStocks[v.size] = v.stock.toString();
    }
  }

  // 3) Custom sizes = any size not in your conventional list
  const customSizes = Object.keys(sizeStocks).filter(
    (sz) => !CONVENTIONAL_SIZES.includes(sz as any)
  );

  // 4) Weight: derive from first variant that has weight, fallback to 0
  const firstWithWeight = product.variants.find((v) => typeof v.weight === "number" && !isNaN(v.weight));
  const weight = firstWithWeight?.weight ?? 0;

  return {
    id:          product.id,
    name:        product.name,
    // map category relation to slug string:
    category:    product.category.slug,
    description: product.description ?? "",
    images:      product.images,
    price: {
      NGN: product.priceNGN ?? 0,
      USD: product.priceUSD ?? 0,
      EUR: product.priceEUR ?? 0,
      GBP: product.priceGBP ?? 0,
    },
    status:     product.status,
    sizeMods:   product.sizeMods,
    colors:     distinctColors,
    sizeStocks,
    customSizes,
    videoUrl:   product.videoUrl ?? "",
    weight,
  };
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const payload = await loadProductPayload(id);
  if (!payload) return notFound();

  // fetch all categories to populate the dropdown
  const categories = await getAllCategories();

  return (
    <div className="p-6">
      <BackButton />
      <h1 className="text-2xl font-bold my-10">Edit Product</h1>
      <EditProductSection
        initialProduct={payload}
        categories={categories}
      />
    </div>
  );
}
