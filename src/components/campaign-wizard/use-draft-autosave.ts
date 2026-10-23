"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type SavePhase = "idle" | "saving" | "saved" | "error";

export interface SaveState<E = unknown> {
  phase: SavePhase;
  savedAt?: number;
  error?: E;
}

export type DraftSaveResult<T, E> = { data: T } | { error: E };

export interface DraftAutosaveOptions<R, T, E> {
  recordId: string | null;
  baseline: string;
  request: R;
  fingerprint: string;
  named: boolean;
  editable: boolean;
  delayMs: number;
  save: (id: string | null, request: R) => Promise<DraftSaveResult<T, E>>;
  idOf: (saved: T) => string;
  onSaved: (saved: T, created: boolean) => void;
}

export interface DraftAutosave<E> {
  state: SaveState<E>;
  save: () => Promise<boolean>;
  dirty: boolean;
  named: boolean;
}

export function useDraftAutosave<R, T, E>({ recordId, baseline, request, fingerprint, named, editable, delayMs, save: store, idOf, onSaved }: DraftAutosaveOptions<R, T, E>): DraftAutosave<E> {
  const [saved, setSaved] = useState(baseline);
  const [state, setState] = useState<SaveState<E>>({ phase: "idle" });
  const live = useRef({ request, fingerprint, named, editable, store, idOf, onSaved });
  const idRef = useRef<string | null>(recordId);
  const savedRef = useRef(baseline);
  const inflight = useRef<Promise<boolean> | null>(null);

  useLayoutEffect(() => {
    live.current = { request, fingerprint, named, editable, store, idOf, onSaved };
  });

  const persist = useCallback(async (): Promise<boolean> => {
    const current = live.current;
    if (!current.editable) return idRef.current !== null;
    if (idRef.current && current.fingerprint === savedRef.current) return true;
    if (!current.named) return false;
    setState((previous) => ({ ...previous, phase: "saving" }));
    const id = idRef.current;
    const result = await current.store(id, current.request);
    if ("error" in result) {
      setState({ phase: "error", error: result.error });
      return false;
    }
    idRef.current = current.idOf(result.data);
    savedRef.current = current.fingerprint;
    setSaved(current.fingerprint);
    setState({ phase: "saved", savedAt: Date.now() });
    live.current.onSaved(result.data, id === null);
    return true;
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    while (inflight.current) await inflight.current;
    const run = persist();
    inflight.current = run;
    try {
      return await run;
    } finally {
      if (inflight.current === run) inflight.current = null;
    }
  }, [persist]);

  useEffect(() => {
    if (!editable || fingerprint === saved || !named) return;
    const timer = window.setTimeout(() => void save(), delayMs);
    return () => window.clearTimeout(timer);
  }, [editable, fingerprint, saved, named, delayMs, save]);

  return { state, save, dirty: fingerprint !== saved, named };
}
