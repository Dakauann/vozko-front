"use client";

import { Skeleton } from "@/components/audience/shared";
import { cn } from "@/lib/utils";

export interface TipRow {
  key: string;
  label: string;
  value: string;
  color?: string;
}

export function ChartTip({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="min-w-[11rem] rounded-[--radius] border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-semibold text-foreground">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {row.color ? <span aria-hidden className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: row.color }} /> : null}
              {row.label}
            </span>
            <span className="readout font-semibold tabular-nums text-foreground">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  shape?: "bar" | "line" | "dash";
}

export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          {item.shape === "dash" ? (
            <span aria-hidden className="w-3 shrink-0 border-t border-dashed" style={{ borderColor: item.color }} />
          ) : (
            <span
              aria-hidden
              className={cn("shrink-0", item.shape === "line" ? "h-0.5 w-3 rounded-full" : "h-2 w-2 rounded-[2px]")}
              style={{ backgroundColor: item.color }}
            />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function Readout({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-2xs text-muted-foreground">
      {label}
      <span className="readout text-xs font-semibold tabular-nums text-foreground">{value}</span>
    </span>
  );
}

export function PanelSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-1/3" />
      <div style={{ height }}>
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  );
}
