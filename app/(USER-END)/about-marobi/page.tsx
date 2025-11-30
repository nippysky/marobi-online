import React from "react";
import type { Metadata } from "next";
import { Header } from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import Link from "next/link";
import { FaFacebookF, FaInstagram, FaTiktok, FaWhatsapp, FaXTwitter } from "react-icons/fa6";

export const metadata: Metadata = {
  title: "About Marobi",
  description:
    "Marobi is a Nigerian fashion brand creating premium everyday wear for the modern working woman — blending clean tailoring, rich textures, and feminine strength.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Marobi",
    description:
      "Marobi is a Nigerian fashion brand creating premium everyday wear for the modern working woman. We believe that looking beautiful isn’t a luxury — it’s power.",
    url: "https://marobionline.com/about",
    siteName: "Marobi",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "About Marobi",
    description:
      "Premium everyday wear for the modern working woman. Your look. Your power.",
  },
};

export default function AboutMarobi() {
  return (
    <section className="flex min-h-screen flex-col">
      {/* Keep global shell consistent */}
      <Header />

      <main className="flex-1 px-5 py-16 md:px-10 lg:px-40 my-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            About Marobi
          </h1>

          <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-700 md:text-base">
            <p>
              Marobi is a Nigerian fashion brand creating premium everyday wear
              for the modern working woman. We believe that looking beautiful
              isn’t a luxury — it’s power. Our pieces are designed to help women
              step into every room with confidence, elegance, and quiet wealth.
            </p>
            <p>
              Blending clean tailoring, rich textures, and feminine strength,
              Marobi celebrates women who take charge of their presence — one
              look at a time.
            </p>
            <p className="pt-2 text-base font-semibold tracking-wide text-gray-900">
              Your Look. Your Power.
            </p>
          </div>

          {/* Social tiles */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4 md:gap-6">
            {/* Facebook */}
            <Link
              href="https://www.facebook.com/share/1a1g2RduqH/?mibextid=wwXIfr"
              aria-label="Visit Marobi on Facebook"
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <FaFacebookF className="h-6 w-6 text-gray-800" />
            </Link>

            {/* Instagram */}
            <Link
              href="https://www.instagram.com/marobi_rtw"
              aria-label="Visit Marobi on Instagram"
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <FaInstagram  className="h-6 w-6 text-gray-800" />
            </Link>

            {/* X (Twitter) */}
            <Link
              href="https://x.com/marobi_rtw"
              aria-label="Visit Marobi on X"
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <FaXTwitter className="h-6 w-6 text-gray-800" />
            </Link>

            {/* Tiktok */}
            <Link
              href="https://www.tiktok.com/@marobi_rtw"
              aria-label="Visit Marobi on Tiktok"
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <FaTiktok className="h-6 w-6 text-gray-800" />
            </Link>

            {/* WhatsApp */}
            <Link
              href="https://wa.me/2347025003685"
              aria-label="Chat with Marobi on WhatsApp"
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <FaWhatsapp className="h-6 w-6 text-gray-800" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </section>
  );
}
