import type { AnalysisSort, AnalysisStatus, AnalysisTrigger, ListAnalysesParams } from "@/lib/unofficial-whatsapp-groups/types";

export const ANALYSIS_STATUSES: readonly AnalysisStatus[] = ["active", "paused", "archived"];

export const ANALYSIS_TRIGGERS: readonly AnalysisTrigger[] = ["message_count", "scheduled"];

export const ANALYSIS_SORTS: readonly AnalysisSort[] = ["recent", "oldest", "name", "name_desc"];

export const DEFAULT_ANALYSIS_SORT: AnalysisSort = "recent";

export const ANALYSES_PAGE_SIZES = [25, 50, 100] as const;

export const DEFAULT_ANALYSES_PAGE_SIZE = 50;

export interface AnalysesListState {
  search: string;
  status?: AnalysisStatus;
  trigger?: AnalysisTrigger;
  groupId?: string;
  sort: AnalysisSort;
  page: number;
  pageSize: number;
}

function oneOf<T extends string>(options: readonly T[], value: string | null): T | undefined {
  return value !== null && (options as readonly string[]).includes(value) ? (value as T) : undefined;
}

function positiveInt(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed >= 1 ? parsed : undefined;
}

export function parseAnalysesListState(params: URLSearchParams): AnalysesListState {
  const state: AnalysesListState = {
    search: (params.get("search") ?? "").trim(),
    sort: oneOf(ANALYSIS_SORTS, params.get("sort")) ?? DEFAULT_ANALYSIS_SORT,
    page: positiveInt(params.get("page")) ?? 1,
    pageSize: DEFAULT_ANALYSES_PAGE_SIZE,
  };
  const status = oneOf(ANALYSIS_STATUSES, params.get("status"));
  if (status) state.status = status;
  const trigger = oneOf(ANALYSIS_TRIGGERS, params.get("trigger"));
  if (trigger) state.trigger = trigger;
  const groupId = params.get("groupId")?.trim();
  if (groupId) state.groupId = groupId;
  const pageSize = positiveInt(params.get("pageSize"));
  if (pageSize && (ANALYSES_PAGE_SIZES as readonly number[]).includes(pageSize)) state.pageSize = pageSize;
  return state;
}

export function analysesListSearch(state: AnalysesListState): string {
  const params = new URLSearchParams();
  if (state.search.trim()) params.set("search", state.search.trim());
  if (state.status) params.set("status", state.status);
  if (state.trigger) params.set("trigger", state.trigger);
  if (state.groupId) params.set("groupId", state.groupId);
  if (state.sort !== DEFAULT_ANALYSIS_SORT) params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_ANALYSES_PAGE_SIZE) params.set("pageSize", String(state.pageSize));
  return params.toString();
}

export function hasFilters(state: AnalysesListState): boolean {
  return Boolean(state.search.trim() || state.status || state.trigger || state.groupId);
}

function filterParams(state: AnalysesListState): ListAnalysesParams {
  const params: ListAnalysesParams = {};
  if (state.search.trim()) params.search = state.search.trim();
  if (state.trigger) params.trigger = state.trigger;
  if (state.groupId) params.groupId = state.groupId;
  return params;
}

export function listParams(state: AnalysesListState): ListAnalysesParams {
  return {
    page: state.page,
    pageSize: state.pageSize,
    sort: state.sort,
    ...filterParams(state),
    ...(state.status ? { status: state.status } : {}),
  };
}

export function countParams(state: AnalysesListState, status: AnalysisStatus): ListAnalysesParams {
  return { page: 1, pageSize: 1, status, ...filterParams(state) };
}

export function pageAfterRemoval(page: number, rowsOnPage: number): number {
  return rowsOnPage <= 1 && page > 1 ? page - 1 : page;
}
