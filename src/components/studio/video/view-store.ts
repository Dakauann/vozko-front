"use client";

import { createStore, type StoreApi } from "zustand/vanilla";

import type { MediaGenerationError } from "@/hooks/use-media-generation";
import type { MediaGenerationJob, ModelKind, Voice } from "@/lib/media-generation/types";
import type { KeyframeProperty } from "@/lib/studio/keyframes";
import type { SourceWindow } from "@/lib/studio/caption-cues";
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

export type VideoJobPurpose = "captions" | "denoise" | "cutout" | "music" | "voice" | "image";

export interface VideoJobTarget {
  clipId?: string;
  trackId?: string;
  atMs?: number;
  durationMs?: number;
  window?: SourceWindow;
}

export type VideoJobState = "running" | "done" | "failed";

export interface VideoJob {
  id: string;
  purpose: VideoJobPurpose;
  target: VideoJobTarget;
  created: MediaGenerationJob | null;
  state: VideoJobState;
  settling: boolean;
  error: MediaGenerationError | null;
  byAgent: boolean;
}

export interface AiDraft {
  prompt: string;
  model: string | null;
  voice: Voice;
  trackId: string | null;
  durationMs: number | null;
}

export const EMPTY_AI_DRAFT: AiDraft = { prompt: "", model: null, voice: "nova", trackId: null, durationMs: null };

export interface VideoViewState {
  playheadMs: number;
  playing: boolean;
  agentFollowing: boolean;
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
  jobs: VideoJob[];
  aiKind: ModelKind;
  aiDrafts: Partial<Record<ModelKind, AiDraft>>;
  clipPicks: Partial<Record<VideoJobPurpose, string>>;
}

export type VideoViewStore = StoreApi<VideoViewState>;

export function createVideoViewStore(): VideoViewStore {
  return createStore<VideoViewState>()(() => ({
    playheadMs: 0,
    playing: false,
    agentFollowing: false,
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
    jobs: [],
    aiKind: "music",
    aiDrafts: {},
    clipPicks: {},
  }));
}
