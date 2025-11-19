"use server";

import { prisma, prismaReady } from "@/lib/db";
import { getAdminSession } from "@/lib/getAdminSession";
import { slugify } from "@/lib/slugify";

// NOTE: your listing page is dynamic (or you call router.refresh), so revalidatePath is optional.

export async function createCategoryAction(formData: FormData) {
  await prismaReady;

  const session = await getAdminSession();
  if (!session || !session.user?.email || session.user.role === "customer") {
    return { ok: false, message: "Unauthorized" };
  }

  const name = (formData.get("name") ?? "").toString().trim();
  const slugRaw = (formData.get("slug") ?? "").toString().trim();
  const description = (formData.get("description") ?? "").toString().trim();
  const bannerImage = (formData.get("bannerImage") ?? "").toString().trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = (formData.get("isActive") ?? "true").toString() === "true";

  if (!name) return { ok: false, message: "Name is required." };
  const slug = slugRaw || slugify(name);

  try {
    await prisma.category.create({
      data: {
        slug,
        name,
        description: description || null,
        bannerImage: bannerImage || null,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        isActive,
      },
    });
    return { ok: true };
  } catch (e: any) {
    if (e?.code === "P2002") return { ok: false, message: "Slug already exists." };
    return { ok: false, message: "Failed to create category." };
  }
}

export async function updateCategoryAction(slug: string, formData: FormData) {
  await prismaReady;

  const session = await getAdminSession();
  if (!session || !session.user?.email || session.user.role === "customer") {
    return { ok: false, message: "Unauthorized" };
  }

  const name = (formData.get("name") ?? "").toString().trim();
  const description = (formData.get("description") ?? "").toString().trim();
  const bannerImage = (formData.get("bannerImage") ?? "").toString().trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = (formData.get("isActive") ?? "true").toString() === "true";

  if (!name) return { ok: false, message: "Name is required." };

  try {
    await prisma.category.update({
      where: { slug },
      data: {
        name,
        description: description || null,
        bannerImage: bannerImage || null,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        isActive,
        // slug change is intentionally locked; changing PK would require
        // cascading updates on Product.categorySlug.
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "Failed to update category." };
  }
}

export async function toggleCategoryActiveAction(slug: string, next: boolean) {
  await prismaReady;

  const session = await getAdminSession();
  if (!session || !session.user?.email || session.user.role === "customer") {
    return { ok: false, message: "Unauthorized" };
  }

  try {
    await prisma.category.update({
      where: { slug },
      data: { isActive: next },
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "Failed to update status." };
  }
}

export async function deleteCategoryAction(slug: string) {
  await prismaReady;

  const session = await getAdminSession();
  if (!session || !session.user?.email || session.user.role === "customer") {
    return { ok: false, message: "Unauthorized" };
  }

  try {
    await prisma.category.delete({ where: { slug } });
    return { ok: true };
  } catch (e: any) {
    // May fail if products still reference this category
    return { ok: false, message: "Delete failed. Ensure no products reference this category." };
  }
}
