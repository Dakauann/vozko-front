import { ADVERTISING_REPORTS_PATH } from "@/lib/advertising/connect";
import { resolveRange } from "@/lib/advertising/date-range";
import type {
  AdRange,
  AdReportDefinition,
  AdReportExport,
  AdReportMetric,
  AdReportPreset,
  AdReportRunRequest,
  AdReportTemplate,
  AdReportView,
  AdSavedReport,
  AdSavedReportInput,
} from "@/lib/advertising/types";

export const BLANK_REPORT_DEFINITION: AdReportDefinition = {
  view: "pivot",
  level: "campaign",
  breakdowns: [],
  metrics: ["spend", "impressions", "reach", "results", "costPerResult"],
  datePreset: "last30",
};

export interface ReportDraft {
  name: string;
  adAccountId: string;
  definition: AdReportDefinition;
}

export function customDays(definition: AdReportDefinition): AdRange {
  return { since: definition.since ?? "", until: definition.until ?? "" };
}

export function reportRange(definition: AdReportDefinition, today: string | null): AdRange | null {
  return resolveRange(definition.datePreset, customDays(definition), today);
}

function withoutCustomDays(definition: AdReportDefinition): AdReportDefinition {
  const { since, until, ...rest } = definition;
  return definition.datePreset === "custom" ? { ...rest, since, until } : rest;
}

export function withRange(definition: AdReportDefinition, preset: AdReportPreset, custom: AdRange): AdReportDefinition {
  if (preset !== "custom") return withoutCustomDays({ ...definition, datePreset: preset });
  return { ...definition, datePreset: "custom", since: custom.since, until: custom.until };
}

function toggled<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

export function toggleMetric(metrics: AdReportMetric[], metric: AdReportMetric): AdReportMetric[] {
  return toggled(metrics, metric);
}

export function toggleBreakdown(breakdowns: string[], breakdown: string): string[] {
  return toggled(breakdowns, breakdown);
}

export function trendMetrics(metrics: AdReportMetric[], allowed: AdReportMetric[]): AdReportMetric[] {
  return metrics.filter((metric) => allowed.includes(metric));
}

export function withView(definition: AdReportDefinition, view: AdReportView, allowedTrend: AdReportMetric[]): AdReportDefinition {
  if (view !== "trend") return { ...definition, view };
  return { ...definition, view, breakdowns: [], metrics: trendMetrics(definition.metrics, allowedTrend) };
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

export function breakdownToggleAllowed(selected: string[], breakdown: string, groups: string[][]): boolean {
  const next = toggleBreakdown(selected, breakdown);
  return next.length === 0 || groups.some((group) => sameSet(group, next));
}

export function reportRunRequest(definition: AdReportDefinition, range: AdRange | null, allowedTrend: AdReportMetric[]): AdReportRunRequest | null {
  if (!range || definition.metrics.length === 0) return null;
  if (definition.view === "trend" && trendMetrics(definition.metrics, allowedTrend).length !== definition.metrics.length) return null;
  return { definition, range };
}

function comparable(draft: ReportDraft): string {
  return JSON.stringify({
    name: draft.name.trim(),
    adAccountId: draft.adAccountId,
    definition: withoutCustomDays(draft.definition),
  });
}

export function isReportDirty(saved: ReportDraft, current: ReportDraft): boolean {
  return comparable(saved) !== comparable(current);
}

export function reportInput(draft: ReportDraft, untitled: string): AdSavedReportInput {
  return {
    name: draft.name.trim() || untitled,
    adAccountId: draft.adAccountId,
    definition: withoutCustomDays(draft.definition),
  };
}

export function resolveTemplate(templates: AdReportTemplate[], key: string | null): AdReportTemplate | null {
  if (!key) return null;
  return templates.find((template) => template.key === key) ?? null;
}

export function newReportHref(accountId: string): string {
  return `${ADVERTISING_REPORTS_PATH}/new?${new URLSearchParams({ account: accountId }).toString()}`;
}

export function reportStamp(iso: string | undefined, locale: string, timeZone?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone }).format(date);
}

export function filterReports(reports: AdSavedReport[], accountId: string, search: string): AdSavedReport[] {
  const query = search.trim().toLocaleLowerCase();
  return reports.filter((report) => report.adAccountId === accountId && report.name.toLocaleLowerCase().includes(query));
}

export type ReportsSection = "reports" | "exports";

const SECTION_PARAM = "section";

export function reportsSection(params: Pick<URLSearchParams, "get">): ReportsSection {
  return params.get(SECTION_PARAM) === "exports" ? "exports" : "reports";
}

export function reportsListHref(accountId: string, section: ReportsSection): string {
  const params = new URLSearchParams({ account: accountId });
  if (section === "exports") params.set(SECTION_PARAM, section);
  return `${ADVERTISING_REPORTS_PATH}?${params.toString()}`;
}

export function exportsForAccount(exports: AdReportExport[], accountId: string): AdReportExport[] {
  return exports.filter((entry) => entry.adAccountId === accountId);
}
