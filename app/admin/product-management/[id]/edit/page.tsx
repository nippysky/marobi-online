export const dynamic = "force-dynamic";

import BackButton from "@/components/BackButton";
import EditProductSection from "./EditProductSection";
import { prisma } from "@/lib/db";
import { getAllCategories } from "@/lib/categories";
import { notFound } from "next/navigation";
import type { ProductPayload, ColorSizeStocks } from "@/types/product";

const CONVENTIONAL_SIZES = ["S", "M", "L", "XL", "R", "B"] as const;

type VariantSalesSnapshot = {
  color: string;
  size: string;
  sold: number;
  remaining: number;
  total: number;
};

interface EditProductData {
  product: ProductPayload;
  variantSales: VariantSalesSnapshot[];
}

async function loadProductPayload(id: string): Promise<EditProductData | null> {
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
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
        select: { id: true, color: true, size: true, stock: true, weight: true },
        orderBy: [{ color: "asc" }, { size: "asc" }],
      },
    },
  });
  if (!product) return null;

  const variantIds = product.variants.map((v) => v.id);

  // Derive "sold" per variant from OrderItem + non-cancelled orders
  const sales = variantIds.length
    ? await prisma.orderItem.groupBy({
        by: ["variantId"],
        where: {
          variantId: { in: variantIds },
          order: {
            status: {
              in: ["Processing", "Shipped", "Delivered"],
            },
          },
        },
        _sum: {
          quantity: true,
        },
      })
    : [];

  const soldMap = new Map<string, number>();
  for (const s of sales) {
    soldMap.set(s.variantId, s._sum.quantity ?? 0);
  }

  const variantSales: VariantSalesSnapshot[] = product.variants.map((v) => {
    const sold = soldMap.get(v.id) ?? 0;
    const remaining = v.stock;
    const total = sold + remaining;
    return {
      color: (v.color || "").trim(),
      size: (v.size || "").trim(),
      sold,
      remaining,
      total,
    };
  });

  // 1) Distinct list of non-empty colors
  const distinctColors = Array.from(
    new Set(product.variants.map((v) => v.color).filter((c) => !!c && c.trim()))
  );
  const hasColors = distinctColors.length > 0;

  // 2) Build sizeStocks (used as "enabled sizes" + global stock in no-color mode)
  const sizeStocks: Record<string, string> = {};

  // 3) Build per-color stock matrix from variants
  const colorSizeStocks: ColorSizeStocks = {};

  if (hasColors) {
    for (const v of product.variants) {
      const colorKey = (v.color || "").trim();
      const sizeKey = (v.size || "").trim();
      if (!sizeKey) continue;

      // per-color stock (remaining)
      if (colorKey) {
        if (!colorSizeStocks[colorKey]) colorSizeStocks[colorKey] = {};
        if (colorSizeStocks[colorKey][sizeKey] === undefined) {
          colorSizeStocks[colorKey][sizeKey] = v.stock.toString();
        }
      }

      // union of all sizes used across colors – for toggles
      if (sizeStocks[sizeKey] === undefined) {
        sizeStocks[sizeKey] = v.stock.toString();
      }
    }
  } else {
    // legacy / no-color products: single dimension (size → stock)
    for (const v of product.variants) {
      const sizeKey = (v.size || "").trim();
      if (!sizeKey) continue;
      if (sizeStocks[sizeKey] === undefined) {
        sizeStocks[sizeKey] = v.stock.toString();
      }
    }
  }

  // 4) Custom sizes = any size not in the conventional list
  const customSizes = Object.keys(sizeStocks).filter(
    (sz) => !CONVENTIONAL_SIZES.includes(sz as any)
  );

  // 5) Weight: from first variant that has it
  const firstWithWeight = product.variants.find(
    (v) => typeof v.weight === "number" && !Number.isNaN(v.weight)
  );
  const weight = firstWithWeight?.weight ?? 0;

  const payload: ProductPayload = {
    id: product.id,
    name: product.name,
    category: product.category.slug,
    description: product.description ?? "",
    images: product.images,
    price: {
      NGN: product.priceNGN ?? 0,
      USD: product.priceUSD ?? 0,
      EUR: product.priceEUR ?? 0,
      GBP: product.priceGBP ?? 0,
    },
    status: product.status,
    sizeMods: product.sizeMods,
    colors: distinctColors,
    sizeStocks,
    customSizes,
    videoUrl: product.videoUrl ?? "",
    weight,
    ...(hasColors && Object.keys(colorSizeStocks).length
      ? { colorSizeStocks }
      : {}),
  };

  return { product: payload, variantSales };
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadProductPayload(id);
  if (!data) return notFound();

  const { product, variantSales } = data;
  const categories = await getAllCategories();

  return (
    <div className="p-6">
      <BackButton />
      <h1 className="text-2xl font-bold my-10">Edit Product</h1>
      <EditProductSection
        initialProduct={product}
        categories={categories}
        variantSales={variantSales}
      />
    </div>
  );
}
