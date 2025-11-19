"use client";

import { useState } from "react";
import { useAdminProductReviews } from "./useAdminProductReviews";
import { Star, Search, Trash2, RefreshCcw } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function ProductReviewsPanel({ productId }: { productId: string }) {
  const {
    data,
    meta,
    loading,
    error,
    page,
    pageSize,
    ratingFilter,
    setRatingFilter,
    search,
    setSearch,
    setPage,
    refetch,
  } = useAdminProductReviews(productId);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/reviews/${deleteTarget}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Delete failed");
      }
      const json = await res.json();
      toast.success("Review deleted");
      setDeleteTarget(null);
      if (meta) {
        meta.averageRating = json.newProductStats.averageRating;
        meta.ratingCount = json.newProductStats.ratingCount;
      }
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  const totalFiltered = meta?.totalFiltered ?? 0;
  const totalPages = meta ? Math.max(1, Math.ceil(totalFiltered / pageSize)) : 1;
  const startIdx = (page - 1) * pageSize + 1;
  const endIdx = Math.min(totalFiltered, page * pageSize);

  return (
    <div className="p-6 border rounded bg-white space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold">Reviews</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
            className="flex items-center gap-1"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Header */}
      <SummaryHeader meta={meta} loading={loading} />

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative w-full md:max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search review text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={ratingFilter ?? "ALL"}
          onChange={(e) =>
            setRatingFilter(e.target.value === "ALL" ? null : Number(e.target.value))
          }
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="ALL">All Ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} stars
            </option>
          ))}
        </select>
      </div>

      {/* Body / Table */}
      <div className="border rounded overflow-hidden">
        <ReviewsList
          loading={loading}
          error={error}
          reviews={data}
          onDelete={(id) => setDeleteTarget(id)}
          meta={meta}
        />
      </div>

      {/* Pagination */}
      {meta && totalFiltered > 0 && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
          <span className="text-gray-600">
            Showing {startIdx}-{endIdx} of {totalFiltered}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1 || loading}
            >
              Prev
            </Button>
            <span className="px-2 py-1">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Review?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The product rating will be
              recalculated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Summary Header ---------------- */
function SummaryHeader({ meta, loading }: { meta: any; loading: boolean }) {
  if (loading && !meta) {
    return (
      <div className="animate-pulse grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }
  if (!meta) {
    return <div className="text-sm text-gray-500">No data yet.</div>;
  }

  const { averageRating, ratingCount, starBreakdown } = meta;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="p-4 border rounded">
        <div className="text-xs text-gray-500 uppercase">Average Rating</div>
        <div className="flex items-end gap-2 mt-2">
          <span className="text-2xl font-semibold">
            {ratingCount === 0 ? "—" : averageRating.toFixed(2)}
          </span>
          <span className="text-xs text-gray-500">
            {ratingCount ? `(${ratingCount})` : "No reviews"}
          </span>
        </div>
      </div>
      <div className="p-4 border rounded md:col-span-3">
        <div className="text-xs text-gray-500 uppercase mb-2">
          Star Distribution (Global)
        </div>
        <div className="space-y-1">
          {[5, 4, 3, 2, 1].map((r) => {
            const count = starBreakdown?.[String(r)] ?? 0;
            const total = ratingCount || 1;
            const pct = ((count / total) * 100) || 0;
            return (
              <div key={r} className="flex items-center gap-2">
                <span className="w-5 text-xs">{r}★</span>
                <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-yellow-400"
                    style={{ width: pct + "%" }}
                  />
                </div>
                <span className="w-10 text-xs tabular-nums text-right">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Reviews List ---------------- */
function ReviewsList({
  loading,
  error,
  reviews,
  onDelete,
  meta,
}: {
  loading: boolean;
  error: string | null;
  reviews: any[];
  onDelete: (id: string) => void;
  meta: any;
}) {
  if (error) {
    return (
      <div className="p-6 text-sm text-red-600">
        Failed to load reviews.{" "}
        <button onClick={() => location.reload()} className="underline">
          Reload
        </button>
      </div>
    );
  }
  if (loading && reviews.length === 0) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse h-10 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }
  if (meta && meta.totalFiltered === 0) {
    return (
      <div className="p-10 text-center text-sm text-gray-600">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
          <Star className="h-6 w-6 text-gray-400" />
        </div>
        {meta.ratingCount === 0
          ? "No reviews yet for this product."
          : "No reviews match your current filters/search."}
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {reviews.map((r) => (
        <li key={r.id} className="p-4 flex gap-4">
          <RatingStars rating={r.rating} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">
                {r.customer.firstName} {r.customer.lastName}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-xs text-gray-500">
                {new Date(r.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm mt-1 text-gray-800 line-clamp-3">{r.body}</p>
          </div>
          <button
            onClick={() => onDelete(r.id)}
            className="p-2 rounded hover:bg-gray-100 text-red-500"
            aria-label="Delete review"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Rating Stars (Row) ---------------- */
function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}
