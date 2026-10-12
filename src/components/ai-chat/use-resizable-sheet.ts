"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSpineWidth } from "@/contexts/sidebar-context";
import { useDragResize } from "@/hooks/use-drag-resize";
import { useViewportWidth } from "@/hooks/use-viewport-width";
import { DEFAULT_SHEET_WIDTH, sheetLayout } from "@/lib/aichat/sheet-width";
import { localStore, readStoredSize, writeStoredSize } from "@/lib/stored-size";

const KEY_STEP = 24;
const SHEET_OFFSET_VAR = "--assistant-sheet-w";

export function useResizableSheet(storageKey: string, open: boolean) {
  const viewport = useViewportWidth();
  const spine = useSpineWidth();
  const [desired, setDesired] = useState<number>(() => readStoredSize(localStore(), storageKey) ?? DEFAULT_SHEET_WIDTH);
  const [expanded, setExpanded] = useState(false);
  const layout = sheetLayout(desired, viewport, spine);
  const pushing = open && !expanded && layout.mode === "push";
  const latest = useRef(layout.width);

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

  const read = useCallback(() => latest.current, []);
  const commit = useCallback((width: number) => writeStoredSize(localStore(), storageKey, width), [storageKey]);
  const { resizing, handleProps } = useDragResize({ edge: "left", step: KEY_STEP, read, resizeTo, commit });

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

  return {
    width: layout.width,
    pushing,
    expanded,
    resizing,
    setExpanded,
    toggleExpanded,
    handleProps,
  };
}
