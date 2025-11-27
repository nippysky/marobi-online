"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useMemo,
} from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";

// ——— Types —————————————————————————————————————
export interface OrderItem {
  id: string;
  name: string;
  image: string | null;
  category: string;
  quantity: number;
  lineTotal: number;
  color: string;
  size: string;
}

export interface Order {
  id: string;
  status: string;
  currency: string;
  totalAmount: number;
  totalNGN: number;
  paymentMethod: string;
  createdAt: string;
  items: OrderItem[];
}

export interface UserProfile {
  // for customers
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  deliveryAddress: string;
  billingAddress: string;
  registeredAt: string;
  lastLogin: string | null;
  orders: Order[];
  // **and** for staff we’ll select in the endpoint above:
  address?: string;
  emailPersonal?: string;
  jobRoles?: string[];
  access?: string;
  dateOfBirth?: string;
  dateOfEmployment?: string;
}

export interface UserContextValue {
  user?: UserProfile;
  isLoading: boolean;
  error?: any;
  refresh: () => void;
}

// ——— Context setup —————————————————————————————————

const UserContext = createContext<UserContextValue>({
  isLoading: true,
  refresh: () => {},
});

// ——— fetcher with debug logging —————————————————————

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    console.error("🚨 fetcher error", res.status, error);
    throw new Error(error || res.statusText);
  }
  const json = await res.json();
  return json;
};

// ——— Provider component ——————————————————————————

export function UserProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  // only once we’re fully signed in
  const isAuth = status === "authenticated" && !!session?.user?.email;
  const role   = session?.user?.role;

  // build the absolute URL once
  const meApiUrl = useMemo(() => {
    if (typeof window === "undefined" || !isAuth) return null;
    const origin = window.location.origin;
    return role === "customer"
      ? `${origin}/api/auth/me`
      : `${origin}/api/admin/me`;
  }, [role, isAuth]);

  const { data, error, mutate, isValidating } = useSWR<UserProfile>(
    meApiUrl,
    fetcher
  );

  // clear on sign out
  useEffect(() => {
    if (status === "unauthenticated") {
      mutate(undefined, false);
    }
  }, [status, mutate]);

  return (
    <UserContext.Provider
      value={{
        user: data,
        isLoading: status === "loading" || isValidating,
        error,
        refresh: () => mutate(),
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
