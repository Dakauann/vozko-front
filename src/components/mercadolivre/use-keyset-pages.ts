"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { appendById, type Identified } from "@/lib/mercadolivre/pages";
import type { MercadoLivreActionError, MercadoLivrePage } from "@/lib/mercadolivre/types";

export type KeysetFetch<T> = (cursor: string | undefined) => Promise<{ page: MercadoLivrePage<T> } | MercadoLivreActionError>;

interface KeysetState<T> {
  source: KeysetFetch<T> | null;
  reloadKey: number;
  rows: T[];
  nextCursor?: string;
  loadingMore: boolean;
  failure: MercadoLivreActionError | null;
}

export function useKeysetPages<T extends Identified>(fetchPage: KeysetFetch<T>, enabled: boolean) {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<KeysetState<T>>({ source: null, reloadKey: 0, rows: [], loadingMore: false, failure: null });
  const generation = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const current = ++generation.current;
    void fetchPage(undefined).then((result) => {
      if (current !== generation.current) return;
      if ("error" in result) setState({ source: fetchPage, reloadKey, rows: [], loadingMore: false, failure: result });
      else
        setState({
          source: fetchPage,
          reloadKey,
          rows: result.page.data ?? [],
          nextCursor: result.page.nextCursor,
          loadingMore: false,
          failure: null,
        });
    });
  }, [fetchPage, enabled, reloadKey]);

  const loading = enabled && (state.source !== fetchPage || state.reloadKey !== reloadKey);

  const loadMore = useCallback(() => {
    const cursor = state.nextCursor;
    if (!cursor || state.loadingMore) return;
    const current = generation.current;
    setState((prev) => ({ ...prev, loadingMore: true }));
    void fetchPage(cursor).then((result) => {
      if (current !== generation.current) return;
      if ("error" in result) setState((prev) => ({ ...prev, loadingMore: false, failure: result }));
      else
        setState((prev) => ({
          ...prev,
          rows: appendById(prev.rows, result.page.data ?? []),
          nextCursor: result.page.nextCursor,
          loadingMore: false,
          failure: null,
        }));
    });
  }, [fetchPage, state.nextCursor, state.loadingMore]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const updateRows = useCallback((change: (rows: T[]) => T[]) => setState((prev) => ({ ...prev, rows: change(prev.rows) })), []);

  return {
    rows: loading ? [] : state.rows,
    loading,
    loadingMore: state.loadingMore,
    hasNext: !loading && Boolean(state.nextCursor),
    failure: loading ? null : state.failure,
    loadMore,
    reload,
    updateRows,
  };
}
