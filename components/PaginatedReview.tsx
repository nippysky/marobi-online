"use client";

import React, { useState } from "react";
import ReviewCard from "./ReviewCard";
import { Button } from "./ui/button";

export interface Review {
  author: string;
  content: string;
}

interface PaginatedReviewsProps {
  reviews: Review[];
  pageSize?: number;
}

const PaginatedReviews: React.FC<PaginatedReviewsProps> = ({
  reviews,
  pageSize = 4,
}) => {
  const [visible, setVisible] = useState(pageSize);

  const showMore = () => {
    setVisible((v) => Math.min(v + pageSize, reviews.length));
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {reviews.slice(0, visible).map((rev, i) => (
          <ReviewCard key={i} author={rev.author} content={rev.content} />
        ))}
      </div>

      {visible < reviews.length && (
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={showMore}>
            Show more reviews ({reviews.length - visible} remaining)
          </Button>
        </div>
      )}
    </>
  );
};

export default PaginatedReviews;
