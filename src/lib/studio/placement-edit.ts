import { clampClipTransform } from "./clip-transform";
import { anchorOffset, anchorOf, animatedTransform, headingOf, isCentered, rotated, type PlacedClip } from "./clip-placement";
import type { Anchor, Clip, Transform } from "./document";
import { positionRange } from "./parenting";
import { editTransform, onPath, setPathKey, setPropertyKey, type TransformEdit } from "./keyframe-edit";
import { pathFramesOf, timedFramesOf, type Keyframes } from "./keyframes";
import type { ClipPatch } from "./timeline";

type EditableClip = PlacedClip & Pick<Clip, "durationMs" | "blur" | "layer"> & Partial<Pick<Clip, "type" | "volume" | "parentId">>;

function patched<C extends EditableClip>(clip: C, patch: ClipPatch): C {
  return { ...clip, ...patch } as C;
}

export function editPlaced(clip: EditableClip, desired: Transform, localMs: number | null, aspect: number): TransformEdit {
  const at = localMs ?? 0;
  const heading = localMs === null ? 0 : headingOf(clip, at, aspect);
  const shown = localMs === null ? clip.transform : animatedTransform(clip.transform, clip.keyframes, at, aspect);
  const sized = editTransform(clip, { ...shown, w: desired.w, h: desired.h, rotation: desired.rotation - heading, opacity: desired.opacity }, localMs, aspect);
  const resized = patched(clip, sized.patch);
  const anchor = anchorOf(clip);
  const pivot = anchorOffset(anchor, resized.transform.w, resized.transform.h);
  const swing = rotated(anchorOffset(anchor, desired.w, desired.h), desired.rotation, aspect);
  const position = { x: desired.x + swing.x - pivot.x, y: desired.y + swing.y - pivot.y };
  const reshown = localMs === null ? resized.transform : animatedTransform(resized.transform, resized.keyframes, at, aspect);
  const moved = editTransform(resized, { ...reshown, x: position.x, y: position.y }, localMs, aspect);
  const patch: ClipPatch = { ...sized.patch, ...moved.patch };
  if (patch.transform) patch.transform = clampClipTransform(patch.transform, positionRange(clip));
  return { patch, outside: sized.outside || moved.outside };
}

export type AnchorKept = "all" | "keys" | "moment" | "none";

export interface AnchorChange {
  patch: ClipPatch;
  kept: AnchorKept;
}

function correction(clip: EditableClip, from: Anchor, to: Anchor, atMs: number, aspect: number): { x: number; y: number } {
  const shown = animatedTransform(clip.transform, clip.keyframes, atMs, aspect);
  const delta = { x: to.x - from.x, y: to.y - from.y };
  const base = { x: delta.x * clip.transform.w, y: delta.y * clip.transform.h };
  const swing = rotated({ x: delta.x * shown.w, y: delta.y * shown.h }, shown.rotation + headingOf(clip, atMs, aspect), aspect);
  return { x: swing.x - base.x, y: swing.y - base.y };
}

function correctedKeys(clip: EditableClip, from: Anchor, to: Anchor, aspect: number): Keyframes | undefined {
  if (onPath(clip)) {
    return pathFramesOf(clip.keyframes).reduce<Keyframes | undefined>((current, key) => {
      const shift = correction(clip, from, to, key.atMs, aspect);
      return setPathKey({ keyframes: current }, key.atMs, { x: key.x + shift.x, y: key.y + shift.y });
    }, clip.keyframes);
  }
  let keyframes = clip.keyframes;
  for (const axis of ["x", "y"] as const) {
    for (const key of timedFramesOf(clip.keyframes, axis)) {
      if (!("value" in key)) continue;
      keyframes = setPropertyKey({ ...clip, keyframes }, axis, key.atMs, key.value + correction(clip, from, to, key.atMs, aspect)[axis]);
    }
  }
  return keyframes;
}

function animatesPlacement(clip: EditableClip): boolean {
  return (["scale", "scaleX", "scaleY", "rotation"] as const).some((property) => timedFramesOf(clip.keyframes, property).length > 1) || Boolean(clip.autoOrient && onPath(clip));
}

function keyedAxis(clip: EditableClip, axis: "x" | "y"): boolean {
  return onPath(clip) || timedFramesOf(clip.keyframes, axis).length > 0;
}

export function anchorPatch(clip: EditableClip, anchor: Anchor, keepVisual: boolean, localMs: number, aspect: number): AnchorChange {
  const next = isCentered(anchor) ? undefined : { x: anchor.x, y: anchor.y };
  if (!keepVisual) return { patch: { anchor: next }, kept: "none" };
  const from = anchorOf(clip);
  const keyed = { x: keyedAxis(clip, "x"), y: keyedAxis(clip, "y") };
  const shift = correction(clip, from, anchor, localMs, aspect);
  const transform = clampClipTransform({ ...clip.transform, x: keyed.x ? clip.transform.x : clip.transform.x + shift.x, y: keyed.y ? clip.transform.y : clip.transform.y + shift.y }, positionRange(clip));
  const moved = transform.x !== clip.transform.x || transform.y !== clip.transform.y;
  const patch: ClipPatch = { anchor: next, ...(keyed.x || keyed.y ? { keyframes: correctedKeys(clip, from, anchor, aspect) } : {}), ...(moved ? { transform } : {}) };
  const kept: AnchorKept = !animatesPlacement(clip) ? "all" : keyed.x && keyed.y ? "keys" : "moment";
  return { patch, kept };
}
