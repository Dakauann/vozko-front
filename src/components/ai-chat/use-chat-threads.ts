"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { deleteChatThreadAction, listChatThreadsAction } from "@/app/actions/aichat";
import { appendThreads, freshFirst, THREAD_PAGE_SIZE, THREAD_SEARCH_DELAY_MS } from "@/lib/aichat/thread-list";
import type { ChatThread, ChatThreadList } from "@/lib/aichat/types";

import { useLiveThreads } from "./background-turns";

export type ThreadsFailure = "load" | "delete";

interface Loaded {
  query: string;
  items: ChatThread[];
  total: number;
  page: number;
  failed: boolean;
}

type Merge = (prev: Loaded | null, items: ChatThread[], total: number) => Loaded;

export interface ChatThreads {
  items: ChatThread[];
  query: string;
  search: (query: string) => void;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  failure: ThreadsFailure | null;
  removing: string | null;
  remove: (threadId: string) => Promise<boolean>;
  add: (thread: ChatThread) => void;
}

function useSettledQuery(query: string): string {
  const [settled, setSettled] = useState(query);
  useEffect(() => {
    if (query === settled) return;
    const timer = setTimeout(() => setSettled(query), THREAD_SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, settled]);
  return settled;
}

export function useChatThreads(active: boolean): ChatThreads {
  const [query, setQuery] = useState("");
  const settledQuery = useSettledQuery(query);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const ticket = useRef(0);
  const live = useLiveThreads();
  const seenLive = useRef(live);

  const fetchPage = useCallback((page: number, wanted: string, merge: Merge) => {
    const mine = ++ticket.current;
    const settle = (data: ChatThreadList | null) => {
      if (mine !== ticket.current) return;
      setLoadingMore(false);
      if (!data) {
        setLoaded((prev) => ({ ...(prev?.query === wanted ? prev : { items: [], total: 0, page: 0 }), query: wanted, failed: true }));
        return;
      }
      setLoaded((prev) => merge(prev, data.items, data.total ?? data.items.length));
    };
    return listChatThreadsAction(page, THREAD_PAGE_SIZE, wanted).then(
      ({ data, error }) => settle(error ? null : data),
      () => settle(null),
    );
  }, []);

  useEffect(() => {
    if (!active) return;
    void fetchPage(1, settledQuery, (_prev, items, total) => ({ query: settledQuery, items, total, page: 1, failed: false }));
  }, [active, settledQuery, fetchPage]);

  useEffect(() => {
    const before = seenLive.current;
    seenLive.current = live;
    if (!active || !before.some((threadId) => !live.includes(threadId))) return;
    void fetchPage(1, settledQuery, (prev, items, total) => ({ query: settledQuery, items: freshFirst(items, prev?.query === settledQuery ? prev.items : []), total, page: Math.max(prev?.page ?? 1, 1), failed: false }));
  }, [live, active, settledQuery, fetchPage]);

  const current = loaded && loaded.query === settledQuery ? loaded : null;
  const items = loaded?.items ?? [];
  const total = current?.total ?? 0;

  const loadMore = useCallback(() => {
    if (!current) return;
    setLoadingMore(true);
    void fetchPage(current.page + 1, current.query, (prev, next, nextTotal) => ({
      query: current.query,
      items: appendThreads(prev?.items ?? [], next),
      total: nextTotal,
      page: (prev?.page ?? 0) + 1,
      failed: false,
    }));
  }, [current, fetchPage]);

  const remove = useCallback(async (threadId: string) => {
    setRemoving(threadId);
    const { error } = await deleteChatThreadAction(threadId).catch(() => ({ error: "delete_failed" }));
    setRemoving(null);
    setDeleteFailed(Boolean(error));
    if (error) return false;
    setLoaded((prev) => (prev ? { ...prev, items: prev.items.filter((thread) => thread.id !== threadId), total: Math.max(0, prev.total - 1) } : prev));
    return true;
  }, []);

  const add = useCallback((thread: ChatThread) => {
    setLoaded((prev) => {
      const base = prev ?? { query: "", items: [], total: 0, page: 1, failed: false };
      return { ...base, items: [thread, ...base.items.filter((known) => known.id !== thread.id)], total: base.total + 1 };
    });
  }, []);

  return {
    items,
    query,
    search: setQuery,
    loading: loadingMore || (active && !current),
    hasMore: items.length < total,
    loadMore,
    failure: deleteFailed ? "delete" : current?.failed ? "load" : null,
    removing,
    remove,
    add,
  };
}
