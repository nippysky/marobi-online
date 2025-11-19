import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductsByCategory, Product } from "@/lib/products";
import { prisma } from "@/lib/db";
import Header from "@/components/shared/header";
import Banner from "@/components/categories/Banner";
import FilterableProductList from "@/components/categories/FilterableProductList";
import Footer from "@/components/shared/footer";

export const revalidate = 300; // ISR for category pages

// For static generation of category paths (if using SSG)
export async function generateStaticParams() {
  const categories = await prisma.category.findMany({ select: { slug: true } });
  return categories.map((cat) => ({ slug: cat.slug }));
}

// Per-category SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;


  const category = await prisma.category.findUnique({
    where: { slug },
    select: { name: true },
  });

  if (!category) {
    return {
      title: "Marobi Category",
      description:
        "Discover premium everyday wear from Marobi, crafted for the modern working woman.",
    };
  }

  const title = `${category.name} — Marobi`;
  const description = `Explore ${category.name.toLowerCase()} from Marobi: premium everyday wear crafted for the modern working woman, blending clean tailoring, rich textures, and quiet luxury.`;
  const url = `https://marobionline.com/categories/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: `/categories/${slug}`,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "Marobi",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Fetch the category from DB
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
