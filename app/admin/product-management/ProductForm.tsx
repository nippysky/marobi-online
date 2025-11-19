"use client";

import { useState, useEffect, useMemo, ChangeEvent } from "react";
import type { ProductPayload } from "@/types/product";
import type { Category } from "@/lib/categories";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import toast from "react-hot-toast";

const CONVENTIONAL_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"] as const;

interface Props {
  initialProduct?: ProductPayload;
  categories: Category[];
  onSave: (payload: ProductPayload) => Promise<void>;
}

export default function ProductForm({
  initialProduct,
  categories,
  onSave,
}: Props) {
  const [name, setName] = useState(initialProduct?.name ?? "");
  const [category, setCategory] = useState<string>(
    initialProduct?.category ?? categories[0]?.slug ?? ""
  );
  const [description, setDescription] = useState(
    initialProduct?.description ?? ""
  );
  const [price, setPrice] = useState({
    NGN:
      initialProduct?.price.NGN != null
        ? String(initialProduct.price.NGN)
        : "",
    USD:
      initialProduct?.price.USD != null
        ? String(initialProduct.price.USD)
        : "",
    EUR:
      initialProduct?.price.EUR != null
        ? String(initialProduct.price.EUR)
        : "",
    GBP:
      initialProduct?.price.GBP != null
        ? String(initialProduct.price.GBP)
        : "",
  });
  const [status, setStatus] = useState<ProductPayload["status"]>(
    initialProduct?.status ?? "Draft"
  );
  const [sizeMods, setSizeMods] = useState(initialProduct?.sizeMods ?? false);
  const initialHasColors = (initialProduct?.colors?.length ?? 0) > 0;
  const [hasColors, setHasColors] = useState(initialHasColors);
  const [colors, setColors] = useState<string[]>(
    initialHasColors ? [...(initialProduct?.colors || [])] : []
  );
  const [videoUrl, setVideoUrl] = useState(initialProduct?.videoUrl ?? "");
  const [weight, setWeight] = useState<string>(
    initialProduct?.weight != null ? String(initialProduct.weight) : ""
  );

  useEffect(() => {
    if (hasColors && colors.length === 0) setColors([""]);
    if (!hasColors) setColors([]);
  }, [hasColors]);

  const [sizeStocks, setSizeStocks] = useState<Record<string, string>>({
    ...(initialProduct?.sizeStocks ?? {}),
  });
  const [sizeEnabled, setSizeEnabled] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {};
    for (const s of CONVENTIONAL_SIZES) {
      base[s] = initialProduct?.sizeStocks?.[s] !== undefined;
    }
    return base;
  });
  const [customSizes, setCustomSizes] = useState<string[]>(
    initialProduct?.customSizes ?? []
  );
  const [images, setImages] = useState<string[]>(initialProduct?.images ?? []);
  const [saving, setSaving] = useState(false);

  const isFormValid = useMemo(() => {
    if (!name.trim() || !category || !description.trim()) return false;
    if (!weight || isNaN(Number(weight)) || Number(weight) <= 0) return false;
    for (const cur of ["NGN", "USD", "EUR", "GBP"] as const) {
      const num = Number(price[cur]);
      if (!price[cur] || isNaN(num) || num < 1) return false;
    }
    if (hasColors && colors.filter((c) => c.trim()).length === 0) return false;
    for (const sz of CONVENTIONAL_SIZES) {
      if (
        sizeEnabled[sz] &&
        (!sizeStocks[sz] || isNaN(Number(sizeStocks[sz])))
      ) {
        return false;
      }
    }
    for (const lbl of customSizes) {
      if (!lbl.trim()) return false;
      if (!sizeStocks[lbl] || isNaN(Number(sizeStocks[lbl]))) return false;
    }
    if (images.length === 0 || !images[0]) return false;
    return true;
  }, [
    name,
    category,
    description,
    price,
    hasColors,
    colors,
    sizeEnabled,
    sizeStocks,
    customSizes,
    images,
    weight,
  ]);

  async function uploadFile(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) throw new Error("Upload failed");
    const json = await res.json();
    return json.data.secure_url;
  }

  async function handleImageChange(
    e: ChangeEvent<HTMLInputElement>,
    idx: number
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile(file);
      setImages((imgs) => {
        const cpy = [...imgs];
        cpy[idx] = url;
        return cpy;
      });
    } catch (err: any) {
      toast.error(err.message || "Image upload failed");
    }
  }

  async function handleSave() {
    if (!isFormValid) {
      toast.error(
        "Please fill all required fields, ensure prices ≥ 1, and weight is provided."
      );
      return;
    }
    setSaving(true);
    const payload: ProductPayload = {
      id: initialProduct?.id,
      name: name.trim(),
      category,
      description: description.trim(),
      price: {
        NGN: parseFloat(price.NGN),
        USD: parseFloat(price.USD),
        EUR: parseFloat(price.EUR),
        GBP: parseFloat(price.GBP),
      },
      status,
      sizeMods,
      colors: hasColors
        ? colors.map((c) => c.trim()).filter((c) => c)
        : [],
      sizeStocks,
      customSizes: customSizes.filter((c) => c.trim()),
      images,
      videoUrl: videoUrl.trim() || null,
      weight: parseFloat(weight),
    };
    try {
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={`max-w-4xl mx-auto ${saving ? "opacity-80" : ""}`}>
      <CardHeader>
        <CardTitle>Product Details</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          className={`flex flex-col space-y-1 ${
            saving ? "animate-pulse" : ""
          }`}
        >
          <Label>Product Name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />
        </div>
        <div
          className={`flex flex-col space-y-1 ${
            saving ? "animate-pulse" : ""
          }`}
        >
          <Label>Category *</Label>
          <Select
            value={category}
            onValueChange={setCategory}
            disabled={saving}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.slug} value={cat.slug}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div
          className={`flex flex-col space-y-1 ${
            saving ? "animate-pulse" : ""
          }`}
        >
          <Label>Status *</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as any)}
            disabled={saving}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {["Draft", "Published", "Archived"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={sizeMods}
            onCheckedChange={setSizeMods}
            disabled={saving}
          />
          <Label>Enable Custom Size Mods?</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={hasColors}
            onCheckedChange={setHasColors}
            disabled={saving}
          />
          <Label>Has Colors?</Label>
        </div>

        <div className="flex flex-col space-y-1">
          <Label>Default Variant Weight (kg) *</Label>
          <Input
            type="number"
            placeholder="e.g., 0.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            disabled={saving}
            min={0.001}
            step="0.001"
          />
        </div>

        {hasColors && (
          <div className="md:col-span-2 grid grid-cols-1 gap-2">
            {colors.map((c, i) => (
              <div key={i} className="flex items-center space-x-2">
                <Input
                  placeholder={`Color ${i + 1}`}
                  value={c}
                  onChange={(e) =>
                    setColors((cs) =>
                      cs.map((x, j) => (j === i ? e.target.value : x))
                    )
                  }
                  disabled={saving}
                />
                {colors.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={saving}
                    onClick={() =>
                      setColors((cs) => cs.filter((_, j) => j !== i))
                    }
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                )}
                {i === colors.length - 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => setColors((cs) => [...cs, ""])}
                  >
                    <Plus className="h-4 w-4 text-green-600" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {(["NGN", "USD", "EUR", "GBP"] as const).map((cur) => (
          <div key={cur} className="flex flex-col space-y-1">
            <Label>{cur} Price *</Label>
            <Input
              type="number"
              placeholder="0.00"
              min={1}
              value={price[cur]}
              onChange={(e) =>
                setPrice((p) => ({ ...p, [cur]: e.target.value }))
              }
              disabled={saving}
            />
          </div>
        ))}
        <div className="md:col-span-2 flex flex-col space-y-1">
          <Label>Description *</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
            className="h-32"
          />
        </div>

        <div className="md:col-span-2 flex flex-col space-y-1">
          <Label>Video URL</Label>
          <Input
            type="url"
            placeholder="https://youtube.com/…"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="md:col-span-2 space-y-2">
          <Label>Sizes & Stock</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CONVENTIONAL_SIZES.map((sz) => (
              <div key={sz} className="flex items-center space-x-2">
                <Switch
                  checked={sizeEnabled[sz]}
                  onCheckedChange={(on) => {
                    setSizeEnabled((s) => ({ ...s, [sz]: on }));
                    setSizeStocks((st) => {
                      const copy = { ...st };
                      if (!on) delete copy[sz];
                      else if (copy[sz] === undefined) copy[sz] = "";
                      return copy;
                    });
                  }}
                  disabled={saving}
                />
                <Label className="w-8">{sz}</Label>
                {sizeEnabled[sz] && (
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={sizeStocks[sz] ?? ""}
                    onChange={(e) =>
                      setSizeStocks((st) => ({
                        ...st,
                        [sz]: e.target.value,
                      }))
                    }
                    disabled={saving}
                    className="w-20"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="md:col-span-2 flex justify-between items-center">
          <Label>Custom Sizes</Label>
          <Button
            size="icon"
            variant="ghost"
            disabled={saving}
            onClick={() => setCustomSizes((cs) => [...cs, ""])}
          >
            <Plus className="h-5 w-5 text-indigo-600" />
          </Button>
        </div>
        {customSizes.map((label, i) => (
          <div key={i} className="flex items-center space-x-2">
            <Input
              placeholder="Label"
              value={label}
              onChange={(e) =>
                setCustomSizes((cs) =>
                  cs.map((c, j) => (j === i ? e.target.value : c))
                )
              }
              disabled={saving}
              className="w-28"
            />
            <Input
              type="number"
              placeholder="Qty"
              value={sizeStocks[label] ?? ""}
              onChange={(e) =>
                setSizeStocks((st) => ({
                  ...st,
                  [label]: e.target.value,
                }))
              }
              disabled={saving}
              className="w-20"
            />
            <Button
              size="icon"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setCustomSizes((cs) => cs.filter((_, j) => j !== i));
                setSizeStocks((st) => {
                  const copy = { ...st };
                  delete copy[label];
                  return copy;
                });
              }}
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ))}
        <div className="md:col-span-2">
          <Label>Images *</Label>
          <div className="grid grid-cols-4 gap-4 mt-2">
            {Array.from({ length: images.length + 1 }).map((_, idx) => {
              const url = images[idx];
              return (
                <div
                  key={idx}
                  className="relative aspect-[4/3] border rounded overflow-hidden"
                >
                  {url ? (
                    <>
                      <img
                        src={url}
                        alt={`img-${idx}`}
                        className="object-cover w-full h-full"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-1 right-1"
                        disabled={saving}
                        onClick={() =>
                          setImages((imgs) => imgs.filter((_, i) => i !== idx))
                        }
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div
                        onClick={() =>
                          document.getElementById(`file-${idx}`)?.click()
                        }
                        className="h-full w-full flex flex-col items-center justify-center text-gray-400 cursor-pointer"
                      >
                        <Plus className="h-6 w-6" />
                        <span className="text-xs">Upload</span>
                      </div>
                      <input
                        id={`file-${idx}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={saving}
                        onChange={(e) => handleImageChange(e, idx)}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            (First image will be used as the primary thumbnail.)
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-4">
        <Button
          variant="destructive"
          disabled={saving}
          onClick={() => history.back()}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!isFormValid || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </CardFooter>
    </Card>
  );
}
