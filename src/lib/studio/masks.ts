import { editFieldValue, fieldKeyState, fieldValue, lanesIssue, setFieldKey, setFieldLane, toggleFieldKey, type AnimatedFields } from "./animated-fields";
import type { KeyState } from "./keyframe-edit";
import { faultIssue, morphLaneFault, type Keyframe } from "./keyframes";
import type { MorphKeyframe, VertexPin } from "./morph-keys";
import { morphAt } from "./path-morph";
import { starPolygon } from "./paint";
import { flattenSegment, pathToSubpaths, segmentCount } from "./path-nodes";
import { isValidToken } from "./tokens";
import type { IssueCode } from "./validate";
import { isValidPath } from "./vector-path";

export const MASK_SHAPES = ["rectangle", "ellipse", "linear", "mirror", "star", "heart", "triangle", "path"] as const;
export type MaskShape = (typeof MASK_SHAPES)[number];

export const MASK_MODES = ["add", "subtract", "intersect"] as const;
export type MaskMode = (typeof MASK_MODES)[number];

export const MASK_PROPERTIES = ["x", "y", "w", "h", "rotation", "roundness", "inner", "feather", "expansion", "opacity"] as const;
export type MaskProperty = (typeof MASK_PROPERTIES)[number];

export interface Mask {
  id: string;
  shape: MaskShape;
  mode: MaskMode;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  roundness?: number;
  points?: number;
  inner?: number;
  path?: string;
  feather: number;
  expansion: number;
  opacity: number;
  invert?: boolean;
  keyframes?: MaskKeyframes;
}

export type MaskKeyframes = Partial<Record<MaskProperty, Keyframe[]>> & { path?: MorphKeyframe[] };

export const MASK_RANGES: Record<MaskProperty, readonly [number, number]> = {
  x: [-1, 2],
  y: [-1, 2],
  w: [0.001, 4],
  h: [0.001, 4],
  rotation: [-3600, 3600],
  roundness: [0, 1],
  inner: [0.05, 1],
  feather: [0, 0.5],
  expansion: [-0.5, 0.5],
  opacity: [0, 1],
};

export const MASK_POINTS_RANGE = [3, 64] as const;
export const MASK_STAR_DEFAULTS = { points: 5, inner: 0.45 } as const;
export const MASK_DEFAULT_PATH = "M0.5 0 L1 0.5 L0.5 1 L0 0.5 Z";

const AA_PX = 0.75;
const HEART_STEPS = 48;
const PATH_STEP = 0.02;

const SHAPED: Partial<Record<MaskShape, MaskProperty[]>> = { linear: ["x", "y", "rotation"], mirror: ["x", "y", "h", "rotation"], rectangle: ["x", "y", "w", "h", "rotation", "roundness"], star: ["x", "y", "w", "h", "rotation", "inner"] };

export function maskProperties(shape: MaskShape): MaskProperty[] {
  return [...(SHAPED[shape] ?? ["x", "y", "w", "h", "rotation"]), "feather", "expansion", "opacity"];
}

export function newMask(shape: MaskShape, id: string): Mask {
  return {
    id,
    shape,
    mode: "add",
    x: 0.5,
    y: 0.5,
    w: 0.5,
    h: 0.5,
    rotation: 0,
    feather: 0,
    expansion: 0,
    opacity: 1,
    ...(shape === "star" ? MASK_STAR_DEFAULTS : {}),
    ...(shape === "path" ? { path: MASK_DEFAULT_PATH } : {}),
  };
}

const SHAPE_ONLY: Partial<Record<MaskProperty | "points" | "path", MaskShape>> = { roundness: "rectangle", points: "star", inner: "star", path: "path" };

export function reshapeMask(mask: Mask, shape: MaskShape): Mask {
  const next: Mask = { ...mask, shape };
  const keyframes = { ...mask.keyframes };
  for (const [field, owner] of Object.entries(SHAPE_ONLY)) {
    if (owner === shape) continue;
    delete (next as unknown as Record<string, unknown>)[field];
    delete keyframes[field as MaskProperty];
  }
  if (shape === "star") Object.assign(next, { points: mask.points ?? MASK_STAR_DEFAULTS.points, inner: mask.inner ?? MASK_STAR_DEFAULTS.inner });
  if (shape === "path") next.path = mask.path ?? MASK_DEFAULT_PATH;
  if (Object.keys(keyframes).length > 0) next.keyframes = keyframes;
  else delete next.keyframes;
  return next;
}

function staticValue(mask: Mask, property: MaskProperty): number {
  if (property === "roundness") return mask.roundness ?? 0;
  if (property === "inner") return mask.inner ?? MASK_STAR_DEFAULTS.inner;
  return mask[property];
}

const MASK_FIELDS: AnimatedFields<Mask, MaskProperty> = {
  staticValue,
  withStatic: (mask, property, value) => ({ ...mask, [property]: value }),
  range: (property) => MASK_RANGES[property],
};

export function maskValue(mask: Mask, property: MaskProperty, localMs: number): number {
  return fieldValue(MASK_FIELDS, mask, property, localMs);
}

export function maskPathAt(mask: Mask, localMs: number): string {
  const frames = mask.keyframes?.path ?? [];
  return frames.length > 0 ? morphAt(frames, localMs) : (mask.path ?? "");
}

export function maskAt(mask: Mask, localMs: number): Mask {
  if (!mask.keyframes) return mask;
  const resolved: Mask = { ...mask };
  for (const property of MASK_PROPERTIES) if (mask.keyframes[property]?.length) (resolved as Record<MaskProperty, number>)[property] = maskValue(mask, property, localMs);
  if (mask.keyframes.path?.length) resolved.path = maskPathAt(mask, localMs);
  return resolved;
}

function withPathLane(mask: Mask, frames: readonly MorphKeyframe[], still: string): Mask {
  const lanes: MaskKeyframes = { ...mask.keyframes };
  if (frames.length > 0) lanes.path = [...frames].sort((a, b) => a.atMs - b.atMs);
  else delete lanes.path;
  const next: Mask = { ...mask, path: frames.length > 0 ? mask.path : still };
  if (Object.keys(lanes).length > 0) next.keyframes = lanes;
  else delete next.keyframes;
  return next;
}

export function setMaskPathLane(mask: Mask, frames: readonly MorphKeyframe[]): Mask {
  return withPathLane(mask, frames, maskPathAt(mask, frames[0]?.atMs ?? 0));
}

export function setMaskPathKey(mask: Mask, atMs: number, path: string): Mask {
  const frames = mask.keyframes?.path ?? [];
  const existing = frames.find((frame) => frame.atMs === atMs);
  const placed: MorphKeyframe = existing ? { ...existing, path } : { atMs, path, easing: "linear" };
  return withPathLane(mask, [...frames.filter((frame) => frame.atMs !== atMs), placed], mask.path ?? path);
}

export function toggleMaskPathKey(mask: Mask, atMs: number): Mask {
  const frames = mask.keyframes?.path ?? [];
  const existing = frames.find((frame) => frame.atMs === atMs);
  if (!existing) return setMaskPathKey(mask, atMs, maskPathAt(mask, atMs));
  return withPathLane(mask, frames.filter((frame) => frame !== existing), existing.path);
}

export function setMaskPathVertex(mask: Mask, atMs: number, pin: VertexPin | null): Mask | null {
  const frames = mask.keyframes?.path ?? [];
  const existing = frames.find((frame) => frame.atMs === atMs);
  if (!existing) return null;
  const placed: MorphKeyframe = { ...existing };
  if (pin) placed.firstVertex = { x: pin.x, y: pin.y };
  else delete placed.firstVertex;
  return withPathLane(mask, frames.map((frame) => (frame === existing ? placed : frame)), mask.path ?? existing.path);
}

export function editMaskPath(mask: Mask, path: string, localMs: number | null): Mask | null {
  if (!mask.keyframes?.path?.length) return { ...mask, path };
  return localMs === null ? null : setMaskPathKey(mask, localMs, path);
}

export function maskPathKeyState(mask: Mask, localMs: number | null): KeyState {
  const frames = mask.keyframes?.path ?? [];
  if (frames.length === 0) return "static";
  return localMs !== null && frames.some((frame) => frame.atMs === localMs) ? "key" : "interpolated";
}

export function shiftMaskKeys(masks: readonly Mask[], deltaMs: number): Mask[] {
  return masks.map((mask) => {
    if (!mask.keyframes) return mask;
    const lanes = Object.fromEntries(Object.entries(mask.keyframes).map(([property, frames]) => [property, (frames as { atMs: number }[]).map((frame) => ({ ...frame, atMs: frame.atMs + deltaMs }))]));
    return { ...mask, keyframes: lanes as MaskKeyframes };
  });
}

export function masksAt(masks: readonly Mask[], localMs: number): Mask[] {
  return masks.map((mask) => maskAt(mask, localMs));
}

export function setMaskKey(mask: Mask, property: MaskProperty, atMs: number, value: number): Mask {
  return setFieldKey(MASK_FIELDS, mask, property, atMs, value);
}

export function setMaskLane(mask: Mask, property: MaskProperty, frames: readonly Keyframe[]): Mask {
  return setFieldLane(MASK_FIELDS, mask, property, frames);
}

export function toggleMaskKey(mask: Mask, property: MaskProperty, atMs: number): Mask {
  return toggleFieldKey(MASK_FIELDS, mask, property, atMs);
}

export function maskKeyState(mask: Mask, property: MaskProperty, localMs: number | null): KeyState {
  return fieldKeyState(mask, property, localMs);
}

export function editMaskValue(mask: Mask, property: MaskProperty, value: number, localMs: number | null): Mask | null {
  return editFieldValue(MASK_FIELDS, mask, property, value, localMs);
}

type Point = [number, number];

interface Prepared {
  mask: Mask;
  distance: (lx: number, ly: number) => number;
  cos: number;
  sin: number;
  cx: number;
  cy: number;
  feather: number;
  expansion: number;
}

function polygonDistance(points: readonly Point[]): (x: number, y: number) => number {
  return (x, y) => {
    let best = Infinity;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [ax, ay] = points[j];
      const [bx, by] = points[i];
      const ex = bx - ax;
      const ey = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1)));
      best = Math.min(best, Math.hypot(x - ax - ex * t, y - ay - ey * t));
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    }
    return inside ? -best : best;
  };
}

function boxPolygon(flat: readonly number[], hw: number, hh: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < flat.length; i += 2) points.push([flat[i] - hw, flat[i + 1] - hh]);
  return points;
}

function heartPolygon(hw: number, hh: number): Point[] {
  const raw = Array.from({ length: HEART_STEPS }, (_, i): Point => {
    const t = (2 * Math.PI * i) / HEART_STEPS;
    return [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))];
  });
  const xs = raw.map(([x]) => x);
  const ys = raw.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return raw.map(([x, y]) => [((x - minX) / (maxX - minX) - 0.5) * 2 * hw, ((y - minY) / (maxY - minY) - 0.5) * 2 * hh]);
}

function pathPolygons(path: string, hw: number, hh: number): Point[][] {
  return pathToSubpaths(path).flatMap((subpath) => {
    if (subpath.nodes.length < 2) return [];
    const unit = [{ x: subpath.nodes[0].x, y: subpath.nodes[0].y }];
    for (let s = 0; s < segmentCount(subpath); s++) unit.push(...flattenSegment(subpath, s, PATH_STEP));
    return [unit.map((p): Point => [(p.x - 0.5) * 2 * hw, (p.y - 0.5) * 2 * hh])];
  });
}

function evenOddDistance(polygons: readonly Point[][]): (x: number, y: number) => number {
  const parts = polygons.map(polygonDistance);
  return (x, y) => {
    let best = Infinity;
    let inside = false;
    for (const part of parts) {
      const d = part(x, y);
      if (d < 0) inside = !inside;
      best = Math.min(best, Math.abs(d));
    }
    return inside ? -best : best;
  };
}

function roundedBox(hw: number, hh: number, radius: number): (x: number, y: number) => number {
  return (x, y) => {
    const qx = Math.abs(x) - hw + radius;
    const qy = Math.abs(y) - hh + radius;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
  };
}

function ellipse(hw: number, hh: number): (x: number, y: number) => number {
  return (x, y) => (Math.hypot(x / Math.max(hw, 1e-6), y / Math.max(hh, 1e-6)) - 1) * Math.min(hw, hh);
}

function shapeDistance(mask: Mask, hw: number, hh: number): (x: number, y: number) => number {
  switch (mask.shape) {
    case "rectangle":
      return roundedBox(hw, hh, (mask.roundness ?? 0) * Math.min(hw, hh));
    case "ellipse":
      return ellipse(hw, hh);
    case "linear":
      return (x) => x;
    case "mirror":
      return (_, y) => Math.abs(y) - hh;
    case "triangle":
      return polygonDistance(boxPolygon([hw, 0, 2 * hw, 2 * hh, 0, 2 * hh], hw, hh));
    case "star":
      return polygonDistance(boxPolygon(starPolygon({ points: mask.points ?? MASK_STAR_DEFAULTS.points, inner: mask.inner ?? MASK_STAR_DEFAULTS.inner }, 2 * hw, 2 * hh), hw, hh));
    case "heart":
      return polygonDistance(heartPolygon(hw, hh));
    case "path":
      return evenOddDistance(pathPolygons(mask.path ?? "", hw, hh));
  }
}

export function prepareMasks(masks: readonly Mask[], width: number, height: number): Prepared[] {
  const unit = Math.min(width, height);
  return masks.map((mask) => {
    const radians = (-mask.rotation * Math.PI) / 180;
    return {
      mask,
      distance: shapeDistance(mask, (mask.w * width) / 2, (mask.h * height) / 2),
      cos: Math.cos(radians),
      sin: Math.sin(radians),
      cx: mask.x * width,
      cy: mask.y * height,
      feather: mask.feather * unit,
      expansion: mask.expansion * unit,
    };
  });
}

function edgeCoverage(distance: number, feather: number): number {
  const band = Math.max(feather, AA_PX);
  const t = Math.min(1, Math.max(0, (distance + band / 2) / band));
  return 1 - t * t * (3 - 2 * t);
}

export function preparedCoverage(prepared: readonly Prepared[], px: number, py: number): number {
  if (prepared.length === 0) return 1;
  let alpha = prepared[0].mask.mode === "add" ? 0 : 1;
  for (const p of prepared) {
    const dx = px - p.cx;
    const dy = py - p.cy;
    const lx = dx * p.cos - dy * p.sin;
    const ly = dx * p.sin + dy * p.cos;
    let m = p.mask.opacity * edgeCoverage(p.distance(lx, ly) - p.expansion, p.feather);
    if (p.mask.invert) m = 1 - m;
    if (p.mask.mode === "add") alpha = Math.max(alpha, m);
    else if (p.mask.mode === "subtract") alpha *= 1 - m;
    else alpha *= m;
  }
  return alpha;
}

export function maskCoverage(masks: readonly Mask[], u: number, v: number, width: number, height: number): number {
  return preparedCoverage(prepareMasks(masks, width, height), u * width, v * height);
}

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

function oneMaskIssue(mask: Mask): IssueCode | null {
  if (!(MASK_SHAPES as readonly string[]).includes(mask.shape) || !(MASK_MODES as readonly string[]).includes(mask.mode)) return "unknown";
  const star = mask.shape === "star";
  if ((!star && (mask.points ?? 0) !== 0) || (!star && (mask.inner ?? 0) !== 0) || (mask.shape !== "rectangle" && (mask.roundness ?? 0) !== 0)) return "invalid";
  if ((mask.shape === "path") !== Boolean(mask.path) || (mask.path && !isValidPath(mask.path))) return "invalid";
  if (star && (mask.points ?? 0) !== 0 && !(Number.isInteger(mask.points) && within(mask.points!, MASK_POINTS_RANGE))) return "out_of_range";
  for (const property of MASK_PROPERTIES) {
    const value = (mask as unknown as Record<string, number | undefined>)[property];
    const absent = value === undefined || (property === "inner" && value === 0);
    if (!absent && !within(value, MASK_RANGES[property])) return "out_of_range";
  }
  const { path: morph, ...lanes } = mask.keyframes ?? {};
  if ((morph?.length ?? 0) > 0) {
    if (mask.shape !== "path") return "invalid";
    const fault = morphLaneFault(morph!);
    if (fault) return faultIssue(fault);
  }
  return lanesIssue(lanes, (property) => ((MASK_PROPERTIES as readonly string[]).includes(property) ? MASK_RANGES[property as MaskProperty] : null));
}

export function maskIssue(masks: readonly Mask[]): IssueCode | null {
  const ids = new Set<string>();
  for (const mask of masks) {
    if (!isValidToken(mask.id) || ids.has(mask.id)) return "invalid";
    ids.add(mask.id);
    const issue = oneMaskIssue(mask);
    if (issue) return issue;
  }
  return null;
}

export const MASK_RASTER_MAX = 768;
export const MASK_RASTER_MIN = 32;

export function maskRasterSize(boxWidth: number, boxHeight: number, scale: number): { width: number; height: number } {
  const long = Math.max(boxWidth, boxHeight) * scale;
  const side = Math.min(MASK_RASTER_MAX, Math.max(MASK_RASTER_MIN, Math.round(long)));
  const ratio = side / Math.max(boxWidth, boxHeight);
  return { width: Math.max(1, Math.round(boxWidth * ratio)), height: Math.max(1, Math.round(boxHeight * ratio)) };
}

export function rasterizeMasks(masks: readonly Mask[], width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const prepared = prepareMasks(masks, width, height);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(preparedCoverage(prepared, x + 0.5, y + 0.5) * 255);
    }
  }
  return data;
}
