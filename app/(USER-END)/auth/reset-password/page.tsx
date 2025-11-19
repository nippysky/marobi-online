import React, { Suspense } from "react";
import ResetPasswordClient from "@/components/auth/ResetPasswordClient";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-xl mx-auto py-16 px-6 space-y-4">
          {/* Title skeleton */}
          <Skeleton className="h-8 w-1/2" />

          {/* OTP inputs skeleton */}
          <div className="flex justify-between">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="w-16 h-16" />
            ))}
          </div>

          {/* Button skeleton */}
          <Skeleton className="h-12 w-full mt-6" />
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
