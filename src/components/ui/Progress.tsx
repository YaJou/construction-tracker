"use client";

import { cn } from "@/utils/cn";

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
}

export function Progress({ value, max = 100, className, showLabel }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn("space-y-1", className)}>
      <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-ink transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-ink-muted">{Math.round(pct)}%</span>
      )}
    </div>
  );
}
