// app/api/store-settings/hero-slides/[id]/route.ts
import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

export async function DELETE(
  _req: Request,
  context: { params: { id: string } }
) {
  await prismaReady;

  const { id } = context.params;

  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: "Missing slide id in URL" },
      { status: 400 }
    );
  }

  try {
    await prisma.heroSlide.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete hero slide", err);
    if (err?.code === "P2025") {
      return NextResponse.json(
        { error: `Slide with id "${id}" not found` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Error deleting slide" },
      { status: 500 }
    );
  }
}
