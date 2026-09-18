"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

/** Centered spinner for sections and pages. */
export function LoadingBlock({
  label = "Загрузка…",
  className,
  compact,
}: {
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-muted",
        compact ? "py-8" : "min-h-[40vh] py-12",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={cn("animate-spin text-orange", compact ? "h-5 w-5" : "h-8 w-8")} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Simple pulse placeholders for card grids. */
export function SkeletonCards({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-[18px] border border-line bg-white"
        />
      ))}
    </div>
  );
}

export function SkeletonLines({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded-[10px] bg-surface"
          style={{ width: `${88 - i * 8}%` }}
        />
      ))}
    </div>
  );
}
