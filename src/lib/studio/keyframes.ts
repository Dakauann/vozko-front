import type { IssueCode } from "./validate";
import type { Transform } from "./document";

export const EASINGS = ["linear", "hold", "easeIn", "easeOut", "easeInOut"] as const;

export type Easing = (typeof EASINGS)[number];

export const KEYFRAME_PROPERTIES = ["x", "y", "scale", "rotation", "opacity"] as const;

export type KeyframeProperty = (typeof KEYFRAME_PROPERTIES)[number];

export interface Keyframe {
  atMs: number;
  value: number;
  easing: Easing;
}

export type Keyframes = Partial<Record<KeyframeProperty, Keyframe[]>>;

export const KEYFRAME_LIMITS = {
  perProperty: 32,
  maxAbsMs: 90_000,
  maxAnimatedBox: 4,
} as const;

export const KEYFRAME_RANGES: Record<KeyframeProperty, readonly [number, number]> = {
  x: [-1, 2],
  y: [-1, 2],
  scale: [0.05, 5],
  rotation: [-3600, 3600],
  opacity: [0, 1],
};

export function ease(easing: Easing, p: number): number {
  switch (easing) {
    case "hold":
      return 0;
    case "easeIn":
      return p * p * p;
    case "easeOut":
      return 1 - Math.pow(1 - p, 3);
    case "easeInOut":
      return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    default:
      return p;
  }
}

export function valueAt(frames: readonly Keyframe[], atMs: number): number {
  if (frames.length === 0) return 0;
  if (atMs <= frames[0].atMs) return frames[0].value;
  for (let i = 0; i < frames.length - 1; i++) {
    const from = frames[i];
    const to = frames[i + 1];
    if (atMs < to.atMs) return from.value + (to.value - from.value) * ease(from.easing, (atMs - from.atMs) / (to.atMs - from.atMs));
  }
  return frames[frames.length - 1].value;
}

function framesOf(k: Keyframes | undefined, property: KeyframeProperty): readonly Keyframe[] {
  return k?.[property] ?? [];
}

export function keyframeCount(k: Keyframes | undefined): number {
  return KEYFRAME_PROPERTIES.reduce((total, property) => total + framesOf(k, property).length, 0);
}

export function maxScale(k: Keyframes | undefined): number {
  const scale = framesOf(k, "scale");
  return scale.length === 0 ? 1 : Math.max(...scale.map((f) => f.value));
}

export function animatedTransform(base: Transform, k: Keyframes | undefined, localMs: number): Transform {
  if (!k || keyframeCount(k) === 0) return base;
  const at = (property: KeyframeProperty, fallback: number) => {
    const frames = framesOf(k, property);
    return frames.length === 0 ? fallback : valueAt(frames, localMs);
  };
  const scale = at("scale", 1);
  return { x: at("x", base.x), y: at("y", base.y), w: base.w * scale, h: base.h * scale, rotation: at("rotation", base.rotation), opacity: at("opacity", base.opacity) };
}

function withProperty(k: Keyframes | undefined, property: KeyframeProperty, frames: Keyframe[]): Keyframes | undefined {
  const next: Keyframes = { ...k };
  if (frames.length === 0) delete next[property];
  else next[property] = frames;
  return keyframeCount(next) === 0 ? undefined : next;
}

export function setKeyframe(k: Keyframes | undefined, property: KeyframeProperty, atMs: number, value: number, easing?: Easing): Keyframes | undefined {
  const frames = framesOf(k, property);
  const at = Math.round(atMs);
  const existing = frames.find((f) => f.atMs === at);
  if (!existing && frames.length >= KEYFRAME_LIMITS.perProperty) return k;
  const frame: Keyframe = { atMs: at, value, easing: easing ?? existing?.easing ?? "linear" };
  const next = [...frames.filter((f) => f.atMs !== at), frame].sort((a, b) => a.atMs - b.atMs);
  return withProperty(k, property, next);
}

export function removeKeyframe(k: Keyframes | undefined, property: KeyframeProperty, atMs: number): Keyframes | undefined {
  return withProperty(
    k,
    property,
    framesOf(k, property).filter((f) => f.atMs !== Math.round(atMs)),
  );
}

export function shiftKeyframes(k: Keyframes | undefined, deltaMs: number): Keyframes | undefined {
  if (!k || deltaMs === 0) return k;
  const next: Keyframes = {};
  for (const property of KEYFRAME_PROPERTIES) {
    const frames = framesOf(k, property);
    if (frames.length > 0) next[property] = frames.map((f) => ({ ...f, atMs: f.atMs + deltaMs }));
  }
  return next;
}

export function keyframesInRange(k: Keyframes | undefined, fromMs: number, toMs: number): Keyframes | undefined {
  if (!k) return k;
  const next: Keyframes = {};
  for (const property of KEYFRAME_PROPERTIES) {
    const frames = framesOf(k, property);
    if (frames.length === 0) continue;
    const before = frames.filter((f) => f.atMs < fromMs).at(-1);
    const after = frames.find((f) => f.atMs > toMs);
    const inside = frames.filter((f) => f.atMs >= fromMs && f.atMs <= toMs);
    next[property] = [...(before ? [before] : []), ...inside, ...(after ? [after] : [])];
  }
  return keyframeCount(next) === 0 ? undefined : next;
}

export type KeyframeFault =
  | { kind: "empty" }
  | { kind: "too_many"; property: KeyframeProperty; limit: number }
  | { kind: "easing"; property: KeyframeProperty; atMs: number; easing: string }
  | { kind: "time"; property: KeyframeProperty; atMs: number; limit: number }
  | { kind: "value"; property: KeyframeProperty; atMs: number; value: number; range: readonly [number, number] }
  | { kind: "order"; property: KeyframeProperty; atMs: number }
  | { kind: "box"; scale: number; maxScale: number };

function propertyFault(property: KeyframeProperty, frames: readonly Keyframe[]): KeyframeFault | null {
  if (frames.length > KEYFRAME_LIMITS.perProperty) return { kind: "too_many", property, limit: KEYFRAME_LIMITS.perProperty };
  const range = KEYFRAME_RANGES[property];
  for (const [index, f] of frames.entries()) {
    const atMs = f.atMs;
    if (!(EASINGS as readonly string[]).includes(f.easing)) return { kind: "easing", property, atMs, easing: f.easing };
    if (!Number.isFinite(atMs) || Math.abs(atMs) > KEYFRAME_LIMITS.maxAbsMs) return { kind: "time", property, atMs, limit: KEYFRAME_LIMITS.maxAbsMs };
    if (!Number.isFinite(f.value) || f.value < range[0] || f.value > range[1]) return { kind: "value", property, atMs, value: f.value, range };
    if (index > 0 && atMs <= frames[index - 1].atMs) return { kind: "order", property, atMs };
  }
  return null;
}

function largestScale(box: Transform): number {
  const fitting = KEYFRAME_LIMITS.maxAnimatedBox / Math.max(box.w, box.h);
  return Math.floor(Math.min(KEYFRAME_RANGES.scale[1], fitting) * 100) / 100;
}

export function keyframeFault(k: Keyframes | undefined, box: Transform): KeyframeFault | null {
  if (!k) return null;
  if (keyframeCount(k) === 0) return { kind: "empty" };
  for (const property of KEYFRAME_PROPERTIES) {
    const fault = propertyFault(property, framesOf(k, property));
    if (fault) return fault;
  }
  const scale = maxScale(k);
  const oversized = box.w * scale > KEYFRAME_LIMITS.maxAnimatedBox || box.h * scale > KEYFRAME_LIMITS.maxAnimatedBox;
  return oversized ? { kind: "box", scale, maxScale: largestScale(box) } : null;
}

const FAULT_ISSUES: Record<KeyframeFault["kind"], IssueCode> = {
  empty: "required",
  too_many: "too_many",
  easing: "unknown",
  time: "out_of_range",
  value: "out_of_range",
  order: "out_of_range",
  box: "out_of_range",
};

export function keyframesIssue(k: Keyframes | undefined, box: Transform): IssueCode | null {
  const fault = keyframeFault(k, box);
  return fault ? FAULT_ISSUES[fault.kind] : null;
}

export interface KeyRef {
  property: KeyframeProperty;
  atMs: number;
}

function picked(k: Keyframes, keys: ReadonlyArray<KeyRef>, property: KeyframeProperty): Keyframe[] {
  const times = new Set(keys.filter((ref) => ref.property === property).map((ref) => Math.round(ref.atMs)));
  return framesOf(k, property).filter((f) => times.has(f.atMs));
}

function placeKeys(k: Keyframes | undefined, keys: ReadonlyArray<KeyRef>, deltaMs: number, keepOriginals: boolean): Keyframes | undefined {
  const delta = Math.round(deltaMs);
  if (!k || delta === 0) return k;
  const next: Keyframes = { ...k };
  let changed = false;
  for (const property of KEYFRAME_PROPERTIES) {
    const chosen = picked(k, keys, property);
    if (chosen.length === 0) continue;
    const staying = keepOriginals ? [...framesOf(k, property)] : framesOf(k, property).filter((f) => !chosen.includes(f));
    const placed = chosen.map((f) => ({ ...f, atMs: f.atMs + delta }));
    const taken = new Set(staying.map((f) => f.atMs));
    if (placed.some((f) => taken.has(f.atMs) || Math.abs(f.atMs) > KEYFRAME_LIMITS.maxAbsMs)) return k;
    const frames = [...staying, ...placed].sort((a, b) => a.atMs - b.atMs);
    if (frames.length > KEYFRAME_LIMITS.perProperty) return k;
    next[property] = frames;
    changed = true;
  }
  return changed ? next : k;
}

export function moveKeyframes(k: Keyframes | undefined, keys: ReadonlyArray<KeyRef>, deltaMs: number): Keyframes | undefined {
  return placeKeys(k, keys, deltaMs, false);
}

export function duplicateKeyframes(k: Keyframes | undefined, keys: ReadonlyArray<KeyRef>, deltaMs: number): Keyframes | undefined {
  return placeKeys(k, keys, deltaMs, true);
}
