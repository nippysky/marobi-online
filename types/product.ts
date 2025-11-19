export type ProductStatus = "Draft" | "Published" | "Archived";

export type ProductPayload = {
  id?: string;
  name: string;
  category: string;
  description: string;
  images: string[];
  price: {
    NGN: string | number;
    USD: string | number;
    EUR: string | number;
    GBP: string | number;
  };
  status: "Draft" | "Published" | "Archived";
  sizeMods: boolean;
  colors: string[];
  sizeStocks: Record<string, string>;
  customSizes: string[];
  videoUrl?: string | null;
  weight: number;
};
