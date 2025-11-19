"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type SortingState,
} from "@tanstack/react-table";

import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Eye, ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

import { AdminCustomerRow } from "@/types/admin";

type Props = { initialData: AdminCustomerRow[] };

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function CustomersTable({ initialData }: Props) {
  const [data, setData] = useState<AdminCustomerRow[]>(initialData);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  // selection & delete dialogs
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [singleDialogOpen, setSingleDialogOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState<string | null>(null);

  // filter by id / name / email
  const filteredData = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [data, search]);

  const columns = useMemo<ColumnDef<AdminCustomerRow>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
        />
      ),
    },
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ getValue }) => (
        <code className="font-mono text-xs">{getValue<string>()}</code>
      ),
    },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "phone", header: "Phone" },
    {
      accessorKey: "totalOrders",
      header: "Orders",
      enableSorting: true,
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue<number>()}</span>
      ),
    },
    {
      accessorKey: "lastLogin",
      header: "Last Login",
      enableSorting: true,
      cell: ({ getValue }) => formatDateTime(getValue<string | null>()),
    },
    {
      accessorKey: "registeredAt",
      header: "Joined",
      enableSorting: true,
      cell: ({ getValue }) => formatDateTime(getValue<string>()),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setToDeleteId(row.original.id);
              setSingleDialogOpen(true);
            }}
            aria-label="Delete customer"
          >
            <Trash2 className="h-5 w-5 text-red-600" />
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/customers/${row.original.id}`}>
              View <Eye className="ml-1 h-4 w-4" />
            </Link>
          </Button>
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

  const selectedIds = table
    .getSelectedRowModel()
    .flatRows.map((r) => r.original.id);

  // ── Single delete handler ───────────────────────────────────────────────
  async function confirmSingleDelete() {
    if (!toDeleteId) return setSingleDialogOpen(false);
    try {
      const res = await fetch(`/api/admin/customers/${toDeleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      setData((d) => d.filter((c) => c.id !== toDeleteId));
      toast.success(`Deleted customer ${toDeleteId}`);
    } catch (err: any) {
      toast.error("Failed to delete: " + err.message);
    } finally {
      setSingleDialogOpen(false);
      setToDeleteId(null);
      table.resetRowSelection();
    }
  }

  // ── Bulk delete handler ─────────────────────────────────────────────────
  async function confirmBulkDelete() {
    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`/api/admin/customers/${id}`, { method: "DELETE" }).then((res) => {
            if (!res.ok) throw new Error(id);
          })
        )
      );
      setData((d) => d.filter((c) => !selectedIds.includes(c.id)));
      toast.success(`Deleted ${selectedIds.length} customers`);
    } catch (err: any) {
      toast.error("Failed to delete some customers");
    } finally {
      setBulkDialogOpen(false);
      table.resetRowSelection();
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <Input
          placeholder="Search by ID, name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm"
        />
        {selectedIds.length > 0 && (
          <div className="flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded">
            <span className="text-sm">
              <strong>{selectedIds.length}</strong> selected
            </span>
            <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      className={`px-4 py-3 ${canSort ? "cursor-pointer select-none" : ""}`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center space-x-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span>
                            {{
                              asc: <ChevronUp className="h-4 w-4" />,
                              desc: <ChevronDown className="h-4 w-4" />,
                            }[header.column.getIsSorted() as string] ?? null}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="even:bg-gray-50 hover:bg-gray-100">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-gray-500">
                  No matching customers.
                </td>
              </tr>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-4">
        <Button
          variant="link"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          ← Prev
        </Button>
        <span className="text-sm">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <Button
          variant="link"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next →
        </Button>
        <select
          className="border rounded p-1 text-sm"
          value={table.getState().pagination.pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
        >
          {[10, 20, 30, 50].map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.length} customer
              {selectedIds.length > 1 && "s"}?
            </DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Dialog */}
      <Dialog open={singleDialogOpen} onOpenChange={setSingleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete customer {toDeleteId}?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setSingleDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmSingleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
