"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface ReviewCardProps {
  author: string;
  content: string;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ author, content }) => {
  return (
    // Removed "max-w-xs" so the card can expand in a grid cell.
    <Card className="w-full">
      <CardContent className="space-y-2">
        <p className="text-sm text-gray-800 dark:text-gray-200">“{content}”</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
          — {author}
        </p>
      </CardContent>
    </Card>
  );
};

export default ReviewCard;
