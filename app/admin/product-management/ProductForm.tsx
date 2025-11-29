// app/admin/.../ProductForm.tsx
"use client";

import { useState, useEffect, useMemo, ChangeEvent } from "react";
import type { ProductPayload, ColorSizeStocks } from "@/types/product";
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

const CONVENTIONAL_SIZES = ["S", "M", "L", "XL", "R", "B"] as const;

type VariantSalesSnapshot = {
  color: string;
  size: string;
  sold: number;
  remaining: number;
  total: number;
};

interface Props {
  initialProduct?: ProductPayload;
  categories: Category[];
  onSave: (payload: ProductPayload) => Promise<void>;
  /** Optional snapshot of sales info per variant, only passed on Edit */
  variantSales?: VariantSalesSnapshot[];
}

export default function ProductForm({
  initialProduct,
  categories,
  onSave,
  variantSales,
}: Props) {
  const [name, setName] = useState(initialProduct?.name ?? "");

  // Category: start empty so user must explicitly choose
  const [category, setCategory] = useState<string>(
    initialProduct?.category ?? ""
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

  // Status: allow "" initially for placeholder, then require selection
  const [status, setStatus] = useState<ProductPayload["status"] | "">(
    initialProduct?.status ?? ""
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

  const isEditMode = !!initialProduct?.id;

  // When toggling colors on/off keep colours array consistent
  useEffect(() => {
    if (hasColors && colors.length === 0) setColors([""]);
    if (!hasColors) setColors([]);
  }, [hasColors, colors.length]);

  // Global size stock map (used when NO colors)
  const [sizeStocks, setSizeStocks] = useState<Record<string, string>>({
    ...(initialProduct?.sizeStocks ?? {}),
  });

  // Map of sales snapshot for edit UI
  const salesLookup = useMemo(() => {
    const map = new Map<string, VariantSalesSnapshot>();
    (variantSales || []).forEach((snap) => {
      const key = `${(snap.color || "").trim()}|||${(snap.size || "").trim()}`;
      map.set(key, snap);
    });
    return map;
  }, [variantSales]);

  // we only show "Sold / Total after save" lines when we *know* we’re on edit
  const hasSalesSnapshot = !!variantSales && variantSales.length > 0;

  const getSalesFor = (
    color: string,
    size: string
  ): VariantSalesSnapshot | undefined => {
    return salesLookup.get(`${color.trim()}|||${size.trim()}`);
  };

  // Which conventional sizes are enabled for this product
  const [sizeEnabled, setSizeEnabled] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {};
    const colorMatrix = initialProduct?.colorSizeStocks || {};
    const hasColorMatrix = Object.keys(colorMatrix).length > 0;

    for (const s of CONVENTIONAL_SIZES) {
      let enabled = false;

      // 1) plain global sizeStocks (no-color products or legacy data)
      if (initialProduct?.sizeStocks?.[s] !== undefined) {
        enabled = true;
      }

      // 2) when we have a per-color matrix, enable a size
      //    only if at least one color actually uses it
      if (!enabled && hasColorMatrix) {
        for (const perColor of Object.values(colorMatrix)) {
          if (
            perColor &&
            typeof perColor === "object" &&
            (perColor as Record<string, string>)[s] !== undefined
          ) {
            enabled = true;
            break;
          }
        }
      }

      base[s] = enabled;
    }

    return base;
  });

  // Custom sizes (labels only when hasColors, labels + qty when no colors)
  const [customSizes, setCustomSizes] = useState<string[]>(
    initialProduct?.customSizes ?? []
  );

  // Per-color, per-size stock map (baseline “remaining” values)
  const [colorSizeStocks, setColorSizeStocks] = useState<ColorSizeStocks>(() => {
    if (initialProduct?.colorSizeStocks) {
      // deep clone to avoid accidental mutation
      return JSON.parse(JSON.stringify(initialProduct.colorSizeStocks));
    }
    // For old products that had colors but only global sizeStocks,
    // derive a default matrix: same stock for each color.
    if (
      initialHasColors &&
      initialProduct?.sizeStocks &&
      Object.keys(initialProduct.sizeStocks).length > 0
    ) {
      const map: ColorSizeStocks = {};
      for (const color of initialProduct.colors || []) {
        const trimmed = color.trim();
        if (!trimmed) continue;
        map[trimmed] = {};
        for (const [size, stock] of Object.entries(initialProduct.sizeStocks)) {
          map[trimmed][size] = String(stock);
        }
      }
      return map;
    }
    return {};
  });

  // NEW: adjustments for existing variants (edit mode only)
  const [colorSizeAdjustments, setColorSizeAdjustments] =
    useState<ColorSizeStocks>({});
  // for no-color products (sizes/custom sizes)
  const [sizeAdjustments, setSizeAdjustments] = useState<Record<string, string>>(
    {}
  );

  const [images, setImages] = useState<string[]>(initialProduct?.images ?? []);
  const [saving, setSaving] = useState(false);

  // ───────────────────────────────
  // Derived helpers
  // ───────────────────────────────

  const trimmedColors = useMemo(
    () => (hasColors ? colors.map((c) => c.trim()).filter(Boolean) : []),
    [colors, hasColors]
  );

  const activeCustomSizes = useMemo(
    () => customSizes.map((c) => c.trim()).filter(Boolean),
    [customSizes]
  );

  const anySizeEnabled = useMemo(
    () =>
      CONVENTIONAL_SIZES.some((s) => sizeEnabled[s]) ||
      activeCustomSizes.length > 0,
    [sizeEnabled, activeCustomSizes]
  );

  const isFormValid = useMemo(() => {
    // Basic required fields
    if (!name.trim() || !category || !description.trim() || !status) return false;
    if (!weight || isNaN(Number(weight)) || Number(weight) <= 0) return false;

    // Pricing: all currencies must be >= 1
    for (const cur of ["NGN", "USD", "EUR", "GBP"] as const) {
      const num = Number(price[cur]);
      if (!price[cur] || isNaN(num) || num < 1) return false;
    }

    // Colors validation
    if (hasColors && trimmedColors.length === 0) return false;

    // Custom size labels must not be blank
    for (const lbl of customSizes) {
      if (!lbl.trim()) return false;
    }

    // Must have at least one enabled size (conventional or custom)
    if (!anySizeEnabled) return false;

    if (!hasColors) {
      // NO COLORS: validate global sizeStocks (baseline or initial)
      for (const sz of CONVENTIONAL_SIZES) {
        if (
          sizeEnabled[sz] &&
          (!sizeStocks[sz] || isNaN(Number(sizeStocks[sz])))
        ) {
          return false;
        }
      }

      for (const lbl of activeCustomSizes) {
        if (!sizeStocks[lbl] || isNaN(Number(sizeStocks[lbl]))) return false;
      }
    } else {
      // WITH COLORS: validate per-color baseline stock (for new variants)
      if (trimmedColors.length === 0) return false;

      for (const color of trimmedColors) {
        const perColor = colorSizeStocks[color] || {};
        let hasStock = false;

        // conventional sizes
        for (const sz of CONVENTIONAL_SIZES) {
          if (!sizeEnabled[sz]) continue;
          const raw = perColor[sz];
          if (!raw) continue;
          const n = Number(raw);
          if (!Number.isNaN(n) && n >= 0) {
            hasStock = true;
            break;
          }
        }

        // custom sizes
        if (!hasStock) {
          for (const lbl of activeCustomSizes) {
            const raw = perColor[lbl];
            if (!raw) continue;
            const n = Number(raw);
            if (!Number.isNaN(n) && n >= 0) {
              hasStock = true;
              break;
            }
          }
        }

        if (!hasStock) return false;
      }
    }

    // At least one primary image
    if (images.length === 0 || !images[0]) return false;

    return true;
  }, [
    name,
    category,
    description,
    status,
    price,
    hasColors,
    trimmedColors,
    sizeEnabled,
    sizeStocks,
    customSizes,
    activeCustomSizes,
    anySizeEnabled,
    images,
    weight,
    colorSizeStocks,
  ]);

  // ───────────────────────────────
  // Image upload helper
  // ───────────────────────────────

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

  // ───────────────────────────────
  // Color helpers for matrix
  // ───────────────────────────────

  function updateColorName(index: number, newValue: string) {
    setColors((prev) => {
      const before = prev[index];
      const next = prev.map((c, i) => (i === index ? newValue : c));

      setColorSizeStocks((old) => {
        const copy: ColorSizeStocks = { ...old };
        const oldKey = (before || "").trim();
        const newKey = newValue.trim();

        if (oldKey && oldKey !== newKey && copy[oldKey]) {
          if (newKey) {
            copy[newKey] = copy[oldKey];
          }
          delete copy[oldKey];
        } else if (!oldKey && newKey && !copy[newKey]) {
          copy[newKey] = {};
        }
        return copy;
      });

      setColorSizeAdjustments((old) => {
        const copy: ColorSizeStocks = { ...old };
        const oldKey = (before || "").trim();
        const newKey = newValue.trim();

        if (oldKey && oldKey !== newKey && copy[oldKey]) {
          if (newKey) {
            copy[newKey] = copy[oldKey];
          }
          delete copy[oldKey];
        } else if (!oldKey && newKey && !copy[newKey]) {
          copy[newKey] = {};
        }
        return copy;
      });

      return next;
    });
  }

  function removeColor(index: number) {
    setColors((prev) => {
      const removed = prev[index];
      const next = prev.filter((_, i) => i !== index);
      setColorSizeStocks((old) => {
        const copy: ColorSizeStocks = { ...old };
        const key = (removed || "").trim();
        if (key && copy[key]) delete copy[key];
        return copy;
      });
      setColorSizeAdjustments((old) => {
        const copy: ColorSizeStocks = { ...old };
        const key = (removed || "").trim();
        if (key && copy[key]) delete copy[key];
        return copy;
      });
      return next;
    });
  }

  function handleColorSizeStockChange(
    colorKey: string,
    sizeLabel: string,
    rawValue: string
  ) {
    const clean = rawValue.replace(/[^\d]/g, "");
    const key = colorKey.trim();
    if (!key) return; // don't store stock for unnamed colors

    setColorSizeStocks((prev) => {
      const copy: ColorSizeStocks = { ...prev };
      const inner = { ...(copy[key] || {}) };
      inner[sizeLabel] = clean;
      copy[key] = inner;
      return copy;
    });
  }

  // NEW: adjustments for existing variants (allow + / -)
  function handleColorSizeAdjustmentChange(
    colorKey: string,
    sizeLabel: string,
    rawValue: string
  ) {
    const clean = rawValue.replace(/[^0-9-]/g, ""); // digits + minus
    const key = colorKey.trim();
    if (!key) return;

    setColorSizeAdjustments((prev) => {
      const copy: ColorSizeStocks = { ...prev };
      const inner = { ...(copy[key] || {}) };
      inner[sizeLabel] = clean;
      copy[key] = inner;
      return copy;
    });
  }

  function handleSizeAdjustmentChange(sizeLabel: string, rawValue: string) {
    const clean = rawValue.replace(/[^0-9-]/g, "");
    setSizeAdjustments((prev) => ({ ...prev, [sizeLabel]: clean }));
  }

  // ───────────────────────────────
  // Save
  // ───────────────────────────────

  async function handleSave() {
    if (!isFormValid) {
      toast.error(
        "Please fill all required fields, ensure prices ≥ 1, weight is provided, and status/category/sizes are set correctly."
      );
      return;
    }
    setSaving(true);

    const trimmedCustomSizes = activeCustomSizes;
    const trimmedColorList = trimmedColors;

    // Global sizeStocks payload (used only when NO colors)
    const sizeStocksPayload: Record<string, string> = {};
    if (!hasColors) {
      for (const sz of CONVENTIONAL_SIZES) {
        if (!sizeEnabled[sz]) continue;

        const snap =
          hasSalesSnapshot && isEditMode ? getSalesFor("", sz) : undefined;

        if (snap) {
          const base = snap.remaining;
          const delta = parseInt(sizeAdjustments[sz] ?? "0", 10) || 0;
          const finalVal = base + delta;
          if (finalVal < 0) {
            toast.error(
              `Size ${sz}: adjustment would make stock negative (${finalVal}).`
            );
            setSaving(false);
            return;
          }
          sizeStocksPayload[sz] = String(finalVal);
        } else {
          const v = (sizeStocks[sz] ?? "").trim();
          if (v) sizeStocksPayload[sz] = v;
        }
      }
      for (const lbl of trimmedCustomSizes) {
        const snap =
          hasSalesSnapshot && isEditMode ? getSalesFor("", lbl) : undefined;

        if (snap) {
          const base = snap.remaining;
          const delta = parseInt(sizeAdjustments[lbl] ?? "0", 10) || 0;
          const finalVal = base + delta;
          if (finalVal < 0) {
            toast.error(
              `Size ${lbl}: adjustment would make stock negative (${finalVal}).`
            );
            setSaving(false);
            return;
          }
          sizeStocksPayload[lbl] = String(finalVal);
        } else {
          const v = (sizeStocks[lbl] ?? "").trim();
          if (v) sizeStocksPayload[lbl] = v;
        }
      }
    }

    // Per-color stock matrix
    const colorSizeStocksPayload: ColorSizeStocks = {};
    if (hasColors && trimmedColorList.length > 0) {
      for (const color of trimmedColorList) {
        const perColor = colorSizeStocks[color] || {};
        const inner: Record<string, string> = {};

        for (const sz of CONVENTIONAL_SIZES) {
          if (!sizeEnabled[sz]) continue;

          const snap =
            hasSalesSnapshot && isEditMode ? getSalesFor(color, sz) : undefined;

          if (snap) {
            const base = snap.remaining;
            const delta =
              parseInt(
                colorSizeAdjustments[color]?.[sz] ?? "0",
                10
              ) || 0;
            const finalVal = base + delta;
            if (finalVal < 0) {
              toast.error(
                `${color} / ${sz}: adjustment would make stock negative (${finalVal}).`
              );
              setSaving(false);
              return;
            }
            inner[sz] = String(finalVal);
          } else {
            const v = (perColor[sz] ?? "").trim();
            if (v) inner[sz] = v;
          }
        }
        for (const lbl of trimmedCustomSizes) {
          const snap =
            hasSalesSnapshot && isEditMode
              ? getSalesFor(color, lbl)
              : undefined;

          if (snap) {
            const base = snap.remaining;
            const delta =
              parseInt(
                colorSizeAdjustments[color]?.[lbl] ?? "0",
                10
              ) || 0;
            const finalVal = base + delta;
            if (finalVal < 0) {
              toast.error(
                `${color} / ${lbl}: adjustment would make stock negative (${finalVal}).`
              );
              setSaving(false);
              return;
            }
            inner[lbl] = String(finalVal);
          } else {
            const v = (perColor[lbl] ?? "").trim();
            if (v) inner[lbl] = v;
          }
        }

        if (Object.keys(inner).length > 0) {
          colorSizeStocksPayload[color] = inner;
        }
      }
    }

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
      status: status as ProductPayload["status"],
      sizeMods,
      colors: hasColors ? trimmedColorList : [],
      sizeStocks: sizeStocksPayload,
      customSizes: trimmedCustomSizes,
      images,
      videoUrl: videoUrl.trim() || null,
      weight: parseFloat(weight),
      ...(hasColors && Object.keys(colorSizeStocksPayload).length
        ? { colorSizeStocks: colorSizeStocksPayload }
        : {}),
    };

    try {
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  }

  // ───────────────────────────────
  // JSX
  // ───────────────────────────────

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

        {/* Category Select */}
        <div
          className={`flex flex-col space-y-1 ${
            saving ? "animate-pulse" : ""
          }`}
        >
          <Label>Category *</Label>
          <Select
            value={category || undefined}
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

        {/* Status Select */}
        <div
          className={`flex flex-col space-y-1 ${
            saving ? "animate-pulse" : ""
          }`}
        >
          <Label>Status *</Label>
          <Select
            value={status || undefined}
            onValueChange={(v) => setStatus(v as ProductPayload["status"])}
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

        {/* Colors + per-color stock matrix */}
        {hasColors && (
          <div className="md:col-span-2 space-y-3">
            <Label>Colors & Stock</Label>
            <p className="text-xs text-gray-500">
              Add colors and then manage stock per size.
              <br />
              Existing variants show current remaining (read-only) plus an
              adjustment field; new variants use a direct quantity.
            </p>
            <div className="grid grid-cols-1 gap-4">
              {colors.map((c, i) => {
                const trimmed = c.trim();
                const perColor = trimmed ? colorSizeStocks[trimmed] || {} : {};
                const enabledConventional = CONVENTIONAL_SIZES.filter(
                  (sz) => sizeEnabled[sz]
                );
                const hasAnySize =
                  enabledConventional.length > 0 ||
                  activeCustomSizes.length > 0;

                return (
                  <div
                    key={i}
                    className="border rounded-md p-3 space-y-3 bg-gray-50"
                  >
                    <div className="flex items-center space-x-2">
                      <Input
                        placeholder={`Color ${i + 1}`}
                        value={c}
                        onChange={(e) => updateColorName(i, e.target.value)}
                        disabled={saving}
                      />
                      {colors.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={saving}
                          onClick={() => removeColor(i)}
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

                    {trimmed && hasAnySize ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {enabledConventional.map((sz) => {
                            const snap =
                              hasSalesSnapshot && isEditMode
                                ? getSalesFor(trimmed, sz)
                                : undefined;
                            const hasExistingVariant = !!snap;
                            const sold = snap?.sold ?? 0;
                            const baselineRemaining = hasExistingVariant
                              ? snap!.remaining
                              : Number(perColor[sz] ?? "") || 0;
                            const adjustStr =
                              colorSizeAdjustments[trimmed]?.[sz] ?? "";
                            const delta =
                              parseInt(adjustStr || "0", 10) || 0;
                            const newRemaining =
                              baselineRemaining + (hasExistingVariant ? delta : 0);
                            const totalAfterSave =
                              sold + (hasExistingVariant ? newRemaining : baselineRemaining);

                            return (
                              <div
                                key={sz}
                                className="flex flex-col space-y-1"
                              >
                                <div className="flex items-center space-x-2">
                                  <Label className="w-10">{sz}</Label>
                                  {hasExistingVariant ? (
                                    <>
                                      <Input
                                        type="number"
                                        value={baselineRemaining}
                                        disabled
                                        className="w-20 bg-gray-100 text-gray-600"
                                      />
                                      <Input
                                        type="text"
                                        placeholder="+ / -"
                                        value={adjustStr}
                                        onChange={(e) =>
                                          handleColorSizeAdjustmentChange(
                                            trimmed,
                                            sz,
                                            e.target.value
                                          )
                                        }
                                        disabled={saving}
                                        className="w-20"
                                      />
                                    </>
                                  ) : (
                                    <Input
                                      type="number"
                                      placeholder="Remaining Qty"
                                      value={perColor[sz] ?? ""}
                                      onChange={(e) =>
                                        handleColorSizeStockChange(
                                          trimmed,
                                          sz,
                                          e.target.value
                                        )
                                      }
                                      disabled={saving}
                                      className="w-24"
                                    />
                                  )}
                                </div>
                                {hasSalesSnapshot && hasExistingVariant && (
                                  <p className="text-xs text-gray-600 ml-10">
                                    Sold so far:{" "}
                                    <span className="font-semibold">
                                      {sold}
                                    </span>{" "}
                                    • Remaining after save:{" "}
                                    <span className="font-semibold">
                                      {newRemaining}
                                    </span>{" "}
                                    • Total after save:{" "}
                                    <span className="font-semibold">
                                      {totalAfterSave}
                                    </span>
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {activeCustomSizes.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500">
                              Custom sizes for this color:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {activeCustomSizes.map((lbl) => {
                                const snap =
                                  hasSalesSnapshot && isEditMode
                                    ? getSalesFor(trimmed, lbl)
                                    : undefined;
                                const hasExistingVariant = !!snap;
                                const sold = snap?.sold ?? 0;
                                const baselineRemaining = hasExistingVariant
                                  ? snap!.remaining
                                  : Number(perColor[lbl] ?? "") || 0;
                                const adjustStr =
                                  colorSizeAdjustments[trimmed]?.[lbl] ?? "";
                                const delta =
                                  parseInt(adjustStr || "0", 10) || 0;
                                const newRemaining =
                                  baselineRemaining +
                                  (hasExistingVariant ? delta : 0);
                                const totalAfterSave =
                                  sold +
                                  (hasExistingVariant
                                    ? newRemaining
                                    : baselineRemaining);

                                return (
                                  <div
                                    key={lbl}
                                    className="flex flex-col space-y-1"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <Label className="w-20 truncate">
                                        {lbl}
                                      </Label>
                                      {hasExistingVariant ? (
                                        <>
                                          <Input
                                            type="number"
                                            value={baselineRemaining}
                                            disabled
                                            className="w-20 bg-gray-100 text-gray-600"
                                          />
                                          <Input
                                            type="text"
                                            placeholder="+ / -"
                                            value={adjustStr}
                                            onChange={(e) =>
                                              handleColorSizeAdjustmentChange(
                                                trimmed,
                                                lbl,
                                                e.target.value
                                              )
                                            }
                                            disabled={saving}
                                            className="w-20"
                                          />
                                        </>
                                      ) : (
                                        <Input
                                          type="number"
                                          placeholder="Remaining"
                                          value={perColor[lbl] ?? ""}
                                          onChange={(e) =>
                                            handleColorSizeStockChange(
                                              trimmed,
                                              lbl,
                                              e.target.value
                                            )
                                          }
                                          disabled={saving}
                                          className="w-24"
                                        />
                                      )}
                                    </div>
                                    {hasSalesSnapshot && hasExistingVariant && (
                                      <p className="text-xs text-gray-600 ml-20">
                                        Sold so far:{" "}
                                        <span className="font-semibold">
                                          {sold}
                                        </span>{" "}
                                        • Remaining after save:{" "}
                                        <span className="font-semibold">
                                          {newRemaining}
                                        </span>{" "}
                                        • Total after save:{" "}
                                        <span className="font-semibold">
                                          {totalAfterSave}
                                        </span>
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">
                        {trimmed
                          ? "Enable sizes above or add custom sizes to assign stock for this color."
                          : "Enter a color name first to configure its stock."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Global sizes (toggles) + stock when no colors */}
        <div className="md:col-span-2 space-y-2">
          <Label>
            Sizes {hasColors ? "(enabled for this product)" : "& Stock"}
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CONVENTIONAL_SIZES.map((sz) => {
              const snap =
                hasSalesSnapshot && isEditMode ? getSalesFor("", sz) : undefined;
              const hasExistingVariant = !!snap;
              const sold = snap?.sold ?? 0;
              const baselineRemaining = hasExistingVariant
                ? snap!.remaining
                : Number(sizeStocks[sz] ?? "") || 0;
              const adjustStr = sizeAdjustments[sz] ?? "";
              const delta = parseInt(adjustStr || "0", 10) || 0;
              const newRemaining =
                baselineRemaining + (hasExistingVariant ? delta : 0);
              const totalAfterSave =
                sold + (hasExistingVariant ? newRemaining : baselineRemaining);

              return (
                <div key={sz} className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
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
                        setSizeAdjustments((prev) => {
                          const copy = { ...prev };
                          if (!on) delete copy[sz];
                          return copy;
                        });
                      }}
                      disabled={saving}
                    />
                    <Label className="w-8">{sz}</Label>
                    {sizeEnabled[sz] &&
                      (!hasColors ? (
                        hasExistingVariant && hasSalesSnapshot && isEditMode ? (
                          <>
                            <Input
                              type="number"
                              value={baselineRemaining}
                              disabled
                              className="w-20 bg-gray-100 text-gray-600"
                            />
                            <Input
                              type="text"
                              placeholder="+ / -"
                              value={adjustStr}
                              onChange={(e) =>
                                handleSizeAdjustmentChange(sz, e.target.value)
                              }
                              disabled={saving}
                              className="w-20"
                            />
                          </>
                        ) : (
                          <Input
                            type="number"
                            placeholder="Remaining"
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
                        )
                      ) : (
                        <span className="text-xs text-gray-500">Enabled</span>
                      ))}
                  </div>
                  {!hasColors &&
                    hasSalesSnapshot &&
                    isEditMode &&
                    sizeEnabled[sz] &&
                    hasExistingVariant && (
                      <p className="text-xs text-gray-600 ml-14">
                        Sold so far:{" "}
                        <span className="font-semibold">{sold}</span> •
                        Remaining after save:{" "}
                        <span className="font-semibold">{newRemaining}</span> •
                        Total after save:{" "}
                        <span className="font-semibold">
                          {totalAfterSave}
                        </span>
                      </p>
                    )}
                </div>
              );
            })}
          </div>
          {hasColors && (
            <p className="text-xs text-gray-500 mt-1">
              When colors are enabled, quantities are set per color above.
              These toggles only control which sizes exist for the product.
            </p>
          )}
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

        {customSizes.map((label, i) => {
          const trimmed = label.trim();
          const snap =
            !hasColors && hasSalesSnapshot && isEditMode && trimmed
              ? getSalesFor("", trimmed)
              : undefined;
          const hasExistingVariant = !!snap;
          const sold = snap?.sold ?? 0;
          const baselineRemaining = hasExistingVariant
            ? snap!.remaining
            : Number(sizeStocks[trimmed] ?? "") || 0;
          const adjustStr = sizeAdjustments[trimmed] ?? "";
          const delta = parseInt(adjustStr || "0", 10) || 0;
          const newRemaining =
            baselineRemaining + (hasExistingVariant ? delta : 0);
          const totalAfterSave =
            sold + (hasExistingVariant ? newRemaining : baselineRemaining);

          return (
            <div key={i} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
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
                {!hasColors && (
                  hasExistingVariant && hasSalesSnapshot && isEditMode ? (
                    <>
                      <Input
                        type="number"
                        value={baselineRemaining}
                        disabled
                        className="w-20 bg-gray-100 text-gray-600"
                      />
                      <Input
                        type="text"
                        placeholder="+ / -"
                        value={adjustStr}
                        onChange={(e) =>
                          handleSizeAdjustmentChange(trimmed, e.target.value)
                        }
                        disabled={saving}
                        className="w-20"
                      />
                    </>
                  ) : (
                    <Input
                      type="number"
                      placeholder="Remaining"
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
                  )
                )}
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
                    setSizeAdjustments((st) => {
                      const copy = { ...st };
                      delete copy[trimmed];
                      return copy;
                    });
                  }}
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
              {!hasColors &&
                hasSalesSnapshot &&
                isEditMode &&
                trimmed &&
                hasExistingVariant && (
                  <p className="text-xs text-gray-600 ml-32">
                    Sold so far:{" "}
                    <span className="font-semibold">{sold}</span> • Remaining
                    after save:{" "}
                    <span className="font-semibold">{newRemaining}</span> •
                    Total after save:{" "}
                    <span className="font-semibold">{totalAfterSave}</span>
                  </p>
                )}
            </div>
          );
        })}

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
