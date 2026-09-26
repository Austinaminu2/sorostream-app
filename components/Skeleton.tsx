"use client";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

interface StreamListSkeletonProps {
  label?: string;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function StreamListSkeleton({
  label = "Loading streams",
}: StreamListSkeletonProps) {
  return (
    <div role="status" aria-live="polite" aria-label={label} aria-busy="true">
      <ul className="grid gap-4 md:grid-cols-2" role="list">
        {Array.from({ length: 5 }, (_, index) => (
          <li
            key={index}
            className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex justify-between items-start mb-3">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 space-y-6">
      <Skeleton className="h-2 w-full" />
      <div className="text-center space-y-2">
        <Skeleton className="h-4 w-24 mx-auto" />
        <Skeleton className="h-8 w-48 mx-auto" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-12 flex-1 rounded-lg" />
        <Skeleton className="h-12 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonForm() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1 rounded-lg" />
          <Skeleton className="h-12 flex-1 rounded-lg" />
          <Skeleton className="h-12 flex-1 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}
