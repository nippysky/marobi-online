import { useState } from "react";

// --- Types for frontend (must match your API/order requirements)
export interface CustomModsPayload {
  chest?: number | string;
  waist?: number | string;
  hip?: number | string;
  length?: number | string;
  // allow any extra custom fields you may add later
  [key: string]: number | string | undefined;
}

export interface CartItemPayload {
  productId: string;
  color?: string;
  size?: string;
  quantity: number;
  hasSizeMod?: boolean;
  sizeModFee?: number;
  unitWeight?: number;
  /** <-- ADDED: will be read as customMods/customSize by the API */
  customMods?: CustomModsPayload;
  /** optional alias if you ever want to send this key instead */
  customSize?: CustomModsPayload;
}

export interface CustomerPayload {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  deliveryAddress: string;
  billingAddress: string;
  country?: string;
  state?: string;
}

export interface CreateOrderPayload {
  items: CartItemPayload[];
  customer: CustomerPayload;
  paymentMethod: string;
  currency: string;
  deliveryFee: number;
  timestamp: string;
  deliveryOptionId?: string;
  paymentReference: string;
  /**
   * Total that Paystack was charged in NGN (major units),
   * same value the UI shows as "≈ ₦X via Paystack".
   */
  totalInNaira?: number;
  // shipping is accepted by the backend; left as any to avoid tight coupling
  // with the Shipbubble types in the API route.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shipping?: any;
}

export function useCheckout() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<any>(null);
  const [result, setResult] = useState<any>(null);

  const createOrder = async (payload: CreateOrderPayload) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/orders/online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data);
        return null;
      }
      setResult(data);
      return data;
    } catch (e: any) {
      setError({ error: e.message });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setError(null);
    setResult(null);
    setIsProcessing(false);
  };

  return { isProcessing, error, result, createOrder, reset };
}
