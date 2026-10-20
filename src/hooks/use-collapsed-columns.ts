"use client";

import { useCallback, useSyncExternalStore } from "react";

import { useSignedInUserId } from "@/contexts/auth-context";
import {
  collapsedColumnsKey,
  readCollapsedColumns,
  toggleCollapsedColumn,
  writeCollapsedColumns,
  type CollapsedColumnsBoard,
} from "@/lib/crm/collapsed-columns";
import { localStore } from "@/lib/stored-size";

const NONE: readonly string[] = [];
const remembered = new Map<string, readonly string[]>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function current(memoryKey: string, storageKey: string | null): readonly string[] {
  const known = remembered.get(memoryKey);
  if (known) return known;
  const stored = storageKey ? readCollapsedColumns(localStore(), storageKey) : [];
  remembered.set(memoryKey, stored);
  return stored;
}

export function useCollapsedColumns(board: CollapsedColumnsBoard) {
  const storageKey = collapsedColumnsKey(board, useSignedInUserId());
  const memoryKey = storageKey ?? board;

  const collapsed = useSyncExternalStore(
    subscribe,
    () => current(memoryKey, storageKey),
    () => NONE,
  );

  const toggle = useCallback(
    (columnId: string) => {
      const next = toggleCollapsedColumn(current(memoryKey, storageKey), columnId);
      remembered.set(memoryKey, next);
      if (storageKey) writeCollapsedColumns(localStore(), storageKey, next);
      listeners.forEach((listener) => listener());
    },
    [memoryKey, storageKey],
  );

  const isCollapsed = useCallback((columnId: string) => collapsed.includes(columnId), [collapsed]);

  return { isCollapsed, toggle };
}
