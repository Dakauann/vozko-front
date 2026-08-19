"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Page shapes: the layout a list page takes, derived from what its data is.
 *
 * Every list page in this product had converged on one composition — a row of
 * metric cards, then a table — regardless of whether the page held eighty
 * invoices or six agents. That shape is the framework default, not a decision:
 * a card is a box drawn around a number that needed no box, and repeating the
 * box on all of them spends the page's vertical budget before the rows start.
 *
 * The replacement is not variety for its own sake. Repetition is what lets an
 * attendant move between pages without relearning them, so the shape only
 * changes where the content genuinely changes:
 *
 * - `ReadoutBar`  — LEDGER. Many rows, numeric, scanned and filtered. The
 *                   summary is engraved on one line so the rows get the page.
 * - `StatusRail`  — ROSTER. Entities carrying status, acted on one at a time.
 *                   The distribution is the filter, so the summary does work
 *                   instead of just reporting.
 * - `GalleryGrid` — GALLERY. Few items whose identity matters more than their
 *                   fields. No table at all; the card carries real content.
 *
 * All three are console furniture: legends engrave, rules divide, and the lamp
 * is reserved for lit state. None of them draws a box around a number.
 */

/* --------------------------------------------------------------- SURFACES */

/**
 * The readable foreground for a filled surface class.
 *
 * Every token surface owns a paired `-foreground` that inverts with the theme;
 * `text-white` does not. Tiles that take their background as a prop or from a
 * lookup had a literal `text-white` baked into the container instead, so any
 * entry that resolved to `bg-muted` painted white on L92% in the default theme
 * and the glyph vanished. Deriving the pair from the fill keeps every caller
 * correct without threading a second class through each one.
 */
export function onSurface(bg: string): string {
  if (/\bbg-(?:muted|card|background|popover)\b/.test(bg)) {
    return "text-muted-foreground";
  }
  if (/\bbg-healthy\b/.test(bg)) return "text-healthy-foreground";
  if (/\bbg-warning\b/.test(bg)) return "text-warning-foreground";
  if (/\bbg-destructive\b/.test(bg)) return "text-destructive-foreground";
  if (/\bbg-primary\b/.test(bg)) return "text-primary-foreground";
  if (/\bbg-foreground\b/.test(bg)) return "text-background";
  // Saturated fills with no token pair (raw palette, brand hexes) are dark
  // enough for white, which is what they were already using.
  return "text-primary-foreground";
}

/* ------------------------------------------------------------------ LEDGER */

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

/**
 * One engraved line of legend/readout pairs.
 *
 * Use above a dense table when the numbers are context, not controls. The
 * values are `.readout` (tabular figures) so a changing total does not shift
 * the labels beside it.
 */
export function ReadoutBar({
  legend,
  readouts,
  right,
  className,
}: {
  /** Silkscreen label for the whole bar. Names the set, not the numbers. */
  legend?: string;
  readouts: Readout[];
  /** Controls that belong to the set as a whole (export, date range). */
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
                "readout whitespace-nowrap text-base font-semibold",
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

/* -------------------------------------------------------------- INSTRUMENT */

export interface Instrument {
  label: string;
  value: string;
  /** One line of provenance under the figure — what it counts, not a claim. */
  detail?: string;
  /** Long-form definition. Financial figures need one; most readouts do not. */
  tooltip?: string;
  tone?: ReadoutTone;
}

/**
 * A continuous strip of gauges for a page whose subject *is* its numbers.
 *
 * `ReadoutBar` is for numbers that give a table context. This is for numbers
 * that are the content — a financial overview, where each figure needs its own
 * scale and a line of provenance, and there is no table beneath to defer to.
 *
 * It is still not cards. The cards this replaces each carried a coloured accent
 * bar, a filled icon tile and a soft drop shadow, which is three decorations
 * per figure and a lifted surface in a system whose depth is engraved. Here the
 * strip is one panel, the figures are divided by the same hairline as every
 * other bank, and nothing is tinted that is not reporting a state.
 */
/** How many gauges sit across the strip at full width. */
const STRIP_COLUMNS: Record<3 | 4 | 8, string> = {
  3: "sm:grid-cols-2 xl:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  // Eight is an operations readout, not a financial one: the figures are small
  // integers read at a glance, so they take the density rather than the scale.
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
  columns?: 3 | 4 | 8;
  /** Operations density: smaller figure, tighter bank. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // A 1px border field with the cells sitting on it: the dividers between
        // gauges are hairlines, and they do not double up at the seams.
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
                "readout font-semibold leading-tight",
                compact ? "text-lg" : "text-xl",
                TONE_TEXT[inst.tone ?? "default"],
              )}
            >
              {inst.value}
            </span>
          )}

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

/**
 * The affordance for a tooltip, drawn rather than borrowed from a glyph set —
 * it needs to sit at legend scale (10px) where an icon-set circle-i turns to
 * mud, and it needs to be focusable so the definition is reachable by keyboard.
 */
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

/* ------------------------------------------------------------------ ROSTER */

export interface StatusSegment {
  /** Filter value this bank selects. */
  key: string;
  label: string;
  count: number;
  tone?: ReadoutTone;
}

/**
 * A bank per status, each showing its share of the roster, each a filter.
 *
 * The cards this replaces reported the same three numbers and did nothing with
 * them: the operator read "3 com erro", then went to a separate dropdown to
 * actually see those three. Here the number *is* the control, and the rule at
 * the foot of each bank carries its proportion — so the shape of the roster is
 * legible before any number is read.
 *
 * State is never colour alone: the selected bank sinks to `bg-muted`, its label
 * goes semibold, and it carries `aria-pressed`.
 */
export function StatusRail({
  segments,
  activeKey,
  onSelect,
  allLabel,
  className,
}: {
  segments: StatusSegment[];
  /** `null` means no filter — the "all" bank is lit. */
  activeKey: string | null;
  onSelect: (key: string | null) => void;
  allLabel: string;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  // The "all" bank carries a null key — it clears the filter rather than
  // setting one — so it cannot reuse StatusSegment's string key.
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
        // Share of the roster. The "all" bank is always full — it is the whole.
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
                ? "bg-primary-subtle text-primary-ink"
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

            {/* Proportion, engraved at the foot of the bank. Unlit banks keep
                the mark at reduced opacity so the shape stays readable while
                only the selection reports as lit. */}
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

/* ----------------------------------------------------------------- GALLERY */

/**
 * A grid for pages whose items are recognised, not scanned.
 *
 * The rule this enforces is what the card grid usually gets wrong: a card here
 * must carry the item's own content. A grid of identical icon-plus-title-plus-
 * one-line-description tiles is the table again, drawn worse and taking four
 * times the room — if that is all the item has, it belongs in a table.
 */
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

/**
 * One cell of a `GalleryGrid`.
 *
 * The grid is a 1px `bg-border` field and the cells sit on it, so the dividers
 * between them are the same engraved hairline the rest of the console uses —
 * not a gap, and not a border per card that doubles up at every seam.
 */
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
