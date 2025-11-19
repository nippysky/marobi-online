// app/api/admin/categories/[slug]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/getAdminSession";
import { slugify } from "@/lib/slugify";


async function ensureAdmin() {
  const session = await getAdminSession();
  if (!session || !session.user?.email || session.user.role === "customer") {
    return false;
  }
  const staff = await prisma.staff.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return Boolean(staff);
}

/** Load one category by slug (used by edit form) */
export async function GET(
  _req: Request,
 context: { params: Promise<{ slug: string }> }
) {

  const { slug: slugify } = await context.params;


  const ok = await ensureAdmin();
  if (!ok) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const slug = decodeURIComponent(slugify);
  const c = await prisma.category.findUnique({
    where: { slug },
  });
  if (!c) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(c);
}

/** Update/toggle */
export async function PATCH(
  req: Request,
 context: { params: Promise<{ slug: string }> }
) {

    const { slug } = await context.params;
  const ok = await ensureAdmin();
  if (!ok) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const currentSlug = decodeURIComponent(slug);
  const body = await req.json().catch(() => ({}));

  // Allow partial updates
  const data: any = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.slug === "string") data.slug = slugify(body.slug);
  if (typeof body.description === "string")
    data.description = body.description.trim() || null;
  if (typeof body.bannerImage === "string")
    data.bannerImage = body.bannerImage.trim() || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.sortOrder !== "undefined") {
    const so = Number(body.sortOrder);
    data.sortOrder = Number.isFinite(so) ? so : 0;
  }

  try {
    const updated = await prisma.category.update({
      where: { slug: currentSlug },
      data,
      select: { slug: true },
    });
    revalidatePath("/admin/categories");
    return NextResponse.json(updated);
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    if (err?.code === "P2002") {
      return NextResponse.json(
        { message: "Slug already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: err?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

/** Delete category (blocked by FK if products exist) */
export async function DELETE(
  _req: Request,
   context: { params: Promise<{ slug: string }> }
) {
   const { slug: slugify } = await context.params;
  const ok = await ensureAdmin();
  if (!ok) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const slug = decodeURIComponent(slugify);
  try {
    await prisma.category.delete({ where: { slug } });
    revalidatePath("/admin/categories");
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Foreign key constraint (products present) will throw here
    return NextResponse.json(
      {
        message:
          "Cannot delete category that is referenced by products. Move or delete products first.",
      },
      { status: 409 }
    );
  }
}
