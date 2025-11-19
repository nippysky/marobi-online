export const dynamic = "force-dynamic";

import React from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import Link from "next/link";

import { getCategoryBySlug } from "@/lib/categories";
import {
  getProductById,
  getProductsByCategory,
  getReviewsByProduct,
  Product,
  Review,
} from "@/lib/products";

import Header from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import ReviewSection from "@/components/ReviewSection";
import ProductDetailHero from "@/components/ProductDetailsHero";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { authOptions } from "@/lib/authOptions";

/** shadcn/ui breadcrumbs */
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ProductCard from "@/components/shared/product-card";

// ─────────────────────────────────────────────────────────────
// Per-product SEO metadata (no assumptions about extra fields)
// ─────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await getProductById(id);
  if (!product) {
    return {
      title: "Product not found | Marobi",
      description: "This Marobi piece is no longer available.",
    };
  }

  const category = await getCategoryBySlug(product.category);
  const categoryName = category?.name ?? product.category;

  const title = `${product.name} — ${categoryName} | Marobi`;
  const description = `Discover ${product.name} from Marobi's ${categoryName} collection — premium everyday wear for the modern working woman.`;
  const url = `https://marobionline.com/product/${id}`;

  return {
    title,
    description,
    alternates: {
      canonical: `/product/${id}`,
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

// ─────────────────────────────────────────────────────────────
// Minimal Product JSON-LD, only using real fields we know
// ─────────────────────────────────────────────────────────────
function ProductJsonLd({
  product,
  categoryName,
}: {
  product: Product;
  categoryName: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    category: categoryName,
    sku: product.id,
    url: `https://marobionline.com/product/${product.id}`,
    brand: {
      "@type": "Brand",
      name: "Marobi",
    },
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product: Product | null = await getProductById(id);
  if (!product) return notFound();

  const category = await getCategoryBySlug(product.category);
  const categoryName = category?.name ?? product.category;

  const related = (await getProductsByCategory(product.category, 8)).filter(
    (p) => p.id !== id
  );

  const reviews: Review[] = await getReviewsByProduct(id);

  const session: Session | null = await getServerSession(authOptions);
  const user = session?.user ?? null;

  return (
    <section className="flex flex-col min-h-screen">
      <Header />

      <main className="mt-20 px-5 md:px-10 lg:px-40 flex-1 space-y-12">
        {/* JSON-LD for this product */}
        <ProductJsonLd product={product} categoryName={categoryName} />

        {/* Breadcrumb (shadcn/ui) */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/categories">Categories</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/categories/${product.category}`}>
                {categoryName}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="whitespace-nowrap">
                {product.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Hero & Details */}
        <ProductDetailHero
          product={product}
          user={user}
          categoryName={categoryName}
        />

        {/* — Separator — */}
        <hr className="my-8 border-gray-200 dark:border-gray-700" />

        {/* — Reviews Accordion — */}
        <section>
          <Accordion type="single" collapsible defaultValue="">
            <AccordionItem value="reviews">
              <AccordionTrigger className="w-full text-xl font-semibold text-gray-900 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition">
                Customer Reviews ({reviews.length})
              </AccordionTrigger>
              <AccordionContent className="mt-4 px-4">
                <ReviewSection
                  productId={product.id}
                  user={user}
                  reviews={reviews}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* Related Products */}
        <section className="pb-20 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            More {categoryName} Looks
          </h2>
          {related.length > 0 ? (
            <div className="grid gap-6 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {related.map((p) => (
                <Link key={p.id} href={`/product/${p.id}`} className="block">
                  <ProductCard product={p} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 text-gray-500">
              <svg
                className="w-12 h-12 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-lg">No related products found.</p>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </section>
  );
}
