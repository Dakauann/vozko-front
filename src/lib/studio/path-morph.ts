import { ease } from "./keyframes";
import type { MorphKeyframe, VertexPin } from "./morph-keys";
import { pathToSubpaths, subpathsToPath, type PathNode, type Subpath } from "./path-nodes";
import type { Point } from "./viewport";

interface Cubic {
  p0: Point;
  c1: Point;
  c2: Point;
  p3: Point;
}

interface Ring {
  closed: boolean;
  segments: Cubic[];
  point: Point;
}

interface Pin {
  subpath: number;
  node: number;
  point: Point;
}

interface PreparedPair {
  closed: boolean;
  from: Cubic[];
  to: Cubic[];
}

export interface MorphPins {
  from?: VertexPin;
  to?: VertexPin;
}

const THIRD = 1 / 3;
const AREA_SAMPLES = 8;
const CACHE_LIMIT = 128;
const prepared = new Map<string, PreparedPair[]>();

function at(point: Point): Point {
  return { x: point.x, y: point.y };
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function distanceSquared(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function cubicOf(from: PathNode, to: PathNode): Cubic {
  if (!from.out && !to.in) return { p0: at(from), c1: lerp(from, to, THIRD), c2: lerp(from, to, 2 * THIRD), p3: at(to) };
  return { p0: at(from), c1: at(from.out ?? from), c2: at(to.in ?? to), p3: at(to) };
}

function ringOf(subpath: Subpath): Ring {
  const nodes = subpath.nodes;
  const count = nodes.length < 2 ? 0 : subpath.closed ? nodes.length : nodes.length - 1;
  const segments = Array.from({ length: count }, (_, j) => cubicOf(nodes[j], nodes[(j + 1) % nodes.length]));
  return { closed: subpath.closed && count > 0, segments, point: nodes[0] ? at(nodes[0]) : { x: 0, y: 0 } };
}

function anchors(ring: Ring): Point[] {
  if (ring.segments.length === 0) return [ring.point];
  const starts = ring.segments.map((segment) => segment.p0);
  return ring.closed ? starts : [...starts, ring.segments[ring.segments.length - 1].p3];
}

function centroid(ring: Ring): Point {
  const points = anchors(ring);
  return { x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length };
}

function collapsed(point: Point, closed: boolean, count: number): Ring {
  const segments = Array.from({ length: count }, () => ({ p0: at(point), c1: at(point), c2: at(point), p3: at(point) }));
  return { closed, segments, point: at(point) };
}

function splitCubic(c: Cubic, t: number): [Cubic, Cubic] {
  const q0 = lerp(c.p0, c.c1, t);
  const q1 = lerp(c.c1, c.c2, t);
  const q2 = lerp(c.c2, c.p3, t);
  const r0 = lerp(q0, q1, t);
  const r1 = lerp(q1, q2, t);
  const middle = lerp(r0, r1, t);
  return [
    { p0: c.p0, c1: q0, c2: r0, p3: middle },
    { p0: middle, c1: r1, c2: q2, p3: c.p3 },
  ];
}

function cubicLength(c: Cubic): number {
  const hull = Math.sqrt(distanceSquared(c.p0, c.c1)) + Math.sqrt(distanceSquared(c.c1, c.c2)) + Math.sqrt(distanceSquared(c.c2, c.p3));
  return (hull + Math.sqrt(distanceSquared(c.p0, c.p3))) / 2;
}

function resampled(ring: Ring, count: number): Ring {
  const segments = [...ring.segments];
  const lengths = segments.map(cubicLength);
  while (segments.length < count) {
    let longest = 0;
    for (let i = 1; i < lengths.length; i++) if (lengths[i] > lengths[longest]) longest = i;
    const halves = splitCubic(segments[longest], 0.5);
    segments.splice(longest, 1, ...halves);
    lengths.splice(longest, 1, ...halves.map(cubicLength));
  }
  return { ...ring, segments };
}

function rotated(ring: Ring, start: number): Ring {
  const count = ring.segments.length;
  if (!ring.closed || count === 0) return ring;
  const k = ((start % count) + count) % count;
  return { ...ring, segments: [...ring.segments.slice(k), ...ring.segments.slice(0, k)], point: ring.segments[k].p0 };
}

function reversedCubic(c: Cubic): Cubic {
  return { p0: c.p3, c1: c.c2, c2: c.c1, p3: c.p0 };
}

function reversed(ring: Ring): Ring {
  const segments = [...ring.segments].reverse().map(reversedCubic);
  return { ...ring, segments, point: segments[0]?.p0 ?? ring.point };
}

function signedArea(ring: Ring): number {
  let area = 0;
  for (const c of ring.segments) {
    let previous = c.p0;
    for (let i = 1; i <= AREA_SAMPLES; i++) {
      const t = i / AREA_SAMPLES;
      const u = 1 - t;
      const next = {
        x: u * u * u * c.p0.x + 3 * u * u * t * c.c1.x + 3 * u * t * t * c.c2.x + t * t * t * c.p3.x,
        y: u * u * u * c.p0.y + 3 * u * u * t * c.c1.y + 3 * u * t * t * c.c2.y + t * t * t * c.p3.y,
      };
      area += previous.x * next.y - next.x * previous.y;
      previous = next;
    }
  }
  return area / 2;
}

function nearestStart(ring: Ring, target: Point): number {
  const points = anchors(ring);
  let best = 0;
  for (let i = 1; i < points.length; i++) if (distanceSquared(points[i], target) < distanceSquared(points[best], target)) best = i;
  return best;
}

function pinned(ring: Ring, pin: Pin | null): Ring {
  if (!pin || ring.segments.length === 0) return ring;
  if (ring.closed) return rotated(ring, pin.node);
  const points = anchors(ring);
  return distanceSquared(pin.point, points[points.length - 1]) < distanceSquared(pin.point, points[0]) ? reversed(ring) : ring;
}

function bestRotation(a: Ring, b: Ring): number {
  const from = anchors(a);
  const to = anchors(b);
  const count = from.length;
  let best = 0;
  let bestCost = Infinity;
  for (let r = 0; r < count; r++) {
    let cost = 0;
    for (let i = 0; i < count && cost < bestCost; i++) cost += distanceSquared(from[i], to[(i + r) % count]);
    if (cost < bestCost) {
      bestCost = cost;
      best = r;
    }
  }
  return best;
}

function crossedBetter(a: Ring, b: Ring): boolean {
  const from = anchors(a);
  const to = anchors(b);
  const [a0, a1, b0, b1] = [from[0], from[from.length - 1], to[0], to[to.length - 1]];
  return distanceSquared(a0, b1) + distanceSquared(a1, b0) < distanceSquared(a0, b0) + distanceSquared(a1, b1);
}

function opened(ring: Ring, partner: Ring, pin: Pin | null): Ring {
  const start = pin ? ring : rotated(ring, nearestStart(ring, anchors(partner)[0]));
  return { ...start, closed: false };
}

function preparedPair(source: Ring, target: Ring, pinA: Pin | null, pinB: Pin | null): PreparedPair {
  let a = source.segments.length === 0 && target.segments.length > 0 ? collapsed(source.point, target.closed, target.segments.length) : pinned(source, pinA);
  let b = target.segments.length === 0 && source.segments.length > 0 ? collapsed(target.point, source.closed, source.segments.length) : pinned(target, pinB);
  if (a.segments.length === 0 && b.segments.length === 0) {
    a = collapsed(a.point, false, 1);
    b = collapsed(b.point, false, 1);
  }
  const anchored = pinA !== null || pinB !== null;
  if (a.closed !== b.closed) {
    if (a.closed) a = opened(a, b, pinA);
    else b = opened(b, a, pinB);
  }
  if (a.closed && b.closed && Math.sign(signedArea(a)) * Math.sign(signedArea(b)) < 0) b = reversed(b);
  if (!a.closed && !b.closed && !anchored && crossedBetter(a, b)) b = reversed(b);
  const count = Math.max(a.segments.length, b.segments.length);
  a = resampled(a, count);
  b = resampled(b, count);
  if (a.closed && b.closed && !anchored) b = rotated(b, bestRotation(a, b));
  return { closed: a.closed && b.closed, from: a.segments, to: b.segments };
}

function pinOf(subpaths: readonly Subpath[], pin: VertexPin | undefined): Pin | null {
  if (!pin) return null;
  let best: Pin | null = null;
  let bestDistance = Infinity;
  subpaths.forEach((subpath, s) =>
    subpath.nodes.forEach((node, n) => {
      const distance = distanceSquared(node, pin);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { subpath: s, node: n, point: at(pin) };
      }
    }),
  );
  return best;
}

function preparedMorph(from: string, to: string, pins: MorphPins): PreparedPair[] {
  const key = JSON.stringify([from, to, pins.from ?? null, pins.to ?? null]);
  const known = prepared.get(key);
  if (known) return known;
  const a = pathToSubpaths(from);
  const b = pathToSubpaths(to);
  const pinA = pinOf(a, pins.from);
  const pinB = pinOf(b, pins.to);
  const pairs: PreparedPair[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ringA = a[i] ? ringOf(a[i]) : null;
    const ringB = b[i] ? ringOf(b[i]) : null;
    const source = ringA ?? collapsed(centroid(ringB!), ringB!.closed, ringB!.segments.length);
    const target = ringB ?? collapsed(centroid(ringA!), ringA!.closed, ringA!.segments.length);
    pairs.push(preparedPair(source, target, pinA?.subpath === i ? pinA : null, pinB?.subpath === i ? pinB : null));
  }
  if (prepared.size >= CACHE_LIMIT) prepared.clear();
  prepared.set(key, pairs);
  return pairs;
}

function blended(a: Cubic, b: Cubic, w: number): Cubic {
  return { p0: lerp(a.p0, b.p0, w), c1: lerp(a.c1, b.c1, w), c2: lerp(a.c2, b.c2, w), p3: lerp(a.p3, b.p3, w) };
}

function subpathOf(segments: readonly Cubic[], closed: boolean): Subpath {
  const count = segments.length;
  if (closed) return { closed, nodes: segments.map((s, i) => ({ x: s.p0.x, y: s.p0.y, in: segments[(i - 1 + count) % count].c2, out: s.c1 })) };
  const nodes: PathNode[] = segments.map((s, i) => ({ x: s.p0.x, y: s.p0.y, ...(i > 0 ? { in: segments[i - 1].c2 } : {}), out: s.c1 }));
  const last = segments[count - 1];
  nodes.push({ x: last.p3.x, y: last.p3.y, in: last.c2 });
  return { closed, nodes };
}

export function morphPath(from: string, to: string, weight: number, pins: MorphPins = {}): string {
  const pairs = preparedMorph(from, to, pins);
  return subpathsToPath(pairs.map((pair) => subpathOf(pair.from.map((segment, i) => blended(segment, pair.to[i], weight)), pair.closed)));
}

export function morphAt(frames: readonly MorphKeyframe[], atMs: number): string {
  const first = frames[0];
  if (!first) return "";
  if (atMs <= first.atMs) return first.path;
  for (let i = 0; i < frames.length - 1; i++) {
    const from = frames[i];
    const to = frames[i + 1];
    if (atMs >= to.atMs) continue;
    const weight = ease(from.easing, (atMs - from.atMs) / (to.atMs - from.atMs));
    if (weight === 0) return from.path;
    if (weight === 1) return to.path;
    return morphPath(from.path, to.path, weight, { from: from.firstVertex, to: to.firstVertex });
  }
  return frames[frames.length - 1].path;
}

export function pathVertices(path: string): Point[] {
  return pathToSubpaths(path).flatMap((subpath) => subpath.nodes.map(at));
}

export function vertexPin(path: string, index: number): VertexPin | null {
  const vertex = Number.isInteger(index) ? pathVertices(path)[index] : undefined;
  return vertex ? { x: vertex.x, y: vertex.y } : null;
}

export function vertexIndex(path: string, pin: VertexPin): number {
  const vertices = pathVertices(path);
  let best = 0;
  for (let i = 1; i < vertices.length; i++) if (distanceSquared(vertices[i], pin) < distanceSquared(vertices[best], pin)) best = i;
  return best;
}
