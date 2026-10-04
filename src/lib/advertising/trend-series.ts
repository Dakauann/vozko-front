import { formatDay } from "./date-range";
import type { AdLiveRow, AdMetrics } from "./types";

export type TrendMetric = "results" | "costPerResult" | "spend" | "impressions" | "linkClicks" | "cpm" | "ctr" | "conversations";

export type MetricFormat = "count" | "micros" | "percent";

export type TrendGranularity = "day" | "week" | "month" | "hour";

export const HOUR_BREAKDOWN = "hourly_stats_aggregated_by_advertiser_time_zone";

export const TREND_METRICS: { key: TrendMetric; format: MetricFormat }[] = [
  { key: "results", format: "count" },
  { key: "costPerResult", format: "micros" },
  { key: "spend", format: "micros" },
  { key: "impressions", format: "count" },
  { key: "linkClicks", format: "count" },
  { key: "cpm", format: "micros" },
  { key: "ctr", format: "percent" },
  { key: "conversations", format: "count" },
];

export const TREND_GRANULARITIES: TrendGranularity[] = ["day", "week", "month", "hour"];

export interface TrendRow {
  key: string;
  label: string;
  values: Partial<Record<TrendMetric, number | null>>;
}

export function metricFormat(metric: TrendMetric): MetricFormat {
  return TREND_METRICS.find((item) => item.key === metric)?.format ?? "count";
}

function valuesOf(metrics: AdMetrics): TrendRow["values"] {
  return Object.fromEntries(TREND_METRICS.map(({ key }) => [key, metrics[key]]));
}

export function bucketLabel(day: string, granularity: TrendGranularity, locale: string): string {
  if (granularity !== "month") return formatDay(day, locale);
  const [year, month] = day.split("-").map(Number);
  if (!year || !month) return day;
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function rowsFromTrend(points: (AdMetrics & { day: string })[], granularity: TrendGranularity, locale: string): TrendRow[] {
  return points.map((point) => ({ key: point.day, label: bucketLabel(point.day, granularity, locale), values: valuesOf(point) }));
}

export function rowsFromHours(rows: AdLiveRow[]): TrendRow[] {
  return rows
    .map((row) => ({ hour: (row.dimensions?.[HOUR_BREAKDOWN] ?? "").slice(0, 2), metrics: row.metrics }))
    .filter((row) => /^\d{2}$/.test(row.hour))
    .sort((a, b) => a.hour.localeCompare(b.hour))
    .map((row) => ({ key: row.hour, label: `${row.hour}h`, values: valuesOf(row.metrics) }));
}
