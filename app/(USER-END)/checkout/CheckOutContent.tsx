"use client";

import React from "react";
import { useCartStore } from "@/lib/store/cartStore";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import CheckoutSection from "./CheckOutSection";
import { CheckoutUser } from "./page";

interface Props {
  user: CheckoutUser | null;
}

export default function CheckoutContent({ user }: Props) {
  const items = useCartStore((s) => s.items); // no shallow to get latest

  if (!items || items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <ShoppingCart className="w-16 h-16 text-gray-400 dark:text-gray-600" />
        <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Your cart is empty
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Looks like you haven’t added anything to your cart yet.
        </p>
        <Link href="/">
          <Button className="mt-6">Start Shopping</Button>
        </Link>
      </div>
    );
  }

  return <CheckoutSection user={user} />;
}
