// lib/store/cartStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product } from "@/lib/products";

export type Currency = "NGN" | "USD" | "EUR" | "GBP";

export interface CartItem {
  product: Product;
  quantity: number;
  color: string;
  size: string;
  price: number;                 // price *in the item's own currency* when added
  currency?: Currency;           // <— NEW, optional for backward compatibility
  hasSizeMod: boolean;
  sizeModFee: number;
  customMods?: Record<string, string | number>;
  unitWeight?: number;
}

interface CartStoreState {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (
    productId: string,
    color: string,
    size: string,
    customMods?: Record<string, string | number>,
    hasSizeMod?: boolean
  ) => void;
  updateQuantity: (
    productId: string,
    color: string,
    size: string,
    newQty: number,
    customMods?: Record<string, string | number>,
    hasSizeMod?: boolean
  ) => void;
  clearCart: () => void;
  clear: () => void;
  totalItems: () => number;
  totalDistinctItems: () => number;
  totalAmount: () => number;
  totalWeight: () => number;
}

function areCustomModsEqual(
  a?: Record<string, string | number>,
  b?: Record<string, string | number>
) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

function getVariantStock(product: Product, color: string, size: string) {
  const v = product.variants.find((vv: any) => vv.color === color && vv.size === size) as any | undefined;
  if (!v) return 0;
  if (typeof v.inStock === "number") return v.inStock;
  if (typeof v.stock === "number") return v.stock;
  return 0;
}

function ensureCurrency(items: CartItem[]): CartItem[] {
  return (items || []).map((ci) => ({ ...ci, currency: ci.currency || "NGN" }));
}

export const useCartStore = create<CartStoreState>()(
  persist(
    (set, get) => ({
      items: [],

      addToCart: (item) => {
        const { product, color, size, quantity, price, hasSizeMod, customMods,
                sizeModFee, unitWeight = 0, currency } = item;

        const items = get().items;
        const maxStock = getVariantStock(product, color, size);
        if (maxStock <= 0) return;

        const idx = items.findIndex(
          (ci) =>
            ci.product.id === product.id &&
            ci.color === color &&
            ci.size === size &&
            ci.hasSizeMod === hasSizeMod &&
            areCustomModsEqual(ci.customMods, customMods)
        );

        if (idx !== -1) {
          const existing = items[idx];
          const newQty = Math.min(existing.quantity + quantity, maxStock);
          if (newQty <= 0) {
            set({ items: items.filter((_, i) => i !== idx) });
          } else {
            const updated = [
              ...items.slice(0, idx),
              { ...existing, quantity: newQty, currency: existing.currency || currency || "NGN" },
              ...items.slice(idx + 1),
            ];
            set({ items: updated });
          }
        } else {
          const initialQty = Math.min(quantity, maxStock);
          if (initialQty <= 0) return;
          set({
            items: [
              ...items,
              {
                product,
                quantity: initialQty,
                color,
                size,
                price,
                hasSizeMod,
                sizeModFee,
                customMods,
                unitWeight,
                currency: currency || "NGN",
              },
            ],
          });
        }
      },

      removeFromCart: (productId, color, size, customMods, hasSizeMod) => {
        const items = get().items;
        set({
          items: items.filter(
            (ci) =>
              !(
                ci.product.id === productId &&
                ci.color === color &&
                ci.size === size &&
                ci.hasSizeMod === Boolean(hasSizeMod) &&
                areCustomModsEqual(ci.customMods, customMods)
              )
          ),
        });
      },

      updateQuantity: (productId, color, size, newQty, customMods, hasSizeMod) => {
        const items = get().items;
        const idx = items.findIndex(
          (ci) =>
            ci.product.id === productId &&
            ci.color === color &&
            ci.size === size &&
            ci.hasSizeMod === Boolean(hasSizeMod) &&
            areCustomModsEqual(ci.customMods, customMods)
        );
        if (idx === -1) return;

        const productInCart = items[idx].product;
        const maxStock = getVariantStock(productInCart, color, size);
        const cappedQty = Math.min(Math.max(newQty, 0), maxStock);

        if (cappedQty <= 0) {
          set({
            items: items.filter(
              (ci) =>
                !(
                  ci.product.id === productId &&
                  ci.color === color &&
                  ci.size === size &&
                  ci.hasSizeMod === Boolean(hasSizeMod) &&
                  areCustomModsEqual(ci.customMods, customMods)
                )
            ),
          });
        } else {
          const updated = [
            ...items.slice(0, idx),
            { ...items[idx], quantity: cappedQty },
            ...items.slice(idx + 1),
          ];
          set({ items: updated });
        }
      },

      clearCart: () => set({ items: [] }),
      clear: () => set({ items: [] }),

      totalItems: () => get().items.reduce((s, it) => s + it.quantity, 0),
      totalDistinctItems: () => get().items.length,

      // totalAmount stays numeric in item currency units; don't use this for display
      totalAmount: () => get().items.reduce((s, { price, quantity }) => s + price * quantity, 0),

      totalWeight: () =>
        get().items.reduce((s, { unitWeight = 0, quantity }) => s + unitWeight * quantity, 0),
    }),
    {
      name: "cart",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persisted: any, fromVersion: number) => {
        if (!persisted) return persisted;
        if (fromVersion < 2 && Array.isArray(persisted.items)) {
          return { ...persisted, items: ensureCurrency(persisted.items) };
        }
        return persisted;
      },
    }
  )
);
