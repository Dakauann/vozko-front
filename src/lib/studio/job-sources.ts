import type { ModelKind } from "@/lib/media-generation/types";

import type { Clip, Layer, Track } from "./document";
import type { MediaClipType } from "./media-clips";
import { trackAccepts } from "./timeline";

export type ClipJobKind = "captions" | "denoise" | "cutout";

export const CLIP_JOB_SOURCES: Record<ClipJobKind, (clip: Clip, track: Track) => boolean> = {
  captions: (clip, track) => Boolean(clip.assetId) && (clip.type === "audio" || (clip.type === "video" && track.kind === "visual")),
  denoise: (clip) => clip.type === "audio" && Boolean(clip.assetId),
  cutout: (clip) => clip.type === "image" && Boolean(clip.assetId),
};

export function layerJobSource(layer: Layer | undefined): string | null {
  return layer && layer.type === "image" && layer.assetId ? layer.assetId : null;
}

export function generatedClipType(kind: ModelKind): MediaClipType {
  return kind === "image" ? "image" : "audio";
}

export function placementTracks<T extends Pick<Track, "kind" | "locked">>(tracks: readonly T[], kind: ModelKind): T[] {
  const type = generatedClipType(kind);
  return tracks.filter((track) => !track.locked && trackAccepts(track.kind, type));
}
