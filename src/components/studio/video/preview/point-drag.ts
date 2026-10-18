"use client";

import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

import type { PathPoint } from "@/lib/studio/position-path";

import { useVideoEditor } from "../editor-context";

const DRAG_SLOP_PX = 3;

interface PointDragOptions {
  disabled: boolean;
  onMove: (point: PathPoint, event: ReactPointerEvent<HTMLElement>) => void;
  onTap?: () => void;
}

interface PointDragHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
}

function framePoint(frameRef: RefObject<HTMLDivElement | null>, event: ReactPointerEvent<HTMLElement>): PathPoint | null {
  const frame = frameRef.current?.getBoundingClientRect();
  return frame && frame.width > 0 && frame.height > 0 ? { x: (event.clientX - frame.left) / frame.width, y: (event.clientY - frame.top) / frame.height } : null;
}

export function usePointDrag(frameRef: RefObject<HTMLDivElement | null>): (options: PointDragOptions) => PointDragHandlers {
  const { store } = useVideoEditor();
  const drag = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  return (options) => ({
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    },
    onPointerMove: (event) => {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId || options.disabled) return;
      if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_SLOP_PX) return;
      if (!current.moved) {
        current.moved = true;
        store.getState().beginTransaction();
      }
      const point = framePoint(frameRef, event);
      if (point) options.onMove(point, event);
    },
    onPointerUp: (event) => {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) return;
      drag.current = null;
      if (current.moved) store.getState().commitTransaction();
      else options.onTap?.();
    },
    onPointerCancel: () => {
      if (drag.current?.moved) store.getState().cancelTransaction();
      drag.current = null;
    },
  });
}
