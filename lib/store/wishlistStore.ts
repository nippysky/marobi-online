
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product } from "@/lib/products";

interface WishlistStoreState {
  items: Product[];

  // Add a product if not already in wishlist
  addToWishlist: (product: Product) => void;

  // Remove a product by ID
  removeFromWishlist: (productId: string) => void;

  // Clear entire wishlist
  clearWishlist: () => void;

  // Check if a product is already wishlisted
  isWishlisted: (productId: string) => boolean;
}

export const useWishlistStore = create<WishlistStoreState>()(
  persist<WishlistStoreState>(
    (set, get) => ({
      items: [],

      addToWishlist: (product: Product) => {
        const items = get().items;
        if (!items.find((p) => p.id === product.id)) {
          set({ items: [...items, product] });
        }
      },

      removeFromWishlist: (productId: string) => {
        const items = get().items;
        set({ items: items.filter((p) => p.id !== productId) });
      },

      clearWishlist: () => {
        set({ items: [] });
      },

      isWishlisted: (productId: string) => {
        return get().items.some((p) => p.id === productId);
      },
    }),
    {
      name: "wishlist", // localStorage key
      storage: createJSONStorage(() => localStorage),
    }
  )
);
