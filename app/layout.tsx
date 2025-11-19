export const dynamic = "force-dynamic";

import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Toaster as HotToaster } from "react-hot-toast";
import React from "react";
import { CurrencyProvider, type Currency } from "@/lib/context/currencyContext";
import { SizeChartProvider } from "@/lib/context/sizeChartcontext";
import NextAuthSessionProvider from "@/components/shared/SessionProvider";
import { UserProvider } from "@/lib/context/UserContext";
import ReactQueryProvider from "@/components/ReactQueryProvider";
import ScrollToTop from "@/components/ScroolToTop";
import { cookies } from "next/headers";

const montserrat = Montserrat({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://marobionline.com"),
  title: { default: "Marobi — Your Look. Your Power.", template: "%s | Marobi" },
  description:
    "Marobi is a Nigerian fashion brand creating premium everyday wear for the modern working woman. Clean tailoring, rich textures, and quietly powerful silhouettes for women who own every room they walk into.",
  keywords: [
    "Marobi","Nigerian fashion brand","women's fashion","modern working woman",
    "premium everyday wear","African fashion","quiet luxury","office dresses","workwear for women",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
  },
  alternates: { canonical: "/" },
  manifest: "/site.webmanifest",
  twitter: {
    card: "summary_large_image",
    title: "Marobi — Your Look. Your Power.",
    site: "@MarobiOfficial",
    creator: "@MarobiOfficial",
    description:
      "Premium everyday wear from Nigeria, crafted for modern women who lead with presence, confidence, and quiet wealth.",
    images: ["/opengraph-image.png"],
  },
  openGraph: {
    title: "Marobi — Premium Everyday Wear for the Modern Working Woman",
    description:
      "Marobi designs clean, tailored, quietly luxurious pieces that help women step into every room with confidence and elegance.",
    url: "https://marobionline.com",
    siteName: "Marobi",
    type: "website",
    locale: "en_US",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Marobi — premium everyday wear for the modern working woman" }],
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies(); // <-- await
  const fromCookie = cookieStore.get("CURRENCY")?.value as Currency | undefined;

  const initialCurrency: Currency =
    fromCookie && (["NGN", "USD", "EUR", "GBP"] as const).includes(fromCookie as Currency)
      ? (fromCookie as Currency)
      : "NGN";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className={`${montserrat.className} antialiased w-full max-w-[1920px] mx-auto`}>
        <NextAuthSessionProvider>
          <ReactQueryProvider>
            <UserProvider>
              <CurrencyProvider initialCurrency={initialCurrency}>
                <SizeChartProvider>{children}</SizeChartProvider>
              </CurrencyProvider>
            </UserProvider>
          </ReactQueryProvider>
        </NextAuthSessionProvider>

        <HotToaster position="top-right" />
        <ScrollToTop />
      </body>
    </html>
  );
}