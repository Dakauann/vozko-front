import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

import { runNodeMark, type RunNodeMark, type RunOverlay } from "@/lib/workflows/run-path";

import { createValueStore, type ValueStore } from "./value-store";

export type RunOverlayStore = ValueStore<RunOverlay | null>;

export function createRunOverlayStore(): RunOverlayStore {
  return createValueStore<RunOverlay | null>(null);
}

export const RunOverlayContext = createContext<RunOverlayStore | null>(null);

const NO_OVERLAY = () => () => undefined;

export function useRunNodeMark(nodeId: string): RunNodeMark | null {
  const store = useContext(RunOverlayContext);
  const readMark = useCallback(() => runNodeMark(store?.get() ?? null, nodeId), [store, nodeId]);
  return useSyncExternalStore(store?.subscribe ?? NO_OVERLAY, readMark, readMark);
}
