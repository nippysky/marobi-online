"use client";

import React, { useState } from "react";
import { v4 as uuid } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import BackButton from "@/components/BackButton";

interface Row {
  id: string;
  order: number;
  bodySize: string;
  productSize: string;
  code: string;
}

interface Chart {
  id: string;
  name?: string;
  rows: Row[];
}

export default function SizeChartManager({ initialChart }: { initialChart: Chart }) {
  const [rows, setRows] = useState<Row[]>(
    (initialChart.rows || []).map((r, i) => ({ ...r, order: r.order ?? i }))
  );
  const [isSaving, setIsSaving] = useState(false);

  const addRow = () =>
    setRows((p) => [...p, { id: uuid(), order: p.length, bodySize: "", productSize: "", code: "" }]);

  const removeRow = (i: number) =>
    setRows((p) => p.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, order: idx })));

  const updateRow = (i: number, field: keyof Row, val: string) =>
    setRows((p) =>
      p.map((r, idx) =>
        idx === i ? { ...r, [field]: field === "order" ? Number(val) : val } : r
      )
    );

  const allValid = rows.length > 0 && rows.every((r) => r.bodySize.trim() && r.productSize.trim() && r.code.trim());

  async function saveChart() {
    if (!allValid || isSaving) return;
    setIsSaving(true);
    const toastId = toast.loading("Saving size chart...");
    try {
      const res = await fetch("/api/store-settings/size-chart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: initialChart.id,
          rows: rows.map((r, i) => ({ ...r, order: i })),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Size chart saved", { id: toastId });
    } catch {
      toast.error("Failed to save size chart", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <BackButton />

      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="mb-4">No size chart rows.</p>
          <Button variant="outline" onClick={addRow} className="border-gray-300 text-gray-800 hover:border-brand hover:text-brand">
            <Plus className="mr-2 h-4 w-4" />
            Add First Row
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  {["s/n", "Body Size", "Product Size", "Code", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-2 w-16 text-sm text-gray-800">{i + 1}</td>
                    <td className="px-4 py-2">
                      <Input
                        value={r.bodySize}
                        placeholder="UK size 6, 8 and 10"
                        onChange={(e) => updateRow(i, "bodySize", e.target.value)}
                        className="w-full border-gray-300 focus:border-brand focus:ring-brand"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={r.productSize}
                        placeholder="Small / Medium / Regular / Biggie"
                        onChange={(e) => updateRow(i, "productSize", e.target.value)}
                        className="w-full border-gray-300 focus:border-brand focus:ring-brand"
                      />
                    </td>
                    <td className="px-4 py-2 w-40">
                      <Input
                        value={r.code}
                        placeholder="S / M / L / XL / R / B"
                        onChange={(e) => updateRow(i, "code", e.target.value)}
                        className="w-full border-gray-300 focus:border-brand focus:ring-brand"
                      />
                    </td>
                    <td className="px-4 py-2 text-center w-20">
                      <Button variant="ghost" size="icon" className="text-red-600 hover:text-brand" onClick={() => removeRow(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              className="border-gray-300 text-gray-800 hover:border-brand hover:text-brand"
              onClick={addRow}
              disabled={isSaving}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Row
            </Button>

            <Button
              onClick={saveChart}
              disabled={!allValid || isSaving}
              className="bg-brand text-white hover:bg-brand/90 disabled:opacity-50 flex items-center"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : (
                "Save Size Chart"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
