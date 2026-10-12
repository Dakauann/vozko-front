import type { ModelKind } from "@/lib/media-generation/types";

import type { SourceWindow } from "./caption-cues";
import { captionWindow } from "./captions";
import type { Clip, Track } from "./document";
import { clipImageSource, type AssetSlot } from "./image-sources";
import type { MediaClipType } from "./media-clips";
import { trackAccepts } from "./timeline";

export type ClipJobKind = "captions" | "denoise" | "cutout";

export const CLIP_JOB_SOURCES: Record<ClipJobKind, (clip: Clip, track: Track) => boolean> = {
  captions: (clip, track) => Boolean(clip.assetId) && (clip.type === "audio" || (clip.type === "video" && track.kind === "visual")),
  denoise: (clip) => clip.type === "audio" && Boolean(clip.assetId),
  cutout: (clip) => Boolean(clipImageSource(clip)?.assetId),
};

export interface ClipJobRequest {
  input: { kind: ClipJobKind; sourceMediaId: string };
  target: { clipId: string; window?: SourceWindow; slot?: AssetSlot };
}

export function clipJobTarget(kind: ClipJobKind, clip: Clip): ClipJobRequest["target"] {
  const slot = kind === "cutout" ? clipImageSource(clip)?.slot : undefined;
  return { clipId: clip.id, ...(kind === "captions" ? { window: captionWindow(clip) } : {}), ...(slot !== undefined && slot !== "clip" ? { slot } : {}) };
}

export function clipJobSource(kind: ClipJobKind, clip: Clip): string | null {
  return (kind === "cutout" ? clipImageSource(clip)?.assetId : clip.assetId) ?? null;
}

export function clipJobRequest(kind: ClipJobKind, clip: Clip): ClipJobRequest | null {
  const source = clipJobSource(kind, clip);
  if (!source) return null;
  return { input: { kind, sourceMediaId: source }, target: clipJobTarget(kind, clip) };
}

export function generatedClipType(kind: ModelKind): MediaClipType {
  return kind === "image" ? "image" : "audio";
}

export function placementTracks<T extends Pick<Track, "kind" | "locked">>(tracks: readonly T[], kind: ModelKind): T[] {
  const type = generatedClipType(kind);
  return tracks.filter((track) => !track.locked && trackAccepts(track.kind, type));
}
