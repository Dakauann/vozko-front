"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { usePollWhile } from "@/hooks/use-poll-while";
import type { WorkflowListMeta } from "@/lib/workflows/types";

export interface PageAnswer<T, H = never> {
  items: T[];
  meta: WorkflowListMeta;
  error?: string;
  status?: number;
  head?: H;
}

interface PagedValue<T, H> {
  items: T[];
  meta: WorkflowListMeta;
  head?: H;
}

interface PagedResult<T, H> {
  key: string;
  items: T[];
  meta: WorkflowListMeta | null;
  head: H | null;
  error: boolean;
  errorStatus: number | null;
}

export interface PagedListOptions<T, H = never> {
  scope: string;
  read: (page: number) => Promise<PageAnswer<T, H>>;
  enabled?: boolean;
  accumulate?: boolean;
  pollWhile?: (items: readonly T[], head: H | null) => boolean;
  pollPaused?: boolean;
}

const NO_ITEMS: never[] = [];

function mergeById<T extends { id: string }>(kept: readonly T[], next: readonly T[]): T[] {
  const fresh = new Map(next.map((item) => [item.id, item]));
  const merged = kept.map((item) => fresh.get(item.id) ?? item);
  const seen = new Set(kept.map((item) => item.id));
  return [...merged, ...next.filter((item) => !seen.has(item.id))];
}

export function usePagedList<T extends { id: string }, H = never>({
  scope,
  read,
  enabled = true,
  accumulate = false,
  pollWhile,
  pollPaused = false,
}: PagedListOptions<T, H>) {
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [shownScope, setShownScope] = useState(scope);
  if (shownScope !== scope) {
    setShownScope(scope);
    if (accumulate) setPage(1);
  }
  const [result, setResult] = useState<PagedResult<T, H> | null>(null);
  const key = `${scope}|${page}|${reload}`;
  const loading = result?.key !== key;

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void read(page).then((res) => {
      if (!current) return;
      const continuing = accumulate && page > 1;
      setResult((prev) => ({
        key,
        items: continuing ? mergeById(prev?.items ?? [], res.items) : res.items,
        meta: res.error ? null : res.meta,
        head: res.error ? (continuing ? (prev?.head ?? null) : null) : (res.head ?? null),
        error: Boolean(res.error),
        errorStatus: res.error ? (res.status ?? null) : null,
      }));
    });
    return () => {
      current = false;
    };
  }, [enabled, read, page, key, accumulate]);

  const readCurrent = useCallback(async () => {
    const res = await read(page);
    return res.error
      ? { data: null, error: res.error }
      : { data: { items: res.items, meta: res.meta, head: res.head }, error: null };
  }, [read, page]);
  const takeValue = useCallback(
    (next: PagedValue<T, H>) =>
      setResult((prev) => ({
        key,
        items: accumulate ? mergeById(prev?.items ?? [], next.items) : next.items,
        meta: next.meta,
        head: next.head ?? null,
        error: false,
        errorStatus: null,
      })),
    [key, accumulate],
  );
  const isOver = useCallback((next: PagedValue<T, H>) => !pollWhile?.(next.items, next.head ?? null), [pollWhile]);

  const items = result?.items ?? NO_ITEMS;
  const head = result?.head ?? null;
  usePollWhile({
    active: Boolean(pollWhile) && enabled && !pollPaused && !loading && !result?.error && Boolean(pollWhile?.(items, head)),
    pollKey: key,
    read: readCurrent,
    isOver,
    onValue: takeValue,
  });

  const refresh = useCallback(() => {
    if (accumulate) setPage(1);
    setReload((n) => n + 1);
  }, [accumulate]);

  return useMemo(
    () => ({
      items,
      head,
      meta: result?.meta ?? null,
      error: Boolean(result?.error),
      errorStatus: result?.errorStatus ?? null,
      loading,
      page,
      setPage,
      totalPages: Math.max(result?.meta?.totalPages ?? 1, 1),
      hasMore: Boolean(result?.meta && page < result.meta.totalPages),
      reloadToken: reload,
      refresh,
    }),
    [items, head, result, loading, page, reload, refresh],
  );
}
