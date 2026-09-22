"use client";

import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  RUNNING: "bg-healthy text-healthy-foreground",
  PAUSED: "bg-warning text-warning-foreground",
  STOPPED: "bg-muted text-muted-foreground",
  COMPLETED: "bg-muted text-muted-foreground",
};

export function CampaignStatusChip({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
        STATUS_TONE[status] ?? "bg-[hsl(var(--plate-neutral))] text-white",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function MetricCell({
  value,
  tone,
}: {
  value: number | undefined;
  tone?: "default" | "healthy" | "muted" | "destructive" | "warning";
}) {
  const toneClass =
    tone === "healthy"
      ? "text-healthy-ink"
      : tone === "destructive"
        ? "text-destructive-ink"
        : tone === "warning"
          ? "text-warning-ink"
          : tone === "muted"
            ? "text-muted-foreground"
            : "text-foreground";

  return (
    <span className={cn("text-sm font-semibold tabular-nums", toneClass)}>
      {value ?? 0}
    </span>
  );
}
