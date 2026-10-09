"use client";

import { SectionError } from "@/components/dashboard/attendance/primitives";
import type { SectionQueryState } from "@/components/dashboard/attendance/section-state";
import Button from "@/components/elevated-design/button";
import { useNextPageOnView } from "@/hooks/use-next-page-on-view";
import { isBusySectionError } from "@/lib/analytics/section-query";
import { autoLoadsNextPage } from "@/lib/leads/timeline";

export interface PagedListQuery {
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isRefetchError: boolean;
  error: unknown;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
}

export interface PagedSectionSource {
  isError: boolean;
  data: unknown;
  error: unknown;
  isFetching: boolean;
  refetch: () => unknown;
}

export function pagedSectionState(query: PagedSectionSource): SectionQueryState {
  return {
    isError: query.isError && !query.data,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

export function PagedListFooter({
  query,
  pageSizes,
  loadMore,
  loadingMore,
}: {
  query: PagedListQuery;
  pageSizes: readonly number[];
  loadMore: string;
  loadingMore: string;
}) {
  const sentinel = useNextPageOnView<HTMLDivElement>({
    hasNextPage: query.hasNextPage,
    busy: query.isFetching || query.isFetchNextPageError || query.isRefetchError,
    auto: autoLoadsNextPage(pageSizes),
    pageCount: pageSizes.length,
    fetchNextPage: query.fetchNextPage,
  });

  if (query.isRefetchError) {
    return (
      <div className="pt-3">
        <SectionError busy={isBusySectionError(query.error)} retrying={query.isFetching} onRetry={() => void query.refetch()} />
      </div>
    );
  }
  if (query.isFetchNextPageError) {
    return (
      <div className="pt-3">
        <SectionError busy={isBusySectionError(query.error)} retrying={query.isFetchingNextPage} onRetry={() => void query.fetchNextPage()} />
      </div>
    );
  }
  if (!query.hasNextPage) return null;
  return (
    <div ref={sentinel} className="pt-3">
      <Button
        variant="ghost"
        size="sm"
        title={query.isFetchingNextPage ? loadingMore : loadMore}
        disabled={query.isFetchingNextPage}
        onClick={() => void query.fetchNextPage()}
      />
    </div>
  );
}
