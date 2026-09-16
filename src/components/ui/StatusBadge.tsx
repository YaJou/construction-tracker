"use client";

import { Check, Pause } from "lucide-react";
import { cn } from "@/utils/cn";

/** Shared status badge styles for settings, dashboard, and project pages. */
export const PROJECT_STATUS_BADGE: Record<string, string> = {
  planning: "bg-[#E8EEEC] text-[#3D524A]",
  construction: "bg-[#E7F3EE] text-[#173F34]",
  paused: "bg-[#FFF6E5] text-[#8A6A20]",
  completed: "bg-[#173F34] text-white",
};

export const STAGE_STATUS_BADGE: Record<string, string> = {
  not_started: "bg-[#E8EEEC] text-[#3D524A]",
  in_progress: "bg-[#E7F3EE] text-[#173F34]",
  completed: "bg-[#173F34] text-white",
};

export function projectStatusBadgeClass(status: string) {
  return PROJECT_STATUS_BADGE[status] || "bg-[#E8EEEC] text-[#3D524A]";
}

export function stageStatusBadgeClass(status: string) {
  return STAGE_STATUS_BADGE[status] || "bg-[#E8EEEC] text-[#3D524A]";
}

export function StatusBadge({
  kind,
  status,
  label,
  className,
}: {
  kind: "project" | "stage";
  status: string;
  label: string;
  className?: string;
}) {
  const tone =
    kind === "project" ? projectStatusBadgeClass(status) : stageStatusBadgeClass(status);
  const showDot = status === "construction" || status === "in_progress";
  const showPause = status === "paused";
  const showCheck = status === "completed";

  return (
    <span
      className={cn(
        "inline-flex h-9 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-full px-3 text-caption font-medium",
        tone,
        className
      )}
    >
      {showDot && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#173F34]" aria-hidden />
      )}
      {showPause && <Pause className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {showCheck && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span className="truncate">{label || "—"}</span>
    </span>
  );
}
