"use client";

import { createStore, type StoreApi } from "zustand/vanilla";

import type { KeyframeProperty } from "@/lib/studio/keyframes";
import { DEFAULT_PX_PER_SECOND } from "@/lib/studio/timeline-view";
import type { Gap } from "@/lib/studio/tools";

export type PanelId = "media" | "ai" | "elements" | "captions" | "process";

export type NoticeTone = "info" | "error";

export interface Notice {
  tone: NoticeTone;
  key: string;
}

export type TrackHeight = "compact" | "normal" | "tall";

export type DragMode = "move" | "insert" | "overwrite" | "ripple" | "roll" | "slip" | "slide";

export type TimelineTool = "select" | "blade" | "ripple" | "roll" | "slip" | "slide";

export const TRIM_TOOLS: readonly TimelineTool[] = ["ripple", "roll", "slip", "slide"];

export const TRACK_HEIGHTS: Record<TrackHeight, { visual: number; audio: number }> = {
  compact: { visual: 40, audio: 32 },
  normal: { visual: 56, audio: 44 },
  tall: { visual: 80, audio: 64 },
};

export interface DragFeedback {
  deltaMs: number;
  x: number;
  y: number;
}

export interface MarkRange {
  inMs: number | null;
  outMs: number | null;
}

export interface FocusState {
  clipId: string;
  solo: boolean;
  zoom: boolean;
}

export interface KeyRef {
  property: KeyframeProperty;
  atMs: number;
}

export interface VideoViewState {
  playheadMs: number;
  playing: boolean;
  rate: number;
  pxPerSecond: number;
  snapping: boolean;
  safeArea: boolean;
  snapGuideMs: number | null;
  panel: PanelId;
  notice: Notice | null;
  trackHeight: TrackHeight;
  soloTrackIds: string[];
  linkedSelection: boolean;
  magnetic: boolean;
  dragMode: DragMode | null;
  keyProperty: KeyframeProperty;
  tool: TimelineTool;
  range: MarkRange;
  selectedGap: Gap | null;
  feedback: DragFeedback | null;
  viewportPx: number;
  scrollRequest: number | null;
  focus: FocusState | null;
  selectedKeys: KeyRef[];
}

export type VideoViewStore = StoreApi<VideoViewState>;

export function createVideoViewStore(): VideoViewStore {
  return createStore<VideoViewState>()(() => ({
    playheadMs: 0,
    playing: false,
    rate: 0,
    pxPerSecond: DEFAULT_PX_PER_SECOND,
    snapping: true,
    safeArea: false,
    snapGuideMs: null,
    panel: "media",
    notice: null,
    trackHeight: "normal",
    soloTrackIds: [],
    linkedSelection: true,
    magnetic: false,
    dragMode: null,
    keyProperty: "x",
    tool: "select",
    range: { inMs: null, outMs: null },
    selectedGap: null,
    feedback: null,
    viewportPx: 0,
    scrollRequest: null,
    focus: null,
    selectedKeys: [],
  }));
}
