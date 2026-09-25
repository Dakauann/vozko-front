"use client";

import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import { DEFAULT_CARD_SIZE, clampCardSize, parseStoredSize, type CardSize } from "@/lib/aichat/card-size";

const KEY_STEP = 24;

function viewport(): CardSize {
  return { width: window.innerWidth, height: window.innerHeight };
}

function readStored(storageKey: string): CardSize {
  if (typeof window === "undefined") return DEFAULT_CARD_SIZE;
  try {
    const stored = parseStoredSize(localStorage.getItem(storageKey));
    return clampCardSize(stored ?? DEFAULT_CARD_SIZE, viewport());
  } catch {
    return DEFAULT_CARD_SIZE;
  }
}

function persist(storageKey: string, size: CardSize) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(size));
  } catch {
  }
}

export function useResizableCard(storageKey: string) {
  const [size, setSize] = useState<CardSize>(() => readStored(storageKey));
  const [expanded, setExpanded] = useState(false);
  const [resizing, setResizing] = useState(false);
  const latest = useRef(size);
  const drag = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const apply = useCallback((next: CardSize) => {
    const clamped = clampCardSize(next, viewport());
    latest.current = clamped;
    setSize(clamped);
  }, []);

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ...latest.current };
    setResizing(true);
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const start = drag.current;
      if (!start) return;
      apply({ width: start.width + start.x - e.clientX, height: start.height + start.y - e.clientY });
    },
    [apply],
  );

  const onPointerUp = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    setResizing(false);
    persist(storageKey, latest.current);
  }, [storageKey]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [KEY_STEP, 0],
        ArrowRight: [-KEY_STEP, 0],
        ArrowUp: [0, KEY_STEP],
        ArrowDown: [0, -KEY_STEP],
      };
      const step = delta[e.key];
      if (!step) return;
      e.preventDefault();
      apply({ width: latest.current.width + step[0], height: latest.current.height + step[1] });
      persist(storageKey, latest.current);
    },
    [apply, storageKey],
  );

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

  return {
    size,
    expanded,
    resizing,
    setExpanded,
    toggleExpanded,
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
  };
}
