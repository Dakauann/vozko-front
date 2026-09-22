"use client";

import { ReactNode } from "react";

import { ArrowDown, ArrowUp, ArrowsDownUp } from "@/components/icons";
import { cn } from "@/lib/utils";


export type SortDirection = "asc" | "desc";

export interface ColumnSort {
  key: string;
  direction: SortDirection;
}

export function SortableColumnHead({
  label,
  sortKey,
  sorts,
  onToggle,
  className,
  buttonClassName,
}: {
  label: ReactNode;
  sortKey?: string;
  sorts?: readonly ColumnSort[];
  onToggle?: (key: string, options: { additive: boolean }) => void;
  className?: string;
  buttonClassName?: string;
}) {
  const sortable = !!(sortKey && onToggle);
  const activeIndex = sortable ? (sorts ?? []).findIndex((s) => s.key === sortKey) : -1;
  const active = activeIndex >= 0 ? sorts![activeIndex] : undefined;

  return (
    <th
      className={className}
      scope="col"
      aria-sort={
        active ? (active.direction === "asc" ? "ascending" : "descending") : sortable ? "none" : undefined
      }
    >
      {sortable ? (
        <button
          type="button"
          onClick={(e) => onToggle!(sortKey!, { additive: e.shiftKey })}
          className={cn(
            "group/sort -mx-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
            active && "text-foreground",
            buttonClassName,
          )}
        >
          <span>{label}</span>
          {
}
          {active ? (
            active.direction === "asc" ? (
              <ArrowUp weight="bold" className="h-3 w-3" />
            ) : (
              <ArrowDown weight="bold" className="h-3 w-3" />
            )
          ) : (
            <ArrowsDownUp weight="bold" className="h-3 w-3 opacity-0 transition-opacity group-hover/sort:opacity-60" />
          )}
          {
}
          {active && (sorts?.length ?? 0) > 1 ? (
            <span className="text-2xs tabular-nums text-muted-foreground">{activeIndex + 1}</span>
          ) : null}
        </button>
      ) : (
        label
      )}
    </th>
  );
}
