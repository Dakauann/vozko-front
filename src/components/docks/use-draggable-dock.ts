"use client";

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useDragControls, useMotionValue } from "framer-motion";

type DockOffset = { x: number; y: number };

const HOME: DockOffset = { x: 0, y: 0 };

function storageKey(key: string) {
  return `dock-offset:${key}`;
}

function readOffset(key: string): DockOffset {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(storageKey(key)) ?? "null",
    );
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      Number.isFinite((parsed as DockOffset).x) &&
      Number.isFinite((parsed as DockOffset).y)
    ) {
      return { x: (parsed as DockOffset).x, y: (parsed as DockOffset).y };
    }
    return HOME;
  } catch {
    return HOME;
  }
}

function writeOffset(key: string, offset: DockOffset | null) {
  try {
    if (offset)
      window.localStorage.setItem(storageKey(key), JSON.stringify(offset));
    else window.localStorage.removeItem(storageKey(key));
  } catch {
    return;
  }
}

export function useDraggableDock(key: string) {
  const [initial] = useState(() => readOffset(key));
  const x = useMotionValue(initial.x);
  const y = useMotionValue(initial.y);
  const controls = useDragControls();
  const boundsRef = useRef<HTMLDivElement>(null);

  const onDragEnd = useCallback(
    () => writeOffset(key, { x: x.get(), y: y.get() }),
    [key, x, y],
  );

  const startDrag = useCallback(
    (event: ReactPointerEvent) => {
      if (
        (event.target as HTMLElement).closest(
          "button, a, input, [role='combobox']",
        )
      )
        return;
      controls.start(event);
    },
    [controls],
  );

  const reset = useCallback(() => {
    x.set(HOME.x);
    y.set(HOME.y);
    writeOffset(key, null);
  }, [key, x, y]);

  return {
    x,
    y,
    boundsRef,
    startDrag,
    reset,
    dragProps: {
      drag: true,
      dragControls: controls,
      dragListener: false,
      dragMomentum: false,
      dragElastic: 0,
      onDragEnd,
    },
  };
}
