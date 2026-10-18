import type { GroupSort, ListGroupsParams } from "@/lib/unofficial-whatsapp-groups/types";

import type { AllGroupsQuery } from "../kit/routes";

const DEFAULT_GROUP_SORT: GroupSort = "recent";

export type ListFilterKey = "search" | "followed" | "origin" | "category" | "instanceId" | "hasAnalysis" | "adminsOnly";

const NARROWING_FILTERS: readonly Exclude<ListFilterKey, "search">[] = ["followed", "origin", "category", "instanceId", "hasAnalysis", "adminsOnly"];

export function listParams(query: AllGroupsQuery, page: number, pageSize: number): ListGroupsParams {
  const params: ListGroupsParams = { page, pageSize, sort: query.sort ?? DEFAULT_GROUP_SORT };
  if (query.search) params.search = query.search;
  if (query.followed !== undefined) params.followed = query.followed;
  if (query.origin) params.origin = query.origin;
  if (query.category !== undefined) params.category = query.category;
  if (query.instanceId) params.instanceId = query.instanceId;
  if (query.hasAnalysis !== undefined) params.hasAnalysis = query.hasAnalysis;
  if (query.adminsOnly) params.adminsOnly = true;
  return params;
}

export function isNarrowed(query: AllGroupsQuery): boolean {
  return NARROWING_FILTERS.some((key) => (key === "adminsOnly" ? query.adminsOnly === true : query[key] !== undefined));
}

export function isSearchedOrNarrowed(query: AllGroupsQuery): boolean {
  return Boolean(query.search) || isNarrowed(query);
}

export function withoutFilter(query: AllGroupsQuery, key: ListFilterKey): AllGroupsQuery {
  const next: AllGroupsQuery = { ...query };
  delete next[key];
  delete next.action;
  return next;
}

export function clearedQuery(query: AllGroupsQuery): AllGroupsQuery {
  return query.sort ? { sort: query.sort } : {};
}
