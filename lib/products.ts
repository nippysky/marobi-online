import { prisma } from "./db";

export interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  category: string;
  prices: Record<"NGN" | "USD" | "EUR" | "GBP", number>;
  variants: Array<{
    color: string;
    size: string;
    inStock: number;
    weight?: number; // kg per variant
  }>;
  sizeMods: boolean;
  videoUrl: string | null;
}

export interface Review {
  id: string;
  author: string;
  content: string;
  rating: number;
  createdAt: Date;
}

/** 1️⃣ Fetch one product by ID */
export async function getProductById(id: string): Promise<Product | null> {
  const p = await prisma.product.findUnique({
    where: { id },
    include: { variants: true },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    images: p.images,
    category: p.categorySlug,
    prices: {
      NGN: p.priceNGN ?? 0,
      USD: p.priceUSD ?? 0,
      EUR: p.priceEUR ?? 0,
      GBP: p.priceGBP ?? 0,
    },
    variants: p.variants.map((v) => ({
      color: v.color,
      size: v.size,
      inStock: v.stock,
      weight: v.weight ?? 0,
    })),
    sizeMods: p.sizeMods,
    videoUrl: p.videoUrl,
  };
}

export async function getProductsByCategory(
  categorySlug: string,
  limit = 8
): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: {
      categorySlug,
      status: "Published",
    },
    take: limit,
    include: { variants: { take: 1 } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    images: p.images,
    category: p.categorySlug,
    prices: {
      NGN: p.priceNGN ?? 0,
      USD: p.priceUSD ?? 0,
      EUR: p.priceEUR ?? 0,
      GBP: p.priceGBP ?? 0,
    },
    variants: p.variants.map((v) => ({
      color: v.color,
      size: v.size,
      inStock: v.stock,
      weight: (v as any).weight ?? 0,
    })),
    sizeMods: p.sizeMods,
    videoUrl: p.videoUrl,
  }));
}

/** 3️⃣ Fetch reviews for a product */
export async function getReviewsByProduct(
  productId: string
): Promise<Review[]> {
  const rows = await prisma.review.findMany({
    where: { productId },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    author: `${r.customer.firstName} ${r.customer.lastName}`,
    content: r.body,
    rating: r.rating,
    createdAt: r.createdAt,
  }));
}

// Fetch all published products with at least one image (for carousel ads)
export async function getAdProducts(limit = 10): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: {
      status: "Published",
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { variants: true },
  });
  return rows
    .filter((p) => Array.isArray(p.images) && p.images.length > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      images: p.images,
      category: p.categorySlug,
      prices: {
        NGN: p.priceNGN ?? 0,
        USD: p.priceUSD ?? 0,
        EUR: p.priceEUR ?? 0,
        GBP: p.priceGBP ?? 0,
      },
      variants: p.variants.map((v: any) => ({
        color: v.color,
        size: v.size,
        inStock: v.stock,
        weight: v.weight ?? 0,
      })),
      sizeMods: p.sizeMods,
      videoUrl: p.videoUrl,
    }));
}

export async function getAllProducts(): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: { status: "Published" },
    include: { variants: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    images: p.images,
    category: p.categorySlug,
    prices: {
      NGN: p.priceNGN ?? 0,
      USD: p.priceUSD ?? 0,
      EUR: p.priceEUR ?? 0,
      GBP: p.priceGBP ?? 0,
    },
    variants: p.variants.map((v: any) => ({
      color: v.color,
      size: v.size,
      inStock: v.stock,
      weight: v.weight ?? 0,
    })),
    sizeMods: p.sizeMods,
    videoUrl: p.videoUrl,
  }));
}
