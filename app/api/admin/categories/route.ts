// app/api/admin/categories/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/getAdminSession";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/slugify";

/** Create a category */
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !session.user?.email || session.user.role === "customer") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const slugInput = String(body?.slug || "");
    const slug = slugify(slugInput || name);
    const description =
      typeof body?.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
    const bannerImage =
      typeof body?.bannerImage === "string" && body.bannerImage.trim()
        ? body.bannerImage.trim()
        : null;
    const isActive = Boolean(body?.isActive ?? true);
    const sortOrder = Number.isFinite(Number(body?.sortOrder))
      ? Number(body.sortOrder)
      : 0;

    if (!name) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }
    if (!slug) {
      return NextResponse.json({ message: "Slug is required." }, { status: 400 });
    }

    const created = await prisma.category.create({
      data: { slug, name, description, bannerImage, isActive, sortOrder },
      select: { slug: true },
    });

    revalidatePath("/admin/categories");
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    // Handle unique constraint violations (P2002)
    if (err?.code === "P2002") {
      return NextResponse.json(
        { message: "A category with this slug already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: err?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
