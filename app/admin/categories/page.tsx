// app/admin/categories/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/getAdminSession";
import CategoriesClient, { CategoryRow } from "./CategoriesClient";


/** Format once on the server to avoid hydration mismatch */
function formatUpdatedAtUTC(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(d) + " UTC";
}

export const dynamic = "force-dynamic";

export default async function CategoriesManagement() {
  // Auth guard
  const session = await getAdminSession();
  if (!session || !session.user?.email || session.user.role === "customer") {
    const cb = encodeURIComponent("/admin/categories");
    return redirect(`/admin-login?callbackUrl=${cb}`);
  }

  // Load categories with product counts
  const cats = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  const categories: CategoryRow[] = cats.map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.description ?? "",
    bannerImage: c.bannerImage ?? "",
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    productCount: c._count.products,
    updatedAtDisplay: formatUpdatedAtUTC(c.updatedAt),
  }));

  return (
    <div className="px-6 md:px-10 lg:px-16 py-8">
      <CategoriesClient categories={categories} />
    </div>
  );
}
