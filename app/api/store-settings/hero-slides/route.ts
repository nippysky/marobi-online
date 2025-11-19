// app/api/hero-slides/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma, { prismaReady } from "@/lib/db";

// GET: return all slides ordered by `order`
export async function GET() {
  await prismaReady;

  const slides = await prisma.heroSlide.findMany({
    orderBy: { order: "asc" },
  });

  return NextResponse.json(slides);
}

// PUT: upsert (update existing by id, create new if no id)
type IncomingSlide = {
  id?: string;
  imageUrl: string;
  headline?: string | null;
  subheadline?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  order: number;
};

export async function PUT(req: Request) {
  await prismaReady;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(payload)) {
    return NextResponse.json({ error: "Expected an array of slides" }, { status: 400 });
  }

  const slides = payload as IncomingSlide[];

  // Basic validation + normalization
  const ops = [];
  for (const s of slides) {
    if (!s || typeof s.imageUrl !== "string" || typeof s.order !== "number") {
      return NextResponse.json(
        { error: "Each slide requires imageUrl (string) and order (number)" },
        { status: 400 }
      );
    }

    const data = {
      imageUrl: s.imageUrl,
      headline: s.headline ?? null,
      subheadline: s.subheadline ?? null,
      ctaText: s.ctaText ?? null,
      ctaUrl: s.ctaUrl ?? null,
      order: s.order,
    };

    if (s.id && typeof s.id === "string" && s.id.trim().length > 0) {
      ops.push(
        prisma.heroSlide.upsert({
          where: { id: s.id },
          create: data,
          update: data,
        })
      );
    } else {
      ops.push(prisma.heroSlide.create({ data }));
    }
  }

  if (ops.length === 0) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  await prisma.$transaction(ops);

  return NextResponse.json({ success: true, updated: ops.length });
}
