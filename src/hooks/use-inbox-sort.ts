"use client";

import { useCallback, useSyncExternalStore } from "react";

import { useSignedInUserId } from "@/contexts/auth-context";
import { DEFAULT_INBOX_SORT, inboxSortKey, readInboxSort, writeInboxSort } from "@/lib/conversations/inbox-sort";
import type { InboxSort } from "@/lib/conversations/types";
import { localStore } from "@/lib/stored-size";

const remembered = new Map<string, InboxSort>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function current(storageKey: string | null): InboxSort {
  const memoryKey = storageKey ?? "";
  const known = remembered.get(memoryKey);
  if (known) return known;
  const stored = readInboxSort(localStore(), storageKey);
  remembered.set(memoryKey, stored);
  return stored;
}

export function useInboxSort(): [InboxSort, (sort: InboxSort) => void] {
  const storageKey = inboxSortKey(useSignedInUserId());
  const sort = useSyncExternalStore(
    subscribe,
    () => current(storageKey),
    () => DEFAULT_INBOX_SORT,
  );
  const choose = useCallback(
    (next: InboxSort) => {
      remembered.set(storageKey ?? "", next);
      if (storageKey) writeInboxSort(localStore(), storageKey, next);
      listeners.forEach((listener) => listener());
    },
    [storageKey],
  );
  return [sort, choose];
}
