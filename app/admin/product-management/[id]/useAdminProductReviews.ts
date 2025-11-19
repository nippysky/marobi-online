"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ReviewCustomer {
  firstName: string;
  lastName: string;
}

export interface AdminReview {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  customer: ReviewCustomer;
}

export interface ReviewsMeta {
  productId: string;
  page: number;
  pageSize: number;
  totalFiltered: number;
  averageRating: number;
  ratingCount: number;
  starBreakdown: Record<string, number>;
}

interface FetchState {
  meta: ReviewsMeta | null;
  data: AdminReview[];
  loading: boolean;
  error: string | null;
}

export function useAdminProductReviews(productId: string) {
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageSize] = useState(50);

  const [state, setState] = useState<FetchState>({
    meta: null,
    data: [],
    loading: true,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const fetchReviews = useCallback(async () => {
    if (!productId) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setState(s => ({ ...s, loading: true, error: null }));

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (rating) params.set("rating", String(rating));

    try {
      const res = await fetch(
        `/api/admin/products/${productId}/reviews?` + params.toString(),
        { signal: ac.signal }
      );
      if (!res.ok) {
        throw new Error(`Failed (${res.status})`);
      }
      const json = await res.json();
      setState({
        meta: json.meta,
        data: json.data,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setState(s => ({ ...s, loading: false, error: err.message || "Error" }));
    }
  }, [productId, page, pageSize, debouncedSearch, rating]);

  useEffect(() => {
    fetchReviews();
    return () => abortRef.current?.abort();
  }, [fetchReviews]);

  function goToPage(p: number) {
    setPage(Math.max(1, p));
  }

  function setRatingFilter(r: number | null) {
    setPage(1);
    setRating(r);
  }

  function refetch() {
    fetchReviews();
  }

  return {
    ...state,
    page,
    pageSize,
    ratingFilter: rating,
    setRatingFilter,
    search,
    setSearch,
    setPage: goToPage,
    refetch,
  };
}
