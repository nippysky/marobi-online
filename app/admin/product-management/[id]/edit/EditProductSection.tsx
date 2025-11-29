"use client";

import { useRouter } from "next/navigation";
import type { ProductPayload } from "@/types/product";
import type { Category } from "@/lib/categories";
import toast from "react-hot-toast";
import ProductForm from "@/app/admin/product-management/ProductForm";

type VariantSalesSnapshot = {
  color: string;
  size: string;
  sold: number;
  remaining: number;
  total: number;
};

interface Props {
  initialProduct: ProductPayload;
  categories: Category[];
  variantSales: VariantSalesSnapshot[];
}

export default function EditProductSection({
  initialProduct,
  categories,
  variantSales,
}: Props) {
  const router = useRouter();

  async function handleSave(payload: ProductPayload) {
    const res = await fetch(`/api/products/${initialProduct.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Update failed");
      return;
    }
    toast.success("Product updated");
    router.push("/admin/product-management");
  }

  return (
    <ProductForm
      initialProduct={initialProduct}
      categories={categories}
      onSave={handleSave}
      variantSales={variantSales}
    />
  );
}
