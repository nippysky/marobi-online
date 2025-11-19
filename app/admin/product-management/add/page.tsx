import BackButton from "@/components/BackButton";
import { getAllCategories } from "@/lib/categories";
import type { Category } from "@/lib/categories";
import AddProductSection from "../AddProductSection";

export const dynamic = "force-dynamic";

export default async function AddProductPage() {
  const categories: Category[] = await getAllCategories();

  return (
    <div className="p-6">
      <BackButton />
      <h1 className="text-2xl font-bold my-10">Add New Product</h1>
      <AddProductSection categories={categories} />
    </div>
  );
}
