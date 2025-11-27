// app/api/store-settings/hero-slides/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

type IncomingSlide = {
  id?: string;
  imageUrl: string;
  headline?: string | null;
  subheadline?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  order: number;
};

// GET: return all slides ordered by `order`
export async function GET() {
  await prismaReady;

  const slides = await prisma.heroSlide.findMany({
    orderBy: { order: "asc" },
  });

  return NextResponse.json(slides);
}

// PUT: treat payload as full snapshot of all slides
export async function PUT(req: Request) {
  await prismaReady;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const incomingRaw: IncomingSlide[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.slides)
    ? body.slides
    : [];

  if (!Array.isArray(incomingRaw)) {
    return NextResponse.json(
      { error: "Expected `slides` to be an array" },
      { status: 400 }
    );
  }

  // Normalize and validate
  const normalized: IncomingSlide[] = incomingRaw
    .map((s, index) => {
      if (!s || typeof s.imageUrl !== "string") return null;

      const img = s.imageUrl.trim();
      if (!img) return null;

      const order =
        typeof s.order === "number" && Number.isFinite(s.order)
          ? s.order
          : index;

      return {
        id: typeof s.id === "string" && s.id.trim() ? s.id.trim() : undefined,
        imageUrl: img,
        headline: s.headline?.trim() || null,
        subheadline: s.subheadline?.trim() || null,
        ctaText: s.ctaText?.trim() || null,
        ctaUrl: s.ctaUrl?.trim() || null,
        order,
      };
    })
    .filter(Boolean) as IncomingSlide[];

  // Reindex order to 0..n-1 to keep it tight
  const ordered = normalized
    .sort((a, b) => a.order - b.order)
    .map((s, idx) => ({ ...s, order: idx }));

  await prisma.$transaction(async (tx) => {
    // Get existing IDs
    const existing = await tx.heroSlide.findMany({
      select: { id: true },
    });
    const existingIds = new Set(existing.map((s) => s.id));

    const incomingIds = new Set(
      ordered
        .map((s) => s.id)
        .filter((id): id is string => typeof id === "string")
    );

    // Delete slides that are no longer present
    if (existingIds.size > 0) {
      const toDelete: string[] = [];
      for (const id of existingIds) {
        if (!incomingIds.has(id)) {
          toDelete.push(id);
        }
      }
      if (toDelete.length > 0) {
        await tx.heroSlide.deleteMany({
          where: { id: { in: toDelete } },
        });
      }
    }

    // Upsert remaining / new slides
    for (const s of ordered) {
      const data = {
        imageUrl: s.imageUrl,
        headline: s.headline,
        subheadline: s.subheadline,
        ctaText: s.ctaText,
        ctaUrl: s.ctaUrl,
        order: s.order,
      };

      if (s.id && existingIds.has(s.id)) {
        await tx.heroSlide.update({
          where: { id: s.id },
          data,
        });
      } else {
        await tx.heroSlide.create({
          data,
        });
      }
    }
  });

  const finalSlides = await prisma.heroSlide.findMany({
    orderBy: { order: "asc" },
  });

  return NextResponse.json({
    success: true,
    updated: finalSlides.length,
    slides: finalSlides,
  });
}
