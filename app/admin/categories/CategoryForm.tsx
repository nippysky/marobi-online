"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slugify";
import { createCategoryAction, updateCategoryAction } from "@/lib/actions/categories";

type Base = {
  name: string;
  slug: string;
  description: string | null;
  bannerImage: string | null;
  sortOrder: number;
  isActive: boolean;
};

export default function CategoryForm({
  mode = "create",
  initial,
  submitLabel = "Save",
}: {
  mode?: "create" | "edit";
  initial?: Partial<Base>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [bannerImage, setBannerImage] = useState(initial?.bannerImage ?? "");
  const [sortOrder, setSortOrder] = useState<number>(initial?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState<boolean>(initial?.isActive ?? true);

  const nameError = useMemo(() => (name.trim() ? null : "Name is required"), [name]);
  const slugError = useMemo(() => {
    if (!slug.trim()) return null;
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())
      ? null
      : "Use lowercase letters, numbers and hyphens only";
  }, [slug]);
  const bannerError = useMemo(() => {
    if (!bannerImage.trim()) return null;
    try {
      const u = new URL(bannerImage);
      return u.protocol === "http:" || u.protocol === "https:" ? null : "Must be a valid URL";
    } catch {
      return "Must be a valid URL";
    }
  }, [bannerImage]);

  const canSubmit = !pending && !nameError && !slugError && !bannerError;

  const onSubmit = (fd: FormData) => {
    if (!canSubmit) return;
    startTransition(async () => {
      toast.loading(mode === "create" ? "Creating category…" : "Saving changes…", { id: "cat" });

      // ensure controlled state is sent
      fd.set("name", name.trim());
      fd.set("slug", slug.trim()); // NOTE: slug is locked in edit (see input)
      fd.set("description", (description ?? "").toString().trim());
      fd.set("bannerImage", (bannerImage ?? "").toString().trim());
      fd.set("sortOrder", String(Number.isFinite(sortOrder) ? sortOrder : 0));
      fd.set("isActive", String(isActive));

      const res =
        mode === "create"
          ? await createCategoryAction(fd)
          : await updateCategoryAction(slug, fd); // slug identifies the record

      if (res?.ok) {
        toast.success(mode === "create" ? "Category created." : "Changes saved.", { id: "cat" });
        router.push("/admin/categories");
        router.refresh();
      } else {
        toast.error(res?.message ?? "Something went wrong.", { id: "cat" });
      }
    });
  };

  const handleNameBlur = () => {
    if (mode === "create" && !slug.trim() && name.trim()) {
      setSlug(slugify(name.trim()));
    }
  };

  return (
    <form action={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name<span className="text-destructive">*</span></Label>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="e.g. African Prints"
            aria-invalid={!!nameError}
          />
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug {mode === "edit" && <span className="text-muted-foreground">(locked)</span>}</Label>
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="african-prints"
            aria-invalid={!!slugError}
            disabled={mode === "edit"} // keep primary key stable
          />
          {slugError && <p className="text-xs text-destructive">{slugError}</p>}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What goes in this category?"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bannerImage">Banner Image URL (optional)</Label>
          <Input
            id="bannerImage"
            name="bannerImage"
            value={bannerImage ?? ""}
            onChange={(e) => setBannerImage(e.target.value)}
            placeholder="https://..."
            aria-invalid={!!bannerError}
          />
          {bannerError && <p className="text-xs text-destructive">{bannerError}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value || 0))}
          />
        </div>

        <div className="flex items-center gap-3 sm:col-span-2">
          <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
          <input type="hidden" name="isActive" value={isActive ? "true" : "false"} />
          <Label htmlFor="isActive" className="!mt-0 select-none">Visible</Label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={!canSubmit} className={cn(pending && "opacity-80")}>
          {pending ? (mode === "create" ? "Creating…" : "Saving…") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
