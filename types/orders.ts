export type OrderChannel = "ONLINE" | "OFFLINE";

export type OrderRow = {
  id: string;
  status: "Processing" | "Shipped" | "Delivered" | "Cancelled";
  currency: "NGN" | "USD" | "EUR" | "GBP";
  totalAmount: number;
  totalNGN: number;
  paymentMethod: string;
  createdAt: string;

  products: Array<{
    id: string;
    name: string;
    image: string;
    category: string;
    color: string;
    size: string;
    quantity: number;
    lineTotal: number;
    priceNGN: number;
    hasSizeMod?: boolean;
    sizeModFee?: number;
    customSize?: Record<string, string> | null;
  }>;

  customer: {
    id: string | null;
    name: string;
    email: string;
    phone: string;
    address: string;
  };

  channel: OrderChannel;
  deliveryOption: {
    id: string;
    name: string;
    provider: string | null;
    type: "COURIER";
  } | null;
  deliveryFee: number | null;
  deliveryDetails: string | null;

  // 🔽 NEW fields for UI logic
  hasShipbubbleLabel?: boolean;
  shipbubbleOrderId?: string | null;
  shipbubbleTrackingUrl?: string | null;
};
