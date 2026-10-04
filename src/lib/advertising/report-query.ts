import type { AdAttributionWindow, AdLevel, AdRange } from "@/lib/advertising/types";

export interface ReportFilters {
  level: AdLevel;
  range: AdRange;
  campaignIds?: string[];
  adSetIds?: string[];
  adIds?: string[];
  search?: string;
  compare?: boolean;
}

export type TrendFilters = Omit<ReportFilters, "level" | "search" | "compare">;

export interface LiveQuery {
  level: AdLevel;
  range: AdRange;
  objectIds?: string[];
  breakdowns?: string[];
  windows?: AdAttributionWindow[];
}

export const MAX_LIVE_OBJECT_IDS = 100;

export function accountPath(id: string): string {
  return `/ads/accounts/${encodeURIComponent(id)}`;
}

export function objectPath(metaId: string): string {
  return `/ads/objects/${encodeURIComponent(metaId)}`;
}

function setList(params: URLSearchParams, key: string, values: string[] | undefined) {
  if (values?.length) params.set(key, values.join(","));
}

export function reportQuery(filters: Partial<Pick<ReportFilters, "level">> & Omit<ReportFilters, "level">): string {
  const params = new URLSearchParams({ since: filters.range.since, until: filters.range.until });
  if (filters.level) params.set("level", filters.level);
  setList(params, "campaignIds", filters.campaignIds);
  setList(params, "adSetIds", filters.adSetIds);
  setList(params, "adIds", filters.adIds);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.compare) params.set("compare", "1");
  return params.toString();
}

export function reportCsvPath(accountId: string, filters: ReportFilters): string {
  return `${accountPath(accountId)}/report.csv?${reportQuery({ ...filters, compare: false })}`;
}

export function liveInsightsPath(accountId: string, query: LiveQuery): string {
  const params = new URLSearchParams({ level: query.level, since: query.range.since, until: query.range.until });
  if (query.objectIds && query.objectIds.length <= MAX_LIVE_OBJECT_IDS) setList(params, "objectIds", query.objectIds);
  setList(params, "breakdowns", query.breakdowns);
  setList(params, "windows", query.windows);
  return `${accountPath(accountId)}/insights?${params.toString()}`;
}
