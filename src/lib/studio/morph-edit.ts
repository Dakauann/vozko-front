import { editVisualClip, type ClipItemsEdit } from "./clip-items";
import { videoCanvasSize, type CanvasSize, type Clip, type Layer, type VideoDocument } from "./document";
import { editMorph, keyAt, morphValue, setMorphKey } from "./keyframe-edit";
import { keyframeFault, morphFramesOf, withLane } from "./keyframes";
import { MORPH_PROPERTY, type MorphKeyframe, type VertexPin } from "./morph-keys";
import { asSelectionEdit, type Refusal, type SelectionEdit } from "./selection-edit";
import type { ClipPatch } from "./timeline";
import { convertToPath } from "./vector-layer";
import { isValidPath } from "./vector-path";

export type MorphRefusal = "notShape" | "outside" | "noKey" | "badPath" | "animated";

export type MorphEdit = ClipItemsEdit<MorphRefusal>;

const CONVERTIBLE = new Set<Layer["shape"]>(["rect", "ellipse", "triangle", "star", "polygon", "path"]);

export function takesMorph(layer: Layer | undefined): boolean {
  return layer?.type === "shape" && CONVERTIBLE.has(layer.shape);
}

function clipBox(clip: Clip, frame: CanvasSize): CanvasSize {
  return { width: clip.transform.w * frame.width, height: clip.transform.h * frame.height };
}

export function pathLayerOf(clip: Clip, frame: CanvasSize): Layer | null {
  const layer = clip.layer;
  if (!layer || !takesMorph(layer)) return null;
  if (layer.shape === "path") return layer;
  const patch = convertToPath(layer, clipBox(clip, frame));
  return patch ? { ...layer, ...patch } : null;
}

function inside(clip: Clip, atMs: number): boolean {
  return atMs >= 0 && atMs <= clip.durationMs;
}

function morphClip(doc: VideoDocument, clipId: string, change: (clip: Clip, layer: Layer) => ClipPatch | MorphRefusal): MorphEdit {
  const frame = videoCanvasSize(doc);
  return editVisualClip<MorphRefusal>(doc, clipId, (clip) => {
    const layer = clip.type === "overlay" ? pathLayerOf(clip, frame) : null;
    if (!layer) return "notShape";
    const patch = change({ ...clip, layer }, layer);
    if (typeof patch === "string") return patch;
    return layer === clip.layer ? patch : { layer, ...patch };
  });
}

export function convertClipToPath(doc: VideoDocument, clipId: string): MorphEdit {
  return morphClip(doc, clipId, (_clip, layer) => ({ layer }));
}

export function setPathKeys(doc: VideoDocument, clipId: string, frames: readonly MorphKeyframe[]): MorphEdit {
  return morphClip(doc, clipId, (clip) => {
    if (frames.some((frame) => !inside(clip, frame.atMs))) return "outside";
    const keyframes = withLane(clip.keyframes, MORPH_PROPERTY, [...frames].sort((a, b) => a.atMs - b.atMs));
    if (keyframeFault(keyframes, clip.transform)) return "badPath";
    const still = frames.length === 0 && morphFramesOf(clip.keyframes).length > 0 ? { layer: { ...clip.layer!, path: morphValue(clip, 0) } } : {};
    return { keyframes, ...still };
  });
}

export function togglePathKey(doc: VideoDocument, clipId: string, localMs: number): MorphEdit {
  return morphClip(doc, clipId, (clip) => {
    if (!inside(clip, localMs)) return "outside";
    const frames = morphFramesOf(clip.keyframes);
    const existing = keyAt(frames, localMs);
    if (!existing) return { keyframes: setMorphKey(clip, localMs, morphValue(clip, localMs)) };
    const remaining = frames.filter((frame) => frame !== existing);
    return { keyframes: withLane(clip.keyframes, MORPH_PROPERTY, remaining), ...(remaining.length === 0 ? { layer: { ...clip.layer!, path: existing.path } } : {}) };
  });
}

export function editClipPath(doc: VideoDocument, clipId: string, path: string, localMs: number | null): MorphEdit {
  if (!isValidPath(path)) return { ok: false, reason: "badPath" };
  return morphClip(doc, clipId, (clip) => {
    const edit = editMorph(clip, path, localMs !== null && inside(clip, localMs) ? localMs : null);
    return edit.outside ? "animated" : edit.patch;
  });
}

export function setFirstVertex(doc: VideoDocument, clipId: string, localMs: number, pin: VertexPin | null): MorphEdit {
  return morphClip(doc, clipId, (clip) => {
    const frames = morphFramesOf(clip.keyframes);
    const existing = keyAt(frames, localMs);
    if (!existing) return "noKey";
    const placed: MorphKeyframe = { ...existing };
    if (pin) placed.firstVertex = { x: pin.x, y: pin.y };
    else delete placed.firstVertex;
    return { keyframes: withLane(clip.keyframes, MORPH_PROPERTY, frames.map((frame) => (frame === existing ? placed : frame))) };
  });
}

const SELECTION_REFUSALS: Record<Extract<MorphEdit, { ok: false }>["reason"], Refusal> = {
  missing: "invalid",
  locked: "locked",
  notVisual: "invalid",
  invalid: "invalid",
  notShape: "invalid",
  outside: "keyframeOutside",
  noKey: "keyframeOutside",
  badPath: "invalid",
  animated: "keyframeOutside",
};

export function morphSelectionEdit(edit: MorphEdit): SelectionEdit {
  return asSelectionEdit(edit, SELECTION_REFUSALS);
}
