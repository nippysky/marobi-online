"use client";

import React, { useState, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ChevronUp, ChevronDown, Printer } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import toast from "react-hot-toast";

import { AdminCustomerOrder } from "@/types/admin";
import { Currency, OrderStatus } from "@/lib/generated/prisma-client";

type Props = { initialData: AdminCustomerOrder[] };

export default function CustomerOrdersTable({ initialData }: Props) {
  const [data, setData] = useState<AdminCustomerOrder[]>(initialData);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | OrderStatus>("All");
  const [currencyFilter, setCurrencyFilter] = useState<"All" | Currency>("All");
  const [sorting, setSorting] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  // Receipt modal
  const [receiptOrder, setReceiptOrder] = useState<AdminCustomerOrder | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  function openReceiptModal(o: AdminCustomerOrder) {
    setReceiptOrder(o);
    setReceiptOpen(true);
  }

  const receiptCSS = `
    @page { size: 80mm auto; margin: 0; }
    body { width: 80mm; font-family: monospace; margin:0; padding:4mm; }
    .header, .footer { text-align: center; margin-bottom:4mm; }
    .line { display:flex; justify-content:space-between; margin-bottom:2mm; }
    .total { font-weight:bold; display:flex; justify-content:space-between; margin-top:4mm; }
    .small { font-size:0.8em; }
  `;

  function generateReceiptHtml(o: AdminCustomerOrder) {
    const now = new Date().toLocaleString();
    const vatRate = 0.075;
    const subtotal = +o.totalAmount.toFixed(2);
    const vat = +(subtotal * vatRate).toFixed(2);
    const deliveryCharge = 500;
    const totalWeight = o.products.reduce((w, p) => w + p.quantity * 0.2, 0).toFixed(2);
    const courier = "DHL Express";
    const sym = o.currency === "NGN" ? "₦"
               : o.currency === "USD" ? "$"
               : o.currency === "EUR" ? "€" : "£";
    const grand = +(subtotal + vat + deliveryCharge).toFixed(2);

    const cust = o.customer ?? {
      name: `${o.guestInfo!.firstName} ${o.guestInfo!.lastName}`,
      email: o.guestInfo!.email,
      phone: o.guestInfo!.phone,
      address: o.guestInfo!.address,
    };

    const lines = o.products.map(p => `
      <div class="line">
        <div>
          ${p.name}<br>
          <span class="small">Color: ${p.color} • Size: ${p.size} • Qty: ${p.quantity}</span>
        </div>
        <div>${sym}${p.lineTotal.toLocaleString()}</div>
      </div>
    `).join("");

    return `
      <html>
        <head><style>${receiptCSS}</style></head>
        <body>
          <div class="header">
            <div>${now}</div>
            <div>Marobi Receipt</div>
            <div>Order: ${o.id}</div>
          </div>
          ${lines}
          <div class="total"><span>Subtotal</span><span>${sym}${subtotal.toLocaleString()}</span></div>
          <div class="line"><span>VAT (${(vatRate*100).toFixed(1)}%)</span><span>${sym}${vat.toLocaleString()}</span></div>
          <div class="line"><span>Delivery</span><span>${sym}${deliveryCharge.toLocaleString()}</span></div>
          <div class="line"><span>Weight</span><span>${totalWeight}kg</span></div>
          <div class="line"><span>Courier</span><span>${courier}</span></div>
          <div class="total"><span>Grand Total</span><span>${sym}${grand.toLocaleString()}</span></div>
          <div class="footer small">
            Customer: ${cust.name}<br>
            Email: ${cust.email}<br>
            Phone: ${cust.phone}<br>
            Address: ${cust.address}
          </div>
        </body>
      </html>
    `;
  }

  async function handlePrint(o: AdminCustomerOrder) {
    if (typeof window === "undefined") return;
    const html = generateReceiptHtml(o);
    const { default: printJS } = await import("print-js");
    printJS({ printable: html, type: "raw-html", scanStyles: false, style: receiptCSS });
  }

  async function handleStatusChange(orderId: string, newStatus: OrderStatus) {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      setData(d => d.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast.success("Status updated");
    } catch (e: any) {
      toast.error("Failed to update status: " + e.message);
    }
  }

  const filteredData = useMemo(
    () =>
      data.filter(o => {
        if (search) {
          const s = search.toLowerCase();
          const nameToTest = (o.customer ?? { name: o.guestInfo!.firstName }).name.toLowerCase();
          if (!o.id.toLowerCase().includes(s) && !nameToTest.includes(s)) return false;
        }
        if (statusFilter !== "All" && o.status !== statusFilter) return false;
        if (currencyFilter !== "All" && o.currency !== currencyFilter) return false;
        return true;
      }),
    [data, search, statusFilter, currencyFilter]
  );

  const columns = useMemo<ColumnDef<AdminCustomerOrder>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={v => table.toggleAllPageRowsSelected(!!v)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={v => row.toggleSelected(!!v)}
        />
      ),
    },
    {
      accessorKey: "id",
      header: "Order ID",
      cell: ({ getValue }) => <code className="font-mono">{getValue<string>()}</code>,
    },
    {
      id: "order",
      header: "Order Contents",
      cell: ({ row }) => {
        const prods = row.original.products.slice(0, 3);
        return (
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {prods.map((p, i) => (
                <img
                  key={i}
                  src={p.image}
                  alt={p.name}
                  className="h-8 w-8 rounded-md border-2 border-white object-cover"
                  style={{ zIndex: prods.length - i }}
                />
              ))}
              {row.original.products.length > 3 && (
                <div className="h-8 w-8 rounded-md bg-gray-200 flex items-center justify-center text-xs font-medium border-2 border-white">
                  +{row.original.products.length - 3}
                </div>
              )}
            </div>
            <Button
              variant="default"
              size="sm"
              className="ml-2"
              onClick={() => openReceiptModal(row.original)}
            >
              View All
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
        const color = s === "Processing"
          ? "bg-blue-100 text-blue-800"
          : s === "Shipped"
          ? "bg-yellow-100 text-yellow-800"
          : s === "Delivered"
          ? "bg-green-100 text-green-800"
          : s === "Cancelled"
          ? "bg-red-100 text-red-800"
          : "bg-gray-100 text-gray-800";
        return <span className={`px-2 py-0.5 rounded-full ${color}`}>{s}</span>;
      },
    },
    {
      accessorFn: r => r.totalAmount,
      header: "Amount",
      cell: ({ getValue, row }) => {
        const sym = row.original.currency === "NGN" ? "₦"
                  : row.original.currency === "USD" ? "$"
                  : row.original.currency === "EUR" ? "€" : "£";
        return `${sym}${getValue<number>().toLocaleString()}`;
      },
      enableSorting: true,
    },
    { accessorKey: "currency", header: "Currency" },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={() => handlePrint(row.original)}>
            <Printer className="h-4 w-4" />
          </Button>
          <Select
            value={row.original.status}
            onValueChange={v => handleStatusChange(row.original.id, v as OrderStatus)}
          >
            <SelectTrigger className="w-auto h-8 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["Processing", "Shipped", "Delivered", "Cancelled"] as OrderStatus[]).map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
    },
  ], []);

  const table = useReactTable({
    data: filteredData,
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
      {/* ─── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:justify-between gap-4 mb-4">
        <Input
          placeholder="Search orders…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm"
        />
        <div className="flex space-x-2">
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              {(["Processing", "Shipped", "Delivered", "Cancelled"] as OrderStatus[]).map(st => (
                <SelectItem key={st} value={st}>{st}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={currencyFilter} onValueChange={v => setCurrencyFilter(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Currencies" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Currencies</SelectItem>
              {(["NGN", "USD", "EUR", "GBP"] as Currency[]).map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── Table ────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(header => (
                  <TableHead key={header.id} className="p-2">
                    {!header.isPlaceholder && (
                      <div className="flex items-center">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="ml-1">
                            {header.column.getIsSorted()==="asc" ? <ChevronUp className="h-4 w-4"/> 
                             : header.column.getIsSorted()==="desc" ? <ChevronDown className="h-4 w-4"/> 
                             : null}
                          </span>
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map(row => (
              <TableRow key={row.id} className="even:bg-gray-50 hover:bg-gray-100">
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id} className="p-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredData.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-500">No orders found.</div>
        )}
      </div>

      {/* ─── Pagination ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between py-4">
        <Button variant="link" onClick={()=>table.previousPage()} disabled={!table.getCanPreviousPage()}>← Prev</Button>
        <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
        <Button variant="link" onClick={()=>table.nextPage()} disabled={!table.getCanNextPage()}>Next →</Button>
        <select
          className="ml-2 border rounded p-1"
          value={table.getState().pagination.pageSize}
          onChange={e=>table.setPageSize(Number(e.target.value))}
        >
          {[10,20,30,50].map(s=><option key={s} value={s}>{s} / page</option>)}
        </select>
      </div>

      {/* ─── Receipt Modal ───────────────────────────────────────────────── */}
      {receiptOrder && (
        <Dialog open={receiptOpen} onOpenChange={()=>setReceiptOpen(false)}>
          <DialogContent className="max-w-lg print:hidden">
            <DialogHeader>
              <DialogTitle>Receipt — {receiptOrder.id}</DialogTitle>
              <DialogDescription>
                Payment: <strong>{receiptOrder.paymentMethod}</strong> —{" "}
                {new Date(receiptOrder.createdAt).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="mt-6 max-h-[60vh] space-y-4">
              {(() => {
                const o = receiptOrder;
                const cust = o.customer ?? {
                  name: `${o.guestInfo!.firstName} ${o.guestInfo!.lastName}`,
                  email: o.guestInfo!.email,
                  phone: o.guestInfo!.phone,
                  address: o.guestInfo!.address,
                };
                const vatRate = 0.075;
                const subtotal = +o.totalAmount.toFixed(2);
                const vat = +(subtotal * vatRate).toFixed(2);
                const deliveryCharge = 500;
                const totalWeight = o.products.reduce((w,p)=>w+p.quantity*0.2,0).toFixed(2);
                const courier = "DHL Express";
                const sym = o.currency==="NGN"?"₦":o.currency==="USD"?"$":o.currency==="EUR"?"€":"£";
                const grand = +(subtotal+vat+deliveryCharge).toFixed(2);

                return (
                  <div className="px-2">
                    {o.products.map(p=>(
                      <div key={p.id} className="flex justify-between mb-2">
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-sm text-gray-600">
                            Color: {p.color} • Size: {p.size} • Qty: {p.quantity}
                          </div>
                        </div>
                        <div className="font-medium">
                          {sym}{p.lineTotal.toLocaleString()}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between font-medium">
                      <span>Subtotal</span><span>{sym}{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VAT (7.5%)</span><span>{sym}{vat.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery</span><span>{sym}{deliveryCharge.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Weight</span><span>{totalWeight}kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Courier</span><span>{courier}</span>
                    </div>
                    <div className="flex justify-between font-semibold mt-2">
                      <span>Grand Total</span><span>{sym}{grand.toLocaleString()}</span>
                    </div>
                    <div className="mt-4 text-sm space-y-1">
                      <div><strong>Customer:</strong> {cust.name}</div>
                      <div><strong>Email:</strong> {cust.email}</div>
                      <div><strong>Phone:</strong> {cust.phone}</div>
                      <div><strong>Address:</strong> {cust.address}</div>
                    </div>
                  </div>
                );
              })()}
            </ScrollArea>

            <DialogFooter className="space-x-2">
              <Button variant="outline" onClick={()=>setReceiptOpen(false)}>Close</Button>
              <Button variant="secondary" onClick={()=>handlePrint(receiptOrder)}>
                <Printer className="mr-1 h-4 w-4"/> Print
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
