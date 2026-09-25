"use client";

import { Cell, Pie, PieChart } from "recharts";

import { vozRing } from "@/components/charts/vozko";

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export function DonutBreakdown({
  slices,
  total,
  centerValue,
  centerLabel,
  formatValue,
  formatShare,
  size = 152,
}: {
  slices: DonutSlice[];
  total: number;
  centerValue: string;
  centerLabel: string;
  formatValue: (value: number) => string;
  formatShare: (pct: number | null) => string;
  size?: number;
}) {
  const drawn = slices.filter((slice) => slice.value > 0);
  const outer = size / 2 - 2;

  return (
    <div className="space-y-3">
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <PieChart width={size} height={size}>
          <Pie
            data={drawn}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            isAnimationActive={false}
            {...vozRing(outer, Math.round(outer * 0.76))}
          >
            {drawn.map((slice) => (
              <Cell key={slice.key} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="readout font-display text-2xl font-semibold leading-none text-foreground">{centerValue}</span>
          <span className="mt-1 max-w-[80%] truncate text-2xs text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <ul className="space-y-1.5">
        {slices.map((slice) => (
          <li
            key={slice.key}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_3.25rem] items-center gap-2 text-sm"
          >
            <span aria-hidden className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: slice.color }} />
            <span className="truncate text-foreground" title={slice.label}>
              {slice.label}
            </span>
            <span className="readout font-semibold tabular-nums text-foreground">{formatValue(slice.value)}</span>
            <span className="readout text-right tabular-nums text-muted-foreground">
              {formatShare(total > 0 ? (slice.value / total) * 100 : null)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
