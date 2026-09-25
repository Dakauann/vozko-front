"use client";

import { Meter } from "@/components/charts/vozko";

export type ShareRow = {
  key: string;
  label: string;
  value: number;
  color?: string;
  share?: number | null;
};

export function ShareRows({
  rows,
  total,
  formatValue,
  formatShare,
}: {
  rows: ShareRow[];
  total?: number;
  formatValue: (value: number) => string;
  formatShare: (pct: number | null) => string;
}) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const pct = row.share !== undefined ? row.share : total && total > 0 ? (row.value / total) * 100 : null;
        return (
          <li
            key={row.key}
            className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto_3.25rem] items-center gap-2.5 text-sm"
          >
            <span className="truncate text-foreground" title={row.label}>
              {row.label}
            </span>
            <Meter value={pct ?? 0} color={row.color} size="lg" label={row.label} />
            <span className="readout text-right font-semibold tabular-nums text-foreground">{formatValue(row.value)}</span>
            <span className="readout text-right tabular-nums text-muted-foreground">{formatShare(pct)}</span>
          </li>
        );
      })}
    </ul>
  );
}
