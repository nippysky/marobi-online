"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2, TrashIcon, Plus, Minus } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCartStore, CartItem } from "@/lib/store/cartStore";
import { BsBag } from "react-icons/bs";
import { useCurrency } from "@/lib/context/currencyContext";
import type { Currency } from "@/lib/context/currencyContext";
import { formatAmount } from "@/lib/formatCurrency";
import { useRouter } from "next/navigation";
import clsx from "clsx";

/** Nice labels for the common custom fields */
const CUSTOM_LABELS: Record<string, string> = {
  chest: "Chest/Bust",
  waist: "Waist",
  hip: "Hip",
  length: "Length",
};

export function CartSheet({ tone = "dark" }: { tone?: "light" | "dark" }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const items = useCartStore((s) => s.items) as CartItem[];
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalAmount = useCartStore((s) => s.totalAmount());
  const distinctCount = useCartStore((s) => s.totalDistinctItems());

  const { currency } = useCurrency();
  const currencyCode = currency as Currency;

  const formattedTotal = formatAmount(totalAmount, currencyCode);

  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({});
  const setPending = useCallback((key: string, v: boolean) => {
    setPendingMap((prev) => ({ ...prev, [key]: v }));
  }, []);

  const handleDecrease = useCallback(
    (item: CartItem, _stock: number, key: string) => {
      updateQuantity(
        item.product.id,
        item.color,
        item.size,
        item.quantity - 1,
        item.customMods,
        item.hasSizeMod
      );
      setPending(key, true);
      setTimeout(() => setPending(key, false), 250);
    },
    [updateQuantity, setPending]
  );

  const handleIncrease = useCallback(
    (item: CartItem, _stock: number, key: string) => {
      updateQuantity(
        item.product.id,
        item.color,
        item.size,
        item.quantity + 1,
        item.customMods,
        item.hasSizeMod
      );
      setPending(key, true);
      setTimeout(() => setPending(key, false), 250);
    },
    [updateQuantity, setPending]
  );

  const triggerClass =
    tone === "light"
      ? "relative p-2 text-white hover:text-white/90"
      : "relative p-2 text-gray-600 hover:text-gray-800";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className={triggerClass} aria-label="Open cart">
          <BsBag className="w-5 h-5" />
          {mounted && distinctCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-brand text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {distinctCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full md:w-[400px] max-w-full flex flex-col">
        <SheetHeader>
          <SheetTitle>Your Cart</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <EmptyCart />
        ) : (
          <CartBody
            items={items}
            removeFromCart={removeFromCart}
            updateQuantity={updateQuantity}
            clearCart={clearCart}
            formattedTotal={formattedTotal}
            currency={currencyCode}
            setPending={setPending}
            pendingMap={pendingMap}
            routerPush={(url) => router.push(url)}
            onDecrease={handleDecrease}
            onIncrease={handleIncrease}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function EmptyCart() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center bg-gray-50">
      <BsBag className="w-16 h-16 mb-4 text-gray-300" />
      <h2 className="text-lg font-semibold text-gray-700 mb-2">Your cart is empty</h2>
      <p className="text-sm text-gray-500 mb-6">
        Browse our products and add items to your cart.
      </p>
      <Link href="/all-products" className="w-full max-w-xs">
        <Button className="w-full">Start Shopping</Button>
      </Link>
    </div>
  );
}

/** Extracted body to keep the top readable; logic unchanged except for custom-size rendering */
function CartBody({
  items,
  removeFromCart,
  updateQuantity,
  clearCart,
  formattedTotal,
  currency,
  setPending,
  pendingMap,
  routerPush,
  onDecrease,
  onIncrease,
}: {
  items: CartItem[];
  removeFromCart: any;
  updateQuantity: any;
  clearCart: any;
  formattedTotal: string;
  currency: Currency;
  setPending: (k: string, v: boolean) => void;
  pendingMap: Record<string, boolean>;
  routerPush: (url: string) => void;
  onDecrease: (item: CartItem, stock: number, key: string) => void;
  onIncrease: (item: CartItem, stock: number, key: string) => void;
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4">
        {items.map((item, idx) => {
          const {
            product,
            quantity,
            color,
            size,
            customMods,
            price,
            hasSizeMod,
            sizeModFee,
            unitWeight = 0,
          } = item;

          const formattedUnit = formatAmount(price, currency);
          const variant = product.variants.find(
            (v: any) => v.color === color && v.size === size
          ) as any | undefined;

          const stock =
            variant && typeof variant.inStock === "number"
              ? variant.inStock
              : variant && typeof (variant as any).stock === "number"
              ? (variant as any).stock
              : Infinity;

          const key = `${product.id}-${color}-${size}-${idx}`;
          const isPending = Boolean(pendingMap[key]);

          const lineWeight = Number.isFinite(unitWeight)
            ? parseFloat((unitWeight * quantity).toFixed(3))
            : 0;

          // If size-mod is on, show "Custom" instead of the standard size
          const sizeLabel = hasSizeMod ? "Custom" : size;

          // Prepare compact list of entered custom measurements
          const pairs =
            hasSizeMod && customMods
              ? Object.entries(customMods).filter(([_, v]) => String(v ?? "").trim() !== "")
              : [];

          const renderLabel = (k: string) => CUSTOM_LABELS[k] ?? k.replace(/^\w/, (c) => c.toUpperCase());

          return (
            <div key={key} className="py-4" aria-busy={isPending}>
              <div className="flex items-start gap-3">
                <Link
                  href={`/product/${product.id}`}
                  className="w-16 h-16 relative flex-shrink-0 rounded overflow-hidden bg-gray-100"
                >
                  {product.images[0] && (
                    <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
                  )}
                </Link>

                <div className="flex-1">
                  <Link
                    href={`/product/${product.id}`}
                    className="text-sm font-medium text-gray-900 hover:underline"
                    title={product.name}
                  >
                    {product.name}
                  </Link>

                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-600">{formattedUnit} each</span>

                    <QuantityControl
                      item={item}
                      stock={stock}
                      isPending={isPending}
                      setPending={setPending}
                      updateQuantity={updateQuantity}
                      keyId={key}
                      onDecrease={onDecrease}
                      onIncrease={onIncrease}
                    />
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    Color: <span className="font-medium">{color}</span> | Size:{" "}
                    <span className="font-medium">{sizeLabel}</span>
                  </div>

                  {hasSizeMod && (
                    <>
                      <div className="text-xs text-yellow-700 mt-1">
                        +5% size-mod fee:{" "}
                        <span className="font-medium">
                          {formatAmount(sizeModFee, currency)}
                        </span>
                      </div>

                      {pairs.length > 0 && (
                        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                          <div className="text-[11px] font-semibold text-amber-900 mb-1">
                            Custom measurements
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-amber-900">
                            {pairs.map(([k, v]) => (
                              <div key={k} className="flex items-center justify-between">
                                <span className="opacity-75">{renderLabel(k)}:</span>
                                <span className="font-medium">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* optional: show weights */}
                  <div className="mt-1 text-xs text-gray-600">
                    <div>
                      Unit weight: {Number.isFinite(unitWeight) ? unitWeight.toFixed(3) : "0.000"}kg
                    </div>
                    <div>Total weight: {lineWeight.toFixed(3)}kg</div>
                  </div>
                </div>

                <button
                  onClick={() => removeFromCart(product.id, color, size, customMods, hasSizeMod)}
                  className="ml-2 p-1 text-red-500 hover:text-red-700"
                  aria-label="Remove item"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>

              {idx < items.length - 1 && <hr className="mt-4 border-gray-200" />}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 left-0 p-4 border-t border-gray-200 bg-white">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-semibold text-gray-900">Total:</span>
          <span className="text-lg font-bold text-gray-900">{formattedTotal}</span>
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            variant="ghost"
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
            onClick={clearCart}
            aria-label="Clear all cart"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
          <Button className="flex-1" onClick={() => routerPush("/checkout")}>
            Proceed
          </Button>
        </div>
      </div>
    </>
  );
}

function QuantityControl({
  item,
  stock,
  isPending,
  setPending,
  updateQuantity,
  keyId,
  onDecrease,
  onIncrease,
}: {
  item: CartItem;
  stock: number;
  isPending: boolean;
  setPending: (k: string, v: boolean) => void;
  updateQuantity: any;
  keyId: string;
  onDecrease: (item: CartItem, stock: number, key: string) => void;
  onIncrease: (item: CartItem, stock: number, key: string) => void;
}) {
  const { quantity } = item;

  return (
    <div className="flex items-center space-x-1">
      <Button
        size="icon"
        variant="outline"
        onClick={() => onDecrease(item, stock, keyId)}
        disabled={isPending}
        aria-label="Decrease quantity"
      >
        <Minus className="w-4 h-4" />
      </Button>

      <div className="relative w-8 flex justify-center">
        <span className={clsx("text-sm font-medium w-full text-center", isPending && "opacity-50")}>
          {quantity}
        </span>
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 animate-spin border border-gray-300 border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      <Button
        size="icon"
        variant="outline"
        onClick={() => onIncrease(item, stock, keyId)}
        disabled={quantity >= stock || isPending}
        aria-label="Increase quantity"
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}
