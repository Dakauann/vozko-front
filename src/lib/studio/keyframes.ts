import { blendHex, parseColor } from "./color";
import type { IssueCode } from "./validate";
import { STUDIO_LIMITS, type Transform } from "./document";
import { handleFault, isSpatialMode, type HandleFault, type PositionKeyframe } from "./path-keys";
import { isMorphProperty, MORPH_PROPERTY, morphKeyFault, type MorphFault, type MorphKeyframe, type MorphProperty } from "./morph-keys";
import { LINE_PROPERTIES, LINE_RANGES } from "./line-properties";
import { TEXT_KEY_PROPERTIES, TEXT_KEY_RANGES } from "./text-properties";
import { GRADE_FIELDS, GRADE_RANGES } from "./color-grade";
import { SPEED_LIMITS, SPEED_PROPERTY } from "./speed-range";
import { CAMERA_PROPERTIES, CAMERA_RANGES } from "./clip-camera";
import { TILT_PROPERTIES, TILT_RANGES } from "./tilt-properties";

export const EASINGS = ["linear", "hold", "easeIn", "easeOut", "easeInOut", "backIn", "backOut", "backInOut", "elastic", "bounce", "spring"] as const;

export type NamedEasing = (typeof EASINGS)[number];

export type Easing = NamedEasing | `cubic-bezier(${string})`;

export type Bezier = readonly [number, number, number, number];

export const BEZIER_Y_RANGE = [-1, 2] as const;

export const TRANSFORM_PROPERTIES = ["x", "y", "scale", "rotation", "opacity"] as const;

export const AUDIO_PROPERTIES = ["gainDb", "pan"] as const;

type AudioProperty = (typeof AUDIO_PROPERTIES)[number];

export function isAudioProperty(property: string): property is AudioProperty {
  return (AUDIO_PROPERTIES as readonly string[]).includes(property);
}

export const VISUAL_KEYFRAME_PROPERTIES = [...TRANSFORM_PROPERTIES, "blur"] as const;

export const AXIS_SCALE_PROPERTIES = ["scaleX", "scaleY"] as const;

export const PLACEMENT_PROPERTIES: readonly string[] = ["x", "y", "position", "scale", "scaleX", "scaleY", "rotation"];

export type AxisScaleProperty = (typeof AXIS_SCALE_PROPERTIES)[number];

export const KEYFRAME_PROPERTIES = [...VISUAL_KEYFRAME_PROPERTIES, ...AXIS_SCALE_PROPERTIES, ...AUDIO_PROPERTIES, ...LINE_PROPERTIES, ...TEXT_KEY_PROPERTIES, ...GRADE_FIELDS, SPEED_PROPERTY, ...CAMERA_PROPERTIES, ...TILT_PROPERTIES] as const;

export const COLOR_PROPERTIES = ["fill", "stroke"] as const;

export type ColorProperty = (typeof COLOR_PROPERTIES)[number];

export const PATH_PROPERTY = "position";

export type PathProperty = typeof PATH_PROPERTY;

export const ANIMATED_PROPERTIES = [...KEYFRAME_PROPERTIES, ...COLOR_PROPERTIES, PATH_PROPERTY, MORPH_PROPERTY] as const;

export type AnimatedProperty = (typeof ANIMATED_PROPERTIES)[number];

export function isColorProperty(property: string): property is ColorProperty {
  return (COLOR_PROPERTIES as readonly string[]).includes(property);
}

export function isPathProperty(property: string): property is PathProperty {
  return property === PATH_PROPERTY;
}

export function carriesValue(property: string): property is KeyframeProperty {
  return !isColorProperty(property) && !isPathProperty(property) && !isMorphProperty(property);
}

const RIVALS: Partial<Record<AnimatedProperty, readonly AnimatedProperty[]>> = {
  scale: AXIS_SCALE_PROPERTIES,
  scaleX: ["scale"],
  scaleY: ["scale"],
  position: ["x", "y"],
  x: [PATH_PROPERTY],
  y: [PATH_PROPERTY],
};

export function rivalsOf(property: AnimatedProperty): readonly AnimatedProperty[] {
  return RIVALS[property] ?? [];
}

export type KeyframeProperty = (typeof KEYFRAME_PROPERTIES)[number];

export interface Keyframe {
  atMs: number;
  value: number;
  easing: Easing;
  smooth?: boolean;
}

export interface ColorKeyframe {
  atMs: number;
  color: string;
  easing: Easing;
}

export interface ColorSegment {
  from: string;
  to: string;
  weight: number;
}

export type TimedKey = Keyframe | ColorKeyframe | PositionKeyframe | MorphKeyframe;

export type Keyframes = Partial<Record<KeyframeProperty, Keyframe[]>> & Partial<Record<ColorProperty, ColorKeyframe[]>> & Partial<Record<PathProperty, PositionKeyframe[]>> & Partial<Record<MorphProperty, MorphKeyframe[]>>;

export const KEYFRAME_LIMITS = {
  maxAbsMs: STUDIO_LIMITS.maxVideoMs,
  maxAnimatedBox: 4,
} as const;

export const KEYFRAME_RANGES: Record<KeyframeProperty, readonly [number, number]> = {
  x: [-1, 2],
  y: [-1, 2],
  scale: [0.05, 5],
  scaleX: [0.05, 5],
  scaleY: [0.05, 5],
  rotation: [-3600, 3600],
  opacity: [0, 1],
  blur: [0, 100],
  gainDb: [-60, 6],
  pan: [-1, 1],
  ...LINE_RANGES,
  ...TEXT_KEY_RANGES,
  ...GRADE_RANGES,
  speed: SPEED_LIMITS,
  ...CAMERA_RANGES,
  ...TILT_RANGES,
};

const PATH_NEIGHBOURS = 2;

export type LaneValue = (property: KeyframeProperty, keyed: number) => number;

export const KEYED_LANE: LaneValue = (_property, keyed) => keyed;

export function animatedBlur(staticBlur: number | undefined, k: Keyframes | undefined, localMs: number, lane: LaneValue = KEYED_LANE): number {
  const frames = k?.blur ?? [];
  return Math.max(0, lane("blur", frames.length === 0 ? (staticBlur ?? 0) : valueAt(frames, localMs)));
}

const BACK_PULL = 1.70158;
const BACK_PULL_IN_OUT = BACK_PULL * 1.525;
const ELASTIC_PERIOD = (2 * Math.PI) / 3;
const BOUNCE_GAIN = 7.5625;
const BOUNCE_STEP = 2.75;
const SPRING_DAMPING = 0.5;
const SPRING_FREQUENCY = 10;

const EASING_REACH: Record<NamedEasing, readonly [number, number]> = {
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

const EASE_SLOPE_STEP = 1e-4;

export function easeSlope(easing: Easing, p: number): number {
  const low = Math.max(0, p - EASE_SLOPE_STEP);
  const high = Math.min(1, p + EASE_SLOPE_STEP);
  return (ease(easing, high) - ease(easing, low)) / (high - low);
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

export function colorSegment(frames: readonly ColorKeyframe[], atMs: number): ColorSegment {
  const first = frames[0];
  if (atMs <= first.atMs) return { from: first.color, to: first.color, weight: 0 };
  for (let i = 0; i < frames.length - 1; i++) {
    const from = frames[i];
    const to = frames[i + 1];
    if (atMs < to.atMs) return { from: from.color, to: to.color, weight: Math.min(1, Math.max(0, ease(from.easing, (atMs - from.atMs) / (to.atMs - from.atMs)))) };
  }
  const last = frames[frames.length - 1];
  return { from: last.color, to: last.color, weight: 0 };
}

export function colorAt(frames: readonly ColorKeyframe[], atMs: number): string {
  const segment = colorSegment(frames, atMs);
  return blendHex(segment.from, segment.to, segment.weight) ?? segment.from;
}

function framesOf(k: Keyframes | undefined, property: KeyframeProperty): readonly Keyframe[] {
  return k?.[property] ?? [];
}

export function colorFramesOf(k: Keyframes | undefined, property: ColorProperty): readonly ColorKeyframe[] {
  return k?.[property] ?? [];
}

export function isPositionKey(frame: TimedKey): frame is PositionKeyframe {
  return "x" in frame;
}

export function pathFramesOf(k: Keyframes | undefined): readonly PositionKeyframe[] {
  return k?.position ?? [];
}

export function morphFramesOf(k: Keyframes | undefined): readonly MorphKeyframe[] {
  return k?.path ?? [];
}

export function isMorphKey(frame: TimedKey): frame is MorphKeyframe {
  return "path" in frame;
}

export function timedFramesOf(k: Keyframes | undefined, property: AnimatedProperty): readonly TimedKey[] {
  if (isMorphProperty(property)) return morphFramesOf(k);
  if (isPathProperty(property)) return pathFramesOf(k);
  return isColorProperty(property) ? colorFramesOf(k, property) : framesOf(k, property);
}

export function keyframeCount(k: Keyframes | undefined): number {
  return ANIMATED_PROPERTIES.reduce((total, property) => total + timedFramesOf(k, property).length, 0);
}

export function animatedProperties(k: Keyframes | undefined): AnimatedProperty[] {
  return ANIMATED_PROPERTIES.filter((property) => timedFramesOf(k, property).length > 0);
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

function reachOf(frames: readonly Keyframe[]): number {
  return frames.length === 0 ? 1 : curveExtent(frames)[1];
}

export function maxScale(k: Keyframes | undefined): number {
  return reachOf(framesOf(k, "scale"));
}

function axisReach(k: Keyframes | undefined): { x: number; y: number } {
  const uniform = maxScale(k);
  return { x: uniform * reachOf(framesOf(k, "scaleX")), y: uniform * reachOf(framesOf(k, "scaleY")) };
}

export function scaleAt(k: Keyframes | undefined, localMs: number, lane: LaneValue = KEYED_LANE): { x: number; y: number } {
  const at = (property: KeyframeProperty) => {
    const frames = framesOf(k, property);
    return Math.max(0, lane(property, frames.length === 0 ? 1 : valueAt(frames, localMs)));
  };
  const uniform = at("scale");
  return { x: uniform * at("scaleX"), y: uniform * at("scaleY") };
}

export function replaceLanes(base: Keyframes | undefined, incoming: Keyframes): Keyframes | undefined {
  const arriving = animatedProperties(incoming);
  const next: Partial<Record<AnimatedProperty, readonly TimedKey[]>> = { ...base };
  for (const property of arriving) {
    for (const rival of rivalsOf(property)) delete next[rival];
    next[property] = timedFramesOf(incoming, property);
  }
  return keyframeCount(next as Keyframes) === 0 ? undefined : (next as Keyframes);
}

export function withLane(k: Keyframes | undefined, property: AnimatedProperty, frames: readonly TimedKey[]): Keyframes | undefined {
  if (frames.length === 0) return withoutProperty(k, property);
  return replaceLanes(k, { [property]: frames } as Keyframes);
}

export function droppedRivals(k: Keyframes | undefined, property: AnimatedProperty): AnimatedProperty[] {
  return rivalsOf(property).filter((rival) => timedFramesOf(k, rival).length > 0);
}

function withTimed(k: Keyframes | undefined, property: AnimatedProperty, frames: readonly TimedKey[]): Keyframes | undefined {
  const next: Partial<Record<AnimatedProperty, readonly TimedKey[]>> = { ...k };
  if (frames.length === 0) delete next[property];
  else next[property] = frames;
  return keyframeCount(next as Keyframes) === 0 ? undefined : (next as Keyframes);
}

function placedKey<F extends TimedKey>(k: Keyframes | undefined, property: AnimatedProperty, frames: readonly F[], frame: Omit<F, "easing"> & { easing?: Easing }): Keyframes | undefined {
  const existing = frames.find((f) => f.atMs === frame.atMs);
  const placed = { ...frame, easing: frame.easing ?? existing?.easing ?? "linear" } as F;
  return withTimed(k, property, [...frames.filter((f) => f.atMs !== frame.atMs), placed].sort((a, b) => a.atMs - b.atMs));
}

export function setKeyframe(k: Keyframes | undefined, property: KeyframeProperty, atMs: number, value: number, easing?: Easing): Keyframes | undefined {
  return placedKey<Keyframe>(k, property, framesOf(k, property), { atMs: Math.round(atMs), value, easing });
}

export function setColorKey(k: Keyframes | undefined, property: ColorProperty, atMs: number, color: string, easing?: Easing): Keyframes | undefined {
  return placedKey<ColorKeyframe>(k, property, colorFramesOf(k, property), { atMs: Math.round(atMs), color, easing });
}

export function manualKey<F extends TimedKey>(frame: F): F {
  if (!("smooth" in frame)) return frame;
  const manual = { ...frame } as F & { smooth?: boolean };
  delete manual.smooth;
  return manual;
}

export function setKeyEasingAt(k: Keyframes | undefined, property: AnimatedProperty, atMs: number, easing: Easing): Keyframes | undefined {
  const frames = timedFramesOf(k, property);
  const index = frames.findIndex((f) => f.atMs === atMs);
  if (index < 0) return k;
  return withTimed(k, property, frames.map((f, i) => (i === index ? { ...manualKey(f), easing } : i === index + 1 ? manualKey(f) : f)));
}

export function setPropertyEasingAll(k: Keyframes | undefined, property: AnimatedProperty, easing: Easing): Keyframes | undefined {
  const frames = timedFramesOf(k, property);
  return frames.length === 0 ? k : withTimed(k, property, frames.map((f) => ({ ...manualKey(f), easing })));
}

export function removeKeyframe(k: Keyframes | undefined, property: AnimatedProperty, atMs: number): Keyframes | undefined {
  return withTimed(
    k,
    property,
    timedFramesOf(k, property).filter((f) => f.atMs !== Math.round(atMs)),
  );
}

export function withoutProperty(k: Keyframes | undefined, property: AnimatedProperty): Keyframes | undefined {
  return withTimed(k, property, []);
}

function mapProperties(k: Keyframes, map: (frames: readonly TimedKey[]) => readonly TimedKey[]): Keyframes {
  const next: Partial<Record<AnimatedProperty, readonly TimedKey[]>> = {};
  for (const property of ANIMATED_PROPERTIES) {
    const frames = timedFramesOf(k, property);
    if (frames.length === 0) continue;
    const mapped = map(frames);
    if (mapped.length > 0) next[property] = mapped;
  }
  return next as Keyframes;
}

export function mergeKeyframes(base: Keyframes | undefined, incoming: Keyframes): Keyframes {
  const next: Partial<Record<AnimatedProperty, readonly TimedKey[]>> = { ...base };
  for (const property of animatedProperties(incoming)) {
    const arriving = timedFramesOf(incoming, property);
    const times = new Set(arriving.map((frame) => frame.atMs));
    for (const rival of rivalsOf(property)) delete next[rival];
    next[property] = [...timedFramesOf(base, property).filter((frame) => !times.has(frame.atMs)), ...arriving].sort((a, b) => a.atMs - b.atMs);
  }
  return next as Keyframes;
}

export function shiftKeyframes(k: Keyframes | undefined, deltaMs: number): Keyframes | undefined {
  if (!k || deltaMs === 0) return k;
  return mapProperties(k, (frames) => frames.map((f) => ({ ...f, atMs: f.atMs + deltaMs })));
}

export function retimeKeyframes(k: Keyframes | undefined, timeOf: (atMs: number) => number): Keyframes | undefined {
  if (!k) return k;
  return mapProperties(k, (frames) =>
    frames.map((f) => ({ ...f, atMs: Math.round(timeOf(f.atMs)) })).filter((f, i, all) => i === all.length - 1 || all[i + 1].atMs > f.atMs),
  );
}

export function keyframesInRange(k: Keyframes | undefined, fromMs: number, toMs: number): Keyframes | undefined {
  if (!k) return k;
  const next: Partial<Record<AnimatedProperty, readonly TimedKey[]>> = {};
  for (const property of animatedProperties(k)) {
    const frames = timedFramesOf(k, property);
    const reach = isPathProperty(property) ? PATH_NEIGHBOURS : 1;
    const before = frames.filter((f) => f.atMs < fromMs).slice(-reach);
    const after = frames.filter((f) => f.atMs > toMs).slice(0, reach);
    next[property] = [...before, ...frames.filter((f) => f.atMs >= fromMs && f.atMs <= toMs), ...after];
  }
  return keyframeCount(next as Keyframes) === 0 ? undefined : (next as Keyframes);
}

export type KeyframeFault =
  | { kind: "empty" }
  | { kind: "easing"; property: AnimatedProperty; atMs: number; easing: string }
  | { kind: "time"; property: AnimatedProperty; atMs: number; limit: number }
  | { kind: "value"; property: KeyframeProperty; atMs: number; value: number; range: readonly [number, number] }
  | { kind: "color"; property: ColorProperty; atMs: number; color: string }
  | { kind: "order"; property: AnimatedProperty; atMs: number }
  | { kind: "path"; atMs: number; problem: "position" | "spatial" | HandleFault }
  | { kind: "morph"; atMs: number; problem: MorphFault }
  | { kind: "rival"; property: AnimatedProperty; rival: AnimatedProperty }
  | { kind: "box"; property: "scale" | AxisScaleProperty; scale: number; maxScale: number };

function framesFault<F extends TimedKey>(property: AnimatedProperty, frames: readonly F[], contentFault: (frame: F) => KeyframeFault | null): KeyframeFault | null {
  for (const [index, f] of frames.entries()) {
    const atMs = f.atMs;
    if (!isEasing(f.easing)) return { kind: "easing", property, atMs, easing: f.easing };
    if (!Number.isFinite(atMs) || Math.abs(atMs) > KEYFRAME_LIMITS.maxAbsMs) return { kind: "time", property, atMs, limit: KEYFRAME_LIMITS.maxAbsMs };
    const content = contentFault(f);
    if (content) return content;
    if (index > 0 && atMs <= frames[index - 1].atMs) return { kind: "order", property, atMs };
  }
  return null;
}

function propertyFault(property: KeyframeProperty, frames: readonly Keyframe[]): KeyframeFault | null {
  const range = KEYFRAME_RANGES[property];
  return framesFault(property, frames, (f) => (!Number.isFinite(f.value) || f.value < range[0] || f.value > range[1] ? { kind: "value", property, atMs: f.atMs, value: f.value, range } : null));
}

function colorPropertyFault(property: ColorProperty, frames: readonly ColorKeyframe[]): KeyframeFault | null {
  return framesFault(property, frames, (f) => (parseColor(f.color) === null ? { kind: "color", property, atMs: f.atMs, color: f.color } : null));
}

const PATH_RANGE = KEYFRAME_RANGES.x;

function pathKeyFault(f: PositionKeyframe): KeyframeFault | null {
  const inside = (value: number) => Number.isFinite(value) && value >= PATH_RANGE[0] && value <= PATH_RANGE[1];
  if (!inside(f.x) || !inside(f.y)) return { kind: "path", atMs: f.atMs, problem: "position" };
  if (f.spatial && !isSpatialMode(f.spatial)) return { kind: "path", atMs: f.atMs, problem: "spatial" };
  const handles = handleFault(f);
  return handles ? { kind: "path", atMs: f.atMs, problem: handles } : null;
}

function morphFault(f: MorphKeyframe): KeyframeFault | null {
  const problem = morphKeyFault(f);
  return problem ? { kind: "morph", atMs: f.atMs, problem } : null;
}

export function morphLaneFault(frames: readonly MorphKeyframe[]): KeyframeFault | null {
  return framesFault(MORPH_PROPERTY, frames, morphFault);
}

function rivalFault(k: Keyframes): KeyframeFault | null {
  for (const property of animatedProperties(k)) {
    const rival = rivalsOf(property).find((other) => timedFramesOf(k, other).length > 0);
    if (rival) return { kind: "rival", property, rival };
  }
  return null;
}

function largestScale(side: number): number {
  const fitting = KEYFRAME_LIMITS.maxAnimatedBox / side;
  return Math.floor(Math.min(KEYFRAME_RANGES.scale[1], fitting) * 100) / 100;
}

function boxFault(k: Keyframes, box: Transform): KeyframeFault | null {
  const reach = axisReach(k);
  const lane = (axis: AxisScaleProperty) => (framesOf(k, axis).length > 0 ? axis : "scale");
  if (box.w * reach.x > KEYFRAME_LIMITS.maxAnimatedBox) return { kind: "box", property: lane("scaleX"), scale: reach.x, maxScale: largestScale(box.w) };
  if (box.h * reach.y > KEYFRAME_LIMITS.maxAnimatedBox) return { kind: "box", property: lane("scaleY"), scale: reach.y, maxScale: largestScale(box.h) };
  return null;
}

export function keyframeFault(k: Keyframes | undefined, box: Transform): KeyframeFault | null {
  if (!k) return null;
  if (keyframeCount(k) === 0) return { kind: "empty" };
  for (const property of KEYFRAME_PROPERTIES) {
    const fault = propertyFault(property, framesOf(k, property));
    if (fault) return fault;
  }
  for (const property of COLOR_PROPERTIES) {
    const fault = colorPropertyFault(property, colorFramesOf(k, property));
    if (fault) return fault;
  }
  return framesFault(PATH_PROPERTY, pathFramesOf(k), pathKeyFault) ?? morphLaneFault(morphFramesOf(k)) ?? rivalFault(k) ?? boxFault(k, box);
}

const FAULT_ISSUES: Record<KeyframeFault["kind"], IssueCode> = {
  empty: "required",
  easing: "unknown",
  time: "out_of_range",
  value: "out_of_range",
  color: "invalid",
  order: "out_of_range",
  path: "invalid",
  morph: "invalid",
  rival: "invalid",
  box: "out_of_range",
};

const MORPH_ISSUES: Record<MorphFault, IssueCode> = {
  path: "invalid",
  vertex: "out_of_range",
};

export function faultIssue(fault: KeyframeFault): IssueCode {
  if (fault.kind === "path") return PATH_ISSUES[fault.problem];
  return fault.kind === "morph" ? MORPH_ISSUES[fault.problem] : FAULT_ISSUES[fault.kind];
}

export function keyframesIssue(k: Keyframes | undefined, box: Transform): IssueCode | null {
  const fault = keyframeFault(k, box);
  return fault ? faultIssue(fault) : null;
}

const PATH_ISSUES: Record<Extract<KeyframeFault, { kind: "path" }>["problem"], IssueCode> = {
  position: "out_of_range",
  spatial: "unknown",
  missing: "invalid",
  unexpected: "invalid",
  range: "out_of_range",
};

export interface KeyRef {
  property: AnimatedProperty;
  atMs: number;
}

function picked(k: Keyframes, keys: ReadonlyArray<KeyRef>, property: AnimatedProperty): TimedKey[] {
  const times = new Set(keys.filter((ref) => ref.property === property).map((ref) => Math.round(ref.atMs)));
  return timedFramesOf(k, property).filter((f) => times.has(f.atMs));
}

function placeKeys(k: Keyframes | undefined, keys: ReadonlyArray<KeyRef>, deltaMs: number, keepOriginals: boolean): Keyframes | undefined {
  const delta = Math.round(deltaMs);
  if (!k || delta === 0) return k;
  const next: Partial<Record<AnimatedProperty, readonly TimedKey[]>> = { ...k };
  let changed = false;
  for (const property of ANIMATED_PROPERTIES) {
    const chosen = picked(k, keys, property);
    if (chosen.length === 0) continue;
    const staying = keepOriginals ? [...timedFramesOf(k, property)] : timedFramesOf(k, property).filter((f) => !chosen.includes(f));
    const placed = chosen.map((f) => ({ ...f, atMs: f.atMs + delta }));
    const taken = new Set(staying.map((f) => f.atMs));
    if (placed.some((f) => taken.has(f.atMs) || Math.abs(f.atMs) > KEYFRAME_LIMITS.maxAbsMs)) return k;
    const frames = [...staying, ...placed].sort((a, b) => a.atMs - b.atMs);
    next[property] = frames;
    changed = true;
  }
  return changed ? (next as Keyframes) : k;
}

export function moveKeyframes(k: Keyframes | undefined, keys: ReadonlyArray<KeyRef>, deltaMs: number): Keyframes | undefined {
  return placeKeys(k, keys, deltaMs, false);
}

export function duplicateKeyframes(k: Keyframes | undefined, keys: ReadonlyArray<KeyRef>, deltaMs: number): Keyframes | undefined {
  return placeKeys(k, keys, deltaMs, true);
}
