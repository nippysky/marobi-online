import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductsByCategory, Product } from "@/lib/products";
import { prisma } from "@/lib/db";
import Header from "@/components/shared/header";
import Banner from "@/components/categories/Banner";
import FilterableProductList from "@/components/categories/FilterableProductList";
import Footer from "@/components/shared/footer";

// IMPORTANT: avoid build-time DB calls on Vercel
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Per-category SEO (safe, no DB query)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  return {
    title: `Marobi — ${slug}`,
    description:
      "Discover premium everyday wear from Marobi, crafted for the modern working woman.",
    alternates: {
      canonical: `/categories/${slug}`,
    },
    openGraph: {
      title: `Marobi — ${slug}`,
      description:
        "Discover premium everyday wear from Marobi, crafted for the modern working woman.",
      url: `https://marobionline.com/categories/${slug}`,
      siteName: "Marobi",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Marobi — ${slug}`,
      description:
        "Discover premium everyday wear from Marobi, crafted for the modern working woman.",
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Fetch the category from DB (runtime)
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { name: true },
  });
  if (!category) notFound();

  // Fetch products for this category
  const products: Product[] = await getProductsByCategory(slug);

  return (
    <section className="flex flex-col">
      <Header />

      <Banner name={category.name} />

      <main className="mt-10 pb-20 px-5 md:px-10 lg:px-20">
        <FilterableProductList initialProducts={products} />
      </main>

      <Footer />
    </section>
  );
}