"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { Session } from "next-auth";
import type { Product } from "@/lib/products";
import {
  CheckCircle,
  Heart,
  LayoutGrid,
  PencilRuler,
  Play,
  Tag,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { BsBag } from "react-icons/bs";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { VideoModal } from "./VideoModal";
import { useSizeChart } from "@/lib/context/sizeChartcontext";
import { useCartStore } from "@/lib/store/cartStore";
import { useCurrency } from "@/lib/context/currencyContext";
import { formatAmount } from "@/lib/formatCurrency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { Input } from "./ui/input";

type CustomFieldKey = "chest" | "waist" | "hip" | "length";

const CUSTOM_SIZE_FIELDS: Array<{ name: CustomFieldKey; label: string }> = [
  { name: "chest", label: "Chest/Bust (in)" },
  { name: "waist", label: "Waist (in)" },
  { name: "hip", label: "Hip (in)" },
  { name: "length", label: "Length (in)" },
];

interface Props {
  product: Product;
  user: Session["user"] | null;
  categoryName: string;
}

const ProductDetailHero: React.FC<Props> = ({ product, user, categoryName }) => {
  const router = useRouter();
  const { openSizeChart } = useSizeChart();
  const { currency } = useCurrency(); // single declaration

  // media
  const media = useMemo(() => [...(product.images || [])], [product.images]);
  const [featuredImage, setFeaturedImage] = useState<string>(media[0] || "");
  const [imgLoading, setImgLoading] = useState<boolean>(true);

  // thumb refs (for auto-centering on active)
  const thumbsRef = useRef<HTMLDivElement | null>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const setThumbRef =
    (i: number) =>
    (el: HTMLButtonElement | null): void => {
      thumbRefs.current[i] = el;
    };

  useEffect(() => {
    const idx = media.findIndex((m) => m === featuredImage);
    if (idx >= 0) {
      const el = thumbRefs.current[idx];
      if (el)
        el.scrollIntoView({
          block: "nearest",
          inline: "center",
          behavior: "smooth",
        });
    }
  }, [featuredImage, media]);

  // video
  const hasVideo = Boolean(product.videoUrl);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  // stock
  const totalStock = useMemo(
    () =>
      product.variants.reduce((sum, v: any) => {
        const s =
          typeof v?.inStock === "number"
            ? v.inStock
            : typeof v?.stock === "number"
            ? v.stock
            : 0;
        return sum + s;
      }, 0),
    [product.variants]
  );

  // variants
  const colors = useMemo(
    () => Array.from(new Set(product.variants.map((v) => v.color))),
    [product.variants]
  );
  const sizes = useMemo(
    () => Array.from(new Set(product.variants.map((v) => v.size))),
    [product.variants]
  );
  const hasColor = colors.length > 1 || (colors[0] ?? "") !== "";
  const hasSize = sizes.length > 1 || (sizes[0] ?? "") !== "";

  const [selectedColor, setSelectedColor] = useState<string>(
    hasColor ? colors[0] : ""
  );
  const availableSizes = useMemo(
    () =>
      hasColor
        ? Array.from(
            new Set(
              product.variants
                .filter((v) => v.color === selectedColor)
                .map((v) => v.size)
            )
          )
        : sizes,
    [hasColor, product.variants, selectedColor, sizes]
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    availableSizes[0] || ""
  );
  useEffect(() => setSelectedSize(availableSizes[0] || ""), [availableSizes]);

  const enableSizeMod = Boolean(product.sizeMods);
  const [customSizeEnabled, setCustomSizeEnabled] = useState(false);
  const [customMods, setCustomMods] = useState<Record<string, string>>({});

  const selectedVariant = useMemo(
    () =>
      product.variants.find(
        (v) =>
          (!hasColor || v.color === selectedColor) &&
          (!hasSize || v.size === selectedSize)
      ),
    [product.variants, hasColor, selectedColor, hasSize, selectedSize]
  ) as any | undefined;

  const inStock = useMemo(() => {
    const s =
      typeof selectedVariant?.inStock === "number"
        ? selectedVariant.inStock
        : typeof selectedVariant?.stock === "number"
        ? selectedVariant.stock
        : undefined;
    return typeof s === "number" ? s : totalStock;
  }, [selectedVariant, totalStock]);

  const outOfStock = inStock === 0;

  // qty
  const [quantity, setQuantity] = useState<number>(1);
  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), inStock || 1));
  }, [selectedColor, selectedSize, inStock]);

  // pricing — per-currency price comes from product meta; no FX conversion
  const basePrice =
    (product as any).prices?.[currency] ??
    (Object.values((product as any).prices ?? {})[0] as number | undefined) ??
    0;
  const sizeModFee = customSizeEnabled ? +(basePrice * 0.05).toFixed(2) : 0;
  const finalPrice = +(basePrice + sizeModFee).toFixed(2);
  const currentPrice = formatAmount(finalPrice, currency);

  const unitWeight =
    typeof selectedVariant?.weight === "number" ? selectedVariant.weight : 0;

  // wishlist
  const [wishLoading, setWishLoading] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (user && user.role === "customer" && product.id) {
          const r = await fetch(`/api/account/wishlist/${product.id}`);
          const d = await r.json();
          if (active) setIsWishlisted(Boolean(d?.wishlisted));
        } else {
          if (active) setIsWishlisted(false);
        }
      } catch {
        if (active) setIsWishlisted(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [user, product.id]);

  const toggleWishlist = async () => {
    if (!user || user.role !== "customer") {
      toast.error("Sign in to use wishlist");
      return;
    }
    setWishLoading(true);
    try {
      if (isWishlisted) {
        await fetch(`/api/account/wishlist/${product.id}`, { method: "DELETE" });
        setIsWishlisted(false);
        toast("Removed from wishlist");
      } else {
        await fetch(`/api/account/wishlist/${product.id}`, { method: "POST" });
        setIsWishlisted(true);
        toast.success("Added to wishlist");
      }
    } catch {
      toast.error("Error updating wishlist");
    } finally {
      setWishLoading(false);
    }
  };

  // cart
  const addToCart = useCartStore((s) => s.addToCart);

  const validate = () => {
    if (outOfStock) return toast.error("Out of stock"), false as const;
    if (hasColor && !selectedColor) return toast.error("Select a color"), false as const;
    if (hasSize && !selectedSize) return toast.error("Select a size"), false as const;
    if (quantity < 1) return toast.error("Quantity must be at least 1"), false as const;
    if (customSizeEnabled) {
      const any = CUSTOM_SIZE_FIELDS.some((f) =>
        (customMods[f.name] ?? "").toString().trim()
      );
      if (!any) return toast.error("Enter at least one custom measurement"), false as const;
    }
    return true as const;
  };

  const handleAddToCart = () => {
    if (!validate()) return;
    addToCart({
      product,
      color: selectedColor,
      size: selectedSize,
      quantity,
      price: finalPrice, // stored snapshot; cart/checkout re-derive from product per-currency fields
      hasSizeMod: customSizeEnabled,
      sizeModFee,
      customMods: customSizeEnabled ? customMods : undefined,
      unitWeight,
    });
    toast.success("Added to cart");
  };

  const handleBuyNow = () => {
    if (!validate()) return;
    addToCart({
      product,
      color: selectedColor,
      size: selectedSize,
      quantity,
      price: finalPrice,
      hasSizeMod: customSizeEnabled,
      sizeModFee,
      customMods: customSizeEnabled ? customMods : undefined,
      unitWeight,
    });
    router.push("/checkout");
  };

  // featured init
  useEffect(() => {
    if (media[0]) {
      setFeaturedImage(media[0]);
      setImgLoading(true);
    }
  }, [media]);

  const idx = media.findIndex((m) => m === featuredImage);
  const prevMedia = () => {
    if (!media.length) return;
    const i = (idx - 1 + media.length) % media.length;
    setFeaturedImage(media[i]);
    setImgLoading(true);
  };
  const nextMedia = () => {
    if (!media.length) return;
    const i = (idx + 1) % media.length;
    setFeaturedImage(media[i]);
    setImgLoading(true);
  };

  const mainAlt = featuredImage
    ? `${product.name} — Marobi womenswear`
    : `${product.name} — product image`;

  return (
    <section className="grid gap-10 lg:grid-cols-[minmax(280px,520px)_1fr] mt-10">
      {/* Main image */}
      <div className="lg:sticky lg:top-28">
        <div className="relative w-full mx-auto max-w-[520px] aspect-[3/4] rounded-2xl bg-gray-100 overflow-hidden shadow-sm">
          <Skeleton className={`absolute inset-0 ${imgLoading ? "" : "hidden"}`} />
          {featuredImage ? (
            <Image
              src={featuredImage}
              alt={mainAlt}
              fill
              priority
              loading="eager"
              decoding="async"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className={`object-cover transition-opacity duration-300 ${
                imgLoading ? "opacity-0" : "opacity-100"
              }`}
              onLoad={() => setImgLoading(false)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No image available
            </div>
          )}

          {media.length > 1 && (
            <>
              <button
                onClick={prevMedia}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/35 hover:bg-black/45 text-white"
                aria-label="Previous image"
                type="button"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={nextMedia}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/35 hover:bg-black/45 text-white"
                aria-label="Next image"
                type="button"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-6 w-full">
        {/* Media thumbnails */}
        {!!media.length && (
          <div className="space-y-3">
            <p className="font-medium text-gray-700">Media</p>

            <div
              ref={thumbsRef}
              className="
                no-scrollbar
                grid grid-flow-col
                auto-cols-[22%] md:auto-cols-[18%]
                gap-3 overflow-x-auto scroll-smooth rounded-xl p-1
              "
            >
              {media.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  ref={setThumbRef(i)}
                  onClick={() => {
                    setFeaturedImage(url);
                    setImgLoading(true);
                  }}
                  className={`relative w-full aspect-[4/5] rounded-lg overflow-hidden bg-gray-100 border ${
                    featuredImage === url ? "ring-2 ring-brand" : "border-transparent"
                  }`}
                  aria-label={`View image ${i + 1}`}
                  type="button"
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    loading="lazy"
                    decoding="async"
                    sizes="96px"
                    className="object-cover"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>

            {hasVideo && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsVideoOpen(true)}
              >
                <Play className="mr-2" /> Play Video
              </Button>
            )}
          </div>
        )}

        {/* Facts */}
        <div className="flex flex-wrap lg:gap-20 gap-10 text-sm text-gray-700">
          <Link
            href={`/categories/${product.category}`}
            className="flex items-center gap-1 underline"
          >
            <LayoutGrid /> {categoryName}
          </Link>
          <button
            onClick={openSizeChart}
            className="flex items-center gap-1 underline"
            type="button"
          >
            <PencilRuler /> Size Chart
          </button>
          <div className="flex items-center gap-1">
            <CheckCircle />
            <span className="font-semibold">{totalStock}</span> in stock
          </div>
          {typeof unitWeight === "number" && unitWeight > 0 && (
            <div className="flex items-center gap-1">
              <span className="font-medium">Weight:</span>
              <span>{unitWeight.toFixed(3)}kg</span>
              {quantity > 1 && (
                <span className="text-gray-500">
                  (Total: {(unitWeight * quantity).toFixed(3)}kg)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Title & description */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{product.name}</h1>
          <p className="text-gray-600">{product.description}</p>
        </div>

        {/* Price */}
        <div className="text-3xl font-bold text-gray-900">{currentPrice}</div>
        <div className="text-sm text-gray-500">
          {customSizeEnabled && (
            <>
              <span>+5% custom-size fee: </span>
              <strong>{formatAmount(sizeModFee, currency)}</strong>
            </>
          )}
        </div>

        {/* Options */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:gap-4 gap-4">
            {hasColor && (
              <div className="flex-1">
                <label className="block text-sm text-gray-700 mb-1">Color</label>
                <Select value={selectedColor} onValueChange={setSelectedColor} aria-label="Select color">
                  <SelectTrigger>
                    <SelectValue placeholder="Select color" />
                  </SelectTrigger>
                  <SelectContent>
                    {colors.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {hasSize && (
              <div className="flex-1">
                <label className="block text-sm text-gray-700 mb-1">Size</label>
                <Select
                  value={selectedSize}
                  onValueChange={setSelectedSize}
                  disabled={customSizeEnabled || (hasColor && !selectedColor)}
                  aria-label="Select size"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSizes.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {enableSizeMod && (
              <div className="flex-1 flex flex-col justify-end">
                <label className="block text-sm text-gray-700 mb-1">Custom Size Mods</label>
                <Switch
                  checked={customSizeEnabled}
                  onCheckedChange={(v) => {
                    setCustomSizeEnabled(v);
                    if (!v) setCustomMods({});
                  }}
                  aria-label="Toggle custom size modifications"
                />
              </div>
            )}
          </div>

          {enableSizeMod && customSizeEnabled && (
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <PencilRuler className="h-4 w-4" />
                Enter custom measurements (inches)
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CUSTOM_SIZE_FIELDS.map((f) => (
                  <div key={f.name} className="space-y-1.5">
                    <label className="block text-xs text-gray-600">{f.label}</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      placeholder="e.g. 36.5"
                      value={customMods[f.name] ?? ""}
                      onChange={(e) =>
                        setCustomMods((m) => ({
                          ...m,
                          [f.name]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Provide any that apply — leave others blank. A 5% tailoring fee is added automatically.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="block text-sm text-gray-700">Quantity</label>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              -
            </Button>
            <span className="w-6 text-center">{quantity}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setQuantity((q) => Math.min(q + 1, inStock))}
              disabled={quantity >= inStock}
              aria-label="Increase quantity"
            >
              +
            </Button>
            <span className="ml-2 text-xs text-gray-500">{inStock} left</span>
          </div>
        </div>

        {/* CTAs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            className="bg-gradient-to-r from-brand to-green-700"
            onClick={handleBuyNow}
            disabled={outOfStock}
          >
            <Tag className="mr-2" /> Buy Now
          </Button>
          <Button variant="outline" onClick={handleAddToCart} disabled={outOfStock}>
            <BsBag className="mr-2" /> Add to Cart
          </Button>
        </div>

        {/* Wishlist */}
        {user && user.role === "customer" && (
          <Button
            variant={isWishlisted ? "outline" : "secondary"}
            className={`mt-3 w-full ${isWishlisted ? "text-red-500" : ""}`}
            onClick={toggleWishlist}
            disabled={wishLoading}
          >
            <Heart className={isWishlisted ? "text-red-500" : ""} />{" "}
            {isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
          </Button>
        )}
      </div>

      {isVideoOpen && product.videoUrl && (
        <VideoModal onClose={() => setIsVideoOpen(false)} videoUrl={product.videoUrl} />
      )}
    </section>
  );
};

export default ProductDetailHero;
