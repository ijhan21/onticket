import React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-surface-2 rounded-sm animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

export function EventItemSkeleton() {
  return (
    <div className="flex gap-3 p-3 bg-surface rounded-md">
      <Skeleton className="flex-none w-[calc(var(--space-7)*1.75)] aspect-[var(--poster-ratio)] rounded-sm" />
      <div className="flex-1 flex flex-col gap-2 pt-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
