import { editClipItem, editClipItems, insertItem, moveItem, removeItem, type ClipItems, type ClipItemsRefusal } from "./clip-items";
import type { Clip, VideoDocument } from "./document";
import type { Keyframe } from "./keyframes";
import { editMaskPath, editMaskValue, MASK_PROPERTIES, MASK_RANGES, maskIssue, reshapeMask, setMaskLane, setMaskPathLane, setMaskPathVertex, toggleMaskKey, toggleMaskPathKey, type Mask, type MaskMode, type MaskProperty, type MaskShape } from "./masks";
import type { MorphKeyframe, VertexPin } from "./morph-keys";
import { asSelectionEdit, type Refusal, type SelectionEdit } from "./selection-edit";

export type MaskEditRefusal = ClipItemsRefusal | "maskMissing" | "animated" | "outside";

export type MaskEdit = { ok: true; document: VideoDocument } | { ok: false; reason: MaskEditRefusal };

export type MaskPatch = Partial<Record<MaskProperty, number>> & {
  shape?: MaskShape;
  mode?: MaskMode;
  invert?: boolean;
  points?: number;
  path?: string;
};

const MASKS: ClipItems<Mask> = {
  read: (clip) => clip.masks ?? [],
  write: (masks) => ({ masks: masks.length > 0 ? masks : undefined }),
  invalid: (masks) => maskIssue(masks) !== null,
};

function withMask(doc: VideoDocument, clipId: string, maskId: string, change: (mask: Mask, clip: Clip) => Mask | MaskEditRefusal): MaskEdit {
  return editClipItem<Mask, MaskEditRefusal>(doc, clipId, maskId, MASKS, "maskMissing", change);
}

export function addClipMask(doc: VideoDocument, clipId: string, mask: Mask, index?: number): MaskEdit {
  return editClipItems<Mask, MaskEditRefusal>(doc, clipId, MASKS, (masks) => insertItem(masks, mask, index));
}

export function removeClipMask(doc: VideoDocument, clipId: string, maskId: string): MaskEdit {
  return editClipItems<Mask, MaskEditRefusal>(doc, clipId, MASKS, (masks) => removeItem(masks, maskId) ?? "maskMissing");
}

export function moveClipMask(doc: VideoDocument, clipId: string, maskId: string, toIndex: number): MaskEdit {
  return editClipItems<Mask, MaskEditRefusal>(doc, clipId, MASKS, (masks) => moveItem(masks, maskId, toIndex) ?? "maskMissing");
}

export function patchMask(current: Mask, patch: MaskPatch, localMs: number | null): Mask | MaskEditRefusal {
  let next: Mask = patch.shape && patch.shape !== current.shape ? reshapeMask(current, patch.shape) : { ...current };
  if (patch.mode !== undefined) next.mode = patch.mode;
  if (patch.invert !== undefined) next.invert = patch.invert || undefined;
  if (patch.points !== undefined) next.points = patch.points;
  if (patch.path !== undefined) {
    const edited = editMaskPath(next, patch.path, localMs);
    if (!edited) return "animated";
    next = edited;
  }
  if (next.invert === undefined) delete next.invert;
  for (const property of MASK_PROPERTIES) {
    const value = patch[property];
    if (value === undefined) continue;
    const [low, high] = MASK_RANGES[property];
    if (!(value >= low && value <= high)) return "invalid";
    const edited = editMaskValue(next, property, value, localMs);
    if (!edited) return "animated";
    next = edited;
  }
  return next;
}

export function updateClipMask(doc: VideoDocument, clipId: string, maskId: string, patch: MaskPatch, localMs: number | null): MaskEdit {
  return withMask(doc, clipId, maskId, (current) => patchMask(current, patch, localMs));
}

export function animateClipMask(doc: VideoDocument, clipId: string, maskId: string, property: MaskProperty, frames: readonly Keyframe[]): MaskEdit {
  return withMask(doc, clipId, maskId, (mask, clip) => {
    if (frames.some((frame) => frame.atMs < 0 || frame.atMs > clip.durationMs)) return "outside";
    return setMaskLane(mask, property, frames);
  });
}

export function animateClipMaskPath(doc: VideoDocument, clipId: string, maskId: string, frames: readonly MorphKeyframe[]): MaskEdit {
  return withMask(doc, clipId, maskId, (mask, clip) => {
    if (frames.some((frame) => frame.atMs < 0 || frame.atMs > clip.durationMs)) return "outside";
    return setMaskPathLane(mask, frames);
  });
}

export function setClipMaskPathVertex(doc: VideoDocument, clipId: string, maskId: string, atMs: number, pin: VertexPin | null): MaskEdit {
  return withMask(doc, clipId, maskId, (mask) => setMaskPathVertex(mask, atMs, pin) ?? "outside");
}

export function toggleClipMaskPathKey(doc: VideoDocument, clipId: string, maskId: string, localMs: number): MaskEdit {
  return withMask(doc, clipId, maskId, (mask, clip) => (localMs < 0 || localMs > clip.durationMs ? "outside" : toggleMaskPathKey(mask, localMs)));
}

export function toggleClipMaskKey(doc: VideoDocument, clipId: string, maskId: string, property: MaskProperty, localMs: number): MaskEdit {
  return withMask(doc, clipId, maskId, (mask, clip) => (localMs < 0 || localMs > clip.durationMs ? "outside" : toggleMaskKey(mask, property, localMs)));
}

const SELECTION_REFUSALS: Record<MaskEditRefusal, Refusal> = {
  missing: "invalid",
  locked: "locked",
  notVisual: "invalid",
  maskMissing: "invalid",
  animated: "keyframeOutside",
  outside: "keyframeOutside",
  invalid: "outOfRange",
};

export function maskSelectionEdit(edit: MaskEdit): SelectionEdit {
  return asSelectionEdit(edit, SELECTION_REFUSALS);
}
