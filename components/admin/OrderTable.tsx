// components/admin/OrderTable.tsx
"use client";

import React, { useState, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import Link from "next/link";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ChevronUp,
  ChevronDown,
  Printer,
  Download,
  RefreshCcw,
  Eye,
  PackagePlus,
  PackageX,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import toast from "react-hot-toast";
import Papa from "papaparse";
import type { OrderRow } from "@/types/orders";
import { renderReceiptHTML } from "@/lib/receipt/html";

/* ========= Local enum mirrors (no Prisma on client) ========= */
type OrderStatus = "Processing" | "Shipped" | "Delivered" | "Cancelled";
type Currency = "NGN" | "USD" | "EUR" | "GBP";
type OrderChannel = "ONLINE" | "OFFLINE";

/* ========================= helpers ========================= */
function tryParseJSON<T = any>(s: unknown): T | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  try { return JSON.parse(t) as T; } catch { return null; }
}
function numToKgString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!isFinite(n)) return null;
  return /kg/i.test(s) ? s : `${n}kg`;
}
function extractWeightFromAny(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;
  return (
    numToKgString(
      obj.aggregatedWeight ??
      obj.weight ??
      obj.totalWeight ??
      obj.packageWeight ??
      obj.pkg_weight ??
      obj?.meta?.destination?.totalWeightKG ??
      obj?.meta?.destination?.weight ??
      obj?.raw?.totalWeight ??
      obj?.raw?.packageWeight
    ) ?? null
  );
}
function extractEtaFromAny(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;
  const eta =
    obj?.meta?.eta ??
    obj?.meta?.ETA ??
    obj?.meta?.raw?.delivery_eta ??
    obj?.raw?.delivery_eta ??
    obj?.delivery_eta ??
    obj?.eta;
  return eta ? String(eta) : null;
}
function extractCourierFromAny(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;
  const sb = obj.shipbubble ?? obj;
  const direct =
    sb?.courierName ??
    sb?.meta?.courierName ??
    sb?.meta?.raw?.courier_name ??
    sb?.raw?.courier_name ??
    sb?.courier_name ??
    sb?.provider ??
    sb?.name;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return null;
}
function humanizeOnClient(maybeJsonOrText: string | null | undefined): string {
  if (!maybeJsonOrText) return "—";
  if (maybeJsonOrText.includes("•")) return maybeJsonOrText;
  const trimmed = maybeJsonOrText.trim();
  if (!trimmed.startsWith("{") && trimmed.length <= 64) return trimmed;
  const obj = tryParseJSON<any>(maybeJsonOrText);
  if (obj) {
    const courier = extractCourierFromAny(obj) ?? "—";
    const weight = extractWeightFromAny(obj);
    const eta = extractEtaFromAny(obj);
    const parts: string[] = [courier];
    if (weight) parts.push(`Weight: ${weight}`);
    if (eta) parts.push(`ETA: ${eta}`);
    return parts.join(" • ");
  }
  return trimmed.length <= 64 ? trimmed : "—";
}
function stripLeadingName(humanized: string, name: string | undefined): string {
  if (!humanized || !name) return humanized;
  const parts = humanized.split("•").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return humanized;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  if (norm(parts[0]) === norm(name)) parts.shift();
  return parts.join(" • ");
}
function DisplayDeliveryDetails({ details, omitName }: { details: string | null | undefined; omitName?: string; }) {
  let human = humanizeOnClient(details);
  if (omitName) human = stripLeadingName(human, omitName);
  if (!human || human === "—") return <span>—</span>;
  if (human.includes("•")) {
    const parts = human.split("•").map((e) => e.trim()).filter(Boolean);
    return (
      <div className="space-y-1">
        {parts.map((entry, idx) => {
          const isEta = /^ETA\s*:/i.test(entry);
          return (
            <div key={idx} className={isEta ? "font-medium text-gray-800" : undefined}>
              {entry}
            </div>
          );
        })}
      </div>
    );
  }
  return <span>{human}</span>;
}

/* ========================= component ========================= */

type OrderTableProps = {
  data: OrderRow[];
  pageSize?: number;
  showSearch?: boolean;
  showExport?: boolean;
  showPagination?: boolean;
};

const STATUS_OPTIONS: OrderStatus[] = ["Processing", "Shipped", "Delivered", "Cancelled"];
const CURRENCY_OPTIONS: Currency[] = ["NGN", "USD", "EUR", "GBP"];

export default function OrderTable({
  data: initialData,
  pageSize = 50,
  showSearch = true,
  showExport = true,
  showPagination = true,
}: OrderTableProps) {
  const [data, setData] = useState<OrderRow[]>(initialData);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | OrderStatus>("All");
  const [currencyFilter, setCurrencyFilter] = useState<"All" | Currency>("All");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [labelBusyIds, setLabelBusyIds] = useState<Set<string>>(new Set());
  const [receiptOrder, setReceiptOrder] = useState<OrderRow | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  function openReceiptModal(order: OrderRow) {
    setReceiptOrder(order);
    setReceiptOpen(true);
  }

  function toRenderPayload(o: OrderRow) {
    const courierName = o.deliveryOption?.name || undefined;
    const human = humanizeOnClient(o.deliveryDetails);
    const summary = stripLeadingName(human, courierName);
    return {
      order: {
        id: o.id,
        createdAt: o.createdAt,
        paymentMethod: o.paymentMethod,
        totalAmount: o.totalAmount,
        items: o.products.map((p) => ({
          name: p.name,
          image: p.image,
          quantity: p.quantity,
          lineTotal: p.lineTotal,
          color: p.color,
          size: p.size,
          hasSizeMod: p.hasSizeMod,
          sizeModFee: p.sizeModFee,
          customSize: p.customSize || undefined,
        })),
      },
      recipient: {
        firstName: o.customer?.name?.split(" ")[0] ?? "Customer",
        lastName: o.customer?.name?.split(" ").slice(1).join(" ") ?? "",
        email: o.customer?.email ?? "",
        deliveryAddress: o.customer?.address ?? "",
        billingAddress: o.customer?.address ?? "",
      },
      currency: o.currency as any,
      deliveryFee: o.deliveryFee ?? 0,
      shipping: { courierName, summary: summary || undefined },
    };
  }

  async function handleStatusChange(id: string, newStatus: OrderStatus) {
    if (updatingIds.has(id)) return;
    setUpdatingIds((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      setData((d) => d.map((o) => (o.id === id ? { ...o, status: newStatus } : o)));
      toast.success(`Order ${id} status updated to ${newStatus}`);
    } catch (err: any) {
      toast.error("❌ " + err.message);
    } finally {
      setUpdatingIds((s) => { const copy = new Set(s); copy.delete(id); return copy; });
    }
  }

  async function handlePrint(order: OrderRow) {
    const { default: printJS } = await import("print-js");
    const html = renderReceiptHTML(toRenderPayload(order));
    printJS({ printable: html, type: "raw-html", scanStyles: false });
  }

  async function refreshHasLabel(id: string) {
    try {
      const res = await fetch(`/api/admin/orders/${id}/shipbubble/status`, { method: "GET", cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      setData((d) => d.map((o) => (o.id === id ? { ...o, hasShipbubbleLabel: !!j.hasLabel } : o)));
    } catch { /* ignore */ }
  }

  async function handleCreateShipmentLabel(order: OrderRow) {
    if (labelBusyIds.has(order.id)) return;
    setLabelBusyIds((s) => new Set(s).add(order.id));
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/shipbubble/create-label`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to create shipment label");

      setData((d) =>
        d.map((o) =>
          o.id === order.id
            ? {
                ...o,
                hasShipbubbleLabel: true as any,
                shipbubbleOrderId: json.shipbubbleOrderId ?? (o as any).shipbubbleOrderId,
                shipbubbleTrackingUrl: json.trackingUrl ?? (o as any).shipbubbleTrackingUrl,
              }
            : o
        )
      );
      toast.success("Shipment label created");
      await refreshHasLabel(order.id);
    } catch (err: any) {
      toast.error("❌ " + (err?.message || "Unable to create shipment label."));
    } finally {
      setLabelBusyIds((s) => { const copy = new Set(s); copy.delete(order.id); return copy; });
    }
  }

  async function handleCancelShipmentLabel(order: OrderRow) {
    if (labelBusyIds.has(order.id)) return;
    setLabelBusyIds((s) => new Set(s).add(order.id));
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/shipbubble/cancel-label`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to cancel shipment label");

      setData((d) =>
        d.map((o) =>
          o.id === order.id
            ? {
                ...o,
                hasShipbubbleLabel: false as any,
                shipbubbleOrderId: null as any,
                shipbubbleTrackingUrl: null as any,
              }
            : o
        )
      );
      toast.success("Shipment label cancelled");
      await refreshHasLabel(order.id);
    } catch (err: any) {
      toast.error("❌ " + (err?.message || "Unable to cancel shipment label."));
    } finally {
      setLabelBusyIds((s) => { const copy = new Set(s); copy.delete(order.id); return copy; });
    }
  }

  const filtered = useMemo(() => {
    return data.filter((o) => {
      if (showSearch && search) {
        const s = search.toLowerCase();
        if (!o.id.toLowerCase().includes(s) && !(o.customer?.name.toLowerCase() ?? "").includes(s)) {
          return false;
        }
      }
      if (showSearch && statusFilter !== "All" && o.status !== statusFilter) return false;
      if (showSearch && currencyFilter !== "All" && o.currency !== currencyFilter) return false;
      return true;
    });
  }, [data, search, statusFilter, currencyFilter, showSearch]);

  // background sync every 20s for visible rows
  React.useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const ids = filtered.slice(0, 50).map((o) => o.id);
        await Promise.all(ids.map((id) => refreshHasLabel(id)));
      } catch { /* ignore */ }
    }
    tick();
    const t = setInterval(tick, 20000);
    return () => { stop = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.map((o) => o.id).join("|")]);

  function handleExportCSV() {
    const rows = filtered.map((o) => {
      const productSummary = o.products
        .map((p) => `${p.name} x${p.quantity} (Color: ${p.color}, Size: ${p.size})`)
        .join(" | ");
      const sizeModSummary = o.products
        .map((p) => {
          if (!p.hasSizeMod) return null;
          const fee = typeof p.sizeModFee === "number" ? p.sizeModFee : 0;
          const custom = p.customSize
            ? `; custom: ${Object.entries(p.customSize).map(([k, v]) => `${k}:${v}`).join(", ")}`
            : "";
          return `${p.name}: fee ${fee.toFixed(2)}${custom}`;
        })
        .filter(Boolean)
        .join(" | ");
      const courierName = o.deliveryOption?.name || "";
      const human = stripLeadingName(humanizeOnClient(o.deliveryDetails), courierName);
      return {
        "Order ID": o.id,
        Status: o.status,
        Channel: o.channel === "OFFLINE" ? "Offline Sale" : "Online Store",
        Currency: o.currency,
        "Amount (NGN)": o.totalNGN,
        Amount: o.totalAmount,
        "Payment Method": o.paymentMethod,
        "Customer Name": o.customer.name,
        "Customer Email": o.customer.email,
        "Customer Phone": o.customer.phone,
        "Customer Address": o.customer.address,
        "Delivery Option": courierName || "—",
        "Delivery Fee": o.deliveryFee ?? 0,
        "Delivery Details": human || "—",
        "Delivery Address": o.customer.address ?? "—",
        Products: productSummary,
        "Size Modifications": sizeModSummary || "None",
        "Created At": o.createdAt,
      };
    });
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const columns = useMemo<ColumnDef<OrderRow>[]>(() => [
    {
      accessorKey: "id",
      header: "Order ID",
      cell: ({ getValue }) => <code className="font-mono text-sm">{getValue<string>()}</code>,
    },
    {
      id: "preview",
      header: "Order Contents",
      cell: ({ row }) => {
        const prods = row.original.products.slice(0, 3);
        return (
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {prods.map((p, i) => (
                <img
                  key={i}
                  src={p.image || "/placeholder.png"}
                  alt={p.name}
                  className="h-8 w-8 rounded-md border-2 border-white object-cover"
                  style={{ zIndex: prods.length - i }}
                />
              ))}
              {row.original.products.length > 3 && (
                <div className="h-8 w-8 rounded-md bg-gray-200 text-xs font-medium flex items-center justify-center border-2 border-white">
                  +{row.original.products.length - 3}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2 text-gray-600 hover:text-gray-900"
              onClick={() => openReceiptModal(row.original)}
              aria-label="View order"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status;
        const color =
          s === "Processing" ? "bg-blue-100 text-blue-800" :
          s === "Shipped"    ? "bg-yellow-100 text-yellow-800" :
          s === "Delivered"  ? "bg-green-100 text-green-800" :
          s === "Cancelled"  ? "bg-red-100 text-red-800" : "";
        return <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${color}`}>{s}</span>;
      },
    },
    {
      id: "amountNGN",
      header: "Amount (NGN)",
      accessorFn: (r) => r.totalNGN,
      cell: ({ getValue }) => <span className="font-medium">₦{getValue<number>().toLocaleString()}</span>,
      enableSorting: true,
    },
    {
      id: "amount",
      header: "Amount",
      accessorFn: (r) => r.totalAmount,
      cell: ({ getValue, row }) => {
        const sym = row.original.currency === "NGN" ? "₦" :
                    row.original.currency === "USD" ? "$" :
                    row.original.currency === "EUR" ? "€" : "£";
        return <span className="font-medium">{sym}{getValue<number>().toLocaleString()}</span>;
      },
      enableSorting: true,
    },
    { accessorKey: "currency", header: "Currency" },
    {
      accessorKey: "channel",
      header: "Channel",
      cell: ({ getValue }) => (getValue<OrderChannel>() === "OFFLINE" ? "Offline Sale" : "Online Store"),
    },
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const cust = row.original.customer;
        if (cust.id) {
          return (
            <Link href={`/admin/customers/${cust.id}`} className="text-indigo-600 hover:underline">
              {cust.name}
            </Link>
          );
        }
        return <span className="text-gray-500">Guest</span>;
      },
    },
    {
      id: "delivery",
      header: "Delivery",
      cell: ({ row }) => {
        const name = row.original.deliveryOption?.name || "";
        const fee = row.original.deliveryFee;
        const details = row.original.deliveryDetails;
        return (
          <div className="text-sm">
            {name ? <div className="font-medium">{name}</div> : null}
            {typeof fee === "number" && (
              <div className="text-xs text-gray-500">Fee: ₦{fee.toLocaleString()}</div>
            )}
            <div className="text-xs mt-1 text-gray-600">
              <DisplayDeliveryDetails details={details} omitName={name} />
            </div>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const order = row.original;
        const isUpdatingStatus = updatingIds.has(order.id);
        const isLabelBusy = labelBusyIds.has(order.id);
        const isShipbubbleOrder =
          (order.deliveryOption?.provider || "").toLowerCase() === "shipbubble";

        // Strong, unambiguous visuals
        const hasLabel = !!(order as any).hasShipbubbleLabel;

        return (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePrint(order)}
              className="text-gray-600 hover:text-gray-900"
              aria-label="Print receipt"
            >
              <Printer className="h-5 w-5" />
            </Button>

            <Select
              value={order.status}
              onValueChange={(v) => handleStatusChange(order.id, v as OrderStatus)}
              disabled={isUpdatingStatus}
            >
              <SelectTrigger className="h-8 px-2 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s2) => (
                  <SelectItem key={s2} value={s2}>{s2}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isUpdatingStatus && <RefreshCcw className="animate-spin h-4 w-4 text-gray-600" />}

            {/* Create Label — emerald */}
            <Button
              variant={hasLabel || !isShipbubbleOrder ? "outline" : "default"}
              size="icon"
              className={
                hasLabel || !isShipbubbleOrder
                  ? "text-gray-500"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
              title={
                !isShipbubbleOrder
                  ? "Shipbubble not configured for this order"
                  : hasLabel
                  ? "Shipment label already created"
                  : "Create Shipbubble shipment label"
              }
              disabled={!isShipbubbleOrder || hasLabel || isLabelBusy}
              onClick={() => handleCreateShipmentLabel(order)}
              aria-label="Create shipment label"
            >
              <PackagePlus className="h-5 w-5" />
            </Button>

            {/* Cancel Label — destructive red */}
            <Button
              variant="destructive"
              size="icon"
              className={
                hasLabel && !isLabelBusy
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-red-300 text-white opacity-60"
              }
              title={hasLabel ? "Cancel Shipbubble shipment label" : "No shipment label to cancel"}
              disabled={!hasLabel || isLabelBusy}
              onClick={() => handleCancelShipmentLabel(order)}
              aria-label="Cancel shipment label"
            >
              <PackageX className="h-5 w-5" />
            </Button>

            {isLabelBusy && <RefreshCcw className="animate-spin h-4 w-4 text-gray-600" />}
          </div>
        );
      },
    },
  ], [updatingIds, labelBusyIds]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <>
      {(showExport || showSearch) && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex gap-2">
            {showExport && (
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="mr-1 h-4 w-4" /> Export CSV
              </Button>
            )}
          </div>
          {showSearch && (
            <div className="flex flex-col md:flex-row items-center gap-4">
              <Input
                placeholder="Search orders…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-sm"
              />
              <div className="flex space-x-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    {STATUS_OPTIONS.map((st) => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={currencyFilter} onValueChange={(v) => setCurrencyFilter(v as any)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All Currencies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Currencies</SelectItem>
                    {CURRENCY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-gray-50">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      className={`px-4 py-2 text-left text-gray-700 font-semibold ${canSort ? "cursor-pointer select-none" : ""}`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {!header.isPlaceholder && (
                        <div className="flex items-center">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span className="ml-1">
                              {{
                                asc: <ChevronUp className="h-4 w-4" />,
                                desc: <ChevronDown className="h-4 w-4" />,
                              }[header.column.getIsSorted() as string] ?? null}
                            </span>
                          )}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="even:bg-white odd:bg-gray-50 hover:bg-gray-100">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-4 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={table.getAllColumns().length} className="text-center py-6 text-gray-500">
                  No orders match your criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className="flex items-center justify-between py-4">
          <Button variant="link" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            ← Prev
          </Button>
          <span className="text-sm text-gray-700">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button variant="link" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next →
          </Button>
          <select
            className="ml-2 border rounded p-1"
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {[10, 20, 30, 50].map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        </div>
      )}

      {receiptOrder && (
        <Dialog open={receiptOpen} onOpenChange={() => setReceiptOpen(false)}>
          <DialogContent className="w-[96vw] max-w-[980px] p-0 rounded-lg shadow-lg print:hidden">
            <div className="px-6 pt-5">
              <DialogHeader>
                <DialogTitle>Receipt — {receiptOrder.id}</DialogTitle>
                <DialogDescription>
                  Payment: <strong>{receiptOrder.paymentMethod}</strong> —{" "}
                  {new Date(receiptOrder.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>
            </div>

            <ScrollArea className="mt-3 max-h-[78vh] px-0 pb-4" type="auto">
              <div className="receipt-frame mx-4">
                <div
                  className="receipt-html"
                  dangerouslySetInnerHTML={{
                    __html: renderReceiptHTML(toRenderPayload(receiptOrder)),
                  }}
                />
              </div>
            </ScrollArea>

            <DialogFooter className="px-6 pb-5 space-x-2">
              <Button variant="outline" onClick={() => setReceiptOpen(false)}>Close</Button>
              <Button variant="secondary" onClick={() => handlePrint(receiptOrder!)}>
                <Printer className="mr-1 h-4 w-4" /> Print
              </Button>
            </DialogFooter>

            <style jsx global>{`
              .receipt-frame { background:#f3f4f6; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; font-family:'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
              .receipt-frame, .receipt-frame * { box-sizing: border-box; }
              .receipt-frame table { width:100% !important; max-width:100% !important; }
              .receipt-frame { overflow-x: hidden; }
              .receipt-frame img { max-width:100% !important; height:auto !important; }
              .receipt-frame td, .receipt-frame th { word-break: break-word; }
            `}</style>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
