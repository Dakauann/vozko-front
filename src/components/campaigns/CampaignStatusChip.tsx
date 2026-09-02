"use client";

import { cn } from "@/lib/utils";

/**
 * The campaign status chip.
 *
 * One component for every channel, because the four statuses come from the
 * shared domain kernel and an operator who learns what a green RUNNING chip
 * means on one campaign screen should not have to relearn it on the other.
 *
 * Solid opaque plates with a foreground colour, per DESIGN.md — never the
 * `bg-x/10 + text-x` wash.
 */
// The exact tones the Cloud API campaign list uses. A completed campaign reads
// as muted, not as a primary-coloured success: it is finished, not noteworthy,
// and giving it the loudest plate on the page makes a list of old campaigns
// shout over the running one.
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

/**
 * The numeric cell used across every metrics column.
 *
 * Tabular figures are not decoration here: these columns are read as a vertical
 * scan down a list of campaigns, and proportional digits make that scan wobble.
 */
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
