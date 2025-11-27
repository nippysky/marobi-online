// app/admin/settings/hero-slider/HeroSlidesManager.tsx
"use client";

import React, { useMemo, useState } from "react";
import { v4 as uuid } from "uuid";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trash2,
  Plus,
  UploadCloud,
  Loader2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import BackButton from "../../../../components/BackButton";

export interface Slide {
  id: string;
  imageUrl: string;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaUrl?: string;
  order: number;
}

interface HeroSlidesManagerProps {
  initialSlides: Slide[];
}

/**
 * IMPORTANT:
 * We now trust the *array position* as the canonical order.
 * This simply rewrites `order` = index; it does NOT sort.
 */
function normalizeSlidesOrder(slides: Slide[]): Slide[] {
  return slides.map((s, idx) => ({ ...s, order: idx }));
}

export default function HeroSlidesManager({
  initialSlides,
}: HeroSlidesManagerProps) {
  const normalizedInitial = useMemo(
    () => normalizeSlidesOrder(initialSlides),
    [initialSlides]
  );

  const [slides, setSlides] = useState<Slide[]>(normalizedInitial);
  const [baseline, setBaseline] = useState<Slide[]>(normalizedInitial);
  const [openIds, setOpenIds] = useState<string[]>(
    normalizedInitial.map((s) => s.id)
  );
  const [saving, setSaving] = useState(false);

  const anyMissingImage = slides.some((s) => !s.imageUrl?.trim());
  const isDirty =
    JSON.stringify(slides) !== JSON.stringify(baseline) && slides.length > 0;

  const setSlidesOrdered = (updater: (prev: Slide[]) => Slide[]) => {
    setSlides((prev) => normalizeSlidesOrder(updater(prev)));
  };

  const updateSlide = (id: string, patch: Partial<Slide>) => {
    setSlidesOrdered((all) =>
      all.map((sl) => (sl.id === id ? { ...sl, ...patch } : sl))
    );
  };

  const removeSlide = (id: string) => {
    setSlidesOrdered((all) => all.filter((sl) => sl.id !== id));
    setOpenIds((open) => open.filter((x) => x !== id));
  };

  const addSlide = () => {
    const newId = uuid();
    setSlidesOrdered((all) => [
      ...all,
      {
        id: newId,
        imageUrl: "",
        headline: "",
        subheadline: "",
        ctaText: "",
        ctaUrl: "",
        order: all.length,
      },
    ]);
    setOpenIds((open) => [...open, newId]);
  };

  const moveSlide = (id: string, direction: "up" | "down") => {
    setSlidesOrdered((all) => {
      const index = all.findIndex((s) => s.id === id);
      if (index === -1) return all;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= all.length) return all;

      const clone = [...all];
      const [current] = clone.splice(index, 1);
      clone.splice(targetIndex, 0, current);
      return clone;
    });
  };

  async function uploadFile(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) {
      throw new Error("Upload failed");
    }
    const json = await res.json();
    return json.data.secure_url as string;
  }

  const saveAll = async () => {
    if (slides.length === 0) {
      const toastId = toast.loading("Clearing all slides…");
      setSaving(true);
      try {
        // NOTE: if your API expects a bare array, adjust this accordingly.
        const res = await fetch("/api/store-settings/hero-slides", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([]),
        });
        if (!res.ok) throw new Error("Save failed");
        const json = await res.json();
        const savedSlides: Slide[] = normalizeSlidesOrder(json.slides ?? []);
        setSlides(savedSlides);
        setBaseline(savedSlides);
        setOpenIds(savedSlides.map((s) => s.id));
        toast.success("All slides cleared.", { id: toastId });
      } catch (err) {
        console.error(err);
        toast.error("Failed to save hero slides.", { id: toastId });
      } finally {
        setSaving(false);
      }
      return;
    }

    const toastId = toast.loading("Saving slides…");
    setSaving(true);

    try {
      const cleaned = normalizeSlidesOrder(
        slides.map((s) => ({
          ...s,
          imageUrl: s.imageUrl.trim(),
          headline: s.headline?.trim() || undefined,
          subheadline: s.subheadline?.trim() || undefined,
          ctaText: s.ctaText?.trim() || undefined,
          ctaUrl: s.ctaUrl?.trim() || undefined,
        }))
      );

      const res = await fetch("/api/store-settings/hero-slides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleaned),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        console.error("Save hero slides failed:", errJson || res.statusText);
        throw new Error("Save failed");
      }

      const json = await res.json();
      const savedSlides: Slide[] = normalizeSlidesOrder(json.slides ?? []);

      setSlides(savedSlides);
      setBaseline(savedSlides);
      setOpenIds(savedSlides.map((s) => s.id));

      toast.success("Hero slides saved!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to save hero slides.", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <BackButton />

      {/* Header strip with status */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-800">
            Manage Hero Slides
          </h2>
          <p className="text-xs text-gray-500 max-w-xl">
            Drag the order using the arrow controls, update text and images,
            then click <span className="font-semibold">Save All</span> to apply
            changes to your live store.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {slides.length > 0 && (
            <div className="text-xs flex items-center gap-2">
              {anyMissingImage && (
                <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                  <AlertTriangle className="w-3 h-3" />
                  Image required for all slides
                </span>
              )}
              {isDirty && !anyMissingImage && (
                <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full">
                  Unsaved changes
                </span>
              )}
            </div>
          )}

          {slides.length > 0 && (
            <Button
              onClick={saveAll}
              disabled={anyMissingImage || saving || !isDirty}
              className="bg-brand text-white hover:bg-brand/90 disabled:opacity-50 flex items-center gap-2 rounded-full px-5"
            >
              {saving && <Loader2 className="animate-spin w-4 h-4" />}
              <span>{saving ? "Saving…" : "Save All"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {slides.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl bg-white py-12 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <UploadCloud className="w-8 h-8 text-gray-400" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-medium text-gray-800">No hero slides yet</p>
            <p className="text-xs text-gray-500 max-w-sm">
              Create your first slide to highlight promotions, collections, or
              stories on the homepage.
            </p>
          </div>
          <Button
            onClick={addSlide}
            variant="outline"
            className="border-gray-300 text-gray-800 hover:border-brand hover:text-brand rounded-full px-5"
          >
            <Plus className="mr-2 w-4 h-4" /> Add Your First Slide
          </Button>
        </div>
      ) : (
        <>
          <Accordion
            type="multiple"
            value={openIds}
            onValueChange={(val) => setOpenIds(val as string[])}
            className="space-y-4"
          >
            {slides.map((slide, idx) => (
              <AccordionItem
                key={slide.id}
                value={slide.id}
                className="border rounded-lg border-gray-200 shadow-sm overflow-hidden bg-white"
              >
                <AccordionTrigger className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-10 border border-gray-200 rounded overflow-hidden bg-gray-100">
                      {slide.imageUrl ? (
                        <img
                          src={slide.imageUrl}
                          alt={`Slide ${idx + 1}`}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-medium text-gray-800">
                        Slide {idx + 1}
                      </span>
                      <span className="text-xs text-gray-500 truncate max-w-xs">
                        {slide.headline || "No headline"}
                      </span>
                    </div>
                  </div>

                  {/* Arrow controls – custom divs, not <button> inside trigger */}
                  <div className="flex items-center gap-2 pr-2">
                    <span className="text-[11px] text-gray-400 mr-1">
                      Order: {slide.order}
                    </span>

                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Move slide up"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (idx === 0) return;
                        moveSlide(slide.id, "up");
                      }}
                      onKeyDown={(e) => {
                        if (idx === 0) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          moveSlide(slide.id, "up");
                        }
                      }}
                      className={`h-7 w-7 inline-flex items-center justify-center rounded-md border text-xs ${
                        idx === 0
                          ? "border-gray-200 text-gray-300 cursor-not-allowed"
                          : "border-gray-300 text-gray-600 hover:border-brand hover:text-brand cursor-pointer"
                      }`}
                    >
                      <ArrowUp className="w-3 h-3" />
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Move slide down"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (idx === slides.length - 1) return;
                        moveSlide(slide.id, "down");
                      }}
                      onKeyDown={(e) => {
                        if (idx === slides.length - 1) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          moveSlide(slide.id, "down");
                        }
                      }}
                      className={`h-7 w-7 inline-flex items-center justify-center rounded-md border text-xs ${
                        idx === slides.length - 1
                          ? "border-gray-200 text-gray-300 cursor-not-allowed"
                          : "border-gray-300 text-gray-600 hover:border-brand hover:text-brand cursor-pointer"
                      }`}
                    >
                      <ArrowDown className="w-3 h-3" />
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-4 pb-4 pt-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    {/* Image Upload */}
                    <div className="flex flex-col items-center">
                      <div
                        className="w-full h-52 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-brand hover:text-brand transition cursor-pointer overflow-hidden bg-gray-50"
                        onClick={() =>
                          document
                            .getElementById(`file-${slide.id}`)
                            ?.click()
                        }
                      >
                        {slide.imageUrl ? (
                          <img
                            src={slide.imageUrl}
                            alt=""
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <>
                            <UploadCloud className="h-10 w-10" />
                            <p className="mt-2 text-sm font-medium">
                              Click to upload hero image
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1">
                              Recommended: 1600×700px, JPG/PNG
                            </p>
                          </>
                        )}
                      </div>
                      <input
                        id={`file-${slide.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const toastId = toast.loading("Uploading image…");
                          try {
                            const url = await uploadFile(file);
                            updateSlide(slide.id, { imageUrl: url });
                            toast.success("Image uploaded.", { id: toastId });
                          } catch (err) {
                            console.error(err);
                            toast.error("Upload failed.", { id: toastId });
                          }
                        }}
                      />
                    </div>

                    {/* Text + actions */}
                    <div className="space-y-3">
                      <Input
                        placeholder="Headline (optional)"
                        value={slide.headline || ""}
                        onChange={(e) =>
                          updateSlide(slide.id, {
                            headline: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Subheadline (optional)"
                        value={slide.subheadline || ""}
                        onChange={(e) =>
                          updateSlide(slide.id, {
                            subheadline: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Button text (optional)"
                        value={slide.ctaText || ""}
                        onChange={(e) =>
                          updateSlide(slide.id, {
                            ctaText: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Button URL (optional)"
                        value={slide.ctaUrl || ""}
                        onChange={(e) =>
                          updateSlide(slide.id, {
                            ctaUrl: e.target.value,
                          })
                        }
                      />

                      <div className="flex items-center justify-between pt-2">
                        <div className="text-[11px] text-gray-400">
                          Slide ID:{" "}
                          <span className="font-mono break-all">
                            {slide.id}
                          </span>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="bg-red-600 text-white hover:bg-red-700"
                          onClick={() => removeSlide(slide.id)}
                        >
                          <Trash2 className="mr-1 w-4 h-4" /> Delete slide
                        </Button>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Add slide button */}
          <div className="pt-4 text-center">
            <Button
              variant="outline"
              onClick={addSlide}
              className="border-gray-300 text-gray-800 hover:border-brand hover:text-brand rounded-full px-5"
            >
              <Plus className="mr-2 w-4 h-4" /> Add New Slide
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
