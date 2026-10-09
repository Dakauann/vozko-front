export type ModelKind = "image" | "music" | "voice";

export type ProcessingKind = "cutout" | "captions" | "denoise" | "proxy";

export type MediaKind = ModelKind | "video" | ProcessingKind;

export const PROCESSING_KINDS: readonly ProcessingKind[] = ["cutout", "captions", "denoise", "proxy"];

export const IMAGE_ASPECTS = ["square", "portrait", "story", "landscape"] as const;

export type ImageAspect = (typeof IMAGE_ASPECTS)[number];

export const MAX_REFERENCE_IMAGES = 16;

export const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"] as const;

export type Voice = (typeof VOICES)[number];

export interface MediaModel {
  id: string;
  name: string;
  default: boolean;
}

export type ClipFit = "cover" | "contain";

export interface NormalizedTransform {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
}

export interface TimelineClip {
  mediaId: string;
  startMs: number;
  durationMs: number;
  trimInMs: number;
  fit?: ClipFit;
  transform: NormalizedTransform;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
}

export interface TimelineTrack {
  clips: TimelineClip[];
}

export interface VideoTimeline {
  durationMs: number;
  background: string;
  visual: TimelineTrack[];
  audio: TimelineTrack[];
}

export type MediaGenerationInput =
  | { kind: "image"; model: string; prompt: string; aspect: ImageAspect; referenceMediaIds?: string[] }
  | { kind: "music"; model: string; prompt: string }
  | { kind: "voice"; model: string; prompt: string; voice?: Voice }
  | { kind: "video"; aspect: ImageAspect; video: VideoTimeline }
  | { kind: ProcessingKind; sourceMediaId: string };

export type MediaJobStatus = "queued" | "running" | "settling" | "done" | "failed";

export type MediaJobFailureCode =
  | "generation_failed"
  | "storage_failed"
  | "timed_out"
  | "enqueue_failed"
  | "insufficient_funds"
  | "reference_unavailable"
  | "cost_unreported";

export interface MediaGenerationJob {
  id: string;
  kind: MediaKind;
  status: MediaJobStatus;
  prompt?: string;
  aspect?: ImageAspect;
  referenceMediaIds: string[];
  voice?: string;
  video?: VideoTimeline;
  sourceMediaId?: string;
  mediaId?: string;
  mediaUrl?: string;
  model?: string;
  failureCode?: MediaJobFailureCode;
  createdAt: string;
  updatedAt: string;
}

export type MediaFrame = ImageAspect | "audio";
