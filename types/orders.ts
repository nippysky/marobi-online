import { OrderStatus, Currency } from "@/lib/generated/prisma-client";

export type OrderChannel = "ONLINE" | "OFFLINE";

export interface DeliveryOptionShape {
  id: string;
  name: string;
  provider?: string | null;
  type: "COURIER" | "PICKUP";
}

export interface OrderProduct {
  id: string;
  name: string;
  image: string;
  category: string;
  color: string;
  size: string;
  quantity: number;
  lineTotal: number;
  priceNGN: number;
  hasSizeMod: boolean;
  sizeModFee: number;
  customSize?: Record<string, string> | null;
}

export interface OrderCustomer {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface OrderRow {
  id: string;
  status: OrderStatus;
  channel: OrderChannel;
  currency: Currency;
  totalAmount: number;
  totalNGN: number;
  paymentMethod: string;
  createdAt: string;
  products: OrderProduct[];
  customer: OrderCustomer;
  deliveryOption?: DeliveryOptionShape | null;
  deliveryFee?: number;
  deliveryDetails?: string | null;
}
