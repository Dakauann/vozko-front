import type { Clip, Transform } from "./document";
import {
  animatedTransform,
  KEYFRAME_PROPERTIES,
  KEYFRAME_RANGES,
  removeKeyframe,
  setKeyframe,
  valueAt,
  type Easing,
  type Keyframe,
  type KeyframeProperty,
  type Keyframes,
} from "./keyframes";
import type { ClipPatch } from "./timeline";

export const KEY_TOLERANCE_MS = 17;

type KeyedClip = Pick<Clip, "transform" | "keyframes" | "durationMs">;

export function framesOf(clip: Pick<Clip, "keyframes">, property: KeyframeProperty): readonly Keyframe[] {
  return clip.keyframes?.[property] ?? [];
}

export function isAnimated(clip: Pick<Clip, "keyframes">, property: KeyframeProperty): boolean {
  return framesOf(clip, property).length > 0;
}

export function localTime(clip: Pick<Clip, "startMs" | "durationMs">, playheadMs: number): number | null {
  const local = Math.round(playheadMs - clip.startMs);
  return local >= 0 && local <= clip.durationMs ? local : null;
}

export function staticValue(transform: Transform, property: KeyframeProperty): number {
  return property === "scale" ? 1 : transform[property];
}

export function propertyValue(clip: KeyedClip, property: KeyframeProperty, localMs: number): number {
  const frames = framesOf(clip, property);
  return frames.length === 0 ? staticValue(clip.transform, property) : valueAt(frames, localMs);
}

export function keyAt(frames: readonly Keyframe[], localMs: number): Keyframe | null {
  return frames.find((f) => Math.abs(f.atMs - localMs) <= KEY_TOLERANCE_MS) ?? null;
}

export function keyTimes(clip: Pick<Clip, "keyframes">): number[] {
  const times = new Set<number>();
  for (const property of KEYFRAME_PROPERTIES) for (const frame of framesOf(clip, property)) times.add(frame.atMs);
  return [...times].sort((a, b) => a - b);
}

export function adjacentKey(times: readonly number[], localMs: number, direction: 1 | -1): number | null {
  if (direction > 0) return times.find((t) => t > localMs + KEY_TOLERANCE_MS) ?? null;
  return [...times].reverse().find((t) => t < localMs - KEY_TOLERANCE_MS) ?? null;
}

function clampValue(property: KeyframeProperty, value: number): number {
  const [low, high] = KEYFRAME_RANGES[property];
  return Math.min(high, Math.max(low, value));
}

export function setPropertyKey(clip: KeyedClip, property: KeyframeProperty, localMs: number, value: number, easing?: Easing): Keyframes | undefined {
  const existing = keyAt(framesOf(clip, property), localMs);
  return setKeyframe(clip.keyframes, property, existing ? existing.atMs : localMs, clampValue(property, value), easing);
}

export function toggleAnimation(clip: KeyedClip, property: KeyframeProperty, localMs: number): ClipPatch {
  if (!isAnimated(clip, property)) return { keyframes: setPropertyKey(clip, property, localMs, propertyValue(clip, property, localMs)) };
  const current = propertyValue(clip, property, localMs);
  const keyframes: Keyframes = { ...clip.keyframes };
  delete keyframes[property];
  const rest = Object.keys(keyframes).length > 0 ? keyframes : undefined;
  const transform = property === "scale" ? { ...clip.transform, w: clip.transform.w * current, h: clip.transform.h * current } : { ...clip.transform, [property]: current };
  return { keyframes: rest, transform };
}

export function toggleKeyAt(clip: KeyedClip, property: KeyframeProperty, localMs: number): ClipPatch {
  const existing = keyAt(framesOf(clip, property), localMs);
  if (existing) return { keyframes: removeKeyframe(clip.keyframes, property, existing.atMs) };
  return { keyframes: setPropertyKey(clip, property, localMs, propertyValue(clip, property, localMs)) };
}

export function setKeyEasing(clip: KeyedClip, property: KeyframeProperty, localMs: number, easing: Easing): ClipPatch | null {
  const existing = keyAt(framesOf(clip, property), localMs);
  if (!existing) return null;
  return { keyframes: setKeyframe(clip.keyframes, property, existing.atMs, existing.value, easing) };
}

export interface TransformEdit {
  patch: ClipPatch;
  outside: boolean;
}

export function editTransform(clip: KeyedClip, edited: Transform, localMs: number | null): TransformEdit {
  const shown = localMs === null ? clip.transform : animatedTransform(clip.transform, clip.keyframes, localMs);
  let keyframes = clip.keyframes;
  let transform = { ...clip.transform };
  let outside = false;
  let keyed = false;
  const apply = (property: KeyframeProperty, value: number, previous: number) => {
    if (Math.abs(value - previous) < 1e-9) return;
    if (!isAnimated(clip, property)) {
      if (property !== "scale") transform = { ...transform, [property]: value };
      return;
    }
    if (localMs === null) {
      outside = true;
      return;
    }
    keyframes = setPropertyKey({ ...clip, keyframes }, property, localMs, value);
    keyed = true;
  };
  apply("x", edited.x, shown.x);
  apply("y", edited.y, shown.y);
  apply("rotation", edited.rotation, shown.rotation);
  apply("opacity", edited.opacity, shown.opacity);
  if (Math.abs(edited.w - shown.w) > 1e-9 || Math.abs(edited.h - shown.h) > 1e-9) {
    if (isAnimated(clip, "scale")) apply("scale", edited.w / clip.transform.w, shown.w / clip.transform.w);
    else transform = { ...transform, w: edited.w, h: edited.h };
  }
  const patch: ClipPatch = { transform };
  if (keyed) patch.keyframes = keyframes;
  return { patch, outside };
}

export type MomentState = "outside" | "none" | "key" | "between";

export type KeyState = "static" | "key" | "interpolated";

function keysAtMoment(clip: Pick<Clip, "keyframes">, localMs: number): { property: KeyframeProperty; frame: Keyframe }[] {
  return KEYFRAME_PROPERTIES.flatMap((property) => {
    const frame = keyAt(framesOf(clip, property), localMs);
    return frame ? [{ property, frame }] : [];
  });
}

export function recordMoment(clip: KeyedClip, localMs: number): ClipPatch | null {
  let keyframes = clip.keyframes;
  for (const property of KEYFRAME_PROPERTIES) {
    const next = setPropertyKey({ ...clip, keyframes }, property, localMs, propertyValue(clip, property, localMs));
    if (next === keyframes) return null;
    keyframes = next;
  }
  return { keyframes };
}

export function removeMoment(clip: KeyedClip, localMs: number): ClipPatch {
  const keyframes = keysAtMoment(clip, localMs).reduce<Keyframes | undefined>((current, { property, frame }) => removeKeyframe(current, property, frame.atMs), clip.keyframes);
  return { keyframes };
}

export function momentState(clip: Pick<Clip, "keyframes">, localMs: number | null): MomentState {
  if (localMs === null) return "outside";
  if (keysAtMoment(clip, localMs).length > 0) return "key";
  return KEYFRAME_PROPERTIES.some((property) => isAnimated(clip, property)) ? "between" : "none";
}

export function keyState(clip: Pick<Clip, "keyframes">, property: KeyframeProperty, localMs: number | null): KeyState {
  if (localMs === null || !isAnimated(clip, property)) return "static";
  return keyAt(framesOf(clip, property), localMs) ? "key" : "interpolated";
}

export function momentEasing(clip: Pick<Clip, "keyframes">, localMs: number): Easing | null {
  const easings = new Set(keysAtMoment(clip, localMs).map(({ frame }) => frame.easing));
  return easings.size === 1 ? [...easings][0] : null;
}

export function setMomentEasing(clip: KeyedClip, localMs: number, easing: Easing): ClipPatch | null {
  const keys = keysAtMoment(clip, localMs);
  if (keys.length === 0) return null;
  const keyframes = keys.reduce<Keyframes | undefined>((current, { property, frame }) => setKeyframe(current, property, frame.atMs, frame.value, easing), clip.keyframes);
  return { keyframes };
}

export function setAllEasing(clip: Pick<Clip, "keyframes">, easing: Easing): ClipPatch | null {
  if (!clip.keyframes || KEYFRAME_PROPERTIES.every((property) => !isAnimated(clip, property))) return null;
  const keyframes: Keyframes = {};
  for (const property of KEYFRAME_PROPERTIES) {
    const frames = framesOf(clip, property);
    if (frames.length > 0) keyframes[property] = frames.map((frame) => ({ ...frame, easing }));
  }
  return { keyframes };
}
