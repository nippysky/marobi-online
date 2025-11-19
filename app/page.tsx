import React from "react";
import type { Metadata } from "next";
import HeroSlider, { Slide } from "@/components/HeroSlider";
import FeatureHighlights from "@/components/FeatureHighlights";
import ProductShowcase from "@/components/ProductShowcase";
import { Header } from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import { prisma } from "@/lib/db";
import { getProductsByCategory, Product } from "@/lib/products";
import { getAllCategories, Category } from "@/lib/categories";

// ISR: statically generate and revalidate every 5 minutes.
// Adjust this to taste (e.g. 300 seconds).
export const revalidate = 300;

// Use env if you have it; falls back to a placeholder.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://marobionline.com";

// ─── FAANG-style metadata for SEO & link previews ─────────────────────────────
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Marobi — Your Look. Your Power.",
    template: "%s | Marobi",
  },
  description:
    "Marobi is a Nigerian fashion brand creating premium everyday wear for the modern working woman—clean tailoring, rich textures, and quietly powerful silhouettes.",
  keywords: [
    "Marobi",
    "Nigerian fashion brand",
    "women's workwear",
    "premium everyday wear",
    "African fashion",
    "office dresses",
    "quiet luxury",
    "modern working woman",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Marobi — Premium Everyday Wear for the Modern Working Woman",
    description:
      "Look powerful, every day. Marobi designs premium, quietly luxurious pieces for modern women who lead with presence.",
    siteName: "Marobi",
    images: [
      {
        url: "/og/marobi-home.jpg", // update to your real OG image path
        width: 1200,
        height: 630,
        alt: "Marobi — premium everyday wear for the modern working woman",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marobi — Your Look. Your Power.",
    description:
      "Premium everyday wear from Nigeria, crafted for modern women who own every room they walk into.",
    images: ["/og/marobi-home.jpg"], // same as above, adjust path if needed
  },
};

// ─── JSON-LD for rich snippets (Organization + WebSite) ───────────────────────
function JsonLd() {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Marobi",
    url: SITE_URL,
    logo: `${SITE_URL}/marobi-logo.png`, // set to your real logo asset
    description:
      "Marobi is a Nigerian fashion brand creating premium everyday wear for the modern working woman.",
    sameAs: [
      // Fill these with your real social URLs when ready
      // "https://www.instagram.com/your-handle",
      // "https://www.facebook.com/your-page",
      // "https://www.linkedin.com/company/your-company",
    ],
  };

  const webSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Marobi",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSite) }}
      />
    </>
  );
}

// ─── Home page ────────────────────────────────────────────────────────────────
export default async function Home() {
  // Fetch hero slides + categories IN PARALLEL for lower TTFB
  const [heroRows, categories]: [any[], Category[]] = await Promise.all([
    prisma.heroSlide.findMany({
      orderBy: { order: "asc" },
      // Narrow columns for less DB payload
      select: {
        id: true,
        imageUrl: true,
        headline: true,
        subheadline: true,
        ctaText: true,
        ctaUrl: true,
      },
    }),
    getAllCategories(),
  ]);

  const heroSlides: Slide[] = heroRows.map((r) => ({
    id: r.id,
    imageUrl: r.imageUrl,
    heading: r.headline ?? "",
    subtext: r.subheadline ?? "",
    buttonText: r.ctaText ?? undefined,
    buttonHref: r.ctaUrl ?? undefined,
  }));

  // For each category, fetch up to 5 of its newest “Published” products
  const categoriesWithProducts: {
    name: string;
    viewMoreHref: string;
    products: Product[];
  }[] = await Promise.all(
    categories.map(async ({ slug, name }) => {
      const products = await getProductsByCategory(slug, 5);
      return {
        name,
        viewMoreHref: `/categories/${slug}`,
        products,
      };
    })
  );

  return (
    <section className="min-h-screen flex flex-col">
      {/* SEO structured data */}
      <JsonLd />

      <Header />

      <main className="w-full flex-1">
        <HeroSlider slides={heroSlides} />
        <FeatureHighlights />
        <ProductShowcase categories={categoriesWithProducts} />
      </main>

      <Footer />
    </section>
  );
}
