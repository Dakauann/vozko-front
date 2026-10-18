import {
  ANIMATED_PROPERTIES,
  BEZIER_Y_RANGE,
  bezierEasing,
  bezierOf,
  carriesValue,
  isPathProperty,
  KEYFRAME_LIMITS,
  KEYFRAME_PROPERTIES,
  KEYFRAME_RANGES,
  manualKey,
  timedFramesOf,
  withLane,
  type AnimatedProperty,
  type Bezier,
  type Easing,
  type Keyframe,
  type KeyframeProperty,
  type Keyframes,
  type KeyRef,
  type NamedEasing,
  type TimedKey,
} from "./keyframes";
import type { PositionKeyframe } from "./path-keys";
import { segmentLengths } from "./position-path";

export const EASE_INFLUENCE = 0.333;
export const MIN_INFLUENCE = 0.001;

export type EaseSide = "in" | "out";
export type EaseSides = EaseSide | "both";
export type StretchAnchor = "first" | "last";

type Handle = readonly [number, number];

interface Side {
  influence: number;
  rise: number;
}

const OPPOSITE = 0.667;
const LINEAR_BEZIER: Bezier = [EASE_INFLUENCE, EASE_INFLUENCE, OPPOSITE, OPPOSITE];
const PRECISION = 1e4;
const SPEED_PRECISION = 1e6;
const MS_PER_SECOND = 1000;

const NAMED_BEZIERS: Record<Exclude<NamedEasing, "hold">, Bezier> = {
  linear: LINEAR_BEZIER,
  easeIn: [EASE_INFLUENCE, 0, OPPOSITE, 0],
  easeOut: [EASE_INFLUENCE, 1, OPPOSITE, 1],
  easeInOut: [0.65, 0, 0.35, 1],
  backIn: [0.36, 0, 0.66, -0.56],
  backOut: [0.34, 1.56, 0.64, 1],
  backInOut: [0.68, -0.6, 0.32, 1.6],
  elastic: [0.25, 1, 0.5, 1],
  bounce: [0.33, 1, 0.68, 1],
  spring: [0.25, 1, 0.5, 1],
};

const REVERSED_NAMES: Partial<Record<NamedEasing, NamedEasing>> = {
  hold: "hold",
  linear: "linear",
  easeIn: "easeOut",
  easeOut: "easeIn",
  easeInOut: "easeInOut",
  backIn: "backOut",
  backOut: "backIn",
  backInOut: "backInOut",
};

function round(value: number): number {
  return Math.round(value * PRECISION) / PRECISION;
}

function roundSpeed(value: number): number {
  return Math.round(value * SPEED_PRECISION) / SPEED_PRECISION;
}

export function segmentBezier(easing: Easing): Bezier | null {
  if (easing === "hold") return null;
  return bezierOf(easing) ?? NAMED_BEZIERS[easing as Exclude<NamedEasing, "hold">] ?? LINEAR_BEZIER;
}

function easingOf(bezier: Bezier): Easing {
  const rounded = bezier.map(round) as unknown as Bezier;
  return rounded.every((value, i) => value === LINEAR_BEZIER[i]) ? "linear" : bezierEasing(rounded);
}

function mirrored([x1, y1, x2, y2]: Bezier): Bezier {
  return [1 - x2, 1 - y2, 1 - x1, 1 - y1];
}

export function reversedEasing(easing: Easing): Easing {
  const named = REVERSED_NAMES[easing as NamedEasing];
  if (named) return named;
  return easingOf(mirrored(segmentBezier(easing) ?? LINEAR_BEZIER));
}

function withHandle(easing: Easing, side: EaseSide, handle: Handle): Easing {
  const [x1, y1, x2, y2] = segmentBezier(easing) ?? LINEAR_BEZIER;
  return easingOf(side === "out" ? [handle[0], handle[1], x2, y2] : [x1, y1, handle[0], handle[1]]);
}

function sideOf(easing: Easing, side: EaseSide): Side | null {
  const bezier = segmentBezier(easing);
  if (!bezier) return null;
  return side === "out" ? { influence: bezier[0], rise: bezier[1] } : { influence: 1 - bezier[2], rise: 1 - bezier[3] };
}

function handleOf(side: EaseSide, { influence, rise }: Side): Handle {
  return side === "out" ? [influence, rise] : [1 - influence, 1 - rise];
}

function slopeOf(side: Side): number {
  return side.influence > 1e-9 ? side.rise / side.influence : 0;
}

function isNumeric(property: AnimatedProperty): boolean {
  return carriesValue(property);
}

function segmentOf(index: number, side: EaseSide, count: number): number | null {
  const segment = side === "out" ? index : index - 1;
  return segment >= 0 && segment < count - 1 ? segment : null;
}

function propertiesOf(keys: readonly KeyRef[]): AnimatedProperty[] {
  return ANIMATED_PROPERTIES.filter((property) => keys.some((key) => key.property === property));
}

function timesOf(keys: readonly KeyRef[], property: AnimatedProperty): Set<number> {
  return new Set(keys.filter((key) => key.property === property).map((key) => Math.round(key.atMs)));
}

function setLane(k: Keyframes | undefined, property: AnimatedProperty, frames: readonly TimedKey[]): Keyframes {
  return withLane(k, property, frames) as Keyframes;
}

export interface SideVelocity {
  speed: number | null;
  influence: number;
}

export interface KeyVelocity {
  in: SideVelocity | null;
  out: SideVelocity | null;
  smooth: boolean;
}

function speedOf(side: Side, distance: number, from: TimedKey, to: TimedKey): number | null {
  if (distance === 0 || side.rise === 0) return 0;
  if (side.influence <= 1e-9) return null;
  return roundSpeed((slopeOf(side) * distance * MS_PER_SECOND) / (to.atMs - from.atMs));
}

export function segmentDistance(property: AnimatedProperty, frames: readonly TimedKey[], segment: number, aspect?: number): number | null {
  if (isPathProperty(property)) return aspect === undefined ? null : (segmentLengths(frames as readonly PositionKeyframe[], aspect)[segment] ?? null);
  if (!carriesValue(property)) return null;
  return (frames[segment + 1] as Keyframe).value - (frames[segment] as Keyframe).value;
}

export function keyVelocity(k: Keyframes | undefined, property: AnimatedProperty, atMs: number, aspect?: number): KeyVelocity | null {
  const frames = timedFramesOf(k, property);
  const index = frames.findIndex((frame) => frame.atMs === atMs);
  if (index < 0) return null;
  const read = (side: EaseSide): SideVelocity | null => {
    const segment = segmentOf(index, side, frames.length);
    if (segment === null) return null;
    const found = sideOf(frames[segment].easing, side);
    if (!found) return null;
    const distance = segmentDistance(property, frames, segment, aspect);
    const speed = distance === null ? null : speedOf(found, distance, frames[segment], frames[segment + 1]);
    return { speed, influence: round(found.influence) };
  };
  return { in: read("in"), out: read("out"), smooth: (frames[index] as Keyframe).smooth === true };
}

export interface SideChange {
  speed?: number;
  influence?: number;
}

export type VelocityChange = Partial<Record<EaseSide, SideChange>>;

export type VelocityRefusal =
  | { kind: "influence" }
  | { kind: "noSide" }
  | { kind: "notNumeric"; property: AnimatedProperty }
  | { kind: "flat"; property: AnimatedProperty; atMs: number; side: EaseSide }
  | { kind: "steep"; property: AnimatedProperty; atMs: number; side: EaseSide; range?: readonly [number, number] };

type VelocityResult = { ok: true; keyframes: Keyframes | undefined; applied: number } | { ok: false; refusal: VelocityRefusal };

interface SegmentContext {
  property: AnimatedProperty;
  atMs: number;
  side: EaseSide;
  from: TimedKey;
  to: TimedKey;
  distance: number | null;
}

function insideCurve(rise: number): boolean {
  return rise >= BEZIER_Y_RANGE[0] && rise <= BEZIER_Y_RANGE[1];
}

function speedRange(context: SegmentContext, influence: number): readonly [number, number] | undefined {
  if (context.distance === null) return undefined;
  const perRise = (context.distance * MS_PER_SECOND) / ((context.to.atMs - context.from.atMs) * influence);
  const ends = [BEZIER_Y_RANGE[0] * perRise, BEZIER_Y_RANGE[1] * perRise].map(roundSpeed);
  return [Math.min(...ends), Math.max(...ends)];
}

function riseFor(context: SegmentContext, current: Side, change: SideChange): number | VelocityRefusal {
  const influence = change.influence ?? current.influence;
  if (change.speed === undefined || change.speed === 0) return change.speed === 0 ? 0 : slopeOf(current) * influence;
  if (context.distance === null) return { kind: "notNumeric", property: context.property };
  if (context.distance === 0) return { kind: "flat", property: context.property, atMs: context.atMs, side: context.side };
  return ((change.speed * (context.to.atMs - context.from.atMs)) / (MS_PER_SECOND * context.distance)) * influence;
}

function sideSought(change: SideChange | undefined): change is SideChange {
  return change !== undefined;
}

function influenceValid(change: SideChange | undefined): boolean {
  return change?.influence === undefined || (Number.isFinite(change.influence) && change.influence >= MIN_INFLUENCE && change.influence <= 1);
}

export function setKeysVelocity(k: Keyframes | undefined, keys: readonly KeyRef[], change: VelocityChange, aspect?: number): VelocityResult {
  if (!influenceValid(change.in) || !influenceValid(change.out)) return { ok: false, refusal: { kind: "influence" } };
  const sides = (["in", "out"] as const).filter((side) => sideSought(change[side]));
  let next = k;
  let applied = 0;
  for (const property of propertiesOf(keys)) {
    const frames = [...timedFramesOf(next, property)];
    const times = timesOf(keys, property);
    const touched = new Set<number>();
    for (const [index, frame] of timedFramesOf(next, property).entries()) {
      if (!times.has(frame.atMs)) continue;
      for (const side of sides) {
        const segment = segmentOf(index, side, frames.length);
        if (segment === null) continue;
        const easing = frames[segment].easing;
        if (side === "in" && easing === "hold") continue;
        const current = sideOf(easing, side) ?? sideOf("linear", side)!;
        const wanted = change[side]!;
        const context: SegmentContext = { property, atMs: frame.atMs, side, from: frames[segment], to: frames[segment + 1], distance: segmentDistance(property, frames, segment, aspect) };
        const rise = riseFor(context, current, wanted);
        if (typeof rise !== "number") return { ok: false, refusal: rise };
        const influence = wanted.influence ?? current.influence;
        if (!insideCurve(rise)) return { ok: false, refusal: { kind: "steep", property, atMs: frame.atMs, side, range: speedRange(context, influence) } };
        frames[segment] = { ...frames[segment], easing: withHandle(easing, side, handleOf(side, { influence, rise })) };
        touched.add(index);
        applied++;
      }
    }
    if (touched.size > 0) next = setLane(next, property, frames.map((frame, index) => (touched.has(index) ? manualKey(frame) : frame)));
  }
  return applied === 0 ? { ok: false, refusal: { kind: "noSide" } } : { ok: true, keyframes: next, applied };
}

function sideSegment(frames: readonly TimedKey[], atMs: number, side: EaseSide): { index: number; segment: number } | null {
  const index = frames.findIndex((frame) => frame.atMs === atMs);
  const segment = index < 0 ? null : segmentOf(index, side, frames.length);
  return segment === null ? null : { index, segment };
}

export function keySide(k: Keyframes | undefined, property: AnimatedProperty, atMs: number, side: EaseSide): Side | null {
  const frames = timedFramesOf(k, property);
  const found = sideSegment(frames, atMs, side);
  return found ? sideOf(frames[found.segment].easing, side) : null;
}

export function setKeySide(k: Keyframes | undefined, property: AnimatedProperty, atMs: number, side: EaseSide, value: Side): Keyframes | undefined {
  const frames = timedFramesOf(k, property);
  const found = sideSegment(frames, atMs, side);
  if (!found || frames[found.segment].easing === "hold" || ![value.influence, value.rise].every(Number.isFinite)) return k;
  const influence = Math.min(1, Math.max(MIN_INFLUENCE, value.influence));
  const rise = Math.min(BEZIER_Y_RANGE[1], Math.max(BEZIER_Y_RANGE[0], value.rise));
  const easing = withHandle(frames[found.segment].easing, side, handleOf(side, { influence, rise }));
  return setLane(k, property, frames.map((frame, index) => (index === found.segment ? { ...frame, easing } : frame)).map((frame, index) => (index === found.index ? manualKey(frame) : frame)));
}

export function setKeySpeed(k: Keyframes | undefined, property: AnimatedProperty, atMs: number, side: EaseSide, change: SideChange, aspect?: number): Keyframes | undefined {
  const frames = timedFramesOf(k, property);
  const found = sideSegment(frames, atMs, side);
  const current = found ? sideOf(frames[found.segment].easing, side) : null;
  if (!found || !current) return k;
  const context: SegmentContext = { property, atMs, side, from: frames[found.segment], to: frames[found.segment + 1], distance: segmentDistance(property, frames, found.segment, aspect) };
  const influence = Math.min(1, Math.max(MIN_INFLUENCE, change.influence ?? current.influence));
  const rise = riseFor(context, current, { ...change, influence });
  return setKeySide(k, property, atMs, side, { influence, rise: typeof rise === "number" ? rise : current.rise });
}

const EASY: SideChange = { speed: 0, influence: EASE_INFLUENCE };

export function easeKeySides(k: Keyframes | undefined, keys: readonly KeyRef[], sides: EaseSides): { keyframes: Keyframes | undefined; applied: number } {
  const change: VelocityChange = sides === "both" ? { in: EASY, out: EASY } : { [sides]: EASY };
  const result = setKeysVelocity(k, keys, change);
  return result.ok ? { keyframes: result.keyframes, applied: result.applied } : { keyframes: k, applied: 0 };
}

export function setSmooth(k: Keyframes | undefined, keys: readonly KeyRef[], smooth: boolean): Keyframes | undefined {
  let next = k;
  for (const property of propertiesOf(keys).filter(isNumeric)) {
    const times = timesOf(keys, property);
    const frames = timedFramesOf(next, property) as readonly Keyframe[];
    if (!frames.some((frame) => times.has(frame.atMs))) continue;
    next = setLane(next, property, frames.map((frame) => (!times.has(frame.atMs) ? frame : smooth ? { ...frame, smooth: true } : manualKey(frame))));
  }
  return next;
}

function smoothSpeed(frames: readonly Keyframe[], index: number): number {
  const frame = frames[index];
  const previous = index > 0 && frames[index - 1].easing !== "hold" ? frames[index - 1] : null;
  const following = index < frames.length - 1 && frame.easing !== "hold" ? frames[index + 1] : null;
  const before = previous ? (frame.value - previous.value) / (frame.atMs - previous.atMs) : null;
  const after = following ? (following.value - frame.value) / (following.atMs - frame.atMs) : null;
  if (before === null || after === null) return before ?? after ?? 0;
  if (before * after <= 0) return 0;
  const central = (following!.value - previous!.value) / (following!.atMs - previous!.atMs);
  return Math.sign(central) * Math.min(Math.abs(central), 3 * Math.min(Math.abs(before), Math.abs(after)));
}

function smoothRise(from: Keyframe, to: Keyframe, speed: number): number {
  const delta = to.value - from.value;
  return delta === 0 ? 0 : (EASE_INFLUENCE * speed * (to.atMs - from.atMs)) / delta;
}

function settledLane(frames: readonly Keyframe[]): readonly Keyframe[] {
  const easings = frames.map((frame) => frame.easing);
  frames.forEach((frame, index) => {
    if (!frame.smooth) return;
    const speed = smoothSpeed(frames, index);
    if (index > 0 && easings[index - 1] !== "hold") easings[index - 1] = withHandle(easings[index - 1], "in", handleOf("in", { influence: EASE_INFLUENCE, rise: smoothRise(frames[index - 1], frame, speed) }));
    if (index < frames.length - 1 && easings[index] !== "hold") easings[index] = withHandle(easings[index], "out", handleOf("out", { influence: EASE_INFLUENCE, rise: smoothRise(frame, frames[index + 1], speed) }));
  });
  return easings.every((easing, index) => easing === frames[index].easing) ? frames : frames.map((frame, index) => ({ ...frame, easing: easings[index] }));
}

export function settleSmooth(k: Keyframes | undefined): Keyframes | undefined {
  if (!k) return k;
  let next = k;
  for (const property of KEYFRAME_PROPERTIES) {
    const frames = k[property];
    if (!frames?.some((frame) => frame.smooth)) continue;
    const settled = settledLane(frames);
    if (settled !== frames) next = { ...next, [property]: settled };
  }
  return next;
}

export interface KeyEdit {
  keyframes: Keyframes;
  keys: KeyRef[];
}

type SideMark = Handle | "hold" | null;

function outMark(frames: readonly TimedKey[], index: number): SideMark {
  if (index >= frames.length - 1) return null;
  const side = sideOf(frames[index].easing, "out");
  return side ? handleOf("out", side) : "hold";
}

function inMark(frames: readonly TimedKey[], index: number): SideMark {
  if (index === 0) return null;
  const side = sideOf(frames[index - 1].easing, "in");
  return side ? handleOf("in", side) : null;
}

function flipped(mark: SideMark): Handle | null {
  return mark && mark !== "hold" ? [1 - mark[0], 1 - mark[1]] : null;
}

interface Placed {
  frame: TimedKey;
  index: number;
  picked: boolean;
}

function joinedEasing(frames: readonly TimedKey[], from: Placed, to: Placed): Easing {
  if (to.index === from.index + 1) return frames[from.index].easing;
  if (from.picked && to.picked && from.index === to.index + 1) return reversedEasing(frames[to.index].easing);
  const out = from.picked ? flipped(inMark(frames, from.index)) : outMark(frames, from.index);
  if (out === "hold") return "hold";
  const into = to.picked ? flipped(outMark(frames, to.index)) : inMark(frames, to.index);
  const [x1, y1] = out ?? [LINEAR_BEZIER[0], LINEAR_BEZIER[1]];
  const [x2, y2] = into && into !== "hold" ? into : [LINEAR_BEZIER[2], LINEAR_BEZIER[3]];
  return easingOf([x1, y1, x2, y2]);
}

function distinctTimes(placed: readonly Placed[]): boolean {
  return new Set(placed.map((p) => p.frame.atMs)).size === placed.length && placed.every((p) => Math.abs(p.frame.atMs) <= KEYFRAME_LIMITS.maxAbsMs);
}

function reverseLane(frames: readonly TimedKey[], picked: ReadonlySet<number>, mirror: number): TimedKey[] | null {
  const placed: Placed[] = frames.map((frame, index) => ({ frame: picked.has(index) ? { ...frame, atMs: mirror - frame.atMs } : frame, index, picked: picked.has(index) }));
  if (!distinctTimes(placed)) return null;
  placed.sort((a, b) => a.frame.atMs - b.frame.atMs);
  return placed.map((entry, position) => {
    const next = placed[position + 1];
    if (!next) return entry.picked ? { ...entry.frame, easing: "linear" } : entry.frame;
    return { ...entry.frame, easing: joinedEasing(frames, entry, next) };
  });
}

function pickedIndices(frames: readonly TimedKey[], times: ReadonlySet<number>): Set<number> {
  return new Set(frames.flatMap((frame, index) => (times.has(frame.atMs) ? [index] : [])));
}

export function reverseKeys(k: Keyframes, keys: readonly KeyRef[]): KeyEdit | null {
  const times = keys.map((key) => Math.round(key.atMs));
  if (times.length === 0) return { keyframes: k, keys: [...keys] };
  const mirror = Math.min(...times) + Math.max(...times);
  let next = k;
  for (const property of propertiesOf(keys)) {
    const lane = reverseLane(timedFramesOf(k, property), pickedIndices(timedFramesOf(k, property), timesOf(keys, property)), mirror);
    if (!lane) return null;
    next = setLane(next, property, lane);
  }
  return { keyframes: next, keys: keys.map((key) => ({ property: key.property, atMs: mirror - Math.round(key.atMs) })) };
}

export function reversedSnippet(snippet: Keyframes): Keyframes {
  const properties = ANIMATED_PROPERTIES.filter((property) => timedFramesOf(snippet, property).length > 0);
  const span = Math.max(0, ...properties.flatMap((property) => timedFramesOf(snippet, property).map((frame) => frame.atMs)));
  return properties.reduce<Keyframes>((current, property) => {
    const frames = timedFramesOf(snippet, property);
    return setLane(current, property, reverseLane(frames, new Set(frames.keys()), span)!);
  }, {});
}

export interface AxisMap {
  pivot: number;
  scale: number;
  offset: number;
}

export interface KeyTransform {
  time?: AxisMap;
  values?: Partial<Record<AnimatedProperty, AxisMap>>;
}

function mapped(axis: AxisMap | undefined, value: number): number {
  return axis ? axis.pivot + (value - axis.pivot) * axis.scale + axis.offset : value;
}

function axisValid(axis: AxisMap | undefined): boolean {
  return axis === undefined || [axis.pivot, axis.scale, axis.offset].every(Number.isFinite);
}

function placedValue(property: AnimatedProperty, frame: TimedKey, axis: AxisMap | undefined): TimedKey {
  if (!axis || !isNumeric(property)) return frame;
  const [low, high] = KEYFRAME_RANGES[property as KeyframeProperty];
  return { ...frame, value: Math.min(high, Math.max(low, mapped(axis, (frame as Keyframe).value))) };
}

export function transformKeys(k: Keyframes, keys: readonly KeyRef[], transform: KeyTransform): KeyEdit | null {
  const axes = [transform.time, ...Object.values(transform.values ?? {})];
  if (keys.length === 0 || !axes.every(axisValid) || (transform.time !== undefined && !(transform.time.scale > 0))) return null;
  const moved = (atMs: number) => Math.round(mapped(transform.time, atMs));
  let next = k;
  for (const property of propertiesOf(keys)) {
    const frames = timedFramesOf(k, property);
    const picked = pickedIndices(frames, timesOf(keys, property));
    const axis = transform.values?.[property];
    const placed: Placed[] = frames.map((frame, index) => ({ frame: picked.has(index) ? placedValue(property, { ...frame, atMs: moved(frame.atMs) }, axis) : frame, index, picked: picked.has(index) }));
    if (!distinctTimes(placed)) return null;
    next = setLane(next, property, placed.map((entry) => entry.frame).sort((a, b) => a.atMs - b.atMs));
  }
  return { keyframes: next, keys: keys.map((key) => ({ property: key.property, atMs: moved(Math.round(key.atMs)) })) };
}

export function stretchKeys(k: Keyframes, keys: readonly KeyRef[], ratio: number, anchor: StretchAnchor): KeyEdit | null {
  if (!Number.isFinite(ratio) || ratio <= 0 || keys.length === 0) return null;
  const times = keys.map((key) => Math.round(key.atMs));
  const pivot = anchor === "first" ? Math.min(...times) : Math.max(...times);
  return transformKeys(k, keys, { time: { pivot, scale: ratio, offset: 0 } });
}

function laneDistances(property: AnimatedProperty, frames: readonly TimedKey[], aspect: number): number[] {
  if (isPathProperty(property)) return segmentLengths(frames as readonly PositionKeyframe[], aspect);
  if (!carriesValue(property)) return frames.slice(1).map(() => 1);
  return frames.slice(1).map((frame, index) => Math.abs((frame as Keyframe).value - (frames[index] as Keyframe).value));
}

const LINEAR_IN: Handle = [LINEAR_BEZIER[2], LINEAR_BEZIER[3]];
const LINEAR_OUT: Handle = [LINEAR_BEZIER[0], LINEAR_BEZIER[1]];

function rovedLane(property: AnimatedProperty, frames: readonly TimedKey[], picked: ReadonlySet<number>, aspect: number): TimedKey[] | null | "unchanged" {
  const chosen = [...picked].sort((a, b) => a - b);
  const first = chosen[0];
  const last = chosen[chosen.length - 1];
  if (chosen.length < 2 || last - first < 2) return "unchanged";
  const distances = laneDistances(property, frames, aspect);
  const total = distances.slice(first, last).reduce((sum, distance) => sum + distance, 0);
  if (total <= 1e-9) return "unchanged";
  const start = frames[first].atMs;
  const span = frames[last].atMs - start;
  const roved = [...frames];
  let walked = 0;
  for (let index = first + 1; index < last; index++) {
    walked += distances[index - 1];
    const atMs = Math.round(start + (span * walked) / total);
    if (atMs <= roved[index - 1].atMs || atMs >= frames[last].atMs) return null;
    roved[index] = manualKey({ ...frames[index], atMs });
  }
  for (let index = first + 1; index < last; index++) {
    roved[index - 1] = roved[index - 1].easing === "hold" ? roved[index - 1] : { ...roved[index - 1], easing: withHandle(roved[index - 1].easing, "in", LINEAR_IN) };
    roved[index] = { ...roved[index], easing: withHandle(roved[index].easing, "out", LINEAR_OUT) };
  }
  return roved;
}

export function roveKeys(k: Keyframes, keys: readonly KeyRef[], aspect: number): KeyEdit | null {
  let next = k;
  const moved = new Map<string, number>();
  for (const property of propertiesOf(keys)) {
    const frames = timedFramesOf(k, property);
    const lane = rovedLane(property, frames, pickedIndices(frames, timesOf(keys, property)), aspect);
    if (lane === null) return null;
    if (lane === "unchanged") continue;
    frames.forEach((frame, index) => moved.set(`${property}:${frame.atMs}`, lane[index].atMs));
    next = setLane(next, property, lane);
  }
  return { keyframes: next, keys: keys.map((key) => ({ property: key.property, atMs: moved.get(`${key.property}:${Math.round(key.atMs)}`) ?? key.atMs })) };
}

export function allSmooth(k: Keyframes | undefined, keys: readonly KeyRef[]): boolean {
  return keys.length > 0 && keys.every((key) => (timedFramesOf(k, key.property).find((frame) => frame.atMs === Math.round(key.atMs)) as Keyframe | undefined)?.smooth === true);
}

export type SideShape = "none" | "linear" | "eased" | "hold" | "smooth";

export interface KeySides {
  in: SideShape;
  out: SideShape;
}

function shapeOf(frames: readonly TimedKey[], index: number, side: EaseSide): SideShape {
  const segment = segmentOf(index, side, frames.length);
  if (segment === null) return "none";
  if ((frames[index] as Keyframe).smooth) return "smooth";
  const found = sideOf(frames[segment].easing, side);
  if (!found) return "hold";
  return Math.abs(found.rise - found.influence) < 1e-3 ? "linear" : "eased";
}

export function keySideShapes(k: Keyframes | undefined, property: AnimatedProperty, atMs: number): KeySides {
  const frames = timedFramesOf(k, property);
  const index = frames.findIndex((frame) => frame.atMs === atMs);
  return index < 0 ? { in: "none", out: "none" } : { in: shapeOf(frames, index, "in"), out: shapeOf(frames, index, "out") };
}
