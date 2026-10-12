import { arrowheadSize, endKind, endMark, headTriangle, strokedArrowEnds } from "./arrowheads";
import type { Layer, LineCap, LineJoin } from "./document";
import type { LineTaper, ResolvedLine, ResolvedTrim } from "./line-animation";
import { strokeStyle } from "./paint";
import { flattenSegment, mapSubpaths, pathToSubpaths, segmentCount, type Subpath } from "./path-nodes";
import { vectorLayerOf } from "./vector-layer";
import type { Point } from "./viewport";

export interface LinePoint {
  x: number;
  y: number;
  width: number;
}

export interface LineRun {
  points: LinePoint[];
  closed: boolean;
}

export interface LineHead {
  points: number[];
  stroked: boolean;
}

export interface LineFrame {
  runs: LineRun[];
  heads: LineHead[];
  width: number;
  uniform: boolean;
  cap: LineCap;
  join: LineJoin;
  miterLimit: number;
  color: string;
}

export interface LineFrameInput {
  layer: Layer;
  widthPx: number;
  heightPx: number;
  line: ResolvedLine;
  color: string;
  step: number;
}

export interface BasePath {
  closed: boolean;
  x: number[];
  y: number[];
  s: number[];
  nx: number[];
  ny: number[];
  length: number;
}

export interface Sample {
  x: number;
  y: number;
  nx: number;
  ny: number;
  s: number;
  u: number;
}

interface RunSamples {
  samples: Sample[];
  closed: boolean;
  path: number;
  from: number;
  to: number;
  reference: number;
}

interface Placed {
  x: number;
  y: number;
  width: number;
  u: number;
}

const CURVE_STEP = 1;
const EPSILON = 1e-9;
const BASE_CACHE_LIMIT = 32;
const DOT_PX = 1e-3;
const WIGGLE_OCTAVE_WEIGHT = 0.5;
const bases = new Map<string, BasePath[]>();

function outlineSubpaths(layer: Layer, widthPx: number, heightPx: number, w: number, h: number): Subpath[] {
  if (layer.shape === "line" || layer.shape === "arrow") return [{ closed: false, nodes: [{ x: 0, y: h / 2 }, { x: w, y: h / 2 }] }];
  const vector = vectorLayerOf(layer, { width: widthPx, height: heightPx });
  return mapSubpaths(pathToSubpaths(vector?.path ?? ""), (p) => ({ x: p.x * w, y: p.y * h }));
}

function polyline(subpath: Subpath, step: number): { x: number[]; y: number[] } {
  const corners: Point[] = [subpath.nodes[0]];
  for (let segment = 0; segment < segmentCount(subpath); segment++) corners.push(...flattenSegment(subpath, segment, CURVE_STEP));
  if (subpath.closed) corners.pop();
  const x: number[] = [];
  const y: number[] = [];
  const edges = subpath.closed ? corners.length : corners.length - 1;
  for (let i = 0; i < edges; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const pieces = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k < pieces; k++) {
      x.push(a.x + ((b.x - a.x) * k) / pieces);
      y.push(a.y + ((b.y - a.y) * k) / pieces);
    }
  }
  if (!subpath.closed) {
    const last = corners[corners.length - 1];
    x.push(last.x);
    y.push(last.y);
  }
  return { x, y };
}

export function basePath(subpath: Subpath, step: number): BasePath | null {
  if (subpath.nodes.length < 2) return null;
  const { x, y } = polyline(subpath, step);
  const count = x.length;
  const edges = subpath.closed ? count : count - 1;
  const s = [0];
  const ex: number[] = [];
  const ey: number[] = [];
  for (let i = 0; i < edges; i++) {
    const j = (i + 1) % count;
    const dx = x[j] - x[i];
    const dy = y[j] - y[i];
    const length = Math.hypot(dx, dy);
    ex.push(length > EPSILON ? -dy / length : 0);
    ey.push(length > EPSILON ? dx / length : 0);
    s.push(s[i] + length);
  }
  const length = s[edges];
  if (length <= EPSILON) return null;
  const nx: number[] = [];
  const ny: number[] = [];
  for (let i = 0; i < count; i++) {
    const before = subpath.closed ? (i - 1 + edges) % edges : Math.max(0, i - 1);
    const after = subpath.closed ? i % edges : Math.min(edges - 1, i);
    const mx = ex[before] + ex[after];
    const my = ey[before] + ey[after];
    const size = Math.hypot(mx, my);
    nx.push(size > EPSILON ? mx / size : ex[after]);
    ny.push(size > EPSILON ? my / size : ey[after]);
  }
  return { closed: subpath.closed, x, y, s: s.slice(0, count), nx, ny, length };
}

function cachedBases(layer: Layer, widthPx: number, heightPx: number, w: number, h: number, step: number): BasePath[] {
  const key = JSON.stringify([layer.shape, layer.path, layer.radius, layer.points, layer.inner, w, h, step]);
  const known = bases.get(key);
  if (known) return known;
  const built = outlineSubpaths(layer, widthPx, heightPx, w, h)
    .map((subpath) => basePath(subpath, step))
    .filter((base): base is BasePath => base !== null);
  if (bases.size >= BASE_CACHE_LIMIT) bases.delete(bases.keys().next().value!);
  bases.set(key, built);
  return built;
}

function locate(base: BasePath, s: number): number {
  let low = 0;
  let high = base.s.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (base.s[middle] <= s) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function sampleAt(base: BasePath, u: number): Sample {
  const s = base.closed ? ((u % base.length) + base.length) % base.length : Math.min(base.length, Math.max(0, u));
  const i = locate(base, s);
  const j = base.closed ? (i + 1) % base.x.length : Math.min(i + 1, base.x.length - 1);
  const next = j === 0 && base.closed ? base.length : base.s[j];
  const span = next - base.s[i];
  const t = span > EPSILON ? (s - base.s[i]) / span : 0;
  const nx = base.nx[i] + (base.nx[j] - base.nx[i]) * t;
  const ny = base.ny[i] + (base.ny[j] - base.ny[i]) * t;
  const size = Math.hypot(nx, ny) || 1;
  return { x: base.x[i] + (base.x[j] - base.x[i]) * t, y: base.y[i] + (base.y[j] - base.y[i]) * t, nx: nx / size, ny: ny / size, s, u };
}

function vertexSample(base: BasePath, i: number, u: number): Sample {
  return { x: base.x[i], y: base.y[i], nx: base.nx[i], ny: base.ny[i], s: base.s[i], u };
}

function runSamples(base: BasePath, from: number, to: number): Sample[] {
  const samples: Sample[] = [sampleAt(base, from)];
  const laps = base.closed ? Math.floor(from / base.length) : 0;
  for (let lap = laps; lap * base.length < to; lap++) {
    const origin = lap * base.length;
    for (let i = 0; i < base.s.length; i++) {
      const u = origin + base.s[i];
      if (u > from + EPSILON && u < to - EPSILON) samples.push(vertexSample(base, i, u));
    }
  }
  samples.push(sampleAt(base, to));
  return samples;
}

function trimWindow(trim: ResolvedTrim | undefined): [number, number] | "full" | null {
  if (!trim) return "full";
  const offset = (((trim.offset / 360) % 1) + 1) % 1;
  const a = Math.min(1, Math.max(0, trim.start)) + offset;
  const b = Math.min(1, Math.max(0, trim.end)) + offset;
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  if (to - from >= 1 - EPSILON) return "full";
  if (to - from <= EPSILON) return null;
  return from >= 1 ? [from - 1, to - 1] : [from, to];
}

function windowsOn(length: number, closed: boolean, window: [number, number]): [number, number][] {
  const from = window[0] * length;
  const to = window[1] * length;
  if (to <= length + EPSILON || closed) return [[from, Math.min(to, closed ? to : length)]];
  return [
    [from, length],
    [0, to - length],
  ];
}

function trimmedRuns(paths: readonly BasePath[], trim: ResolvedTrim | undefined): RunSamples[] {
  const window = trimWindow(trim);
  if (window === null) return [];
  if (window === "full") return paths.map((base, path) => ({ samples: runSamples(base, 0, base.length), closed: base.closed, path, from: 0, to: base.length, reference: base.length }));
  if (!trim?.sequential) {
    return paths.flatMap((base, path) => windowsOn(base.length, base.closed, window).map(([from, to]) => ({ samples: runSamples(base, from, to), closed: false, path, from, to, reference: base.length })));
  }
  const total = paths.reduce((sum, base) => sum + base.length, 0);
  const runs: RunSamples[] = [];
  let origin = 0;
  paths.forEach((base, path) => {
    for (const [from, to] of windowsOn(total, false, window)) {
      const start = Math.max(from, origin) - origin;
      const end = Math.min(to, origin + base.length) - origin;
      if (end - start > EPSILON) runs.push({ samples: runSamples(base, start, end), closed: false, path, from: start, to: end, reference: total });
    }
    origin += base.length;
  });
  return runs;
}

function hash(ix: number, iy: number, seed: number, channel: number): number {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(seed + 0x9e37, 0x2c1b3c6d) ^ Math.imul(channel + 1, 0x297a2d39);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lattice(u: number, v: number, period: number, seed: number, channel: number): number {
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  const fu = fade(u - iu);
  const fv = fade(v - iv);
  const wrap = (i: number) => (period > 0 ? ((i % period) + period) % period : i);
  const a = hash(wrap(iu), iv, seed, channel);
  const b = hash(wrap(iu + 1), iv, seed, channel);
  const c = hash(wrap(iu), iv + 1, seed, channel);
  const d = hash(wrap(iu + 1), iv + 1, seed, channel);
  const top = a + (b - a) * fu;
  const bottom = c + (d - c) * fu;
  return top + (bottom - top) * fv;
}

export function wiggleNoise(u: number, v: number, period: number, seed: number, channel: number): number {
  const coarse = lattice(u, v, period, seed, channel * 2);
  const fine = lattice(u * 2, v * 2, period * 2, seed, channel * 2 + 1);
  return (coarse + WIGGLE_OCTAVE_WEIGHT * fine) / (1 + WIGGLE_OCTAVE_WEIGHT);
}

function taperCurve(p: number, ease: number): number {
  const shaped = ease >= 0 ? 1 - (1 - p) * (1 - p) : p * p;
  return p + (shaped - p) * Math.abs(ease);
}

function taperFactor(taper: LineTaper, distance: number, runLength: number, reference: number): number {
  let startZone = taper.startLength * reference;
  let endZone = taper.endLength * reference;
  if (startZone + endZone > runLength && startZone + endZone > 0) {
    const shrink = runLength / (startZone + endZone);
    startZone *= shrink;
    endZone *= shrink;
  }
  const side = (zone: number, d: number, width: number, ease: number) => (zone <= EPSILON || d >= zone ? 1 : width + (1 - width) * taperCurve(Math.max(0, d) / zone, ease));
  return Math.min(side(startZone, distance, taper.startWidth, taper.startEase), side(endZone, runLength - distance, taper.endWidth, taper.endEase));
}

function placedRun(run: RunSamples, base: BasePath, line: ResolvedLine, width: number): Placed[] {
  const { wave, wiggle, taper } = line;
  const waveLength = wave ? (base.closed ? base.length / Math.max(1, Math.round(base.length / wave.wavelength)) : wave.wavelength) : 1;
  const period = wiggle && base.closed ? Math.max(1, Math.round((base.length * wiggle.detail) / 100)) : 0;
  const runLength = run.to - run.from;
  return run.samples.map((sample) => {
    const angle = wave ? 2 * Math.PI * (sample.s / waveLength - wave.turns) : 0;
    const bend = wave?.mode === "bend" ? wave.amount * Math.sin(angle) : 0;
    let x = sample.x + sample.nx * bend;
    let y = sample.y + sample.ny * bend;
    if (wiggle && wiggle.size > 0) {
      const u = period > 0 ? (sample.s / base.length) * period : (sample.s * wiggle.detail) / 100;
      x += wiggle.size * wiggleNoise(u, wiggle.time, period, wiggle.seed, 0);
      y += wiggle.size * wiggleNoise(u, wiggle.time, period, wiggle.seed, 1);
    }
    const pulse = wave?.mode === "width" ? wave.amount * Math.sin(angle) : 0;
    const factor = taper ? taperFactor(taper, sample.u - run.from, runLength, run.reference) : 1;
    return { x, y, width: Math.max(0, (width + pulse) * factor), u: sample.u };
  });
}

function dashPattern(layer: Layer): number[] | null {
  const dash = strokeStyle(layer).dash;
  if (!dash || dash.length === 0) return null;
  const pattern = dash.length % 2 === 1 ? [...dash, ...dash] : dash;
  return pattern.reduce((sum, value) => sum + value, 0) > EPSILON ? pattern : null;
}

function between(a: Placed, b: Placed, u: number): Placed {
  const t = b.u - a.u > EPSILON ? (u - a.u) / (b.u - a.u) : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, width: a.width + (b.width - a.width) * t, u };
}

function dashed(points: readonly Placed[], pattern: readonly number[], offset: number): Placed[][] {
  const edges = [0];
  for (const value of pattern) edges.push(edges[edges.length - 1] + value);
  const cycle = edges[edges.length - 1];
  const inDash = (u: number) => {
    const r = (((u + offset) % cycle) + cycle) % cycle;
    let index = 0;
    while (index < pattern.length - 1 && r >= edges[index + 1]) index++;
    return index % 2 === 0;
  };
  const pieces: Placed[][] = [];
  let current: Placed[] | null = inDash(points[0].u) ? [points[0]] : null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const first = Math.floor((a.u + offset) / cycle);
    const last = Math.floor((b.u + offset) / cycle);
    for (let k = first; k <= last; k++) {
      for (let e = 0; e < edges.length - 1; e++) {
        const cut = k * cycle + edges[e] - offset;
        if (cut <= a.u + EPSILON || cut > b.u + EPSILON) continue;
        const point = between(a, b, cut);
        if (current) {
          current.push(point);
          pieces.push(current);
          current = null;
        } else current = [point];
      }
    }
    if (current && current[current.length - 1].u < b.u - EPSILON) current.push(b);
  }
  if (current) pieces.push(current);
  return pieces.filter((piece) => piece.length > 1);
}

function dotted(points: Placed[], cap: LineCap): Placed[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (cap === "butt" || points.length > 2 || Math.hypot(last.x - first.x, last.y - first.y) > DOT_PX) return points;
  return [first, { ...last, x: last.x + DOT_PX }];
}

function direction(points: readonly Placed[], fromEnd: boolean, reach: number): Point | null {
  const tip = fromEnd ? points[points.length - 1] : points[0];
  let travelledPx = 0;
  let previous = tip;
  for (let k = 1; k < points.length; k++) {
    const point = fromEnd ? points[points.length - 1 - k] : points[k];
    travelledPx += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
    if (travelledPx >= reach) break;
  }
  const dx = tip.x - previous.x;
  const dy = tip.y - previous.y;
  const length = Math.hypot(dx, dy);
  return length > EPSILON ? { x: dx / length, y: dy / length } : null;
}

function headsOf(layer: Layer, runs: readonly { run: RunSamples; points: Placed[] }[], paths: readonly BasePath[], width: number): LineHead[] {
  const startKind = endKind(layer, "start");
  const finishKind = endKind(layer, "end");
  if (!startKind && !finishKind) return [];
  const size = arrowheadSize(width);
  const strokedEnds = strokedArrowEnds(layer);
  const heads: LineHead[] = [];
  const head = (points: Placed[], fromEnd: boolean) => {
    const kind = fromEnd ? finishKind : startKind;
    const dir = direction(points, fromEnd, size);
    if (!dir || !kind) return;
    const tip = fromEnd ? points[points.length - 1] : points[0];
    const stroked = fromEnd ? strokedEnds.end : strokedEnds.start;
    const base = stroked ? { x: tip.x - dir.x * size, y: tip.y - dir.y * size } : tip;
    heads.push({ points: stroked ? headTriangle(base, dir, size) : endMark(kind, tip, dir, width), stroked });
  };
  paths.forEach((base, path) => {
    if (base.closed) return;
    const own = runs.filter((entry) => entry.run.path === path && entry.points.length > 1);
    if (own.length === 0) return;
    const earliest = own.reduce((best, entry) => (entry.run.from < best.run.from ? entry : best));
    const latest = own.reduce((best, entry) => (entry.run.to > best.run.to ? entry : best));
    head(earliest.points, false);
    head(latest.points, true);
  });
  return heads;
}

export function lineFrame({ layer, widthPx, heightPx, line, color, step }: LineFrameInput): LineFrame {
  const t = layer.transform;
  const w = t.w * widthPx;
  const h = t.h * heightPx;
  const width = layer.strokeWidth ?? 0;
  const style = strokeStyle(layer);
  const paths = cachedBases(layer, widthPx, heightPx, w, h, step);
  const placed = trimmedRuns(paths, line.trim).map((run) => ({ run, points: placedRun(run, paths[run.path], line, width) }));
  const pattern = dashPattern(layer);
  const angle = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = t.x * widthPx;
  const cy = t.y * heightPx;
  const toRaster = (point: { x: number; y: number }) => ({ x: cx + (point.x - w / 2) * cos - (point.y - h / 2) * sin, y: cy + (point.x - w / 2) * sin + (point.y - h / 2) * cos });
  const runs: LineRun[] = placed.flatMap(({ run, points }) => {
    const pieces = pattern ? dashed(points, pattern, style.dashOffset) : [points];
    const closed = run.closed && !pattern;
    return pieces.map((piece) => ({ closed, points: dotted(piece, style.lineCap).map((point) => ({ ...toRaster(point), width: point.width })) }));
  });
  const heads = headsOf(layer, placed, paths, width).map((head) => {
    const points: number[] = [];
    for (let i = 0; i < head.points.length; i += 2) {
      const mapped = toRaster({ x: head.points[i], y: head.points[i + 1] });
      points.push(mapped.x, mapped.y);
    }
    return { ...head, points };
  });
  const uniform = !line.taper && line.wave?.mode !== "width";
  return { runs, heads, width, uniform, cap: style.lineCap, join: style.lineJoin, miterLimit: style.miterLimit, color };
}
