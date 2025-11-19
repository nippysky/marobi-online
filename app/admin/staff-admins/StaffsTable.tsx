"use client";

import React, { useState, useMemo } from "react";
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
import {
  Trash2,
  Eye,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";

export interface StaffRow {
  id: string;
  firstName: string;
  lastName: string;
  emailOfficial: string;
  phone: string;
  jobRoles: string[];     // <-- now an array
  userRole: string;
  createdAt: string;      // ISO, if you ever want to sort by join date
}

type Props = { initialData: StaffRow[] };

export default function StaffsTable({ initialData }: Props) {
  const [data, setData] = useState<StaffRow[]>(initialData);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Bulk delete dialogs
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [singleDialogOpen, setSingleDialogOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState<string | null>(null);

  // filter by name/email
  const filteredData = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(
      (s) =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.emailOfficial.toLowerCase().includes(q)
    );
  }, [data, search]);

  // define columns
  const columns = useMemo<ColumnDef<StaffRow>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) =>
            table.toggleAllPageRowsSelected(!!v)
          }
          aria-label="Select all staff"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) =>
            row.toggleSelected(!!v)
          }
          aria-label={`Select staff ${row.original.id}`}
        />
      ),
    },
    {
      accessorKey: "id",
      header: "Staff ID",
      cell: ({ getValue }) => (
        <code className="font-mono text-xs text-gray-600">
          {getValue<string>()}
        </code>
      ),
    },
    { accessorKey: "firstName", header: "First Name" },
    { accessorKey: "lastName", header: "Last Name" },
    { accessorKey: "emailOfficial", header: "Official Email" },
    { accessorKey: "phone", header: "Phone Number" },

    // NEW: jobRoles column collapses >1 into “First +N”
    {
      id: "jobRoles",
      header: "Job Role",
      accessorFn: (row) => row.jobRoles,
      cell: ({ getValue }) => {
        const roles = getValue<string[]>();
        if (roles.length === 0) return "—";
        if (roles.length === 1) return roles[0];
        const [first, ...rest] = roles;
        return (
          <span className="flex items-center space-x-1">
            <span>{first}</span>
            <span className="text-xs text-gray-400">
              +{rest.length}
            </span>
          </span>
        );
      },
      // allow sorting by number of roles if you like:
      sortingFn: (a, b) =>
        a.original.jobRoles.length - b.original.jobRoles.length,
    },

    { accessorKey: "userRole", header: "User Role" },

    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/staff-admins/${row.original.id}`}>
              View <Eye className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setToDeleteId(row.original.id);
              setSingleDialogOpen(true);
            }}
          >
            <Trash2 className="h-5 w-5 text-red-600" />
          </Button>
        </div>
      ),
    },
  ], []);

  // build table instance
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

  // delete handlers
  function confirmBulkDelete() {
    setData((d) =>
      d.filter((s) => !selectedIds.includes(s.id))
    );
    table.resetRowSelection();
    setBulkDialogOpen(false);
  }

  function confirmSingleDelete() {
    if (toDeleteId) {
      setData((d) => d.filter((s) => s.id !== toDeleteId));
      table.resetRowSelection();
    }
    setSingleDialogOpen(false);
    setToDeleteId(null);
  }

  return (
    <>
      {/* Search & Bulk Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm"
        />

        {selectedIds.length > 0 && (
          <div className="flex items-center space-x-3 bg-gray-100 px-3 py-1 rounded-lg">
            <span className="text-sm">
              <strong>{selectedIds.length}</strong> selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkDialogOpen(true)}
            >
              Delete Selected
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={`px-3 py-2 ${
                      header.column.getCanSort()
                        ? "cursor-pointer select-none"
                        : ""
                    }`}
                    onClick={
                      header.column.getCanSort()
                        ? header
                            .column
                            .getToggleSortingHandler()
                        : undefined
                    }
                  >
                    {!header.isPlaceholder && (
                      <div className="flex items-center">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() && (
                          <span className="ml-1">
                            {{
                              asc: (
                                <ChevronUp className="h-4 w-4" />
                              ),
                              desc: (
                                <ChevronDown className="h-4 w-4" />
                              ),
                            }[header.column.getIsSorted() as string] ?? (
                              <span className="opacity-0">
                                <ChevronUp className="h-4 w-4" />
                              </span>
                            )}
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
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="even:bg-white odd:bg-gray-50 hover:bg-gray-100"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-3 py-2">
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-4 text-sm">
        <Button
          variant="link"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          ← Prev
        </Button>
        <span>
          Page{" "}
          <strong>
            {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </strong>
        </span>
        <Button
          variant="link"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next →
        </Button>
        <select
          className="ml-2 border rounded-lg px-2 py-1"
          value={table.getState().pagination.pageSize}
          onChange={(e) =>
            table.setPageSize(Number(e.target.value))
          }
        >
          {[10, 20, 30, 50].map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Delete Dialog */}
      <Dialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {selectedIds.length} staff member
              {selectedIds.length > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Dialog */}
      <Dialog
        open={singleDialogOpen}
        onOpenChange={setSingleDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete staff {toDeleteId}?
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setSingleDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmSingleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
