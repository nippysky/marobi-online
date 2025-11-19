"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Star } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type SubmittedReview = {
  id: string;
  rating: number;
  content: string;
  author: string;
  createdAt: Date;
};

interface ReviewFormProps {
  productId: string;
  /** Optional: Provide this if you want the parent to optimistically add the new review. */
  onSubmitted?: (review: SubmittedReview) => void;
}

export default function ReviewForm({ productId, onSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const displayRating = hoverRating || rating;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!rating) {
      toast.error("Please select a rating.");
      return;
    }
    if (!comment.trim()) {
      toast.error("Please provide a short comment.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, body: comment.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Specific UX for duplicate review (unique constraint)
        if (res.status === 409) {
          toast.error("You’ve already reviewed this product.", {
            id: `dup-review-${productId}`, // de-dupe the toast if they click multiple times
          });
        } else if (res.status === 401) {
          toast.error("You must be logged in to submit a review.");
        } else {
          toast.error(data?.error || "Failed to submit review.");
        }
        return;
      }

      // Map API payload to UI-friendly shape
      const author =
        `${data.customer?.firstName ?? ""} ${data.customer?.lastName ?? ""}`.trim() || "You";
      const mapped: SubmittedReview = {
        id: data.id,
        rating: data.rating,
        content: data.body,
        createdAt: new Date(data.createdAt),
        author,
      };

      toast.success("Review submitted! Thank you 🙌");
      setRating(0);
      setHoverRating(0);
      setComment("");

      // Let parent (e.g., SWR list) optimistically prepend
      onSubmitted?.(mapped);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-xl space-y-6 px-4 py-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Leave a Review
      </h3>

      {/* Star selector */}
      <div className="space-y-2">
        <Label>Rating</Label>
        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => {
            const val = i + 1;
            const active = val <= displayRating;
            return (
              <button
                key={val}
                type="button"
                className="p-1"
                aria-label={`Rate ${val} star${val > 1 ? "s" : ""}`}
                onMouseEnter={() => setHoverRating(val)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(val)}
                disabled={submitting}
              >
                <Star
                  className={`h-6 w-6 transition-transform ${
                    active ? "text-yellow-400 scale-110" : "text-gray-300"
                  }`}
                  fill={active ? "currentColor" : "none"}
                />
              </button>
            );
          })}
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
            {displayRating ? `${displayRating}/5` : "Select rating"}
          </span>
        </div>

        {/* Accessible/select fallback (kept visible; you can hide on md+ if you want) */}
        <div className="max-w-[220px]">
          <Select
            onValueChange={(value) => setRating(Number(value))}
            value={rating > 0 ? String(rating) : ""}
            disabled={submitting}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 – Excellent</SelectItem>
              <SelectItem value="4">4 – Very Good</SelectItem>
              <SelectItem value="3">3 – Good</SelectItem>
              <SelectItem value="2">2 – Fair</SelectItem>
              <SelectItem value="1">1 – Poor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="comment">Comment</Label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="Share your thoughts about this product…"
          disabled={submitting}
        />
      </div>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Submitting…" : "Submit Review"}
      </Button>
    </form>
  );
}
