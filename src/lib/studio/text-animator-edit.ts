import { editClipItem, editClipItems, insertItem, moveItem, removeItem, type ClipItems, type ClipItemsEdit, type ClipItemsRefusal } from "./clip-items";
import type { Clip, VideoDocument } from "./document";
import type { Keyframe } from "./keyframes";
import { asSelectionEdit, type Refusal, type SelectionEdit } from "./selection-edit";
import { animatesText, type TextUnit } from "./text-animation";
import { editSelectorKey, reselected, reunited, setSelectorLane, textAnimatorsIssue, toggleSelectorKey, withProperty } from "./text-animator";
import { selectorKeyRange, selectorKeys, type AnimatorColor, type AnimatorNumber, type RangeOrder, type RangeShape, type RangeUnits, type SelectorKey, type SelectorKind, type TextUnitAnimator } from "./text-selectors";

export type TextAnimatorRefusal = ClipItemsRefusal | "notText" | "animatorMissing" | "animated" | "outside" | "foreign";

export type TextAnimatorEdit = ClipItemsEdit<TextAnimatorRefusal>;

export interface TextAnimatorPatch {
  unit?: TextUnit;
  properties?: Partial<Record<AnimatorNumber | AnimatorColor, number | string | null>>;
  kind?: SelectorKind;
  units?: RangeUnits;
  order?: RangeOrder;
  shape?: RangeShape;
  easeHigh?: number;
  easeLow?: number;
  seed?: number;
  rate?: number;
  loopMs?: number;
  correlation?: number;
  keyed?: Partial<Record<SelectorKey, number>>;
}

const RANGE_FIELDS = ["units", "order", "shape", "easeHigh", "easeLow"] as const;
const WIGGLY_FIELDS = ["rate", "loopMs", "correlation"] as const;
const STATIC_FIELDS = ["order", "shape", "easeHigh", "easeLow", "rate", "loopMs", "correlation", "seed"] as const;

const ANIMATOR_LIST: ClipItems<TextUnitAnimator> = {
  read: (clip) => clip.textAnimators ?? [],
  write: (list) => ({ textAnimators: list.length > 0 ? list : undefined }),
  invalid: (list, clip) => textAnimatorsIssue({ ...clip, textAnimators: [...list] }) !== null,
};

function onText<T>(clip: Clip, change: () => T): T | "notText" {
  return animatesText(clip) ? change() : "notText";
}

function withAnimator(doc: VideoDocument, clipId: string, animatorId: string, change: (animator: TextUnitAnimator, clip: Clip) => TextUnitAnimator | TextAnimatorRefusal): TextAnimatorEdit {
  return editClipItem<TextUnitAnimator, TextAnimatorRefusal>(doc, clipId, animatorId, ANIMATOR_LIST, "animatorMissing", (animator, clip) => onText(clip, () => change(animator, clip)));
}

export function addClipTextAnimator(doc: VideoDocument, clipId: string, animator: TextUnitAnimator, index?: number): TextAnimatorEdit {
  return editClipItems<TextUnitAnimator, TextAnimatorRefusal>(doc, clipId, ANIMATOR_LIST, (list, clip) => onText(clip, () => insertItem(list, animator, index)));
}

export function removeClipTextAnimator(doc: VideoDocument, clipId: string, animatorId: string): TextAnimatorEdit {
  return editClipItems<TextUnitAnimator, TextAnimatorRefusal>(doc, clipId, ANIMATOR_LIST, (list) => removeItem(list, animatorId) ?? "animatorMissing");
}

export function moveClipTextAnimator(doc: VideoDocument, clipId: string, animatorId: string, toIndex: number): TextAnimatorEdit {
  return editClipItems<TextUnitAnimator, TextAnimatorRefusal>(doc, clipId, ANIMATOR_LIST, (list) => moveItem(list, animatorId, toIndex) ?? "animatorMissing");
}

function foreignField(animator: TextUnitAnimator, patch: TextAnimatorPatch): boolean {
  const kind = patch.kind ?? animator.selector.kind;
  const foreign = kind === "range" ? WIGGLY_FIELDS : RANGE_FIELDS;
  if (foreign.some((field) => patch[field] !== undefined)) return true;
  return Object.keys(patch.keyed ?? {}).some((key) => !selectorKeys({ kind }).includes(key as SelectorKey));
}

export function patchTextAnimator(current: TextUnitAnimator, patch: TextAnimatorPatch, localMs: number | null): TextUnitAnimator | TextAnimatorRefusal {
  if (foreignField(current, patch)) return "foreign";
  let next = patch.kind ? reselected(current, patch.kind) : current;
  if (patch.units) next = reunited(next, patch.units);
  if (patch.unit) next = { ...next, unit: patch.unit };
  for (const [name, value] of Object.entries(patch.properties ?? {})) {
    if (value !== undefined) next = withProperty(next, name as AnimatorNumber | AnimatorColor, value);
  }
  const statics: Record<string, number | string> = {};
  for (const field of STATIC_FIELDS) {
    const value = patch[field];
    if (value !== undefined) statics[field] = value;
  }
  if (Object.keys(statics).length > 0) next = { ...next, selector: { ...next.selector, ...statics } as TextUnitAnimator["selector"] };
  for (const [key, value] of Object.entries(patch.keyed ?? {})) {
    if (value === undefined) continue;
    const range = selectorKeyRange(next.selector, key as SelectorKey);
    if (!range || !(value >= range[0] && value <= range[1])) return "invalid";
    const edited = editSelectorKey(next, key as SelectorKey, value, localMs);
    if (!edited) return "animated";
    next = edited;
  }
  return next;
}

export function updateClipTextAnimator(doc: VideoDocument, clipId: string, animatorId: string, patch: TextAnimatorPatch, localMs: number | null): TextAnimatorEdit {
  return withAnimator(doc, clipId, animatorId, (animator) => patchTextAnimator(animator, patch, localMs));
}

export function replaceClipTextAnimator(doc: VideoDocument, clipId: string, animator: TextUnitAnimator): TextAnimatorEdit {
  return withAnimator(doc, clipId, animator.id, () => animator);
}

export function animateClipTextAnimator(doc: VideoDocument, clipId: string, animatorId: string, key: SelectorKey, frames: readonly Keyframe[]): TextAnimatorEdit {
  return withAnimator(doc, clipId, animatorId, (animator, clip) => {
    if (!selectorKeys(animator.selector).includes(key)) return "foreign";
    if (frames.some((frame) => frame.atMs < 0 || frame.atMs > clip.durationMs)) return "outside";
    return setSelectorLane(animator, key, frames);
  });
}

export function toggleClipTextAnimatorKey(doc: VideoDocument, clipId: string, animatorId: string, key: SelectorKey, localMs: number): TextAnimatorEdit {
  return withAnimator(doc, clipId, animatorId, (animator, clip) => {
    if (!selectorKeys(animator.selector).includes(key)) return "foreign";
    return localMs < 0 || localMs > clip.durationMs ? "outside" : toggleSelectorKey(animator, key, localMs);
  });
}

const SELECTION_REFUSALS: Record<TextAnimatorRefusal, Refusal> = {
  missing: "invalid",
  locked: "locked",
  notVisual: "invalid",
  notText: "invalid",
  invalid: "outOfRange",
  animatorMissing: "invalid",
  animated: "keyframeOutside",
  outside: "keyframeOutside",
  foreign: "invalid",
};

export function textAnimatorSelectionEdit(edit: TextAnimatorEdit): SelectionEdit {
  return asSelectionEdit(edit, SELECTION_REFUSALS);
}
