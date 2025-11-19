"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ChevronRight,
  Package,
  Users,
  DollarSign,
  Star,
  ShoppingBag,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Dynamically import RevenueChartCard
const RevenueChartCard = dynamic(
  () => import("@/components/admin/RevenueChartCard"),
  { ssr: false }
);

// Use the shared OrderTable utility component
import OrderTable from "@/components/admin/OrderTable";
import type { OrderRow } from "@/types/orders";

export type RevenueSeries = Record<
  "Day" | "Month" | "6 Months" | "Year",
  { label: string; value: number }[]
>;

interface Props {
  totalProducts: number;
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  top3: {
    id: string;
    name: string;
    sold: number;
    revenue: number;
    image: string;
    category?: string;
  }[];
  recentOrders: OrderRow[];
  revenueSeries: RevenueSeries;
}

export default function AdminDashboardClient({
  totalProducts,
  totalCustomers,
  totalOrders,
  totalRevenue,
  top3,
  recentOrders,
  revenueSeries,
}: Props) {
  const stats = [
    {
      label: "Total Products",
      value: totalProducts,
      href: "/admin/product-management",
      icon: <Package className="h-6 w-6" />,
      iconBg: "bg-indigo-100 text-indigo-700",
    },
    {
      label: "Total Customers",
      value: totalCustomers,
      href: "/admin/customers",
      icon: <Users className="h-6 w-6" />,
      iconBg: "bg-green-100 text-green-700",
    },
    {
      label: "Total Orders",
      value: totalOrders,
      href: "/admin/order-inventory",
      icon: <ShoppingBag className="h-6 w-6" />,
      iconBg: "bg-yellow-100 text-yellow-700",
    },
    {
      label: "Total Revenue",
      value: `₦${totalRevenue.toLocaleString()}`,
      href: null,
      icon: <DollarSign className="h-6 w-6" />,
      iconBg: "bg-pink-100 text-pink-700",
    },
  ];

  return (
    <div className="p-6 space-y-8 text-gray-800">
      <h1 className="text-3xl font-bold mb-4">Dashboard Overview</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((c) => {
          const content = (
            <>
              <CardHeader className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center space-x-3">
                  <div className={`${c.iconBg} p-2 rounded-md`}>{c.icon}</div>
                  <CardTitle className="text-sm font-medium">
                    {c.label}
                  </CardTitle>
                </div>
                {c.href && <ChevronRight className="h-4 w-4 text-gray-400" />}
              </CardHeader>
              <CardContent className="px-4 pb-4 text-3xl font-semibold">
                {c.value}
              </CardContent>
            </>
          );
          return c.href ? (
            <Card
              key={c.label}
              className="hover:shadow-lg transition bg-white overflow-hidden"
            >
              <Link href={c.href}>{content}</Link>
            </Card>
          ) : (
            <Card key={c.label} className="bg-white overflow-hidden">
              {content}
            </Card>
          );
        })}
      </div>

      {/* Revenue + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex justify-between items-center px-4 py-3">
            <CardTitle>Revenue</CardTitle>
            <ChevronRight className="h-4 w-4 text-gray-400 cursor-pointer" />
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <RevenueChartCard serverSeries={revenueSeries} />
          </CardContent>
        </Card>
        <Card className="bg-white shadow-md rounded-xl p-6 flex flex-col">
          <CardHeader className="flex items-center justify-between border-b px-0 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Star className="h-6 w-6 text-yellow-400" />
              <CardTitle className="text-lg font-semibold">
                Top Products
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex-1 px-0">
            {top3.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                No sales data yet.
              </div>
            ) : (
              <ul className="flex flex-col gap-6">
                {top3.map((prod, idx) => (
                  <li
                    key={`${prod.id}-${idx}`}
                    className="flex items-center justify-between hover:bg-gray-50 p-3 rounded-lg transition"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={prod.image || "/placeholder.png"}
                        alt={prod.name}
                        className="h-14 w-14 object-cover rounded-xl border border-gray-200 shadow"
                      />
                      <div>
                        <Link
                          href={`/admin/product-management/${encodeURIComponent(
                            prod.id
                          )}`}
                          className="font-semibold text-indigo-700 hover:underline"
                        >
                          {prod.name}
                        </Link>
                        <div className="text-xs text-gray-400 mt-1">
                          Sold: <span className="font-semibold">{prod.sold}</span>
                          {prod.category && (
                            <span className="ml-2">• {prod.category}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          Revenue:{" "}
                          <span className="font-semibold text-green-600">
                            ₦{prod.revenue.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        (location.href = `/admin/product-management/${encodeURIComponent(
                          prod.id
                        )}`)
                      }
                    >
                      View
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --- Recent Orders Table --- */}
      <Card>
        <CardHeader className="flex justify-between items-center px-4 py-3">
          <CardTitle>Recent Orders</CardTitle>
          <ChevronRight
            className="h-4 w-4 text-gray-400 cursor-pointer"
            onClick={() => (location.href = "/admin/order-inventory")}
          />
        </CardHeader>
        <CardContent className="pt-0 px-0 pb-4">
          {/* Utility OrderTable, show 5 orders, no search, no export, no pagination */}
          <OrderTable
            data={recentOrders}
            pageSize={5}
            showSearch={false}
            showExport={false}
            showPagination={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
