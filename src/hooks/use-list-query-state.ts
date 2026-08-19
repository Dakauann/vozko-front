"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  decodeFilterParam,
  emptyCrmFilter,
  encodeFilterParam,
  isEmptyCrmFilter,
  type CrmFilter,
} from "@/lib/crm/board";

export type ListSortDirection = "asc" | "desc";

export interface ListSort<K extends string = string> {
  key: K;
  direction: ListSortDirection;
}

export interface ListQueryState<K extends string = string> {
  filter: CrmFilter;
  search: string;
  sorts: ListSort<K>[];
  page: number;
  pageSize: number;

  setFilter: (filter: CrmFilter) => void;
  setSearch: (search: string) => void;
  setSorts: (sorts: ListSort<K>[]) => void;
  /** Cycle one column: unsorted → desc → asc → unsorted. */
  toggleSort: (key: K, options?: { additive?: boolean }) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  /** Clear filters and search, keeping sort and page size. */
  clearFilters: () => void;
  /** Back to the default view entirely. */
  reset: () => void;
}

export interface UseListQueryStateOptions<K extends string = string> {
  /** Sort keys the list accepts; anything else in the URL is ignored. */
  sortKeys: readonly K[];
  defaultSorts?: ListSort<K>[];
  defaultPageSize?: number;
  pageSizes?: readonly number[];
}

/**
 * List state that lives in the URL.
 *
 * The URL is the state, not a mirror of it. That is what makes a filtered list
 * shareable, bookmarkable, survivable across a refresh, and navigable with the
 * browser's own back button — the four things a component-state-only filter bar
 * silently gives up, and the reason "send me the leads you're looking at" ends
 * in a screenshot.
 *
 * Generic over the sort vocabulary so any list can adopt it; the leads list is
 * the first caller.
 */
export function useListQueryState<K extends string = string>({
  sortKeys,
  defaultSorts = [],
  defaultPageSize = 20,
  pageSizes,
}: UseListQueryStateOptions<K>): ListQueryState<K> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = useMemo(
    () => decodeFilterParam(searchParams.get("filter")),
    [searchParams],
  );

  const search = searchParams.get("q") ?? "";

  const sorts = useMemo<ListSort<K>[]>(() => {
    const raw = searchParams.get("sort");
    if (!raw) return defaultSorts;

    const parsed = raw
      .split(",")
      .map((entry) => {
        const [key, direction] = entry.split(":");
        return {
          key: key?.trim() as K,
          direction: direction?.trim() === "asc" ? "asc" : "desc",
        } satisfies ListSort<K>;
      })
      // A stale bookmark naming a key the list no longer offers degrades to the
      // default order instead of an empty or mis-sorted page.
      .filter((sort) => sortKeys.includes(sort.key));

    return parsed.length > 0 ? parsed : defaultSorts;
  }, [searchParams, sortKeys, defaultSorts]);

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

  /**
   * Writes params, dropping any that hold their default so the URL stays
   * readable — `?q=ana` rather than `?filter=&q=ana&sort=&page=1&pageSize=20`.
   *
   * `replace`, not `push`: typing in a search box must not bury the previous
   * page under thirty history entries.
   */
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

  // Any change to WHAT is listed returns to page 1. Staying on page 7 of a
  // result set that now has two pages is how a filter appears to return nothing.
  const setFilter = useCallback(
    (nextFilter: CrmFilter) => {
      apply({
        filter: isEmptyCrmFilter(nextFilter) ? null : encodeFilterParam(nextFilter),
        page: null,
      });
    },
    [apply],
  );

  const setSearch = useCallback(
    (nextSearch: string) => apply({ q: nextSearch.trim() || null, page: null }),
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

  const toggleSort = useCallback(
    (key: K, options?: { additive?: boolean }) => {
      const current = sorts.find((sort) => sort.key === key);
      const others = options?.additive
        ? sorts.filter((sort) => sort.key !== key)
        : [];

      // desc first: for dates and counts — which is most of what a list sorts
      // by — "biggest/newest first" is the question being asked.
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

  return {
    filter: filter ?? emptyCrmFilter,
    search,
    sorts,
    page,
    pageSize,
    setFilter,
    setSearch,
    setSorts,
    toggleSort,
    setPage,
    setPageSize,
    clearFilters,
    reset,
  };
}
