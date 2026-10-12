"use client";

import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

export type ResizeEdge = "left" | "top";

const EDGES: Record<ResizeEdge, { coordinate: (e: PointerEvent<HTMLElement>) => number; grow: string; shrink: string }> = {
  left: { coordinate: (e) => e.clientX, grow: "ArrowLeft", shrink: "ArrowRight" },
  top: { coordinate: (e) => e.clientY, grow: "ArrowUp", shrink: "ArrowDown" },
};

interface DragResizeOptions {
  edge: ResizeEdge;
  step: number;
  read: () => number;
  resizeTo: (next: number) => number;
  commit: (value: number) => void;
}

export function useDragResize({ edge, step, read, resizeTo, commit }: DragResizeOptions) {
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ origin: number; value: number; applied: number } | null>(null);
  const { coordinate, grow, shrink } = EDGES[edge];

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const value = read();
      drag.current = { origin: coordinate(e), value, applied: value };
      setResizing(true);
    },
    [coordinate, read],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const start = drag.current;
      if (start) start.applied = resizeTo(start.value + start.origin - coordinate(e));
    },
    [coordinate, resizeTo],
  );

  const onPointerUp = useCallback(() => {
    const start = drag.current;
    if (!start) return;
    drag.current = null;
    setResizing(false);
    commit(start.applied);
  }, [commit]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const delta = e.key === grow ? step : e.key === shrink ? -step : 0;
      if (!delta) return;
      e.preventDefault();
      commit(resizeTo(read() + delta));
    },
    [commit, grow, read, resizeTo, shrink, step],
  );

  return {
    resizing,
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
  };
}
