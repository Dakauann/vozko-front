import { MAX_LIVE_OBJECT_IDS } from "@/lib/advertising/report-query";
import type {
  AdAttributionWindow,
  AdLevel,
  AdRange,
  AdReportExportLabels,
  AdReportMetric,
  AdReportRun,
  AdReportRunRequest,
  AdReportRunRow,
} from "@/lib/advertising/types";

type PivotRow = AdReportRunRow & { groupStart: boolean };

export function pivotRows(rows: AdReportRunRow[]): PivotRow[] {
  return rows.map((row, index) => ({ ...row, groupStart: index === 0 || rows[index - 1].objectId !== row.objectId }));
}

export interface Bar {
  key: string;
  label: string;
  value: number | null;
}

export type ValueLabel = (breakdown: string, value: string) => string;

const DIMENSION_SEPARATOR = " · ";

export function reportBars(run: AdReportRun, valueLabel: ValueLabel): Bar[] {
  const metric = run.metrics[0];
  if (!metric) return [];
  return run.rows.map((row) => ({
    key: row.key,
    label:
      run.breakdowns.length > 0
        ? row.dimensions.map((value, index) => valueLabel(run.breakdowns[index], value)).join(DIMENSION_SEPARATOR)
        : row.name ?? row.key,
    value: row.values[metric] ?? null,
  }));
}

export interface ReportLabelTexts {
  object: string;
  day: string;
  total: string;
  breakdown: (breakdown: string) => string;
  value: ValueLabel;
  metric: (metric: AdReportMetric) => string;
}

export function exportLabels(run: AdReportRun, texts: ReportLabelTexts): AdReportExportLabels {
  const values: Record<string, Record<string, string>> = {};
  for (const row of run.rows) {
    row.dimensions.forEach((value, index) => {
      const breakdown = run.breakdowns[index];
      values[breakdown] = { ...values[breakdown], [value]: texts.value(breakdown, value) };
    });
  }
  return {
    object: texts.object,
    day: texts.day,
    total: texts.total,
    breakdowns: Object.fromEntries(run.breakdowns.map((breakdown) => [breakdown, texts.breakdown(breakdown)])),
    values,
    metrics: Object.fromEntries(run.metrics.map((metric) => [metric, texts.metric(metric)])),
  };
}

export const BREAKDOWN_METRICS: AdReportMetric[] = ["spend", "impressions", "reach", "results", "costPerResult", "cpm"];

export interface BreakdownRunInput {
  group: string[];
  level: AdLevel;
  range: AdRange;
  objectIds: string[];
  windows: AdAttributionWindow[];
}

export function breakdownRunRequest(input: BreakdownRunInput): AdReportRunRequest | null {
  if (input.objectIds.length === 0 || input.objectIds.length > MAX_LIVE_OBJECT_IDS) return null;
  return {
    definition: {
      view: "bars",
      level: input.level,
      breakdowns: input.group,
      metrics: BREAKDOWN_METRICS,
      datePreset: "custom",
      since: input.range.since,
      until: input.range.until,
    },
    range: input.range,
    objectIds: input.objectIds,
    windows: input.windows.length > 0 ? input.windows : undefined,
  };
}

export function hasReportData(run: AdReportRun): boolean {
  return run.view === "trend" ? run.series.length > 0 : run.rows.length > 0;
}
