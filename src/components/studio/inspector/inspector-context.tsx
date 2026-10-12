"use client";

import { createContext, useContext, useId, useState, useSyncExternalStore, type ReactNode } from "react";

import type { InspectorGroupId } from "@/lib/studio/inspector-layout";

import { createInspectorStore, type InspectorScope, type InspectorStore } from "./inspector-store";

const StoreContext = createContext<InspectorStore | null>(null);
const GroupContext = createContext<InspectorGroupId | null>(null);

export function InspectorProvider({ scope, children }: { scope: InspectorScope; children: ReactNode }) {
  const baseId = useId();
  const [store] = useState(() => createInspectorStore(scope, baseId));
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function InspectorGroup({ id, children }: { id: InspectorGroupId; children: ReactNode }) {
  return <GroupContext.Provider value={id}>{children}</GroupContext.Provider>;
}

export function useInspectorStore(): InspectorStore | null {
  return useContext(StoreContext);
}

export function useInheritedGroup(): InspectorGroupId | null {
  return useContext(GroupContext);
}

const UNSUBSCRIBED = () => () => undefined;

export function useInspectorValue<T>(store: InspectorStore | null, read: (store: InspectorStore) => T, fallback: T): T {
  return useSyncExternalStore(
    store ? store.subscribe : UNSUBSCRIBED,
    () => (store ? read(store) : fallback),
    () => fallback,
  );
}

export function tabId(store: InspectorStore, group: InspectorGroupId): string {
  return `${store.baseId}-tab-${group}`;
}

export function panelId(store: InspectorStore): string {
  return `${store.baseId}-panel`;
}
