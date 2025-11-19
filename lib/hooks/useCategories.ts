// hooks/useCategories.ts (your existing file)
"use client";

import { useQuery } from "@tanstack/react-query";
import type { Category } from "@/lib/categories";

async function fetchCategories(activeOnly = true): Promise<Category[]> {
  const url = activeOnly ? "/api/categories" : "/api/categories?active=false";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  return res.json();
}

/** Active-only by default. Pass { activeOnly: false } if you need all. */
export function useCategories(opts?: { activeOnly?: boolean }) {
  const activeOnly = opts?.activeOnly ?? true;
  return useQuery<Category[], Error>({
    queryKey: ["categories", { activeOnly }],
    queryFn: () => fetchCategories(activeOnly),
  });
}
