// lib/store/cartStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product } from "@/lib/products";

/**
 * A single item in the cart: wraps a Product plus the desired quantity,
 * as well as the specific color and size the user chose.
 * Optionally, customMods for size modifications, plus hasSizeMod and the fee.
 * Also includes per-unit weight so total weight can be derived.
 */
export interface CartItem {
  product: Product;
  quantity: number;
  color: string;
  size: string;
  price: number;
  hasSizeMod: boolean;
  sizeModFee: number;
  customMods?: Record<string, string | number>;
  unitWeight?: number; // kg per single unit, optional for backwards compatibility
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
  totalItems: () => number; // sum of quantities
  totalDistinctItems: () => number; // number of unique entries
  totalAmount: () => number;
  totalWeight: () => number; // aggregated weight (kg)
}

// deep equality for customMods
function areCustomModsEqual(
  a?: Record<string, string | number>,
  b?: Record<string, string | number>
) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

// stock helper: supports both inStock and stock shapes
function getVariantStock(product: Product, color: string, size: string) {
  const variant = product.variants.find(
    (v: any) => v.color === color && v.size === size
  ) as any | undefined;
  if (!variant) return 0;
  if (typeof variant.inStock === "number") return variant.inStock;
  if (typeof variant.stock === "number") return variant.stock;
  return 0;
}

export const useCartStore = create<CartStoreState>()(
  persist(
    (set, get) => ({
      items: [],

      addToCart: (item) => {
        const {
          product,
          color,
          size,
          quantity,
          price,
          hasSizeMod,
          customMods,
          sizeModFee,
          unitWeight = 0,
        } = item;
        const items = get().items;
        const maxStock = getVariantStock(product, color, size);

        if (maxStock <= 0) {
          // out of stock; ignore
          return;
        }

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
            set({
              items: items.filter((_, i) => i !== idx),
            });
          } else {
            const updated = [
              ...items.slice(0, idx),
              { ...existing, quantity: newQty },
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

      updateQuantity: (
        productId,
        color,
        size,
        newQty,
        customMods,
        hasSizeMod
      ) => {
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

      totalItems: () =>
        get().items.reduce((sum, it) => sum + it.quantity, 0), // sum quantities

      totalDistinctItems: () => get().items.length, // unique entries

      totalAmount: () =>
        get().items.reduce(
          (sum, { price, quantity }) => sum + price * quantity,
          0
        ),

      totalWeight: () =>
        get()
          .items.reduce(
            (sum, { unitWeight = 0, quantity }) => sum + unitWeight * quantity,
            0
          ),
    }),
    {
      name: "cart",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
