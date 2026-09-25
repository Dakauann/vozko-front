"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";

import {
  SECTION_GC_MS,
  SECTION_STALE_MS,
  sectionRetryDelay,
  shouldRetrySection,
} from "@/lib/analytics/section-query";

export function useSectionQuery<T>({
  queryKey,
  queryFn,
  enabled,
  refetchInterval,
}: {
  queryKey: QueryKey;
  queryFn: (signal: AbortSignal) => Promise<T>;
  enabled: boolean;
  refetchInterval?: number;
}) {
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => queryFn(signal),
    enabled,
    staleTime: SECTION_STALE_MS,
    gcTime: SECTION_GC_MS,
    refetchOnWindowFocus: false,
    refetchInterval,
    retry: shouldRetrySection,
    retryDelay: sectionRetryDelay,
  });
}
