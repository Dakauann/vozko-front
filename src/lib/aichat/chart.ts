import { CHART_OTHER_CATEGORY, type ChatChart, type ChatValueKind } from "./types";

export interface ValueFormatter {
  na: string;
  num: (v: number | null | undefined) => string;
  pct: (v: number | null | undefined) => string;
  mins: (v: number | null | undefined) => string;
  money: (cents: number | null | undefined) => string;
}

export function formatChartValue(fmt: ValueFormatter, kind: ChatValueKind, value: number | null | undefined): string {
  if (value === null || value === undefined) return fmt.na;
  switch (kind) {
    case "percent":
      return fmt.pct(value);
    case "minutes":
      return fmt.mins(value);
    case "money":
      return fmt.money(value);
    default:
      return fmt.num(value);
  }
}

export type ChartRow = { category?: string; x?: number | null } & Record<string, string | number | null | undefined>;

export function seriesKey(index: number): string {
  return `s${index}`;
}

export function chartRows(chart: ChatChart, otherLabel: string): ChartRow[] {
  const length = chart.categories?.length ?? chart.xValues?.length ?? 0;
  return Array.from({ length }, (_, i) => {
    const row: ChartRow = {};
    if (chart.categories) {
      const category = chart.categories[i];
      row.category = category === CHART_OTHER_CATEGORY ? otherLabel : category;
    } else {
      row.x = chart.xValues?.[i] ?? null;
    }
    chart.series.forEach((s, j) => {
      row[seriesKey(j)] = s.values[i] ?? null;
    });
    return row;
  });
}
