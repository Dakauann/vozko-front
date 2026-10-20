import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

import { nodeDebugFlags, type NodeDebugMarks } from "@/lib/workflows/debug-marks";

import { createValueStore, type ValueStore } from "./value-store";

export type NodeDebugStore = ValueStore<NodeDebugMarks | null>;

export function createNodeDebugStore(): NodeDebugStore {
  return createValueStore<NodeDebugMarks | null>(null);
}

export const NodeDebugContext = createContext<NodeDebugStore | null>(null);

const NO_MARKS = () => () => undefined;

export function useNodeDebugFlags(nodeId: string): number {
  const store = useContext(NodeDebugContext);
  const readFlags = useCallback(() => nodeDebugFlags(store?.get() ?? null, nodeId), [store, nodeId]);
  return useSyncExternalStore(store?.subscribe ?? NO_MARKS, readFlags, readFlags);
}
