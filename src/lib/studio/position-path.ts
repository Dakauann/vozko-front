import { msOfFrame } from "./document";
import { ease, KEYFRAME_RANGES, valueAt, type Easing, type Keyframe } from "./keyframes";
import { spatialOf, type PositionKeyframe, type SpatialMode, type Tangent } from "./path-keys";

export interface PathPoint {
  x: number;
  y: number;
}

export interface KeyHandles {
  in: Tangent;
  out: Tangent;
}

interface PathSegment {
  from: PositionKeyframe;
  to: PositionKeyframe;
  controls: readonly [PathPoint, PathPoint, PathPoint, PathPoint];
  straight: boolean;
  lengths: Float64Array;
  length: number;
}

interface PathGeometry {
  aspect: number;
  handles: KeyHandles[];
  segments: PathSegment[];
}

export const SEGMENT_SAMPLES = 64;
export const DRAW_SAMPLES = 24;
const EPSILON = 1e-12;
const ZERO: Tangent = { x: 0, y: 0 };

const geometries = new WeakMap<readonly PositionKeyframe[], PathGeometry>();

function add(a: PathPoint, b: PathPoint): PathPoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

function sub(a: PathPoint, b: PathPoint): PathPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(a: PathPoint, k: number): PathPoint {
  return { x: a.x * k, y: a.y * k };
}

function size(a: PathPoint): number {
  return Math.hypot(a.x, a.y);
}

function toIso(p: PathPoint, aspect: number): PathPoint {
  return { x: p.x * aspect, y: p.y };
}

function fromIso(p: PathPoint, aspect: number): PathPoint {
  return { x: p.x / aspect, y: p.y };
}

function same(a: PathPoint, b: PathPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

function autoHandles(keys: readonly PositionKeyframe[], i: number, aspect: number): KeyHandles {
  if (i === 0 || i === keys.length - 1) return { in: ZERO, out: ZERO };
  const [p0, p1, p2] = [keys[i - 1], keys[i], keys[i + 1]].map((k) => toIso(k, aspect));
  const d1 = Math.sqrt(size(sub(p1, p0)));
  const d2 = Math.sqrt(size(sub(p2, p1)));
  if (d1 < EPSILON && d2 < EPSILON) return { in: ZERO, out: ZERO };
  if (d1 < EPSILON) return { in: ZERO, out: fromIso(scale(sub(p2, p1), 1 / 3), aspect) };
  if (d2 < EPSILON) return { in: fromIso(scale(sub(p0, p1), 1 / 3), aspect), out: ZERO };
  const tangent = add(sub(scale(sub(p1, p0), 1 / d1), scale(sub(p2, p0), 1 / (d1 + d2))), scale(sub(p2, p1), 1 / d2));
  return { in: fromIso(scale(tangent, -d1 / 3), aspect), out: fromIso(scale(tangent, d2 / 3), aspect) };
}

function handlesOf(keys: readonly PositionKeyframe[], aspect: number): KeyHandles[] {
  const handles = keys.map((key, i): KeyHandles => {
    const mode = spatialOf(key);
    if (mode === "linear") return { in: ZERO, out: ZERO };
    if (mode === "auto") return autoHandles(keys, i, aspect);
    return { in: key.in ?? ZERO, out: key.out ?? ZERO };
  });
  for (let i = 0; i < keys.length - 1; i++) {
    if (!same(keys[i], keys[i + 1])) continue;
    if (spatialOf(keys[i]) === "auto") handles[i] = { ...handles[i], out: ZERO };
    if (spatialOf(keys[i + 1]) === "auto") handles[i + 1] = { ...handles[i + 1], in: ZERO };
  }
  return handles;
}

function bezierPoint(c: PathSegment["controls"], t: number): PathPoint {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  return { x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x, y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y };
}

function bezierSlope(c: PathSegment["controls"], t: number): PathPoint {
  const u = 1 - t;
  const first = scale(sub(c[1], c[0]), 3 * u * u);
  const second = scale(sub(c[2], c[1]), 6 * u * t);
  const third = scale(sub(c[3], c[2]), 3 * t * t);
  return add(add(first, second), third);
}

function segmentOf(from: PositionKeyframe, to: PositionKeyframe, out: Tangent, into: Tangent, aspect: number): PathSegment {
  const controls = [from, add(from, out), add(to, into), to].map((p) => toIso({ x: p.x, y: p.y }, aspect)) as unknown as PathSegment["controls"];
  const lengths = new Float64Array(SEGMENT_SAMPLES + 1);
  let previous = controls[0];
  for (let j = 1; j <= SEGMENT_SAMPLES; j++) {
    const point = bezierPoint(controls, j / SEGMENT_SAMPLES);
    lengths[j] = lengths[j - 1] + size(sub(point, previous));
    previous = point;
  }
  const straight = out.x === 0 && out.y === 0 && into.x === 0 && into.y === 0;
  return { from, to, controls, straight, lengths, length: lengths[SEGMENT_SAMPLES] };
}

function geometryOf(keys: readonly PositionKeyframe[], aspect: number): PathGeometry {
  const known = geometries.get(keys);
  if (known && known.aspect === aspect) return known;
  const handles = handlesOf(keys, aspect);
  const segments = keys.slice(0, -1).map((from, i) => segmentOf(from, keys[i + 1], handles[i].out, handles[i + 1].in, aspect));
  const built = { aspect, handles, segments };
  geometries.set(keys, built);
  return built;
}

export function resolvedHandles(keys: readonly PositionKeyframe[], aspect: number): KeyHandles[] {
  return geometryOf(keys, aspect).handles;
}

export function segmentLengths(keys: readonly PositionKeyframe[], aspect: number): number[] {
  return geometryOf(keys, aspect).segments.map((segment) => segment.length);
}

function paramAt(segment: PathSegment, distance: number): number {
  const lengths = segment.lengths;
  let low = 0;
  let high = SEGMENT_SAMPLES;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (lengths[middle] < distance) low = middle;
    else high = middle;
  }
  const span = lengths[high] - lengths[low];
  return (low + (span > EPSILON ? (distance - lengths[low]) / span : 0)) / SEGMENT_SAMPLES;
}

function direction(segment: PathSegment, t: number): PathPoint | null {
  const c = segment.controls;
  const candidates = [bezierSlope(c, t), t < 0.5 ? sub(c[2], c[0]) : sub(c[3], c[1]), sub(c[3], c[0])];
  return candidates.find((candidate) => size(candidate) > EPSILON) ?? null;
}

function pointAlong(segment: PathSegment, progress: number, aspect: number): PathPoint {
  const { from, to } = segment;
  if (segment.straight) return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
  if (segment.length < EPSILON || progress === 0) return { x: from.x, y: from.y };
  if (progress < 0 || progress > 1) {
    const edge = progress < 0 ? 0 : 1;
    const heading = direction(segment, edge);
    const base = segment.controls[edge === 0 ? 0 : 3];
    const reach = (progress < 0 ? progress : progress - 1) * segment.length;
    const moved = heading ? add(base, scale(heading, reach / size(heading))) : base;
    return fromIso(moved, aspect);
  }
  return fromIso(bezierPoint(segment.controls, paramAt(segment, progress * segment.length)), aspect);
}

interface PathMoment {
  segment: number;
  progress: number;
}

function momentOf(keys: readonly PositionKeyframe[], atMs: number): PathMoment {
  const last = keys.length - 2;
  if (atMs <= keys[0].atMs) return { segment: 0, progress: 0 };
  for (let i = 0; i <= last; i++) {
    const from = keys[i];
    const to = keys[i + 1];
    if (atMs < to.atMs) return { segment: i, progress: ease(from.easing, (atMs - from.atMs) / (to.atMs - from.atMs)) };
  }
  return { segment: last, progress: 1 };
}

export function positionAt(keys: readonly PositionKeyframe[], atMs: number, aspect: number): PathPoint {
  if (keys.length === 0) return { x: 0, y: 0 };
  if (keys.length === 1 || atMs <= keys[0].atMs) return { x: keys[0].x, y: keys[0].y };
  const last = keys[keys.length - 1];
  if (atMs >= last.atMs) return { x: last.x, y: last.y };
  const moment = momentOf(keys, atMs);
  return pointAlong(geometryOf(keys, aspect).segments[moment.segment], moment.progress, aspect);
}

function degrees(vector: PathPoint): number {
  return (Math.atan2(vector.y, vector.x) * 180) / Math.PI;
}

export function headingAt(keys: readonly PositionKeyframe[], atMs: number, aspect: number): number | null {
  if (keys.length < 2) return null;
  const segments = geometryOf(keys, aspect).segments;
  const moment = momentOf(keys, atMs);
  const here = segments[moment.segment];
  const t = moment.progress <= 0 ? 0 : moment.progress >= 1 ? 1 : paramAt(here, moment.progress * here.length);
  const found = here.length < EPSILON ? null : direction(here, t);
  if (found) return degrees(found);
  for (let i = moment.segment - 1; i >= 0; i--) {
    const earlier = segments[i].length < EPSILON ? null : direction(segments[i], 1);
    if (earlier) return degrees(earlier);
  }
  for (let i = moment.segment + 1; i < segments.length; i++) {
    const later = segments[i].length < EPSILON ? null : direction(segments[i], 0);
    if (later) return degrees(later);
  }
  return null;
}

export function pathPolyline(keys: readonly PositionKeyframe[], aspect: number, perSegment: number = DRAW_SAMPLES): PathPoint[] {
  if (keys.length === 0) return [];
  const segments = geometryOf(keys, aspect).segments;
  const points: PathPoint[] = [{ x: keys[0].x, y: keys[0].y }];
  for (const segment of segments) {
    const steps = segment.straight ? 1 : perSegment;
    for (let j = 1; j <= steps; j++) points.push(j === steps ? { x: segment.to.x, y: segment.to.y } : fromIso(bezierPoint(segment.controls, j / steps), aspect));
  }
  return points;
}

function easingAt(lanes: readonly (readonly Keyframe[])[], atMs: number): Easing {
  for (const lane of lanes) {
    const found = lane.find((frame) => frame.atMs === atMs);
    if (found) return found.easing;
  }
  return "linear";
}

export function joinedPath(x: readonly Keyframe[], y: readonly Keyframe[], still: PathPoint, spatial: SpatialMode): PositionKeyframe[] {
  const times = [...new Set([...x, ...y].map((frame) => frame.atMs))].sort((a, b) => a - b);
  const at = (lane: readonly Keyframe[], ms: number, fallback: number) => (lane.length === 0 ? fallback : valueAt(lane, ms));
  return times.map((atMs) => ({ atMs, x: at(x, atMs, still.x), y: at(y, atMs, still.y), easing: easingAt([x, y], atMs), spatial }));
}

function bakedTimes(keys: readonly PositionKeyframe[]): number[] {
  const first = keys[0].atMs;
  const span = keys[keys.length - 1].atMs - first;
  const own = keys.map((key) => key.atMs);
  const steps = Math.ceil(span / msOfFrame(1));
  const extra = Array.from({ length: Math.max(0, steps - 1) }, (_, i) => Math.round(first + (span * (i + 1)) / steps));
  return [...new Set([...own, ...extra])].sort((a, b) => a - b);
}

export function separatedLanes(keys: readonly PositionKeyframe[], aspect: number): { x: Keyframe[]; y: Keyframe[] } {
  if (keys.every((key) => spatialOf(key) === "linear")) {
    return { x: keys.map((key) => ({ atMs: key.atMs, value: key.x, easing: key.easing })), y: keys.map((key) => ({ atMs: key.atMs, value: key.y, easing: key.easing })) };
  }
  const [low, high] = KEYFRAME_RANGES.x;
  const inside = (value: number) => Math.min(high, Math.max(low, value));
  const samples = bakedTimes(keys).map((atMs) => ({ atMs, point: positionAt(keys, atMs, aspect) }));
  return {
    x: samples.map(({ atMs, point }) => ({ atMs, value: inside(point.x), easing: "linear" as const })),
    y: samples.map(({ atMs, point }) => ({ atMs, value: inside(point.y), easing: "linear" as const })),
  };
}
