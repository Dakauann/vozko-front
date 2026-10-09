"use client";

import { useCallback, useState } from "react";

import {
  cleared,
  countFailed,
  countingStarted,
  initialBulkSelection,
  rescoped,
  selectionMode,
  selectionSize,
  widened,
  withPicked,
  type BulkSelectionState,
  type SelectionMode,
  type WideSelection,
  type WideSelectionMode,
} from "@/lib/selection/bulk-state";

export interface WideCount {
  matched: number;
  fingerprint?: string;
  limit?: number;
}

export interface BulkSelection {
  scope: string;
  state: BulkSelectionState;
  picked: ReadonlySet<string>;
  wide: WideSelection | null;
  counting: WideSelectionMode | null;
  size: number;
  mode: SelectionMode | null;
  setPicked: (keys: ReadonlySet<string>) => void;
  clear: () => void;
  select: (wide: WideCount & { mode: WideSelectionMode }) => void;
  widen: (mode: WideSelectionMode, count: () => Promise<WideCount | null>) => Promise<WideCount | null>;
}

export function useBulkSelection(scope: string): BulkSelection {
  const [stored, setStored] = useState<BulkSelectionState>(() => initialBulkSelection(scope));
  const state = rescoped(stored, scope);
  if (state !== stored) setStored(state);

  const setPicked = useCallback((keys: ReadonlySet<string>) => {
    setStored((current) => withPicked(rescoped(current, scope), keys));
  }, [scope]);

  const clear = useCallback(() => {
    setStored((current) => cleared(rescoped(current, scope)));
  }, [scope]);

  const select = useCallback(
    (wide: WideCount & { mode: WideSelectionMode }) => {
      setStored((current) => widened(rescoped(current, scope), { ...wide, scope }));
    },
    [scope],
  );

  const widen = useCallback(
    async (mode: WideSelectionMode, count: () => Promise<WideCount | null>) => {
      setStored((current) => countingStarted(rescoped(current, scope), mode));
      const counted = await count().catch(() => null);
      setStored((current) => (counted ? widened(current, { ...counted, mode, scope }) : countFailed(current)));
      return counted;
    },
    [scope],
  );

  return {
    scope,
    state,
    picked: state.picked,
    wide: state.wide,
    counting: state.counting,
    size: selectionSize(state),
    mode: selectionMode(state),
    setPicked,
    clear,
    select,
    widen,
  };
}
