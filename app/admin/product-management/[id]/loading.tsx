import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingProductView() {
  return (
    <div className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-wrap gap-4 justify-between">
        <div className="flex gap-4">
          <Skeleton className="h-20 w-20 rounded" />
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Overview area */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Skeleton className="h-44 w-full" />   {/* Basic Info */}
          <Skeleton className="h-32 w-full" />   {/* Description */}
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="aspect-[4/3] w-full" />
            <Skeleton className="aspect-[4/3] w-full" />
            <Skeleton className="aspect-[4/3] w-full" />
          </div>
        </div>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />   {/* Next Steps */}
          <Skeleton className="h-28 w-full" />   {/* Tips */}
        </div>
      </div>
    </div>
  );
}
