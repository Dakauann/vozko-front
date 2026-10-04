import { resultCount } from "@/lib/advertising/delivery";
import { LIVE_COLUMNS, isLiveColumn, liveValue, type LiveColumn, type ManagerRow } from "@/lib/advertising/live";
import type { AdRow } from "@/lib/advertising/types";

export const REPORT_COLUMNS = [
  "delivery",
  "results",
  "costPerResult",
  "budget",
  "spend",
  "impressions",
  "linkClicks",
  "cpc",
  "ctr",
  "clicks",
  "cpm",
  "crmConversations",
  "costPerLead",
  "roas",
] as const;

export type ReportColumn = (typeof REPORT_COLUMNS)[number];

export const METRIC_COLUMNS = [...REPORT_COLUMNS, ...LIVE_COLUMNS] as const;

export type MetricColumn = ReportColumn | LiveColumn;

export const COLUMN_PRESETS = ["performance", "performanceClicks", "engagement", "delivery"] as const;

export type ColumnPreset = (typeof COLUMN_PRESETS)[number];

const PRESET_COLUMNS: Record<ColumnPreset, readonly MetricColumn[]> = {
  performance: ["delivery", "results", "costPerResult", "budget", "spend", "impressions", "crmConversations", "costPerLead", "roas"],
  performanceClicks: ["delivery", "results", "reach", "frequency", "costPerResult", "budget", "spend", "impressions", "cpm", "linkClicks", "cpc", "ctr", "clicks", "crmConversations"],
  engagement: ["delivery", "results", "costPerResult", "spend", "impressions", "linkClicks", "ctr", "videoPlays", "thruPlays", "costPerThruPlay"],
  delivery: ["delivery", "budget", "spend", "impressions", "cpm", "reach", "frequency"],
};

export function presetColumns(preset: ColumnPreset): MetricColumn[] {
  const chosen = new Set(PRESET_COLUMNS[preset]);
  return METRIC_COLUMNS.filter((column) => chosen.has(column));
}

export function presetOf(visible: MetricColumn[]): ColumnPreset | null {
  const shown = new Set(visible);
  return (
    COLUMN_PRESETS.find((preset) => {
      const columns = PRESET_COLUMNS[preset];
      return columns.length === shown.size && columns.every((column) => shown.has(column));
    }) ?? null
  );
}

export const DEFAULT_COLUMNS: MetricColumn[] = presetColumns("performance");

export type SortableColumn = "name" | MetricColumn;

export function isMetricColumn(value: unknown): value is MetricColumn {
  return typeof value === "string" && (METRIC_COLUMNS as readonly string[]).includes(value);
}

export function parseVisibleColumns(raw: string | null): MetricColumn[] {
  if (!raw) return [...DEFAULT_COLUMNS];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_COLUMNS];
    const chosen = new Set(parsed.filter(isMetricColumn));
    return METRIC_COLUMNS.filter((column) => chosen.has(column));
  } catch {
    return [...DEFAULT_COLUMNS];
  }
}

export function toggleColumn(visible: MetricColumn[], column: MetricColumn): MetricColumn[] {
  const chosen = new Set(visible);
  if (chosen.has(column)) chosen.delete(column);
  else chosen.add(column);
  return METRIC_COLUMNS.filter((c) => chosen.has(c));
}

export function needsLiveData(visible: MetricColumn[]): boolean {
  return visible.some(isLiveColumn);
}

type SortableRow = AdRow & Partial<Pick<ManagerRow, "live">>;

export function sortValue(row: SortableRow, column: SortableColumn): string | number | null {
  if (isLiveColumn(column)) return liveValue(row.live ?? null, column);
  switch (column) {
    case "name":
      return row.name.toLocaleLowerCase();
    case "delivery":
      return row.delivery;
    case "results":
      return resultCount(row.metrics);
    case "costPerResult":
      return row.metrics.costPerResult;
    case "budget":
      return row.dailyBudget > 0 ? row.dailyBudget : row.lifetimeBudget > 0 ? row.lifetimeBudget : null;
    case "spend":
      return row.metrics.spend;
    case "impressions":
      return row.metrics.impressions;
    case "linkClicks":
      return row.metrics.linkClicks;
    case "cpc":
      return row.metrics.cpc;
    case "clicks":
      return row.metrics.clicks;
    case "ctr":
      return row.metrics.ctr;
    case "cpm":
      return row.metrics.cpm;
    case "crmConversations":
      return row.outcome.conversations;
    case "costPerLead":
      return row.outcome.costPerLead;
    case "roas":
      return row.outcome.roas;
  }
}

export interface RowSort {
  key: SortableColumn;
  direction: "asc" | "desc";
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function sortRows<T extends SortableRow>(rows: T[], sort: RowSort | null): T[] {
  if (!sort) return rows;
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = sortValue(left, sort.key);
    const b = sortValue(right, sort.key);
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return compareValues(a, b) * factor;
  });
}

export function nextSort(current: RowSort | null, key: SortableColumn): RowSort | null {
  if (!current || current.key !== key) return { key, direction: key === "name" ? "asc" : "desc" };
  const firstDirection = key === "name" ? "asc" : "desc";
  if (current.direction === firstDirection) return { key, direction: firstDirection === "asc" ? "desc" : "asc" };
  return null;
}

export function isSortableColumn(value: string): value is SortableColumn {
  return value === "name" || isMetricColumn(value);
}
