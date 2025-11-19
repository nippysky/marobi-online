'use client';

import React, { useState, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, UploadCloud, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import BackButton from '../../../../components/BackButton';

interface Slide {
  id: string;
  imageUrl: string;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  ctaUrl?: string;
  order: number;
}

export default function HeroSlidesManager({
  initialSlides,
}: {
  initialSlides: Slide[];
}) {
  const initialIds = useMemo(() => initialSlides.map((s) => s.id), [initialSlides]);
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [openIds, setOpenIds] = useState<string[]>(initialIds);
  const [saving, setSaving] = useState(false); // 👈 NEW: track saving state

  // helper: update a slide in-place
  const updateSlide = (id: string, patch: Partial<Slide>) => {
    setSlides((all) =>
      all.map((sl) => (sl.id === id ? { ...sl, ...patch } : sl))
    );
  };

  const removeSlide = (id: string) => {
    setSlides((all) => all.filter((sl) => sl.id !== id));
    setOpenIds((open) => open.filter((x) => x !== id));
  };

  const addSlide = () => {
    const newId = uuid();
    setSlides((all) => [
      ...all,
      {
        id: newId,
        imageUrl: '',
        headline: '',
        subheadline: '',
        ctaText: '',
        ctaUrl: '',
        order: all.length,
      },
    ]);
    setOpenIds((open) => [...open, newId]);
  };

  async function uploadFile(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const json = await res.json();
    return json.data.secure_url;
  }

  // 👇 NEW: show toast and spinner while saving
  const saveAll = async () => {
    setSaving(true);
    const toastId = toast.loading("Saving slides…");
    try {
      const res = await fetch('/api/store-settings/hero-slides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slides),
      });
      if (!res.ok) throw new Error('save failed');
      toast.success('Hero slides saved!', { id: toastId });
    } catch {
      toast.error('Failed to save hero slides.', { id: toastId });
    }
    setSaving(false);
  };

  const anyMissingImage = slides.some((sl) => !sl.imageUrl);

  return (
    <div className="space-y-6">
      <BackButton />

      {/* Save All */}
      <div className="flex justify-end">
        {slides.length > 0 && (
          <Button
            onClick={saveAll}
            disabled={anyMissingImage || saving}
            className="bg-brand text-white hover:bg-brand/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="animate-spin w-4 h-4 mr-2" />}
            Save All
          </Button>
        )}
      </div>

      {/* Empty State */}
      {slides.length === 0 ? (
        <div className="text-center text-gray-600 py-12">
          <p className="mb-4">No slides yet.</p>
          <Button
            onClick={addSlide}
            variant="outline"
            className="border-gray-300 text-gray-800 hover:border-brand hover:text-brand"
          >
            <Plus className="mr-2" /> Add Your First Slide
          </Button>
        </div>
      ) : (
        <>
          <Accordion
            type="multiple"
            value={openIds}
            onValueChange={setOpenIds}
            className="space-y-4"
          >
            {slides.map((slide, idx) => (
              <AccordionItem
                key={slide.id}
                value={slide.id}
                className="border rounded-lg border-gray-200 shadow-sm overflow-hidden"
              >
                <AccordionTrigger className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-8 border border-gray-300 rounded overflow-hidden bg-gray-100">
                      {slide.imageUrl && (
                        <img
                          src={slide.imageUrl}
                          alt={`Slide ${idx + 1}`}
                          className="object-cover w-full h-full"
                        />
                      )}
                    </div>
                    <span className="font-medium text-gray-800">
                      Slide {idx + 1}
                    </span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="p-4 bg-white space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Image Upload */}
                    <div className="flex flex-col items-center">
                      <div
                        className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-brand hover:text-brand transition cursor-pointer overflow-hidden"
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
                            <p className="mt-2">Click to upload</p>
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
                          const url = await uploadFile(file);
                          updateSlide(slide.id, { imageUrl: url });
                        }}
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        Recommended: 1200×600px
                      </p>
                    </div>

                    {/* Text Fields + Order/Delete */}
                    <div className="space-y-4">
                      <Input
                        placeholder="Headline (optional)"
                        value={slide.headline || ''}
                        onChange={(e) =>
                          updateSlide(slide.id, {
                            headline: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Subheadline (optional)"
                        value={slide.subheadline || ''}
                        onChange={(e) =>
                          updateSlide(slide.id, {
                            subheadline: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Button Text (optional)"
                        value={slide.ctaText || ''}
                        onChange={(e) =>
                          updateSlide(slide.id, {
                            ctaText: e.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Button URL (optional)"
                        value={slide.ctaUrl || ''}
                        onChange={(e) =>
                          updateSlide(slide.id, {
                            ctaUrl: e.target.value,
                          })
                        }
                      />

                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          min={0}
                          className="w-20"
                          value={slide.order}
                          onChange={(e) =>
                            updateSlide(slide.id, {
                              order: Math.max(0, +e.target.value),
                            })
                          }
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="bg-red-600 text-white hover:bg-red-700"
                          onClick={() => removeSlide(slide.id)}
                        >
                          <Trash2 className="mr-2" /> Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Add Another Slide */}
          <div className="pt-4 text-center">
            <Button
              variant="outline"
              onClick={addSlide}
              className="border-gray-300 text-gray-800 hover:border-brand hover:text-brand"
            >
              <Plus className="mr-2" /> Add New Slide
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
