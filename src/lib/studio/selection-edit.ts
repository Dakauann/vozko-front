import { clampClipTransform } from "./clip-transform";
import { canvasAspect, type Anchor, type Clip, type Transform, type VideoDocument } from "./document";
import { editKeyed, editPaint, editTransform, keyableProperties, keyState, keyTimes, localTime, paintValue, propertyValue, momentEasing, momentState, recordMoment, removeMoment, setAllEasing, setMomentEasing, toggleKeyAt, type KeyState, type MomentState } from "./keyframe-edit";
import { animatedBlur, animatedProperties, KEYFRAME_RANGES, timedFramesOf, type AnimatedProperty, type ColorProperty, type Easing, type KeyframeProperty } from "./keyframes";
import { takesLineAnimation } from "./line-animation";
import { anchorFits, animatedTransform } from "./clip-placement";
import { anchorPatch, editPlaced, type AnchorChange } from "./placement-edit";
import { boxToLocal, parentFrameOf, positionRange, type ClipLookup } from "./parenting";
import { animatesText } from "./text-animation";
import { clipTime, hasSourceTime } from "./clip-time";
import { sourceLengthOf } from "./group-scope";
import { findClip, moveClipsBy, trimClipEnd, updateClip, type ClipLocation, type ClipPatch } from "./timeline";
import { documentIssue } from "./validate";

export type Shared<T> = { kind: "same"; value: T } | { kind: "mixed" };

const EPSILON = 1e-9;

function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < EPSILON;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function sharedValue<C, T>(items: readonly C[], get: (item: C) => T): Shared<T> {
  if (items.length === 0) return { kind: "mixed" };
  const first = get(items[0]);
  return items.every((item) => sameValue(get(item), first)) ? { kind: "same", value: first } : { kind: "mixed" };
}

export function sharedOr<T>(shared: Shared<T>, fallback: T): T {
  return shared.kind === "same" ? shared.value : fallback;
}

export const FIELD_GROUPS = ["timing", "trimIn", "fit", "transform", "volume", "fades", "motion", "keyframes", "layer", "textMotion", "speed", "grade", "masks", "vfx", "strength", "chroma", "blend", "line", "counter", "textPath", "look", "parent", "behaviors", "group", "groupSound", "tracking", "chart", "table", "qr", "camera"] as const;

export type FieldGroup = (typeof FIELD_GROUPS)[number];

const GENERATED_GROUPS: Partial<Record<string, FieldGroup>> = { chart: "chart", table: "table", qr: "qr" };

function fieldGroupsOf(clip: Clip): FieldGroup[] {
  if (clip.type === "null") return ["timing", "transform", "keyframes", "parent", "behaviors"];
  const groups: FieldGroup[] = ["timing", "fades"];
  if (hasSourceTime(clip.type)) groups.push("trimIn", "speed");
  if (clip.type === "audio") return [...groups, "volume", "keyframes"];
  if (clip.type === "effect") return [...groups, "strength", "vfx", "grade", "masks", "camera"];
  if (clip.type === "group") return [...groups, "group", "groupSound", "transform", "look", "parent", "motion", "keyframes", "masks", "vfx", "grade", "blend"];
  groups.push("transform", "look", "parent", "motion", "keyframes", "behaviors", "masks", "vfx");
  if (clip.type === "video" || clip.type === "image") groups.push("fit", "grade", "chroma", "blend");
  if (clip.type === "video" && !clip.freeze) groups.push("tracking");
  if (clip.type === "overlay" && clip.layer) groups.push(GENERATED_GROUPS[clip.layer.type] ?? "layer");
  if (clip.type === "overlay" && clip.layer && (takesLineAnimation(clip.layer) || clip.line)) groups.push("line");
  if (animatesText(clip)) groups.push("textMotion", "counter", "textPath");
  return groups;
}

const SINGLE_CLIP_GROUPS: readonly FieldGroup[] = ["masks", "vfx", "chroma", "line", "counter", "textPath", "behaviors", "group", "tracking", "chart", "table", "qr"];

export function commonFields(clips: readonly Clip[]): Set<FieldGroup> {
  if (clips.length === 0) return new Set();
  const common = new Set(fieldGroupsOf(clips[0]));
  for (const clip of clips.slice(1)) {
    const own = new Set(fieldGroupsOf(clip));
    for (const group of common) if (!own.has(group)) common.delete(group);
  }
  if (sharedValue(clips, (clip) => clip.layer?.type).kind === "mixed") common.delete("layer");
  if (sharedValue(clips, (clip) => clip.type === "audio").kind === "mixed") common.delete("keyframes");
  if (clips.length > 1) for (const group of SINGLE_CLIP_GROUPS) common.delete(group);
  return common;
}

export type Refusal = "locked" | "keyframeOutside" | "outOfRange" | "sourcePending" | "noRoom" | "invalid";

export type SelectionEdit = { ok: true; document: VideoDocument } | { ok: false; reason: Refusal };

export function asSelectionEdit<R extends string>(edit: { ok: true; document: VideoDocument } | { ok: false; reason: R }, refusals: Record<R, Refusal>): SelectionEdit {
  return edit.ok ? edit : { ok: false, reason: refusals[edit.reason] };
}

export type ClipEdit = (doc: VideoDocument, location: ClipLocation) => VideoDocument | Refusal;

export function checkedDocument(before: VideoDocument, after: VideoDocument): SelectionEdit {
  if (after === before) return { ok: true, document: before };
  const issue = documentIssue("video", after);
  if (!issue) return { ok: true, document: after };
  return { ok: false, reason: "invalid" };
}

function editable(doc: VideoDocument, clipIds: readonly string[]): string[] {
  return clipIds.filter((id) => {
    const found = findClip(doc, id);
    return found !== null && !found.track.locked;
  });
}

export function editSelection(doc: VideoDocument, clipIds: readonly string[], edit: ClipEdit): SelectionEdit {
  const ids = editable(doc, clipIds);
  if (ids.length === 0) return { ok: false, reason: "locked" };
  let next = doc;
  for (const id of ids) {
    const location = findClip(next, id);
    if (!location) return { ok: false, reason: "invalid" };
    const result = edit(next, location);
    if (typeof result === "string") return { ok: false, reason: result };
    next = result;
  }
  return checkedDocument(doc, next);
}

export type PatchBuilder = (clip: Clip) => ClipPatch | Refusal | null;

export function applyToSelection(doc: VideoDocument, clipIds: readonly string[], build: PatchBuilder): SelectionEdit {
  return editSelection(doc, clipIds, (current, { clip }) => {
    const patch = build(clip);
    if (patch === null) return current;
    if (typeof patch === "string") return patch;
    return updateClip(current, clip.id, patch);
  });
}

export { clipTime } from "./clip-time";

export function shownTransform(clip: Pick<Clip, "transform" | "keyframes" | "startMs" | "durationMs">, playheadMs: number, aspect: number): Transform {
  return animatedTransform(clip.transform, clip.keyframes, clipTime(clip, playheadMs), aspect);
}

export function shownBlur(clip: Pick<Clip, "blur" | "keyframes" | "startMs" | "durationMs">, playheadMs: number): number {
  return animatedBlur(clip.blur, clip.keyframes, clipTime(clip, playheadMs));
}

export function shownPaint(clip: Pick<Clip, "keyframes" | "layer" | "startMs" | "durationMs">, property: ColorProperty, playheadMs: number): string {
  return paintValue(clip, property, clipTime(clip, playheadMs));
}

export function paintPatch(clip: Clip, property: ColorProperty, color: string, playheadMs: number): ClipPatch | Refusal {
  const edit = editPaint(clip, property, color, localTime(clip, playheadMs));
  return edit.outside ? "keyframeOutside" : edit.patch;
}

export function keyedPatch(clip: Clip, property: KeyframeProperty, change: (shown: number) => number, playheadMs: number): ClipPatch | Refusal {
  const [low, high] = KEYFRAME_RANGES[property];
  const edit = editKeyed(clip, property, Math.min(high, Math.max(low, change(propertyValue(clip, property, clipTime(clip, playheadMs))))), localTime(clip, playheadMs));
  return edit.outside ? "keyframeOutside" : edit.patch;
}

export function blurPatch(clip: Clip, change: (shown: number) => number, playheadMs: number): ClipPatch | Refusal {
  return keyedPatch(clip, "blur", change, playheadMs);
}

export function transformPatch(clip: Clip, change: (shown: Transform) => Partial<Transform>, playheadMs: number, aspect: number): ClipPatch | Refusal {
  const shown = shownTransform(clip, playheadMs, aspect);
  const edit = editTransform(clip, clampClipTransform({ ...shown, ...change(shown) }, positionRange(clip)), localTime(clip, playheadMs), aspect);
  return edit.outside ? "keyframeOutside" : edit.patch;
}

export function placedPatch(parents: ClipLookup, clip: Clip, desired: Transform, playheadMs: number, aspect: number): ClipPatch | Refusal {
  const local = boxToLocal(parentFrameOf(parents, clip, clip.startMs + clipTime(clip, playheadMs), aspect), clampClipTransform(desired), aspect);
  if (!local) return "outOfRange";
  const edit = editPlaced(clip, clip.parentId ? clampClipTransform(local, positionRange(clip)) : local, localTime(clip, playheadMs), aspect);
  return edit.outside ? "keyframeOutside" : edit.patch;
}

export function anchorEdit(clip: Clip, anchor: Anchor, keepVisual: boolean, playheadMs: number, aspect: number): AnchorChange | Refusal {
  if (clip.type === "audio") return "invalid";
  if (!anchorFits(anchor)) return "outOfRange";
  return anchorPatch(clip, anchor, keepVisual, clipTime(clip, playheadMs), aspect);
}

export function selectionStart(clips: readonly Pick<Clip, "startMs">[]): number {
  return clips.length === 0 ? 0 : Math.min(...clips.map((clip) => clip.startMs));
}

function locatedClips(doc: VideoDocument, clipIds: readonly string[]): ClipLocation[] {
  return clipIds.map((id) => findClip(doc, id)).filter((found): found is ClipLocation => found !== null);
}

export function moveSelectionBy(doc: VideoDocument, clipIds: readonly string[], deltaMs: number): SelectionEdit {
  const clips = locatedClips(doc, clipIds);
  if (clips.length === 0 || clips.some((found) => found.track.locked)) return { ok: false, reason: "locked" };
  const delta = Math.round(deltaMs);
  if (delta === 0) return { ok: true, document: doc };
  const next = moveClipsBy(doc, clipIds, delta);
  return next === doc ? { ok: false, reason: "noRoom" } : checkedDocument(doc, next);
}

export function moveSelectionTo(doc: VideoDocument, clipIds: readonly string[], startMs: number): SelectionEdit {
  return moveSelectionBy(doc, clipIds, Math.round(startMs) - selectionStart(locatedClips(doc, clipIds).map((found) => found.clip)));
}

export type SourceDurations = Readonly<Record<string, number | undefined>>;

export function sourceDurationOf(clip: Pick<Clip, "type" | "assetId" | "tracks">, durations: SourceDurations): number | undefined | null {
  if (!hasSourceTime(clip.type)) return undefined;
  return sourceLengthOf(clip, (assetId) => durations[assetId]) ?? null;
}

export function editSourced(durations: SourceDurations, edit: (doc: VideoDocument, clip: Clip, sourceDurationMs: number | undefined) => VideoDocument): ClipEdit {
  return (doc, { clip }) => {
    const source = sourceDurationOf(clip, durations);
    return source === null ? "sourcePending" : edit(doc, clip, source);
  };
}

export function trimSelectionEnd(doc: VideoDocument, clipIds: readonly string[], durationOf: (clip: Clip) => number, durations: SourceDurations): SelectionEdit {
  return editSelection(
    doc,
    clipIds,
    editSourced(durations, (current, clip, source) => trimClipEnd(current, clip.id, clip.startMs + durationOf(clip), source)),
  );
}

type MomentClip = Pick<Clip, "keyframes" | "startMs" | "durationMs">;

export function selectionMoment(clips: readonly MomentClip[], playheadMs: number): MomentState {
  const states = clips.map((clip) => momentState(clip, localTime(clip, playheadMs)));
  if (states.includes("outside")) return "outside";
  if (states.length > 0 && states.every((state) => state === "key")) return "key";
  return states.some((state) => state !== "none") ? "between" : "none";
}

function editableClips(doc: VideoDocument, clipIds: readonly string[]): Clip[] {
  return editable(doc, clipIds).map((id) => findClip(doc, id)!.clip);
}

export function toggleSelectionMoment(doc: VideoDocument, clipIds: readonly string[], playheadMs: number): SelectionEdit {
  const state = selectionMoment(editableClips(doc, clipIds), playheadMs);
  if (state === "outside") return { ok: false, reason: "keyframeOutside" };
  return applyToSelection(doc, clipIds, (clip) => {
    const local = localTime(clip, playheadMs);
    if (local === null) return "keyframeOutside";
    return state === "key" ? removeMoment(clip, local) : recordMoment(clip, local, canvasAspect(doc));
  });
}

export function selectionKeyState(clips: readonly MomentClip[], property: AnimatedProperty, playheadMs: number): KeyState {
  const states = new Set(clips.map((clip) => keyState(clip, property, localTime(clip, playheadMs))));
  if (states.size === 1) return [...states][0];
  return states.size === 0 ? "static" : "interpolated";
}

export function toggleSelectionKey(doc: VideoDocument, clipIds: readonly string[], property: AnimatedProperty, playheadMs: number): SelectionEdit {
  const clips = editableClips(doc, clipIds);
  if (clips.some((clip) => localTime(clip, playheadMs) === null)) return { ok: false, reason: "keyframeOutside" };
  const removing = selectionKeyState(clips, property, playheadMs) === "key";
  return applyToSelection(doc, clipIds, (clip) => {
    const local = localTime(clip, playheadMs)!;
    if (removing) return toggleKeyAt(clip, property, local, canvasAspect(doc));
    if (keyState(clip, property, local) === "key") return null;
    if (!keyableProperties(clip).includes(property)) return "invalid";
    return toggleKeyAt(clip, property, local, canvasAspect(doc));
  });
}

export interface SelectionEasing {
  scope: "moment" | "all";
  easing: Easing | null;
}

function allEasings(clip: Pick<Clip, "keyframes">): Easing[] {
  return animatedProperties(clip.keyframes).flatMap((property) => timedFramesOf(clip.keyframes, property).map((frame) => frame.easing));
}

export function selectionEasing(clips: readonly MomentClip[], playheadMs: number): SelectionEasing {
  if (selectionMoment(clips, playheadMs) === "key") {
    const shared = sharedValue(clips, (clip) => momentEasing(clip, localTime(clip, playheadMs)!));
    return { scope: "moment", easing: shared.kind === "same" ? shared.value : null };
  }
  const easings = new Set(clips.flatMap(allEasings));
  return { scope: "all", easing: easings.size === 1 ? [...easings][0] : null };
}

export function setSelectionEasing(doc: VideoDocument, clipIds: readonly string[], playheadMs: number, easing: Easing): SelectionEdit {
  const { scope } = selectionEasing(editableClips(doc, clipIds), playheadMs);
  return applyToSelection(doc, clipIds, (clip) => (scope === "moment" ? setMomentEasing(clip, localTime(clip, playheadMs)!, easing) : setAllEasing(clip, easing)));
}

export function selectionKeyTimes(clips: readonly Pick<Clip, "keyframes" | "startMs">[]): number[] {
  return [...new Set(clips.flatMap((clip) => keyTimes(clip).map((atMs) => clip.startMs + atMs)))].sort((x, y) => x - y);
}

export function seekInside(clips: readonly Pick<Clip, "startMs" | "durationMs">[], playheadMs: number): number | null {
  if (clips.length === 0) return null;
  const from = Math.max(...clips.map((clip) => clip.startMs));
  const to = Math.min(...clips.map((clip) => clip.startMs + clip.durationMs)) - 1;
  return from > to ? null : Math.min(Math.max(Math.round(playheadMs), from), to);
}
