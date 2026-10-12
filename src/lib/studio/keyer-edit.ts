import { editFieldValue, setFieldLane, toggleFieldKey, type Animated, type AnimatedFields } from "./animated-fields";
import { editVisualClip, type ClipItemsEdit, type ClipItemsRefusal } from "./clip-items";
import type { Clip, VideoDocument } from "./document";
import type { Keyframe } from "./keyframes";
import { asSelectionEdit, type Refusal, type SelectionEdit } from "./selection-edit";
import type { ClipPatch } from "./timeline";
import type { IssueCode } from "./validate";

export type KeyerRefusal = "notKeyable" | "off" | "animated" | "outside";

export type KeyerEdit = ClipItemsEdit<KeyerRefusal>;

export interface Keyer<T extends Animated<P>, P extends string> {
  fields: AnimatedFields<T, P>;
  properties: readonly P[];
  create(): T;
  read(clip: Clip): T | undefined;
  write(key: T | undefined): ClipPatch;
  issue(key: T): IssueCode | null;
}

export function keyable(clip: Clip): boolean {
  return clip.type === "video" || clip.type === "image";
}

export function editKeyer<T extends Animated<P>, P extends string>(keyer: Keyer<T, P>, doc: VideoDocument, clipId: string, change: (current: T | undefined, clip: Clip) => T | undefined | KeyerRefusal | "invalid"): KeyerEdit {
  return editVisualClip<KeyerRefusal>(doc, clipId, (clip) => {
    if (!keyable(clip)) return "notKeyable";
    const next = change(keyer.read(clip), clip);
    if (typeof next === "string") return next;
    if (next && keyer.issue(next)) return "invalid";
    return keyer.write(next);
  });
}

export function patchKeyerValues<T extends Animated<P>, P extends string>(keyer: Keyer<T, P>, current: T, patch: Partial<Record<P, number>>, localMs: number | null): T | "animated" | "invalid" {
  let next = current;
  for (const property of keyer.properties) {
    const value = patch[property];
    if (value === undefined) continue;
    const [low, high] = keyer.fields.range(property, next);
    if (!(value >= low && value <= high)) return "invalid";
    const edited = editFieldValue(keyer.fields, next, property, value, localMs);
    if (!edited) return "animated";
    next = edited;
  }
  return next;
}

export function removeKeyer<T extends Animated<P>, P extends string>(keyer: Keyer<T, P>, doc: VideoDocument, clipId: string): KeyerEdit {
  return editKeyer(keyer, doc, clipId, () => undefined);
}

export function animateKeyer<T extends Animated<P>, P extends string>(keyer: Keyer<T, P>, doc: VideoDocument, clipId: string, property: P, frames: readonly Keyframe[]): KeyerEdit {
  return editKeyer(keyer, doc, clipId, (current, clip) => (frames.some((frame) => frame.atMs < 0 || frame.atMs > clip.durationMs) ? "outside" : setFieldLane(keyer.fields, current ?? keyer.create(), property, frames)));
}

export function toggleKeyerKey<T extends Animated<P>, P extends string>(keyer: Keyer<T, P>, doc: VideoDocument, clipId: string, property: P, localMs: number): KeyerEdit {
  return editKeyer(keyer, doc, clipId, (current, clip) => {
    if (!current) return "off";
    return localMs < 0 || localMs > clip.durationMs ? "outside" : toggleFieldKey(keyer.fields, current, property, localMs);
  });
}

const SELECTION_REFUSALS: Record<ClipItemsRefusal | KeyerRefusal, Refusal> = {
  missing: "invalid",
  locked: "locked",
  notVisual: "invalid",
  invalid: "outOfRange",
  notKeyable: "invalid",
  off: "invalid",
  animated: "keyframeOutside",
  outside: "keyframeOutside",
};

export function keyerSelectionEdit(edit: KeyerEdit): SelectionEdit {
  return asSelectionEdit(edit, SELECTION_REFUSALS);
}
