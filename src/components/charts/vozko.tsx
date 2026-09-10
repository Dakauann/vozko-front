"use client";

/*
 * The Vozko chart grammar — one module so every graph in the product speaks
 * the board's language instead of recharts' defaults.
 *
 * What the board's own dashboard mock shows, translated to rules:
 *
 * - LINES ARE THE BRAND'S TRACES. A series line is 2.5px with a soft
 *   gradient fill dissolving to transparent below it (`<VozAreaGradient>`),
 *   no dots at rest, a ringed dot on hover. Series-1 is the brand green —
 *   a green-brand product charts its own numbers in its own colour.
 * - CHROME RECEDES. Horizontal grid only, dashed hairlines on the border
 *   token; axes carry no line and no tick marks, just 11px muted tabular
 *   labels (`vozGrid` / `vozXAxis` / `vozYAxis`).
 * - RADIAL MEANS RING, NEVER PIE. A single value is the board's progress
 *   ring (`<ProgressRing>`: thick rounded arc over a quiet track, the value
 *   in the display face at centre). A composition is a thin segmented ring
 *   (`<DonutRing>`: fat inner radius, card-coloured gaps, centre total) —
 *   the wedge pie is retired product-wide.
 * - TEXT WEARS TEXT TOKENS. Values and labels stay in foreground/muted ink;
 *   the coloured mark beside them carries identity (dataviz rule).
 *
 * Series colour comes from the chart tokens (--chart-1..5), validated
 * 2026-08-24 (six-checks): both themes pass CVD and normal-vision floors;
 * dark series-1 exceeds the generic lightness band deliberately — the board
 * pins glowing green charts, and thin marks + low-alpha fills carry the
 * mitigation. Amber (series-3) sits under 3:1 on white by nature of yellow,
 * so any chart using it must keep direct labels or a legend.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

/** The five series tokens, in their fixed assignment order. Assign hues by
 * ENTITY and never re-map when a filter changes the series count. */
export const VOZ_SERIES = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

/** Recessive chart chrome: horizontal hairlines only, dashed, on the border
 * token so they re-theme. Spread into <CartesianGrid {...vozGrid} />. */
export const vozGrid = {
  vertical: false,
  stroke: "hsl(var(--border))",
  strokeDasharray: "3 6",
} as const;

/** Quiet axes: no axis line, no tick marks, muted 11px tabular labels.
 * Spread into <XAxis {...vozXAxis} /> / <YAxis {...vozYAxis} />. */
export const vozXAxis = {
  axisLine: false,
  tickLine: false,
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
  tickMargin: 8,
} as const;

export const vozYAxis = {
  axisLine: false,
  tickLine: false,
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
  width: 40,
} as const;

/** The line/area mark spec: 2.5px, no resting dots, a ringed hover dot whose
 * ring is the card colour so it reads as a gap. Spread into <Area>/<Line>. */
export const vozLineMark = {
  strokeWidth: 2.5,
  dot: false,
  activeDot: { r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" },
} as const;

/**
 * The soft fill under a series line — the board's dissolve. Render inside
 * the chart's <defs> and reference with `fill="url(#voz-fill-<id>)"`.
 */
export function VozAreaGradient({
  id,
  color = VOZ_SERIES[0],
}: {
  id: string;
  color?: string;
}) {
  return (
    <linearGradient id={`voz-fill-${id}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.28} />
      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
    </linearGradient>
  );
}

/* ------------------------------------------------------------------ */
/* ProgressRing — the board's "75%" element, drawn exactly: a thick    */
/* rounded arc over a quiet full-circle track, value at centre in the  */
/* display face. For ONE value against a whole.                        */
/* ------------------------------------------------------------------ */

export function ProgressRing({
  value,
  label,
  size = 112,
  strokeWidth = 10,
  color = "hsl(var(--primary))",
  className,
  children,
}: {
  /** 0–100. Clamped. */
  value: number;
  /** Accessible name; also the quiet caption under the number when no
   * children are given. */
  label?: string;
  size?: number;
  strokeWidth?: number;
  /** Defaults to the brand; pass a status token when the ring reports
   * state (e.g. hsl(var(--warning))). */
  color?: string;
  className?: string;
  /** Custom centre content; replaces the default value+label stack. */
  children?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="img"
      aria-label={label ? `${label}: ${Math.round(clamped)}%` : `${Math.round(clamped)}%`}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* The track: a full quiet ring, not an absence. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset] duration-500 ease-panel"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ?? (
          <>
            <span className="readout font-display font-semibold leading-none text-foreground" style={{ fontSize: size * 0.22 }}>
              {Math.round(clamped)}%
            </span>
            {label ? (
              <span className="mt-1 max-w-[80%] truncate text-2xs text-muted-foreground">
                {label}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* RadialGauge — the half-circle variant for quality/score readouts.   */
/* Same material as ProgressRing: rounded value arc on a quiet track.  */
/* ------------------------------------------------------------------ */

export function RadialGauge({
  value,
  label,
  size = 160,
  strokeWidth = 12,
  color = "hsl(var(--primary))",
  className,
  children,
}: {
  /** 0–100. Clamped. */
  value: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const half = Math.PI * r;
  const height = size / 2 + strokeWidth / 2;
  return (
    <div
      role="img"
      aria-label={label ? `${label}: ${Math.round(clamped)}%` : `${Math.round(clamped)}%`}
      className={cn("relative inline-flex items-end justify-center", className)}
      style={{ width: size, height }}
    >
      <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={half}
          strokeDashoffset={half * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset] duration-500 ease-panel"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        {children ?? (
          <>
            <span className="readout font-display font-semibold leading-none text-foreground" style={{ fontSize: size * 0.19 }}>
              {Math.round(clamped)}%
            </span>
            {label ? (
              <span className="mt-0.5 max-w-full truncate text-2xs text-muted-foreground">
                {label}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut ring geometry — the shared shape values for a SEGMENTED ring  */
/* built with recharts <Pie>. Spread into the Pie element so every     */
/* composition ring in the product has the same anatomy: thin ring,    */
/* card-coloured gaps, small rounded segment corners, no wedges.       */
/*                                                                     */
/*   <Pie {...vozRing(56, 44)} data={…} dataKey="value">               */
/* ------------------------------------------------------------------ */

export function vozRing(outerRadius: number | string, innerRadius: number | string) {
  return {
    outerRadius,
    innerRadius,
    paddingAngle: 2.5,
    cornerRadius: 3,
    stroke: "hsl(var(--card))",
    strokeWidth: 2,
  } as const;
}

/* ==================================================================== */
/* THE DENSE FORMS                                                      */
/*                                                                      */
/* Added 2026-09-10, because the ops dashboards had drifted into rows   */
/* of bordered boxes each holding one number. A box around a number is  */
/* not a visualization, it is a number wearing a card, and this repo's  */
/* own page-shape rules already said so ("None of them draws a box      */
/* around a number"). These are the forms that replace them.            */
/*                                                                      */
/* Each is chosen by the JOB the data does, never for variety:          */
/*                                                                      */
/*   Meter        one ratio against its whole            -> a track     */
/*   SegmentBar   a population split into named parts    -> one bar     */
/*   CompareBars  a few magnitudes on a shared scale     -> a bar list  */
/*   SplitFlow    two opposed directions of one flow     -> centred bar */
/*                                                                      */
/* These lightweight forms share tokens with the existing Recharts     */
/* charts and the advanced ECharts forms in composition-charts.tsx.    */
/* Engine choice does not change colour identity, units or typography. */
/* ==================================================================== */

/** Track height for every horizontal value bar in the product. Thin on
 * purpose: a value bar is a mark, not a slab, and the dark brand green is
 * only allowed to be a large fill at low alpha. */
const TRACK_H = { sm: "h-1", md: "h-1.5", lg: "h-2" } as const;

export type VozBarSize = keyof typeof TRACK_H;

/**
 * Meter - one ratio against its whole.
 *
 * The honest form for "43% of finished conversations were reopened": a filled
 * track on the same ramp, so the unfilled remainder is visible as the rest of
 * the whole instead of merely implied. Never a two-slice donut.
 */
export function Meter({
  value,
  color = "hsl(var(--chart-1))",
  size = "md",
  className,
  label,
}: {
  /** 0-100. Clamped. */
  value: number;
  color?: string;
  size?: VozBarSize;
  className?: string;
  /** Accessible name; the visible label is rendered by the caller. */
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("w-full overflow-hidden rounded-full bg-muted", TRACK_H[size], className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-panel"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export type VozSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

/**
 * SegmentBar - one population split into named parts.
 *
 * Segments are separated by a 2px surface GAP rather than a border: a border
 * draws a line around a mark, a gap lets the sheet show through, and only the
 * outermost ends round.
 *
 * Identity never rests on colour. The legend is on by default and names every
 * segment beside its own swatch.
 */
export function SegmentBar({
  segments,
  size = "lg",
  legend = true,
  formatValue,
  className,
}: {
  segments: VozSegment[];
  size?: VozBarSize;
  legend?: boolean;
  formatValue?: (value: number, pct: number) => string;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const live = segments.filter((s) => s.value > 0);

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("flex w-full overflow-hidden rounded-full bg-muted", TRACK_H[size])}>
        {total > 0
          ? live.map((s, i) => (
              <div
                key={s.key}
                className="h-full"
                style={{
                  width: `${(s.value / total) * 100}%`,
                  backgroundColor: s.color,
                  marginLeft: i === 0 ? undefined : 2,
                }}
                title={`${s.label}: ${s.value}`}
              />
            ))
          : null}
      </div>
      {legend ? (
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {segments.map((s) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            return (
              <li key={s.key} className="flex items-baseline gap-1.5 text-2xs">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 translate-y-[1px] rounded-[2px]"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="readout font-semibold tabular-nums text-foreground">
                  {formatValue ? formatValue(s.value, pct) : s.value}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export type CompareRow = {
  key: string;
  label: string;
  /** Bar length. Null renders the row as unmeasured rather than as zero. */
  value: number | null;
  /** Right-hand readout, pre-formatted by the caller (units, locale). */
  display: string;
  /** Quiet trailing note: sample counts, denominators. */
  hint?: string;
  color?: string;
};

/**
 * CompareBars - a few magnitudes read against each other on ONE shared scale.
 *
 * This is what a row of stat tiles was pretending to be. Four numbers in four
 * boxes cannot be compared without the reader doing the arithmetic; four bars
 * on a shared maximum are compared by looking.
 *
 * `emphasisKey` is the most underused form in the system: one row in the
 * accent, the rest quiet, when the story is one of them.
 */
export function CompareBars({
  rows,
  emphasisKey,
  size = "md",
  className,
}: {
  rows: CompareRow[];
  emphasisKey?: string;
  size?: VozBarSize;
  className?: string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.value ?? 0), 0);
  return (
    <ul className={cn("space-y-2", className)}>
      {rows.map((r) => {
        const emphasised = !emphasisKey || r.key === emphasisKey;
        const color =
          r.color ?? (emphasised ? "hsl(var(--chart-1))" : "hsl(var(--muted-foreground) / 0.45)");
        return (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-2xs font-semibold text-muted-foreground">
                {r.label}
              </span>
              <span
                className={cn(
                  "readout shrink-0 text-sm font-semibold tabular-nums",
                  r.value === null ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {r.display}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Meter
                value={max > 0 && r.value !== null ? (r.value / max) * 100 : 0}
                color={color}
                size={size}
                label={r.label}
              />
              {r.hint ? (
                <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                  {r.hint}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * SplitFlow - two opposed directions of one flow, centred on the divide.
 *
 * Inbound and outbound are not two categories, they are one exchange with a
 * direction, so they read as one bar growing from a shared middle. Two boxes
 * reporting "3,2" and "4,1" hide the only thing that matters: which way the
 * conversation leans.
 */
export function SplitFlow({
  left,
  right,
  className,
}: {
  left: { label: string; value: number; display: string; color?: string };
  right: { label: string; value: number; display: string; color?: string };
  className?: string;
}) {
  const total = Math.max(0, left.value) + Math.max(0, right.value);
  const leftPct = total > 0 ? (Math.max(0, left.value) / total) * 100 : 50;
  const leftColor = left.color ?? "hsl(var(--chart-4))";
  const rightColor = right.color ?? "hsl(var(--chart-1))";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-2xs">
        <span className="flex items-baseline gap-1.5">
          <span
            aria-hidden
            className="h-2 w-2 translate-y-[1px] rounded-[2px]"
            style={{ backgroundColor: leftColor }}
          />
          <span className="text-muted-foreground">{left.label}</span>
          <span className="readout font-semibold tabular-nums text-foreground">
            {left.display}
          </span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="readout font-semibold tabular-nums text-foreground">
            {right.display}
          </span>
          <span className="text-muted-foreground">{right.label}</span>
          <span
            aria-hidden
            className="h-2 w-2 translate-y-[1px] rounded-[2px]"
            style={{ backgroundColor: rightColor }}
          />
        </span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full transition-[width] duration-300 ease-panel"
          style={{ width: `${leftPct}%`, backgroundColor: leftColor, marginRight: 2 }}
        />
        <div className="h-full flex-1" style={{ backgroundColor: rightColor }} />
      </div>
    </div>
  );
}
