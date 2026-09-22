"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";



export function onSurface(bg: string): string {
  if (/\bbg-(?:muted|card|background|popover)\b/.test(bg)) {
    return "text-muted-foreground";
  }
  if (/\bbg-healthy\b/.test(bg)) return "text-healthy-foreground";
  if (/\bbg-warning\b/.test(bg)) return "text-warning-foreground";
  if (/\bbg-destructive\b/.test(bg)) return "text-destructive-foreground";
  if (/\bbg-primary\b/.test(bg)) return "text-primary-foreground";
  if (/\bbg-foreground\b/.test(bg)) return "text-background";
  return "text-primary-foreground";
}


export type ReadoutTone = "default" | "healthy" | "fault" | "warning";

const TONE_TEXT: Record<ReadoutTone, string> = {
  default: "text-foreground",
  healthy: "text-healthy-ink",
  fault: "text-destructive-ink",
  warning: "text-warning-ink",
};

const TONE_BAR: Record<ReadoutTone, string> = {
  default: "bg-lamp",
  healthy: "bg-healthy",
  fault: "bg-destructive",
  warning: "bg-warning",
};

export interface Readout {
  label: string;
  value: ReactNode;
  tone?: ReadoutTone;
}

export function ReadoutBar({
  legend,
  readouts,
  right,
  className,
}: {
  legend?: string;
  readouts: Readout[];
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-stretch border border-border bg-card",
        className,
      )}
    >
      {legend ? (
        <div className="flex items-center border-r border-border px-3 py-2">
          <span className="legend">{legend}</span>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-wrap items-center">
        {readouts.map((r) => (
          <div
            key={r.label}
            className="flex min-w-0 items-baseline gap-2 border-r border-border px-3 py-2 last:border-r-0"
          >
            <span className="legend">{r.label}</span>
            <span
              className={cn(
                "readout font-display whitespace-nowrap text-base font-semibold",
                TONE_TEXT[r.tone ?? "default"],
              )}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {right ? (
        <div className="flex items-center gap-2 border-l border-border px-3 py-2">
          {right}
        </div>
      ) : null}
    </div>
  );
}


export interface Instrument {
  label: string;
  value: string;
  detail?: string;
  tooltip?: string;
  tone?: ReadoutTone;
  chart?: ReactNode;
}

const STRIP_COLUMNS: Record<2 | 3 | 4 | 8, string> = {
  2: "grid-cols-2",
  3: "sm:grid-cols-2 xl:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  8: "grid-cols-2 sm:grid-cols-4 xl:grid-cols-8",
};

export function InstrumentStrip({
  instruments,
  loading,
  columns = 3,
  compact = false,
  className,
}: {
  instruments: Instrument[];
  loading?: boolean;
  columns?: 2 | 3 | 4 | 8;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-px border border-border bg-border",
        STRIP_COLUMNS[columns],
        className,
      )}
    >
      {instruments.map((inst) => (
        <div
          key={inst.label}
          className={cn(
            "flex min-w-0 flex-col gap-1 bg-card",
            compact ? "px-3 py-2.5" : "px-4 py-3",
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="legend leading-[1.35] sm:truncate">{inst.label}</span>
            {inst.tooltip ? (
              <span className="relative flex-shrink-0">
                <InfoGlyph />
                <span className="pointer-events-none fixed inset-x-3 bottom-auto z-50 mb-2 w-auto border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground opacity-0 shadow-xl transition-opacity duration-DEFAULT peer-hover:opacity-100 peer-focus-visible:opacity-100 sm:absolute sm:bottom-full sm:left-0 sm:inset-x-auto sm:w-60">
                  {inst.tooltip}
                </span>
              </span>
            ) : null}
          </div>

          {loading ? (
            <span className="mt-0.5 block h-6 w-28 animate-pulse rounded-md bg-border" />
          ) : (
            <span
              className={cn(
                "readout font-display font-semibold leading-tight",
                compact ? "text-lg" : "text-xl",
                TONE_TEXT[inst.tone ?? "default"],
              )}
            >
              {inst.value}
            </span>
          )}

          {inst.chart && !loading ? <div className="my-0.5 min-w-0">{inst.chart}</div> : null}
          {inst.detail && !loading ? (
            <span className="truncate text-xs text-muted-foreground">
              {inst.detail}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function InfoGlyph() {
  return (
    <button
      type="button"
      aria-label="?"
      className="peer relative flex h-3 w-3 items-center justify-center border border-border text-2xs font-bold leading-none text-muted-foreground before:absolute before:-inset-[11px] before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:before:hidden"
    >
      ?
    </button>
  );
}


export interface StatusSegment {
  key: string;
  label: string;
  count: number;
  tone?: ReadoutTone;
}

export function StatusRail({
  segments,
  activeKey,
  onSelect,
  allLabel,
  className,
}: {
  segments: StatusSegment[];
  activeKey: string | null;
  onSelect: (key: string | null) => void;
  allLabel: string;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  type Bank = Omit<StatusSegment, "key"> & { key: string | null };
  const banks: Bank[] = [
    { key: null, label: allLabel, count: total, tone: "default" },
    ...segments,
  ];

  return (
    <div
      className={cn(
        "flex flex-wrap items-stretch border border-border bg-card",
        className,
      )}
      role="group"
    >
      {banks.map((bank) => {
        const selected = activeKey === bank.key;
        const share =
          bank.key === null || total === 0 ? 1 : bank.count / total;
        return (
          <button
            key={bank.key ?? "__all"}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(selected ? null : bank.key)}
            className={cn(
              "group relative min-w-[7rem] flex-1 border-l border-border px-3 pb-2.5 pt-2 text-left transition-colors duration-DEFAULT first:border-l-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-muted text-foreground shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
                : "hover:bg-muted",
            )}
          >
            <span
              className={cn(
                "legend block",
                selected && "text-foreground",
              )}
            >
              {bank.label}
            </span>
            <span
              className={cn(
                "readout mt-0.5 block text-lg leading-none",
                selected ? "font-semibold" : "font-medium",
                TONE_TEXT[bank.tone ?? "default"],
              )}
            >
              {bank.count}
            </span>

            {
}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 block h-0.5 rounded-full bg-border"
            >
              <span
                className={cn(
                  "block h-full transition-[width,opacity] duration-DEFAULT",
                  TONE_BAR[bank.tone ?? "default"],
                  selected ? "opacity-100" : "opacity-45",
                )}
                style={{ width: `${Math.round(share * 100)}%` }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}


export function GalleryGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-px border border-border bg-border",
        "sm:grid-cols-2 xl:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function GalleryCell({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const base = cn(
    "flex min-w-0 flex-col gap-2 bg-card p-4 text-left transition-colors duration-DEFAULT",
    className,
  );
  if (!onClick) return <div className={base}>{children}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        base,
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {children}
    </button>
  );
}
