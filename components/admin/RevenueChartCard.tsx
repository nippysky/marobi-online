"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { RevenueSeries } from "./AdminDashboardClient";

type Filter = "Day" | "Month" | "6 Months" | "Year";

interface Props {
  serverSeries: RevenueSeries;
}

export default function RevenueChartCard({ serverSeries }: Props) {
  const [filter, setFilter] = useState<Filter>("Month");
  const data = useMemo(() => serverSeries[filter] || [], [filter, serverSeries]);

  const hasData = data.some(d => d.value > 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={filter} onValueChange={v => setFilter(v as Filter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Range" />
          </SelectTrigger>
            <SelectContent>
            {(Object.keys(serverSeries) as Filter[]).map(k => (
              <SelectItem key={k} value={k}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data.length === 0 || !hasData ? (
        <div className="h-[250px] flex items-center justify-center text-sm text-gray-500 border rounded">
          No revenue data yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid stroke="#f0f0f0" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip
              formatter={val => `₦${Number(val).toLocaleString()}`}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#043927"
              dot
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
