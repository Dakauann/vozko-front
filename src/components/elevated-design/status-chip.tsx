"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatusChipTone = "healthy" | "warning" | "muted" | "neutral" | "outline";

const TONE_CLASS: Record<StatusChipTone, string> = {
  healthy: "bg-healthy text-healthy-foreground",
  warning: "bg-warning text-warning-foreground",
  muted: "bg-muted text-muted-foreground",
  neutral: "bg-[hsl(var(--plate-neutral))] text-white",
  outline: "border border-border bg-card text-foreground",
};

export function StatusChip({
  tone,
  label,
  icon,
  className,
}: {
  tone: StatusChipTone;
  label: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium", icon ? "gap-1.5" : null, TONE_CLASS[tone], className)}>
      {icon}
      {label}
    </span>
  );
}
