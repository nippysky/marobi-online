// types/product.ts

export type ProductStatus = "Draft" | "Published" | "Archived";

export type ProductPrice = {
  NGN: number;
  USD: number;
  EUR: number;
  GBP: number;
};

/**
 * Per-color, per-size stock map.
 * Example:
 * {
 *   Blue: { S: "10", M: "4" },
 *   Red:  { S: "3", L: "7" }
 * }
 */
export type ColorSizeStocks = Record<string, Record<string, string>>;

export interface ProductPayload {
  id?: string;
  name: string;
  category: string;
  description: string;
  price: ProductPrice;
  status: ProductStatus;
  sizeMods: boolean;
  colors: string[];
  /**
   * Global size stocks – used when the product has
   * no colors. When colors exist and colorSizeStocks
   * is provided, this is ignored by the API.
   */
  sizeStocks: Record<string, string>;
  customSizes: string[];
  images: string[];
  videoUrl: string | null;
  weight: number;
  /**
   * Optional per-color, per-size stock matrix.
   * When present and colors are defined, the API
   * uses this to create variants.
   */
  colorSizeStocks?: ColorSizeStocks;
}
