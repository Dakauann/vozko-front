"use client";

import { createStore, type StoreApi } from "zustand/vanilla";
import type { ChromaView } from "@/lib/studio/scene/video-scene";

import type { MediaGenerationError } from "@/hooks/use-media-generation";
import { SOUND_EFFECT_MS } from "@/lib/media-generation/sound-effects";
import type { MediaGenerationJob, ModelKind, Voice } from "@/lib/media-generation/types";
import type { AnimatedProperty } from "@/lib/studio/keyframes";
import type { GraphFit, GraphMode, GraphShow, GraphTarget } from "@/lib/studio/graph-editor";
import type { SourceWindow } from "@/lib/studio/caption-cues";
import type { AssetSlot } from "@/lib/studio/image-sources";
import { DEFAULT_PX_PER_SECOND } from "@/lib/studio/timeline-view";
import type { Gap } from "@/lib/studio/tools";
import type { TrimLimit } from "@/lib/studio/edits";
import type { TrimPreview } from "@/lib/studio/trim-edits";
import type { PreviewQuality } from "@/lib/studio/preview-quality";
import type { MarkRange } from "@/lib/studio/work-area";
import type { Viewport } from "@/lib/studio/viewport";
import type { CanvasSize } from "@/lib/studio/document";
import type { PathPoint } from "@/lib/studio/position-path";
import type { TrackDirection } from "@/lib/studio/tracking/track-run";
import type { TrackOutcome } from "@/lib/studio/tracking/track-outcome";

export interface TrackTool {
  clipId: string;
  trackerId?: string;
  point: PathPoint | null;
  size: number;
  direction: TrackDirection;
  progress: number | null;
  pending: TrackOutcome | null;
}

export interface PathEditTarget {
  clipId: string;
  maskId?: string;
}

export type PanelId = "media" | "ai" | "text" | "elements" | "transitions" | "effects" | "captions" | "process";

export type NoticeTone = "info" | "error";

export interface Notice {
  tone: NoticeTone;
  key: string;
}

export type TrackHeight = "compact" | "normal" | "tall";

export type DragMode = "move" | "insert" | "overwrite" | "ripple" | "roll" | "slip" | "slide";

export type KeyDialog = "velocity" | "stretch";

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
  limit?: TrimLimit;
}

export type { MarkRange };

export interface FocusState {
  clipId: string;
  solo: boolean;
  zoom: boolean;
}

export interface KeyRef {
  property: AnimatedProperty;
  atMs: number;
}

export const VIDEO_JOB_PURPOSES = ["captions", "denoise", "cutout", "music", "voice", "sfx", "image"] as const;

export type VideoJobPurpose = (typeof VIDEO_JOB_PURPOSES)[number];

export interface VideoJobTarget {
  clipId?: string;
  trackId?: string;
  atMs?: number;
  durationMs?: number;
  window?: SourceWindow;
  thenCutout?: boolean;
  slot?: AssetSlot;
}

export type VideoJobState = "running" | "done" | "failed";

export interface VideoJob {
  id: string;
  purpose: VideoJobPurpose;
  target: VideoJobTarget;
  startedFrom?: string;
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
  lengthMs: number;
}

export const EMPTY_AI_DRAFT: AiDraft = { prompt: "", model: null, voice: "nova", trackId: null, durationMs: null, lengthMs: SOUND_EFFECT_MS.initial };

export interface VideoViewState {
  groupPath: string[];
  playheadMs: number;
  playing: boolean;
  agentFollowing: boolean;
  rate: number;
  previewRate: number;
  loop: boolean;
  previewQuality: PreviewQuality;
  transparencyGrid: boolean;
  scrubbing: boolean;
  blurWhileScrubbing: boolean;
  previewViewport: Viewport;
  previewFit: boolean;
  previewContainer: CanvasSize | null;
  chromaView: ChromaView;
  pxPerSecond: number;
  snapping: boolean;
  safeArea: boolean;
  depthOverlay: boolean;
  layoutOverlay: boolean;
  snapGuideMs: number | null;
  panel: PanelId;
  notice: Notice | null;
  trackHeight: TrackHeight;
  soloTrackIds: string[];
  mixerOpen: boolean;
  showShy: boolean;
  linkedSelection: boolean;
  magnetic: boolean;
  dragMode: DragMode | null;
  keyProperty: AnimatedProperty;
  tool: TimelineTool;
  range: MarkRange;
  selectedGap: Gap | null;
  feedback: DragFeedback | null;
  trimPreview: TrimPreview | null;
  viewportPx: number;
  scrollRequest: number | null;
  focus: FocusState | null;
  graphEditor: boolean;
  graphMode: GraphMode;
  graphShow: GraphShow;
  graphFit: GraphFit;
  graphTarget: GraphTarget;
  selectedKeys: KeyRef[];
  keyDialog: KeyDialog | null;
  selectedTransitionId: string | null;
  editingTextClipId: string | null;
  jobs: VideoJob[];
  aiKind: ModelKind;
  aiDrafts: Partial<Record<ModelKind, AiDraft>>;
  clipPicks: Partial<Record<VideoJobPurpose, string>>;
  trackTool: TrackTool | null;
  pathEdit: PathEditTarget | null;
  dataEditorFor: string | null;
}

export type VideoViewStore = StoreApi<VideoViewState>;

export function createVideoViewStore(): VideoViewStore {
  return createStore<VideoViewState>()(() => ({
    groupPath: [],
    playheadMs: 0,
    playing: false,
    agentFollowing: false,
    rate: 0,
    previewRate: 1,
    loop: false,
    previewQuality: "full",
    transparencyGrid: false,
    scrubbing: false,
    blurWhileScrubbing: false,
    previewViewport: { scale: 1, x: 0, y: 0 },
    previewFit: true,
    previewContainer: null,
    chromaView: null,
    pxPerSecond: DEFAULT_PX_PER_SECOND,
    snapping: true,
    safeArea: false,
    depthOverlay: false,
    layoutOverlay: false,
    snapGuideMs: null,
    panel: "media",
    notice: null,
    trackHeight: "normal",
    soloTrackIds: [],
    mixerOpen: false,
    showShy: false,
    linkedSelection: true,
    magnetic: false,
    dragMode: null,
    keyProperty: "x",
    tool: "select",
    range: { inMs: null, outMs: null },
    selectedGap: null,
    feedback: null,
    trimPreview: null,
    viewportPx: 0,
    scrollRequest: null,
    focus: null,
    graphEditor: false,
    graphMode: "value",
    graphShow: "animated",
    graphFit: "all",
    graphTarget: "keys",
    selectedKeys: [],
    keyDialog: null,
    selectedTransitionId: null,
    editingTextClipId: null,
    jobs: [],
    aiKind: "music",
    aiDrafts: {},
    clipPicks: {},
    trackTool: null,
    pathEdit: null,
    dataEditorFor: null,
  }));
}
