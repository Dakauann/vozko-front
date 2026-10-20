"use client";

import { useCallback, useSyncExternalStore } from "react";

type EditingListener = () => void;

const editing = new Map<string, string>();
const listeners = new Set<EditingListener>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: EditingListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function startEditing(entryKey: string, messageId: string) {
  if (editing.get(entryKey) === messageId) return;
  editing.set(entryKey, messageId);
  notify();
}

export function stopEditing(entryKey: string) {
  if (!editing.delete(entryKey)) return;
  notify();
}

export function editingMessageOf(entryKey: string): string | null {
  return editing.get(entryKey) ?? null;
}

export function useEditingMessage(entryKey: string | null): string | null {
  const snapshot = useCallback(() => (entryKey ? editingMessageOf(entryKey) : null), [entryKey]);
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
