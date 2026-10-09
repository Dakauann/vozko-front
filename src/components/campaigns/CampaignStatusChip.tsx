"use client";

import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, StatusChipTone> = {
  RUNNING: "healthy",
  PAUSED: "warning",
  STOPPED: "muted",
  COMPLETED: "muted",
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
  return <StatusChip tone={STATUS_TONE[status] ?? "neutral"} label={label} className={className} />;
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
