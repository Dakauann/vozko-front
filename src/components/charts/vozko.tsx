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
