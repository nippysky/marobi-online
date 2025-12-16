// components/admin/categories/CategoriesClient.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  toggleCategoryActiveAction,
  deleteCategoryAction,
} from "@/lib/actions/categories";

export type CategoryRow = {
  slug: string;
  name: string;
  description: string;
  bannerImage: string; // (not shown per request)
  isActive: boolean;
  sortOrder: number;   // (not shown per request)
  productCount: number;
  updatedAtDisplay: string; // pre-formatted server string
};

export default function CategoriesClient({ categories: initial }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<CategoryRow[]>(initial);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (slug: string, name: string, next: boolean) => {
    // optimistic
    setRows((rs) => rs.map((c) => (c.slug === slug ? { ...c, isActive: next } : c)));
    setPendingSlug(slug);

    startTransition(async () => {
      const res = await toggleCategoryActiveAction(slug, next);
      setPendingSlug(null);

      if (res?.ok) {
        toast.success(`${name} ${next ? "enabled" : "hidden"}.`);
        // Keep page in sync if other derived data uses isActive
        router.refresh();
      } else {
        // revert
        setRows((rs) => rs.map((c) => (c.slug === slug ? { ...c, isActive: !next } : c)));
        toast.error(res?.message ?? "Failed to update status.");
      }
    });
  };

  const handleDelete = async (slug: string, name: string) => {
    if (!confirm(`Delete “${name}”? This cannot be undone.`)) return;

    const prev = rows;
    setRows((r) => r.filter((c) => c.slug !== slug));

    const res = await deleteCategoryAction(slug);
    if (res?.ok) {
      toast.success("Category deleted.");
      router.refresh();
    } else {
      setRows(prev);
      toast.error(res?.message ?? "Failed to delete category.");
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Categories</h1>
        <p className="text-muted-foreground">Manage all product categories in one place.</p>
      </header>

   {/* header actions in CategoriesClient */}
<Button asChild size="lg" className="rounded-full px-5">
  <Link href="/admin/categories/new">
    <Plus className="mr-2 h-4 w-4" /> Add Category
  </Link>
</Button>


      {/* Table (extra horizontal padding) */}
      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="overflow-x-auto px-4 md:px-6">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[420px]">Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-center">Products</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[200px] text-right pr-2 md:pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.slug} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-semibold leading-none">{c.name}</div>
                      {c.description ? (
                        <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                          {c.description}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell className="font-mono text-sm">{c.slug}</TableCell>
                  <TableCell className="text-center tabular-nums">{c.productCount}</TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={c.isActive}
                        disabled={pendingSlug === c.slug || isPending}
                        onCheckedChange={(v) => handleToggle(c.slug, c.name, v)}
                        aria-label={`Set ${c.name} ${c.isActive ? "hidden" : "visible"}`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {c.isActive ? "Visible" : "Hidden"}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-sm">{c.updatedAtDisplay}</TableCell>

                  <TableCell className="text-right pr-2 md:pr-6">
                    <div className="flex justify-end gap-2">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button asChild size="sm" variant="outline" className="rounded-full">
                              <Link href={`/admin/categories/${c.slug}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit category</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="rounded-full"
                              onClick={() => handleDelete(c.slug, c.name)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete category</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Separator />
        <div className="flex items-center justify-between px-6 py-4 text-xs text-muted-foreground">
          <span>Total: {rows.length} {rows.length === 1 ? "category" : "categories"}</span>
          <span>Tip: you can open the full page form for richer editing.</span>
        </div>
      </div>


    </section>
  );
}
