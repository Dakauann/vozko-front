"use client";

import * as React from "react";

import { CaretDown } from "@/components/icons";
import { cn } from "@/lib/utils";

export type ConfigCardStatusTone = "active" | "inactive" | "warning";

const STATUS_TONE_CLASS: Record<ConfigCardStatusTone, string> = {
  active: "bg-healthy text-healthy-foreground",
  inactive: "bg-muted text-muted-foreground",
  warning: "bg-warning text-warning-foreground",
};

export function ConfigCardShell({
  open,
  onToggle,
  icon,
  title,
  description,
  statusLabel,
  statusTone,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  statusLabel: string;
  statusTone: ConfigCardStatusTone;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[--radius] border border-border bg-card shadow-sm p-5 space-y-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground shadow">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              {description}
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-[--radius] px-2.5 py-1 text-2xs font-semibold",
              STATUS_TONE_CLASS[statusTone],
            )}
          >
            {statusLabel}
          </span>
          <CaretDown
            weight="bold"
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      {open ? <div className="space-y-4">{children}</div> : null}
    </div>
  );
}
