import { newMediaClip, newOverlayClip, newStudioId, newTextLayer, STUDIO_LIMITS, type Clip, type Layer, type Transform } from "./document";

export const DEFAULT_STILL_MS = 3000;
export const DEFAULT_OVERLAY_MS = 3000;
export const CAPTION_TRANSFORM: Transform = { x: 0.5, y: 0.82, w: 0.9, h: 0.14, rotation: 0, opacity: 1 };

export type MediaClipType = "video" | "image" | "audio";

export function clipTypeForMedia(mediaType: string): MediaClipType | null {
  if (mediaType === "video" || mediaType === "vsl_video") return "video";
  if (mediaType === "image" || mediaType === "sticker") return "image";
  if (mediaType === "audio") return "audio";
  return null;
}

export function mediaClipDuration(type: MediaClipType, sourceDurationMs: number | undefined): number {
  if (type === "image") return DEFAULT_STILL_MS;
  if (sourceDurationMs === undefined || !Number.isFinite(sourceDurationMs) || sourceDurationMs <= 0) return DEFAULT_STILL_MS;
  return Math.max(STUDIO_LIMITS.minClipMs, Math.min(Math.round(sourceDurationMs), STUDIO_LIMITS.maxVideoMs));
}

export function mediaClips(type: MediaClipType, assetId: string, atMs: number, sourceDurationMs: number | undefined): Clip[] {
  const durationMs = mediaClipDuration(type, sourceDurationMs);
  const primary = newMediaClip(type, assetId, atMs, durationMs);
  if (type !== "video") return [primary];
  const linkId = newStudioId("k");
  return [{ ...primary, linkId }, { ...newMediaClip("audio", assetId, atMs, durationMs), linkId }];
}

export function overlayClip(layer: Layer, atMs: number, transform?: Transform): Clip {
  return newOverlayClip(layer, atMs, DEFAULT_OVERLAY_MS, transform ?? { ...layer.transform });
}

export function captionLayer(text: string): Layer {
  return { ...newTextLayer(text, "body"), fontSize: 0.04, fontWeight: 700, fill: "#ffffff", stroke: "#000000", strokeWidth: 6, lineHeight: 1.15 };
}

export function captionClip(cue: { text: string; startMs: number; endMs: number }): Clip {
  return newOverlayClip(captionLayer(cue.text), cue.startMs, Math.max(STUDIO_LIMITS.minClipMs, cue.endMs - cue.startMs), { ...CAPTION_TRANSFORM });
}
