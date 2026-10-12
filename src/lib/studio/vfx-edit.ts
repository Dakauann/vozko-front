import { editClipItem, editClipItems, insertItem, moveItem, removeItem, type ClipItems, type ClipItemsEdit, type ClipItemsRefusal } from "./clip-items";
import { STUDIO_LIMITS, type Clip, type VideoDocument } from "./document";
import { onScreenFloor, placeStack } from "./edits";
import type { Keyframe } from "./keyframes";
import { defaultReactTrack } from "./behavior-edit";
import { pathOfId, timelineAt } from "./group-scope";
import { asSelectionEdit, type Refusal, type SelectionEdit } from "./selection-edit";
import { effectVfxIssue, vfxTracksIssue } from "./vfx-tracks";
import { DEFAULT_EFFECT_MS, editVfxValue, isKeyedParam, listensToTrack, newEffectClip, paramSpec, setVfxLane, toggleVfxKey, VFX_SPECS, vfxIssue, type Vfx, type VfxColor, type VfxParam } from "./vfx";

export type VfxEditRefusal = ClipItemsRefusal | "vfxMissing" | "animated" | "outside" | "paced" | "noSound";

export type VfxEdit = ClipItemsEdit<VfxEditRefusal>;

export interface VfxPatch {
  params?: Partial<Record<VfxParam, number>>;
  colors?: Partial<Record<VfxColor, string>>;
  seed?: number;
  hidden?: boolean;
  trackId?: string;
}

const VFX_LIST: ClipItems<Vfx> = {
  read: (clip) => clip.vfx ?? [],
  write: (list, clip) => ({ vfx: list.length > 0 || clip.type === "effect" ? list : undefined }),
  invalid: (list, clip) => vfxIssue(list) !== null || (clip.type === "effect" && effectVfxIssue(list) !== null),
};

function withVfx(doc: VideoDocument, clipId: string, vfxId: string, change: Parameters<typeof editClipItem<Vfx, VfxEditRefusal>>[5]): VfxEdit {
  return editClipItem<Vfx, VfxEditRefusal>(doc, clipId, vfxId, VFX_LIST, "vfxMissing", change);
}

export function timelineOf(doc: VideoDocument, id: string | undefined): VideoDocument | null {
  const path = id ? pathOfId(doc, id) : null;
  return path ? timelineAt(doc, path) : null;
}

export function withDefaultTrack(vfx: Vfx, timeline: VideoDocument | null): Vfx {
  if (!listensToTrack(vfx.kind) || vfx.trackId || !timeline) return vfx;
  const trackId = defaultReactTrack(timeline);
  return trackId ? { ...vfx, trackId } : vfx;
}

function heard(edit: VfxEdit, clipId: string): VfxEdit {
  if (!edit.ok) return edit;
  const timeline = timelineOf(edit.document, clipId);
  return timeline && vfxTracksIssue(timeline) ? { ok: false, reason: "noSound" } : edit;
}

export function addClipVfx(doc: VideoDocument, clipId: string, vfx: Vfx, index?: number): VfxEdit {
  return heard(
    editClipItems<Vfx, VfxEditRefusal>(doc, clipId, VFX_LIST, (list) => insertItem(list, vfx, index)),
    clipId,
  );
}

export function removeClipVfx(doc: VideoDocument, clipId: string, vfxId: string): VfxEdit {
  return editClipItems<Vfx, VfxEditRefusal>(doc, clipId, VFX_LIST, (list) => removeItem(list, vfxId) ?? "vfxMissing");
}

export function moveClipVfx(doc: VideoDocument, clipId: string, vfxId: string, toIndex: number): VfxEdit {
  return editClipItems<Vfx, VfxEditRefusal>(doc, clipId, VFX_LIST, (list) => moveItem(list, vfxId, toIndex) ?? "vfxMissing");
}

export function patchVfx(current: Vfx, patch: VfxPatch, localMs: number | null): Vfx | VfxEditRefusal {
  let next: Vfx = { ...current };
  if (patch.seed !== undefined) next.seed = patch.seed;
  if (patch.trackId !== undefined) {
    if (!listensToTrack(current.kind)) return "invalid";
    next.trackId = patch.trackId;
  }
  if (patch.hidden !== undefined) next.hidden = patch.hidden || undefined;
  if (next.hidden === undefined) delete next.hidden;
  for (const [name, color] of Object.entries(patch.colors ?? {})) {
    if (color === undefined) continue;
    if (VFX_SPECS[current.kind].colors[name as VfxColor] === undefined) return "invalid";
    next = { ...next, colors: { ...next.colors, [name]: color } };
  }
  for (const [name, value] of Object.entries(patch.params ?? {})) {
    if (value === undefined) continue;
    const spec = paramSpec(current.kind, name as VfxParam);
    if (!spec || !(value >= spec.range[0] && value <= spec.range[1])) return "invalid";
    const edited = editVfxValue(next, name as VfxParam, value, localMs);
    if (!edited) return "animated";
    next = edited;
  }
  return next;
}

export function updateClipVfx(doc: VideoDocument, clipId: string, vfxId: string, patch: VfxPatch, localMs: number | null): VfxEdit {
  return heard(
    withVfx(doc, clipId, vfxId, (current) => patchVfx(current, patch, localMs)),
    clipId,
  );
}

export function animateClipVfx(doc: VideoDocument, clipId: string, vfxId: string, name: VfxParam, frames: readonly Keyframe[]): VfxEdit {
  return withVfx(doc, clipId, vfxId, (vfx, clip) => {
    if (!isKeyedParam(vfx.kind, name)) return paramSpec(vfx.kind, name) ? "paced" : "invalid";
    if (frames.some((frame) => frame.atMs < 0 || frame.atMs > clip.durationMs)) return "outside";
    return setVfxLane(vfx, name, frames);
  });
}

export function toggleClipVfxKey(doc: VideoDocument, clipId: string, vfxId: string, name: VfxParam, localMs: number): VfxEdit {
  return withVfx(doc, clipId, vfxId, (vfx, clip) => {
    if (!isKeyedParam(vfx.kind, name)) return paramSpec(vfx.kind, name) ? "paced" : "invalid";
    return localMs < 0 || localMs > clip.durationMs ? "outside" : toggleVfxKey(vfx, name, localMs);
  });
}

export function placeEffectClip(doc: VideoDocument, clip: Clip): { document: VideoDocument; clipId: string } | null {
  const placed = placeStack(doc, [clip], onScreenFloor(doc, clip.startMs, clip.durationMs));
  return placed ? { document: placed.document, clipId: placed.ids[0] } : null;
}

export function addEffectClip(doc: VideoDocument, vfx: Vfx[], atMs: number, durationMs: number = DEFAULT_EFFECT_MS): { document: VideoDocument; clipId: string } | null {
  const start = Math.min(Math.max(0, Math.round(atMs)), STUDIO_LIMITS.maxVideoMs - STUDIO_LIMITS.minClipMs);
  const duration = Math.min(Math.max(STUDIO_LIMITS.minClipMs, Math.round(durationMs)), STUDIO_LIMITS.maxVideoMs - start);
  if (vfxIssue(vfx) || effectVfxIssue(vfx)) return null;
  const placed = placeEffectClip(doc, newEffectClip(vfx, start, duration));
  return placed && !vfxTracksIssue(placed.document) ? placed : null;
}

const SELECTION_REFUSALS: Record<VfxEditRefusal, Refusal> = {
  missing: "invalid",
  locked: "locked",
  notVisual: "invalid",
  invalid: "outOfRange",
  vfxMissing: "invalid",
  animated: "keyframeOutside",
  outside: "keyframeOutside",
  paced: "invalid",
  noSound: "invalid",
};

export function vfxSelectionEdit(edit: VfxEdit): SelectionEdit {
  return asSelectionEdit(edit, SELECTION_REFUSALS);
}
