"use client";


import * as React from "react";

import { cn } from "@/lib/utils";

export const VOZ_SERIES = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

export const vozGrid = {
  vertical: false,
  stroke: "hsl(var(--border))",
  strokeDasharray: "3 6",
} as const;

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

export const vozLineMark = {
  strokeWidth: 2.5,
  dot: false,
  activeDot: { r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" },
} as const;

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


export function ProgressRing({
  value,
  label,
  size = 112,
  strokeWidth = 10,
  color = "hsl(var(--primary))",
  className,
  children,
}: {
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
  const c = 2 * Math.PI * r;
  return (
    <div
      role="img"
      aria-label={label ? `${label}: ${Math.round(clamped)}%` : `${Math.round(clamped)}%`}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {}
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


export function RadialGauge({
  value,
  label,
  size = 160,
  strokeWidth = 12,
  color = "hsl(var(--primary))",
  className,
  children,
}: {
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


const TRACK_H = { sm: "h-1", md: "h-1.5", lg: "h-2" } as const;

export type VozBarSize = keyof typeof TRACK_H;

export function Meter({
  value,
  color = "hsl(var(--chart-1))",
  size = "md",
  className,
  label,
}: {
  value: number;
  color?: string;
  size?: VozBarSize;
  className?: string;
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
  value: number | null;
  display: string;
  hint?: string;
  color?: string;
};

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
