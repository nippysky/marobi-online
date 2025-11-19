"use client";

import React from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export interface OrderRow {
  id: string;
  createdAt: string;
  status: string;
  currency: string;
  totalAmount: number;
}

export default function OrdersTable({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg shadow-lg bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="px-6 py-3">Date</TableHead>
            <TableHead className="px-6 py-3 min-w-[200px]">Order ID</TableHead>
            <TableHead className="px-6 py-3">Status</TableHead>
            <TableHead className="px-6 py-3 text-right min-w-[120px]">Total</TableHead>
            <TableHead className="px-6 py-3 min-w-[130px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id} className="hover:bg-gray-100 transition-colors">
              <TableCell className="px-6 py-3">
                {new Date(o.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="px-6 py-3 font-mono text-sm whitespace-nowrap">
                {o.id}
              </TableCell>
              <TableCell className="px-6 py-3">
                <Badge
                  variant={
                    o.status === "Delivered"
                      ? "default"
                      : o.status === "Processing"
                      ? "outline"
                      : "destructive"
                  }
                >
                  {o.status}
                </Badge>
              </TableCell>
              <TableCell className="px-6 py-3 text-right">
                {o.currency} {o.totalAmount.toFixed(2)}
              </TableCell>
              <TableCell className="px-6 py-3">
                <Link href={`/account/orders/${o.id}`}>
                  <Button size="sm" variant="ghost">
                    View Details
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
