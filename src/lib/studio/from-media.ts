import { addArtboard } from "./artboards";
import {
  STUDIO_LIMITS,
  emptyImageDocument,
  emptyVideoDocument,
  IMAGE_PRESETS,
  newImageLayer,
  VIDEO_ASPECT_SIZES,
  VIDEO_ASPECTS,
  type CanvasSize,
  type ImageDocument,
  type ImagePreset,
  type ImagePresetId,
  type StudioDocument,
  type StudioKind,
  type Transform,
  type VideoAspect,
  type VideoDocument,
} from "./document";
import { clipTypeForMedia, mediaClips, sizedMediaClips, type MediaClipType } from "./media-clips";
import { placeClips } from "./timeline";
import { canvasSizeIssue } from "./validate";

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

export const NEW_IMAGE_PRESET: ImagePresetId = "instagram_post";
export const NEW_VIDEO_ASPECT: VideoAspect = "story";

const EXTRA_MEDIA_SCALE = 0.5;

export interface ProjectMedia {
  mediaId: string;
  type: MediaClipType;
  frame: MediaFrame;
}

interface StudioProjectRequest {
  kind: StudioKind;
  media?: readonly ProjectMedia[];
  sizes?: readonly CanvasSize[];
  aspect?: VideoAspect;
  durationMs?: number;
}

type ProjectDocumentIssue = "size" | "aspect" | "media" | "duration";

type ProjectDocumentResult = { ok: true; document: StudioDocument } | { ok: false; issue: ProjectDocumentIssue };

function presetSize(preset: CanvasSize): CanvasSize {
  return { width: preset.width, height: preset.height };
}

function containedIn(frame: MediaFrame, canvas: CanvasSize, scale: number): Transform {
  const relative = hasShape(frame) ? frame.width / frame.height / (canvas.width / canvas.height) : 1;
  const w = relative >= 1 ? 1 : relative;
  const h = relative >= 1 ? 1 / relative : 1;
  return { x: 0.5, y: 0.5, w: w * scale, h: h * scale, rotation: 0, opacity: 1 };
}

function failed(issue: ProjectDocumentIssue): ProjectDocumentResult {
  return { ok: false, issue };
}

function imageProject(request: StudioProjectRequest): ProjectDocumentResult {
  const media = request.media ?? [];
  if (media.some((m) => m.type !== "image")) return failed("media");
  if (request.aspect !== undefined) return failed("aspect");
  if (request.durationMs !== undefined) return failed("duration");
  const [first, ...rest] = media;
  const fallback = presetSize(first ? closestImagePreset(first.frame) : IMAGE_PRESETS.find((p) => p.id === NEW_IMAGE_PRESET)!);
  const sizes = request.sizes?.length ? request.sizes : [fallback];
  if (sizes.some((size) => canvasSizeIssue(size) !== null)) return failed("size");
  let document = emptyImageDocument(sizes[0]);
  for (const size of sizes.slice(1)) document = addArtboard(document, size).document;
  if (!first) return { ok: true, document };
  const artboards = document.artboards.map((artboard, index) => {
    const extras = index === 0 ? rest.map((m) => newImageLayer(m.mediaId, containedIn(m.frame, artboard.canvas, EXTRA_MEDIA_SCALE))) : [];
    return { ...artboard, layers: [newImageLayer(first.mediaId, containedIn(first.frame, artboard.canvas, 1)), ...extras] };
  });
  return { ok: true, document: { ...document, artboards } };
}

function videoProject(request: StudioProjectRequest): ProjectDocumentResult {
  if (request.sizes?.length) return failed("size");
  const media = request.media ?? [];
  const visual = media.find((m) => m.type !== "audio");
  const aspect = request.aspect ?? (visual ? closestVideoAspect(visual.frame) : NEW_VIDEO_ASPECT);
  if (!VIDEO_ASPECTS.includes(aspect)) return failed("aspect");
  const still = request.durationMs;
  if (still !== undefined && !(Number.isInteger(still) && still >= STUDIO_LIMITS.minClipMs && still <= STUDIO_LIMITS.maxVideoMs)) return failed("duration");
  let document: VideoDocument = emptyVideoDocument(aspect);
  let at = 0;
  for (const m of media) {
    const clips = m.type === "audio" ? mediaClips("audio", m.mediaId, 0, m.frame.durationMs) : sizedMediaClips(m.type, m.mediaId, at, m.frame.durationMs, m.type === "image" ? still : undefined);
    const placed = placeClips(document, clips);
    if (!placed) return failed("media");
    document = placed.document;
    if (m.type !== "audio") at += clips[0].durationMs;
  }
  return { ok: true, document };
}

export function studioProjectDocument(request: StudioProjectRequest): ProjectDocumentResult {
  return request.kind === "image" ? imageProject(request) : videoProject(request);
}

export function imageDocumentFromMedia(assetId: string, frame: MediaFrame): ImageDocument {
  const result = studioProjectDocument({ kind: "image", media: [{ mediaId: assetId, type: "image", frame }] });
  if (!result.ok) throw new Error(result.issue);
  return result.document as ImageDocument;
}

export function videoDocumentFromMedia(type: Exclude<MediaClipType, "image">, assetId: string, frame: MediaFrame): VideoDocument | null {
  const result = studioProjectDocument({ kind: "video", aspect: closestVideoAspect(frame), media: [{ mediaId: assetId, type, frame }] });
  return result.ok ? (result.document as VideoDocument) : null;
}

export function projectNameFrom(description: string, fallback: string): string {
  const name = description.trim() || fallback;
  return Array.from(name).slice(0, STUDIO_LIMITS.maxProjectNameRunes).join("").trim();
}
