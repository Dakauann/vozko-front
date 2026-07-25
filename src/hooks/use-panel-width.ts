"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PanelWidthOptions {
  def: number;
  min: number;
  max: number;
}

/**
 * Persisted, drag-resizable width for a right-docked panel.
 *
 * The panel is anchored to the right edge, so dragging the LEFT handle to the
 * left widens it: `next = startWidth + (startX - clientX)`. The chosen width is
 * written to localStorage on release and rehydrated on mount, clamped to
 * [min, max] both ways so a stale/out-of-range value can never wedge the panel.
 */
export function usePanelWidth(
  storageKey: string,
  { def, min, max }: PanelWidthOptions,
) {
  const [width, setWidthState] = useState(def);
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(def);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const setWidth = useCallback(
    (value: number) => {
      const clamped = Math.min(max, Math.max(min, Math.round(value)));
      widthRef.current = clamped;
      setWidthState(clamped);
    },
    [min, max],
  );

  // Rehydrate the persisted width on mount (client-only; avoids SSR mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw != null) {
        const parsed = Number.parseInt(raw, 10);
        // SSR-safe hydration of persisted width: first render must match the
        // server (def), so the stored value is applied post-mount, not in a
        // useState initializer.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Number.isFinite(parsed)) setWidth(parsed);
      }
    } catch {
      /* localStorage unavailable (private mode / SSR) — keep the default */
    }
  }, [storageKey, setWidth]);

  useEffect(() => {
    if (!resizing) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setWidth(drag.startW + (drag.startX - e.clientX));
    };
    const onUp = () => {
      setResizing(false);
      dragRef.current = null;
      try {
        window.localStorage.setItem(storageKey, String(widthRef.current));
      } catch {
        /* ignore persistence failures */
      }
    };

    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [resizing, storageKey, setWidth]);

  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: widthRef.current };
    setResizing(true);
  }, []);

  return { width, startResize, resizing };
}
