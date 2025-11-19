import React from "react";
import Link from "next/link";
import Header from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import ProductListClient from "@/components/categories/ProductListClient";

export default function AllProductsPage() {
  return (
    <section className="flex flex-col">
      <Header />

      <main className="mt-28 pb-20 px-5 md:px-10 lg:px-20">
        <nav className="text-sm text-gray-600 mb-4" aria-label="Breadcrumb">
          <Link href="/" className="hover:underline">
            Home
          </Link>{" "}
          / <span className="font-medium">All Products</span>
        </nav>

        <h1 className="text-3xl font-bold mb-6">All Products</h1>

        <ProductListClient />
      </main>

      <Footer />
    </section>
  );
}
