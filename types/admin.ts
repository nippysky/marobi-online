export interface AdminCustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  lastLogin: string | null;
  registeredAt: string;
}

export interface AdminCustomerOrderProduct {
  id: string;
  name: string;
  image: string;
  category: string;
  color: string;
  size: string;
  quantity: number;
  lineTotal: number;
}

export interface AdminCustomerOrder {
  id: string;
  status: "Processing" | "Shipped" | "Delivered" | "Cancelled";
  currency: "NGN" | "USD" | "EUR" | "GBP";
  totalAmount: number;
  totalNGN: number;
  createdAt: string;
  paymentMethod: string;
  products: AdminCustomerOrderProduct[];

  /** Populated if this order belongs to a registered customer */
  customer?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
  };

  /** Populated for one-off guest checkouts (never persisted to Customer table) */
  guestInfo?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    country?: string;
    state?: string;
  };
}
