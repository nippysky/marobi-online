// app/admin/order-inventory/OrderInventoryClient.tsx
"use client";

import React from "react";
import LogOfflineSaleButton from "@/components/admin/LogOfflineSaleButton";
import type { OrderRow } from "@/types/orders";
import OrderTable from "@/components/admin/OrderTable";

interface Props {
  data: OrderRow[];
}

export default function OrderInventoryClient({ data }: Props) {
  return (
    <div className="py-6 px-3">
      <div className="flex justify-end mb-10 space-x-2">
        <LogOfflineSaleButton />
      </div>
      <OrderTable
        data={data}
        pageSize={50}
        showSearch={true}
        showExport={true}
        showPagination={true}
      />
    </div>
  );
}
