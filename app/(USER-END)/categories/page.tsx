export const dynamic = "force-dynamic";

import Link from "next/link";
import React from "react";
import Header from "@/components/shared/header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

// ⬇️ Import Prisma client
import { prisma } from "@/lib/db";

// ⬇️ Type for a category (optional: infer from Prisma if needed)
type Category = {
  slug: string;
  name: string;
  description?: string | null;
};



// Fetch categories from DB (sorted by name)
async function getCategories(): Promise<Category[]> {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      slug: true,
      name: true,
      description: true,
    },
  });
  return categories;
}

// Server Component (async)
export default async function CategoriesIndex() {
  const categories = await getCategories();

  return (
    <section className="flex flex-col lg:px-20 md:px-10 px-5">
      <Header />

      <main className="mt-10 space-y-8">
        {/* ───── Breadcrumb (responsive wrap) ───── */}
        <nav
          className="text-sm text-gray-600 dark:text-gray-400 mb-2"
          aria-label="Breadcrumb"
        >
          <ol className="flex flex-wrap items-center space-x-1 space-y-1 sm:space-y-0">
            <li className="flex items-center whitespace-nowrap">
              <Link href="/" className="hover:underline">
                Home
              </Link>
            </li>
            <li className="flex items-center whitespace-nowrap">
              <span className="mx-2">/</span>
            </li>
            <li className="flex items-center font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
              Categories
            </li>
          </ol>
        </nav>

        {/* ───── Page Title ───── */}
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
          Browse Categories
        </h1>

        {/* ───── Category Cards Grid ───── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 pb-20">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className="group"
            >
              <Card className="cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-lg">
                <CardHeader className="px-4 pt-4">
                  <CardTitle className="text-lg">{cat.name}</CardTitle>
                </CardHeader>
                {cat.description && (
                  <CardContent className="px-4 pb-4">
                    <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                      {cat.description}
                    </CardDescription>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </section>
  );
}
