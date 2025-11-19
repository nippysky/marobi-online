// lib/categories.ts
import "server-only";
import { prisma, prismaReady } from "@/lib/db";

/** Shape your frontend expects from /api/categories */
export type Category = {
  slug: string;
  name: string;
  description: string | null;
  bannerImage: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;   // ISO string for JSON safety
  updatedAt: string;   // ISO string for JSON safety
  productCount: number;
};

/** Fetch categories. Defaults to only active ones. */
export async function getAllCategories(
  opts?: { activeOnly?: boolean }
): Promise<Category[]> {
  await prismaReady;

  const where = opts?.activeOnly === false ? {} : { isActive: true };

  const rows = await prisma.category.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      slug: true,
      name: true,
      description: true,
      bannerImage: true,
      isActive: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { products: true } },
    },
  });

  return rows.map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.description,
    bannerImage: c.bannerImage,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    productCount: c._count.products,
  }));
}

/** Convenience wrapper for active categories */
export const getActiveCategories = () => getAllCategories({ activeOnly: true });

/** 🔹 NEW: fetch a single category by slug (full mapped object) */
export async function getCategoryBySlug(
  slug: string
): Promise<Category | null> {
  await prismaReady;

  const c = await prisma.category.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      description: true,
      bannerImage: true,
      isActive: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { products: true } },
    },
  });

  if (!c) return null;

  return {
    slug: c.slug,
    name: c.name,
    description: c.description,
    bannerImage: c.bannerImage,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    productCount: c._count.products,
  };
}
