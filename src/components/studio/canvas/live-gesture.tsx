"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

import type { StudioEditorStore } from "@/lib/studio/store";

export interface LiveGesture {
  begin: () => void;
  end: () => void;
}

export const LiveGestureContext = createContext<LiveGesture | null>(null);

export function StoreGestures<D extends object>({ store, children }: { store: StudioEditorStore<D>; children: ReactNode }) {
  const gesture = useMemo<LiveGesture>(() => ({ begin: () => store.getState().beginTransaction(), end: () => store.getState().commitTransaction() }), [store]);
  return <LiveGestureContext.Provider value={gesture}>{children}</LiveGestureContext.Provider>;
}

interface Drag {
  input: HTMLInputElement;
  live: boolean;
  detach: () => void;
}

export function useColorDrag(shown: string, apply: (raw: string) => void): (input: HTMLInputElement | null) => void {
  const gesture = useContext(LiveGestureContext);
  const latest = useRef({ apply, gesture, shown });
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    latest.current = { apply, gesture, shown };
  });

  useEffect(() => {
    const current = drag.current;
    if (current && !current.live && current.input.value !== shown) current.input.value = shown;
  }, [shown]);

  useEffect(() => () => drag.current?.detach(), []);

  return useCallback(
    (input: HTMLInputElement | null) => {
      drag.current?.detach();
      drag.current = null;
      if (!input) return;
      input.value = latest.current.shown;
      let frame = 0;
      let pending: string | null = null;
      const state: Drag = { input, live: false, detach: () => undefined };
      const flush = () => {
        frame = 0;
        if (pending === null) return;
        const value = pending;
        pending = null;
        latest.current.apply(value);
      };
      const onInput = () => {
        if (!state.live) {
          state.live = true;
          latest.current.gesture?.begin();
        }
        pending = input.value;
        if (frame === 0) frame = requestAnimationFrame(flush);
      };
      const finish = () => {
        if (frame !== 0) cancelAnimationFrame(frame);
        pending = input.value;
        flush();
        if (!state.live) return;
        state.live = false;
        latest.current.gesture?.end();
      };
      const close = () => {
        if (state.live) finish();
      };
      input.addEventListener("input", onInput);
      input.addEventListener("change", finish);
      input.addEventListener("blur", close);
      state.detach = () => {
        input.removeEventListener("input", onInput);
        input.removeEventListener("change", finish);
        input.removeEventListener("blur", close);
        close();
      };
      drag.current = state;
    },
    [],
  );
}
