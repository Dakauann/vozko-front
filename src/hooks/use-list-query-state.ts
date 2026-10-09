"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  emptyCrmFilter,
  encodeFilterParam,
  isEmptyCrmFilter,
  parseFilterParam,
  type CrmFilter,
} from "@/lib/crm/board";

export type ListSortDirection = "asc" | "desc";

export interface ListSort<K extends string = string> {
  key: K;
  direction: ListSortDirection;
}

export interface ListQueryState<K extends string = string, V extends string = string> {
  filter: CrmFilter;
  filterInvalid: boolean;
  search: string;
  sorts: ListSort<K>[];
  sortsChosen: boolean;
  page: number;
  pageSize: number;
  view: V | undefined;

  setView: (view: V, filter?: CrmFilter) => void;
  setFilter: (filter: CrmFilter) => void;
  setFilterAndSorts: (filter: CrmFilter, sorts?: ListSort<K>[]) => void;
  setSearch: (search: string) => void;
  setFilterAndSearch: (filter: CrmFilter, search: string) => void;
  setSorts: (sorts: ListSort<K>[]) => void;
  toggleSort: (key: K, options?: { additive?: boolean }) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  clearFilters: () => void;
  reset: () => void;
}

export interface UseListQueryStateOptions<K extends string = string, V extends string = string> {
  sortKeys: readonly K[];
  defaultSorts?: ListSort<K>[];
  defaultPageSize?: number;
  pageSizes?: readonly number[];
  views?: readonly V[];
  defaultView?: V;
  viewScopedParams?: readonly string[];
}

export function parseListView<V extends string>(
  raw: string | null,
  views: readonly V[] | undefined,
  defaultView: V | undefined,
): V | undefined {
  if (!views || views.length === 0) return undefined;
  const fallback = defaultView ?? views[0];
  return views.find((view) => view === raw) ?? fallback;
}

const NO_VIEW_PARAMS: readonly string[] = [];

function filterChange(nextFilter: CrmFilter) {
  return {
    filter: isEmptyCrmFilter(nextFilter) ? null : encodeFilterParam(nextFilter),
    page: null,
  };
}

export function useListQueryState<K extends string = string, V extends string = string>({
  sortKeys,
  defaultSorts = [],
  defaultPageSize = 20,
  pageSizes,
  views,
  defaultView,
  viewScopedParams = NO_VIEW_PARAMS,
}: UseListQueryStateOptions<K, V>): ListQueryState<K, V> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view = parseListView(searchParams.get("view"), views, defaultView);
  const fallbackView = parseListView(null, views, defaultView);

  const filterParam = useMemo(
    () => parseFilterParam(searchParams.get("filter")),
    [searchParams],
  );
  const filter = filterParam.status === "invalid" ? emptyCrmFilter : filterParam.filter;
  const filterInvalid = filterParam.status === "invalid";

  const search = searchParams.get("q") ?? "";

  const chosenSorts = useMemo<ListSort<K>[]>(() => {
    const raw = searchParams.get("sort");
    if (!raw) return [];

    return raw
      .split(",")
      .map((entry) => {
        const [key, direction] = entry.split(":");
        return {
          key: key?.trim() as K,
          direction: direction?.trim() === "asc" ? "asc" : "desc",
        } satisfies ListSort<K>;
      })
      .filter((sort) => sortKeys.includes(sort.key));
  }, [searchParams, sortKeys]);
  const sortsChosen = chosenSorts.length > 0;
  const sorts = sortsChosen ? chosenSorts : defaultSorts;

  const page = useMemo(() => {
    const parsed = Number.parseInt(searchParams.get("page") ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [searchParams]);

  const pageSize = useMemo(() => {
    const parsed = Number.parseInt(searchParams.get("pageSize") ?? "", 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultPageSize;
    if (pageSizes && !pageSizes.includes(parsed)) return defaultPageSize;
    return parsed;
  }, [searchParams, defaultPageSize, pageSizes]);

  const apply = useCallback(
    (changes: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }

      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const setFilter = useCallback(
    (nextFilter: CrmFilter) => apply(filterChange(nextFilter)),
    [apply],
  );

  const setSearch = useCallback(
    (nextSearch: string) => apply({ q: nextSearch.trim() || null, page: null }),
    [apply],
  );

  const setFilterAndSearch = useCallback(
    (nextFilter: CrmFilter, nextSearch: string) =>
      apply({ ...filterChange(nextFilter), q: nextSearch.trim() || null }),
    [apply],
  );

  const serializeSorts = useCallback(
    (nextSorts: ListSort<K>[]) =>
      nextSorts.length === 0
        ? null
        : nextSorts.map((sort) => `${sort.key}:${sort.direction}`).join(","),
    [],
  );

  const setSorts = useCallback(
    (nextSorts: ListSort<K>[]) =>
      apply({ sort: serializeSorts(nextSorts), page: null }),
    [apply, serializeSorts],
  );

  const setFilterAndSorts = useCallback(
    (nextFilter: CrmFilter, nextSorts?: ListSort<K>[]) =>
      apply({
        ...filterChange(nextFilter),
        ...(nextSorts ? { sort: serializeSorts(nextSorts) } : {}),
      }),
    [apply, serializeSorts],
  );

  const toggleSort = useCallback(
    (key: K, options?: { additive?: boolean }) => {
      const current = sorts.find((sort) => sort.key === key);
      const others = options?.additive
        ? sorts.filter((sort) => sort.key !== key)
        : [];

      let next: ListSort<K>[];
      if (!current) {
        next = [...others, { key, direction: "desc" }];
      } else if (current.direction === "desc") {
        next = [...others, { key, direction: "asc" }];
      } else {
        next = others;
      }

      setSorts(next);
    },
    [sorts, setSorts],
  );

  const setPage = useCallback(
    (nextPage: number) => apply({ page: nextPage > 1 ? nextPage : null }),
    [apply],
  );

  const setPageSize = useCallback(
    (nextPageSize: number) =>
      apply({
        pageSize: nextPageSize === defaultPageSize ? null : nextPageSize,
        page: null,
      }),
    [apply, defaultPageSize],
  );

  const clearFilters = useCallback(
    () => apply({ filter: null, q: null, page: null }),
    [apply],
  );

  const reset = useCallback(
    () => apply({ filter: null, q: null, sort: null, page: null, pageSize: null }),
    [apply],
  );

  const setView = useCallback(
    (nextView: V, nextFilter?: CrmFilter) =>
      apply({
        ...Object.fromEntries(viewScopedParams.map((param) => [param, null])),
        view: nextView === fallbackView ? null : nextView,
        ...(nextFilter ? filterChange(nextFilter) : {}),
      }),
    [apply, fallbackView, viewScopedParams],
  );

  return {
    filter,
    filterInvalid,
    search,
    sorts,
    sortsChosen,
    page,
    pageSize,
    view,
    setView,
    setFilter,
    setFilterAndSorts,
    setSearch,
    setFilterAndSearch,
    setSorts,
    toggleSort,
    setPage,
    setPageSize,
    clearFilters,
    reset,
  };
}
