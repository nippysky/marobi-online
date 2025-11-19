"use client";

import React from "react";
import Image from "next/image";
import { formatAmount } from "@/lib/formatCurrency";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Truck } from "lucide-react";
import type {
  Currency,
  OrderStatus,
  OrderChannel,
} from "@/lib/generated/prisma-client";

export interface OrderDetailProps {
  order: {
    id: string;
    createdAt: string;
    status: OrderStatus;
    channel: OrderChannel;
    currency: Currency;
    paymentMethod: string;
    deliveryAddress: string;
    billingAddress: string;
    items: {
      id: string;
      name: string;
      image: string;
      category: string;
      color: string;
      size: string;
      quantity: number;
      lineTotal: number;
      hasSizeMod: boolean;
      sizeModFee: number;
    }[];
    deliveryFee: number;
  };
}

export default function OrderDetail({ order }: OrderDetailProps) {
  const {
    id,
    createdAt,
    status,
    channel,
    currency,
    paymentMethod,
    deliveryAddress,
    billingAddress,
    items,
    deliveryFee,
  } = order;

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const modTotal = items.reduce((sum, i) => sum + i.sizeModFee * i.quantity, 0);
  const total = subtotal + modTotal + deliveryFee;

  // map status to badge variant
  const badgeVariant: "default" | "outline" | "secondary" =
    status === "Delivered"
      ? "default"
      : status === "Processing"
      ? "outline"
      : status === "Cancelled"
      ? "secondary"
      : "secondary"; // fallback for unexpected

  return (
    <div className="space-y-6">
      {/* ─── Header ───────────────────────────────────── */}
      <Card className="bg-gradient-to-r from-green-50 to-white">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <CardTitle className="text-xl">
            Order <span className="font-mono">{id}</span>
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span>{new Date(createdAt).toLocaleString()}</span>
            <Badge variant={badgeVariant}>{status}</Badge>
            {channel === "OFFLINE" && (
              <Truck
                aria-label="Offline sale"
                role="img"
                className="w-5 h-5 text-gray-500"
              />
            )}
          </div>
        </CardHeader>
      </Card>

      {/* ─── Items List ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-64">
            <ul className="divide-y">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 p-4">
                  <div className="w-16 h-16 relative flex-shrink-0">
                    {i.image ? (
                      <Image
                        src={i.image}
                        fill
                        alt={i.name}
                        className="object-cover rounded"
                      />
                    ) : (
                      <div className="bg-gray-200 w-full h-full rounded" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-gray-900">{i.name}</p>
                    <p className="text-xs text-gray-500">
                      {i.category} · {i.color}, {i.size}
                    </p>
                    {i.hasSizeMod && (
                      <p className="text-xs text-yellow-600">
                        +5% custom-size fee
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-medium">
                      {currency} {formatAmount(i.lineTotal, currency)}
                    </p>
                    <p className="text-xs text-gray-500">× {i.quantity}</p>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ─── Summary & Addresses ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Items Subtotal:</span>
              <span>
                {currency} {formatAmount(subtotal, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Size Mod Fees:</span>
              <span>
                {currency} {formatAmount(modTotal, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Delivery:</span>
              <span>
                {currency} {formatAmount(deliveryFee, currency)}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-lg pt-2 border-t">
              <span>Total:</span>
              <span>
                {currency} {formatAmount(total, currency)}
              </span>
            </div>
            <p className="mt-4 text-sm text-gray-700">
              Payment Method: <strong>{paymentMethod}</strong>
            </p>
          </CardContent>
        </Card>

        {/* Shipping & Billing */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping & Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium">Shipping Address</h4>
              <p className="text-gray-700">{deliveryAddress}</p>
            </div>
            <div>
              <h4 className="font-medium">Billing Address</h4>
              <p className="text-gray-700">{billingAddress}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
