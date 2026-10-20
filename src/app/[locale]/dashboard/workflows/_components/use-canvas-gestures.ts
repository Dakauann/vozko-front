"use client";

import { useCallback, type RefObject } from "react";
import type { Node } from "@xyflow/react";

import { isPanGesture } from "./canvas-detail";
import type { HoverStore } from "./edge-activity";

const CANVAS_PANNING_ATTRIBUTE = "data-canvas-panning";

const CANVAS_BUSY_ATTRIBUTE = "data-canvas-busy";

export function useCanvasGestures({
  wrapperRef,
  hoverStore,
}: {
  wrapperRef: RefObject<HTMLDivElement | null>;
  hoverStore: HoverStore;
}) {
  const onNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => hoverStore.set(node.id),
    [hoverStore],
  );

  const onNodeMouseLeave = useCallback(() => hoverStore.set(null), [hoverStore]);

  const markCanvas = useCallback((attribute: string, on: boolean) => {
    if (on) wrapperRef.current?.setAttribute(attribute, "");
    else wrapperRef.current?.removeAttribute(attribute);
  }, [wrapperRef]);

  const onMoveStart = useCallback(
    (event: MouseEvent | TouchEvent | null) => {
      markCanvas(CANVAS_BUSY_ATTRIBUTE, true);
      markCanvas(CANVAS_PANNING_ATTRIBUTE, isPanGesture(event));
    },
    [markCanvas],
  );

  const onMoveEnd = useCallback(() => {
    markCanvas(CANVAS_BUSY_ATTRIBUTE, false);
    markCanvas(CANVAS_PANNING_ATTRIBUTE, false);
  }, [markCanvas]);

  const onNodeDragStart = useCallback(() => markCanvas(CANVAS_BUSY_ATTRIBUTE, true), [markCanvas]);

  const onNodeDragStop = useCallback(() => markCanvas(CANVAS_BUSY_ATTRIBUTE, false), [markCanvas]);

  return { onNodeMouseEnter, onNodeMouseLeave, onMoveStart, onMoveEnd, onNodeDragStart, onNodeDragStop };
}
