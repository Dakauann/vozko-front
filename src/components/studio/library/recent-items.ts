"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { useSignedInUserId } from "@/contexts/auth-context";
import { parseRecent, withRecent } from "@/lib/studio/library/catalog";

import { browserStorage, type BrowserStorage } from "@/lib/browser-storage";

const KEY_PREFIX = "studio-library:recent";
const NONE: readonly string[] = [];
const ignore = () => undefined;
const quiet = () => ignore;

interface RecentStore {
  ids: (key: string) => readonly string[];
  remember: (key: string, id: string) => void;
  clear: (key: string) => void;
  subscribe: (listener: () => void) => () => void;
}

function createRecentStore(storage: BrowserStorage): RecentStore {
  const lists = new Map<string, readonly string[]>();
  const listeners = new Set<() => void>();
  const ids = (key: string) => {
    const known = lists.get(key);
    if (known) return known;
    const read = parseRecent(storage.read(key));
    lists.set(key, read);
    return read;
  };
  const write = (key: string, next: readonly string[]) => {
    lists.set(key, next);
    storage.write(key, JSON.stringify(next));
    listeners.forEach((listener) => listener());
  };
  return {
    ids,
    remember: (key, id) => write(key, withRecent(ids(key), id)),
    clear: (key) => write(key, []),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const persisted = createRecentStore(browserStorage);

interface RecentItems {
  ids: readonly string[];
  remember: (id: string) => void;
  clear: () => void;
}

export function useRecentItems(): RecentItems {
  const userId = useSignedInUserId();
  const key = userId ? `${KEY_PREFIX}:${userId}` : null;
  const ids = useSyncExternalStore(
    key ? persisted.subscribe : quiet,
    () => (key ? persisted.ids(key) : NONE),
    () => NONE,
  );
  const remember = useCallback((id: string) => (key ? persisted.remember(key, id) : undefined), [key]);
  const clear = useCallback(() => (key ? persisted.clear(key) : undefined), [key]);
  return useMemo(() => ({ ids, remember, clear }), [ids, remember, clear]);
}
