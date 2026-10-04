"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import { useSpineWidth } from "@/contexts/sidebar-context";
import { useViewportWidth } from "@/hooks/use-viewport-width";
import { DEFAULT_SHEET_WIDTH, parseStoredWidth, sheetLayout } from "@/lib/aichat/sheet-width";

const KEY_STEP = 24;
const SHEET_OFFSET_VAR = "--assistant-sheet-w";

function readStored(storageKey: string): number {
  if (typeof window === "undefined") return DEFAULT_SHEET_WIDTH;
  try {
    return parseStoredWidth(localStorage.getItem(storageKey)) ?? DEFAULT_SHEET_WIDTH;
  } catch {
    return DEFAULT_SHEET_WIDTH;
  }
}

function persist(storageKey: string, width: number) {
  try {
    localStorage.setItem(storageKey, String(width));
  } catch {
    return;
  }
}

export function useResizableSheet(storageKey: string, open: boolean) {
  const viewport = useViewportWidth();
  const spine = useSpineWidth();
  const [desired, setDesired] = useState<number>(() => readStored(storageKey));
  const [expanded, setExpanded] = useState(false);
  const [resizing, setResizing] = useState(false);
  const layout = sheetLayout(desired, viewport, spine);
  const pushing = open && !expanded && layout.mode === "push";
  const latest = useRef(layout.width);
  const drag = useRef<{ x: number; width: number } | null>(null);

  useEffect(() => {
    latest.current = layout.width;
  }, [layout.width]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(SHEET_OFFSET_VAR, pushing ? `${layout.width}px` : "0px");
    return () => {
      root.style.setProperty(SHEET_OFFSET_VAR, "0px");
    };
  }, [pushing, layout.width]);

  const resizeTo = useCallback(
    (next: number) => {
      const width = sheetLayout(next, window.innerWidth, spine).width;
      latest.current = width;
      setDesired(width);
      return width;
    },
    [spine],
  );

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, width: latest.current };
    setResizing(true);
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const start = drag.current;
      if (start) resizeTo(start.width + start.x - e.clientX);
    },
    [resizeTo],
  );

  const onPointerUp = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    setResizing(false);
    persist(storageKey, latest.current);
  }, [storageKey]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const delta: Record<string, number> = { ArrowLeft: KEY_STEP, ArrowRight: -KEY_STEP };
      const step = delta[e.key];
      if (!step) return;
      e.preventDefault();
      persist(storageKey, resizeTo(latest.current + step));
    },
    [resizeTo, storageKey],
  );

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

  return {
    width: layout.width,
    pushing,
    expanded,
    resizing,
    setExpanded,
    toggleExpanded,
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
  };
}
