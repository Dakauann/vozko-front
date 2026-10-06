"use client";

import { createContext, useContext } from "react";

import type { TrackKind } from "@/lib/studio/document";

export const RULER_HEIGHT = 26;
export const OVERVIEW_HEIGHT = 28;
export const HEADER_WIDTH = 184;
export const CLIP_INSET = 1;
export const DRAG_SLOP_PX = 3;
export const EDGE_SCROLL_PX = 40;
export const MEDIA_DRAG_TYPE = "application/x-vozko-studio-media";

export interface TimelineGeometry {
  pxPerSecond: number;
  heightOf: (kind: TrackKind) => number;
  scrollLeft: number;
  viewportPx: number;
  laneAt: (clientY: number) => string | null;
  timeAt: (clientX: number) => number;
  autoScroll: (clientX: number) => void;
}

export const TimelineGeometryContext = createContext<TimelineGeometry | null>(null);

export function useTimelineGeometry(): TimelineGeometry {
  const value = useContext(TimelineGeometryContext);
  if (!value) throw new Error("useTimelineGeometry must be used inside the timeline");
  return value;
}

export interface DraggedMedia {
  id: string;
  type: string;
}

export function readDraggedMedia(data: DataTransfer): DraggedMedia | null {
  try {
    const parsed = JSON.parse(data.getData(MEDIA_DRAG_TYPE)) as Partial<DraggedMedia>;
    return typeof parsed.id === "string" && typeof parsed.type === "string" ? { id: parsed.id, type: parsed.type } : null;
  } catch {
    return null;
  }
}
