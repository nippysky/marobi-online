// app/admin/settings/hero-slider/page.tsx
export const dynamic = "force-dynamic";

import HeroSlidesManager from "@/app/admin/settings/hero-slider/HeroSlidesManager";
import { prisma } from "@/lib/db";

export default async function HeroSliderPage() {
  // Load all slides, ordered
  const slidesFromDb = await prisma.heroSlide.findMany({
    orderBy: { order: "asc" },
  });

  // Map null → undefined for the client Slide interface
  const initialSlides = slidesFromDb.map((s) => ({
    id: s.id,
    imageUrl: s.imageUrl,
    order: s.order,
    headline: s.headline ?? undefined,
    subheadline: s.subheadline ?? undefined,
    ctaText: s.ctaText ?? undefined,
    ctaUrl: s.ctaUrl ?? undefined,
  }));

  return (
    <div className="bg-gray-50 min-h-screen p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">
        Hero Slider
      </h1>
      <p className="text-sm text-gray-600 max-w-2xl mb-4">
        Manage the slides that appear on your homepage hero section.
        Reorder them, edit copy, or remove old campaigns. Changes are
        applied only when you click <span className="font-semibold">Save All</span>.
      </p>
      <HeroSlidesManager initialSlides={initialSlides} />
    </div>
  );
}
