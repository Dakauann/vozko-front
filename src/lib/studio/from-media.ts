import { STUDIO_LIMITS, emptyImageDocument, emptyVideoDocument, IMAGE_PRESETS, newImageLayer, VIDEO_ASPECT_SIZES, type CanvasSize, type ImageDocument, type ImagePreset, type StudioKind, type VideoAspect, type VideoDocument } from "./document";
import { clipTypeForMedia, mediaClips, type MediaClipType } from "./media-clips";
import { placeClips } from "./timeline";

export interface MediaFrame {
  width: number;
  height: number;
  durationMs?: number;
}

function ratioDistance(a: CanvasSize, b: CanvasSize): number {
  return Math.abs(Math.log(a.width / a.height) - Math.log(b.width / b.height));
}

function hasShape(frame: MediaFrame): boolean {
  return frame.width > 0 && frame.height > 0;
}

export function studioKindForMedia(mediaType: string): StudioKind | null {
  const type = clipTypeForMedia(mediaType);
  if (type === null) return null;
  return type === "image" ? "image" : "video";
}

export function closestImagePreset(frame: MediaFrame): ImagePreset {
  if (!hasShape(frame)) return IMAGE_PRESETS[0];
  return IMAGE_PRESETS.reduce((best, preset) => (ratioDistance(frame, preset) < ratioDistance(frame, best) ? preset : best));
}

export function closestVideoAspect(frame: MediaFrame): VideoAspect {
  const aspects = Object.keys(VIDEO_ASPECT_SIZES) as VideoAspect[];
  if (!hasShape(frame)) return aspects[0];
  return aspects.reduce((best, aspect) => (ratioDistance(frame, VIDEO_ASPECT_SIZES[aspect]) < ratioDistance(frame, VIDEO_ASPECT_SIZES[best]) ? aspect : best));
}

export function imageDocumentFromMedia(assetId: string, frame: MediaFrame): ImageDocument {
  const preset = closestImagePreset(frame);
  const document = emptyImageDocument({ width: preset.width, height: preset.height });
  const relative = hasShape(frame) ? frame.width / frame.height / (preset.width / preset.height) : 1;
  const w = relative >= 1 ? 1 : relative;
  const h = relative >= 1 ? 1 / relative : 1;
  const [artboard] = document.artboards;
  return { ...document, artboards: [{ ...artboard, layers: [newImageLayer(assetId, { x: 0.5, y: 0.5, w, h, rotation: 0, opacity: 1 })] }] };
}

export function videoDocumentFromMedia(type: Exclude<MediaClipType, "image">, assetId: string, frame: MediaFrame): VideoDocument | null {
  const document = emptyVideoDocument(closestVideoAspect(frame));
  return placeClips(document, mediaClips(type, assetId, 0, frame.durationMs))?.document ?? null;
}

export function projectNameFrom(description: string, fallback: string): string {
  const name = description.trim() || fallback;
  return Array.from(name).slice(0, STUDIO_LIMITS.maxProjectNameRunes).join("").trim();
}
