"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function AddNewProductButton() {
  return (
    <Link href="/admin/product-management/add" className="w-full md:w-auto">
      <Button className="w-full md:w-auto flex items-center justify-center md:justify-start">
        <Plus className="h-4 w-4" />
        Add New Product
      </Button>
    </Link>
  );
}
