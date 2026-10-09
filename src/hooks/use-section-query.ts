"use client";

import { useInfiniteQuery, useQuery, type QueryKey } from "@tanstack/react-query";

import {
  SECTION_GC_MS,
  SECTION_STALE_MS,
  sectionRetryDelay,
  shouldRetrySection,
} from "@/lib/analytics/section-query";

const SECTION_OPTIONS = {
  staleTime: SECTION_STALE_MS,
  gcTime: SECTION_GC_MS,
  refetchOnWindowFocus: false,
  retry: shouldRetrySection,
  retryDelay: sectionRetryDelay,
} as const;

export function useSectionQuery<T>({
  queryKey,
  queryFn,
  enabled,
  refetchInterval,
  keepPreviousWhen,
}: {
  queryKey: QueryKey;
  queryFn: (signal: AbortSignal) => Promise<T>;
  enabled: boolean;
  refetchInterval?: number | ((data: T | undefined) => number | false);
  keepPreviousWhen?: (previousKey: QueryKey) => boolean;
}) {
  return useQuery<T, Error, T, QueryKey>({
    ...SECTION_OPTIONS,
    queryKey,
    queryFn: ({ signal }) => queryFn(signal),
    enabled,
    refetchInterval: typeof refetchInterval === "function" ? (query) => refetchInterval(query.state.data) : refetchInterval,
    placeholderData: keepPreviousWhen
      ? (previous, previousQuery) => (previousQuery && keepPreviousWhen(previousQuery.queryKey) ? previous : undefined)
      : undefined,
  });
}

export function useSectionPagesQuery<T>({
  queryKey,
  queryFn,
  nextCursor,
  enabled,
}: {
  queryKey: QueryKey;
  queryFn: (cursor: string, signal: AbortSignal) => Promise<T>;
  nextCursor: (page: T) => string | undefined;
  enabled: boolean;
}) {
  return useInfiniteQuery({
    ...SECTION_OPTIONS,
    queryKey,
    queryFn: ({ pageParam, signal }) => queryFn(pageParam, signal),
    initialPageParam: "",
    getNextPageParam: (page) => nextCursor(page) || undefined,
    enabled,
  });
}
