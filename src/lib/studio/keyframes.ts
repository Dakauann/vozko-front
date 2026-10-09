import type { IssueCode } from "./validate";
import type { Transform } from "./document";

export const EASINGS = ["linear", "hold", "easeIn", "easeOut", "easeInOut", "backIn", "backOut", "backInOut", "elastic", "bounce", "spring"] as const;

export type NamedEasing = (typeof EASINGS)[number];

export type Easing = NamedEasing | `cubic-bezier(${string})`;

export type Bezier = readonly [number, number, number, number];

export const BEZIER_Y_RANGE = [-1, 2] as const;

export const TRANSFORM_PROPERTIES = ["x", "y", "scale", "rotation", "opacity"] as const;

export const KEYFRAME_PROPERTIES = [...TRANSFORM_PROPERTIES, "blur"] as const;

export type TransformProperty = (typeof TRANSFORM_PROPERTIES)[number];

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
  blur: [0, 100],
};

export function animatedBlur(staticBlur: number | undefined, k: Keyframes | undefined, localMs: number): number {
  const frames = k?.blur ?? [];
  return Math.max(0, frames.length === 0 ? (staticBlur ?? 0) : valueAt(frames, localMs));
}

const BACK_PULL = 1.70158;
const BACK_PULL_IN_OUT = BACK_PULL * 1.525;
const ELASTIC_PERIOD = (2 * Math.PI) / 3;
const BOUNCE_GAIN = 7.5625;
const BOUNCE_STEP = 2.75;
export const SPRING_DAMPING = 0.5;
export const SPRING_FREQUENCY = 10;

export const EASING_REACH: Record<NamedEasing, readonly [number, number]> = {
  linear: [0, 1],
  hold: [0, 1],
  easeIn: [0, 1],
  easeOut: [0, 1],
  easeInOut: [0, 1],
  backIn: [-0.101, 1],
  backOut: [0, 1.101],
  backInOut: [-0.101, 1.101],
  elastic: [0, 1.374],
  bounce: [0, 1],
  spring: [0, 1.161],
};

function bounceOut(p: number): number {
  if (p < 1 / BOUNCE_STEP) return BOUNCE_GAIN * p * p;
  if (p < 2 / BOUNCE_STEP) return BOUNCE_GAIN * (p - 1.5 / BOUNCE_STEP) ** 2 + 0.75;
  if (p < 2.5 / BOUNCE_STEP) return BOUNCE_GAIN * (p - 2.25 / BOUNCE_STEP) ** 2 + 0.9375;
  return BOUNCE_GAIN * (p - 2.625 / BOUNCE_STEP) ** 2 + 0.984375;
}

function springRaw(p: number): number {
  const damped = SPRING_FREQUENCY * Math.sqrt(1 - SPRING_DAMPING * SPRING_DAMPING);
  const decay = SPRING_DAMPING * SPRING_FREQUENCY;
  return 1 - Math.exp(-decay * p) * (Math.cos(damped * p) + (decay / damped) * Math.sin(damped * p));
}

const SPRING_SETTLED = springRaw(1);

const BEZIER = /^cubic-bezier\(\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*\)$/;
const BEZIER_CACHE_LIMIT = 256;
const beziers = new Map<string, Bezier | null>();

function parsedBezier(easing: string): Bezier | null {
  const match = BEZIER.exec(easing);
  if (!match) return null;
  const [x1, y1, x2, y2] = match.slice(1, 5).map(Number);
  const inX = (x: number) => x >= 0 && x <= 1;
  const inY = (y: number) => y >= BEZIER_Y_RANGE[0] && y <= BEZIER_Y_RANGE[1];
  return inX(x1) && inX(x2) && inY(y1) && inY(y2) ? [x1, y1, x2, y2] : null;
}

export function bezierOf(easing: string): Bezier | null {
  const known = beziers.get(easing);
  if (known !== undefined) return known;
  const parsed = parsedBezier(easing);
  if (beziers.size >= BEZIER_CACHE_LIMIT) beziers.clear();
  beziers.set(easing, parsed);
  return parsed;
}

export function bezierEasing(bezier: Bezier): Easing {
  return `cubic-bezier(${bezier.join(",")})`;
}

export function isNamedEasing(value: string): value is NamedEasing {
  return (EASINGS as readonly string[]).includes(value);
}

export function isEasing(value: string): value is Easing {
  return isNamedEasing(value) || bezierOf(value) !== null;
}

function coefficients(a: number, b: number): readonly [number, number, number] {
  const c = 3 * a;
  const bb = 3 * (b - a) - c;
  return [1 - c - bb, bb, c];
}

function bezierAt([x1, y1, x2, y2]: Bezier, p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const [ax, bx, cx] = coefficients(x1, x2);
  const [ay, by, cy] = coefficients(y1, y2);
  const xAt = (t: number) => ((ax * t + bx) * t + cx) * t;
  let t = p;
  let solved = false;
  for (let i = 0; i < 16 && !solved; i++) {
    const error = xAt(t) - p;
    const slope = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(error) < 1e-12) solved = true;
    else if (Math.abs(slope) < 1e-6) break;
    else t -= error / slope;
  }
  if (!solved) {
    let low = 0;
    let high = 1;
    t = p;
    for (let i = 0; i < 100; i++) {
      const x = xAt(t);
      if (Math.abs(x - p) < 1e-12) break;
      if (p > x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
  }
  return ((ay * t + by) * t + cy) * t;
}

function turningPoints(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / (2 * b)];
  const disc = 4 * b * b - 12 * a * c;
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  return [(-2 * b + root) / (6 * a), (-2 * b - root) / (6 * a)];
}

function bezierReach([, y1, , y2]: Bezier): readonly [number, number] {
  const [ay, by, cy] = coefficients(y1, y2);
  const yAt = (t: number) => ((ay * t + by) * t + cy) * t;
  const values = turningPoints(ay, by, cy)
    .filter((t) => t > 0 && t < 1)
    .map(yAt);
  return [Math.floor(Math.min(0, ...values) * 1000) / 1000, Math.ceil(Math.max(1, ...values) * 1000) / 1000];
}

export function easingReach(easing: Easing): readonly [number, number] {
  if (isNamedEasing(easing)) return EASING_REACH[easing];
  const bezier = bezierOf(easing);
  return bezier ? bezierReach(bezier) : EASING_REACH.linear;
}

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
    case "backIn":
      return (BACK_PULL + 1) * p ** 3 - BACK_PULL * p ** 2;
    case "backOut":
      return 1 + (BACK_PULL + 1) * (p - 1) ** 3 + BACK_PULL * (p - 1) ** 2;
    case "backInOut":
      return p < 0.5 ? ((2 * p) ** 2 * ((BACK_PULL_IN_OUT + 1) * 2 * p - BACK_PULL_IN_OUT)) / 2 : ((2 * p - 2) ** 2 * ((BACK_PULL_IN_OUT + 1) * (2 * p - 2) + BACK_PULL_IN_OUT) + 2) / 2;
    case "elastic":
      return p <= 0 || p >= 1 ? Math.max(0, Math.min(1, p)) : Math.pow(2, -10 * p) * Math.sin((10 * p - 0.75) * ELASTIC_PERIOD) + 1;
    case "bounce":
      return bounceOut(p);
    case "spring":
      return p >= 1 ? 1 : springRaw(p) / SPRING_SETTLED;
    case "linear":
      return p;
    default: {
      const bezier = bezierOf(easing);
      return bezier ? bezierAt(bezier, p) : p;
    }
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

export function curveExtent(frames: readonly Keyframe[]): readonly [number, number] {
  let low = Math.min(...frames.map((f) => f.value));
  let high = Math.max(...frames.map((f) => f.value));
  for (let i = 0; i < frames.length - 1; i++) {
    const from = frames[i].value;
    const delta = frames[i + 1].value - from;
    const [lowReach, highReach] = easingReach(frames[i].easing);
    const a = from + delta * lowReach;
    const b = from + delta * highReach;
    low = Math.min(low, a, b);
    high = Math.max(high, a, b);
  }
  return [low, high];
}

export function maxScale(k: Keyframes | undefined): number {
  const scale = framesOf(k, "scale");
  return scale.length === 0 ? 1 : curveExtent(scale)[1];
}

export function animatedTransform(base: Transform, k: Keyframes | undefined, localMs: number): Transform {
  if (!k || keyframeCount(k) === 0) return base;
  const at = (property: KeyframeProperty, fallback: number) => {
    const frames = framesOf(k, property);
    return frames.length === 0 ? fallback : valueAt(frames, localMs);
  };
  const scale = Math.max(0, at("scale", 1));
  return { x: at("x", base.x), y: at("y", base.y), w: base.w * scale, h: base.h * scale, rotation: at("rotation", base.rotation), opacity: Math.min(1, Math.max(0, at("opacity", base.opacity))) };
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
    if (!isEasing(f.easing)) return { kind: "easing", property, atMs, easing: f.easing };
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
