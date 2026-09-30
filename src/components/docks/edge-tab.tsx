"use client";

import { forwardRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type EdgeTabSlot = "upper" | "lower";
export type EdgeTabStatus = "idle" | "live" | "alert";

const SLOT: Record<EdgeTabSlot, string> = {
  upper: "top-[calc(50%-7rem-3px)]",
  lower: "top-[calc(50%+3px)]",
};

const STRIP: Record<Exclude<EdgeTabStatus, "idle">, string> = {
  live: "bg-healthy",
  alert: "bg-warning",
};

interface EdgeTabProps {
  label: string;
  tabLabel: string;
  icon: ReactNode;
  onClick: () => void;
  slot: EdgeTabSlot;
  status?: EdgeTabStatus;
  decoration?: ReactNode;
  className?: string;
  dataBusy?: boolean;
}

export const EdgeTab = forwardRef<HTMLButtonElement, EdgeTabProps>(function EdgeTab(
  { label, tabLabel, icon, onClick, slot, status = "idle", decoration, className, dataBusy },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      data-busy={dataBusy}
      data-status={status}
      className={cn(
        "group fixed right-0 z-[60] flex h-28 w-9 flex-col items-center justify-center gap-2 rounded-l-xl bg-card text-foreground shadow-lg transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        SLOT[slot],
        className,
      )}
    >
      {decoration}
      <span aria-hidden className="absolute inset-0 rounded-[inherit] border border-r-0 border-border-strong bg-card" />
      {status !== "idle" ? (
        <span aria-hidden className={cn("absolute bottom-3 left-[3px] top-3 w-[3px] rounded-full", STRIP[status])} />
      ) : null}
      <span className="relative">{icon}</span>
      <span
        aria-hidden
        className="relative whitespace-nowrap text-2xs font-semibold tabular-nums text-foreground [writing-mode:vertical-rl]"
      >
        {tabLabel}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-semibold text-foreground opacity-0 shadow-md transition-opacity duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover:opacity-100 group-focus-visible:opacity-100 sm:block"
      >
        {label}
      </span>
    </button>
  );
});
