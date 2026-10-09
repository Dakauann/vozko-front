"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { TrackKind } from "@/lib/studio/document";
import { steppedSpan, visibleSpan, type Span } from "@/lib/studio/timeline-view";

export const RULER_HEIGHT = 26;
export const OVERVIEW_HEIGHT = 28;
export const HEADER_WIDTH = 184;
export const CLIP_INSET = 1;
export const DRAG_SLOP_PX = 3;
export const EDGE_SCROLL_PX = 40;
export const MEDIA_DRAG_TYPE = "application/x-vozko-studio-media";

export interface TimelineScroll {
  scrollLeft: number;
  viewportPx: number;
}

export type TimelineScrollStore = StoreApi<TimelineScroll>;

export function createTimelineScroll(): TimelineScrollStore {
  return createStore<TimelineScroll>()(() => ({ scrollLeft: 0, viewportPx: 0 }));
}

export interface TimelineGeometry {
  pxPerSecond: number;
  heightOf: (kind: TrackKind) => number;
  scroll: TimelineScrollStore;
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

export function useScrollLeft(scroll: TimelineScrollStore): number {
  return useStore(scroll, (s) => s.scrollLeft);
}

export function useOnScreen(scroll: TimelineScrollStore, leftPx: number, widthPx: number, overscanPx: number): boolean {
  return useStore(scroll, (s) => s.viewportPx <= 0 || visibleSpan(leftPx, widthPx, s.scrollLeft, s.viewportPx, overscanPx) !== null);
}

export function useVisibleSpan(scroll: TimelineScrollStore, leftPx: number, widthPx: number, overscanPx: number): Span | null {
  const span = (s: TimelineScroll) => steppedSpan(visibleSpan(leftPx, widthPx, s.scrollLeft, s.viewportPx, overscanPx), overscanPx / 2, widthPx);
  const fromPx = useStore(scroll, (s) => span(s)?.fromPx ?? -1);
  const toPx = useStore(scroll, (s) => span(s)?.toPx ?? -1);
  return fromPx < 0 ? null : { fromPx, toPx };
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
