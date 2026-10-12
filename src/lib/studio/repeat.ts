import type { Layer, StudioGroup } from "./document";
import { ancestry, groupParents, groupLayerIds } from "./groups";
import type { IssueCode } from "./validate";

export const REPEAT_MODES = ["radial", "grid", "mirror"] as const;

export type RepeatMode = (typeof REPEAT_MODES)[number];

export const REPEAT_DIRECTIONS = ["cw", "ccw"] as const;

export const REPEAT_LAYOUTS = ["grid", "brick-row", "brick-column"] as const;

export const REPEAT_FLIPS = ["horizontal", "vertical", "both"] as const;

export const MIRROR_SIDES = ["end", "start"] as const;

export type RepeatDirection = (typeof REPEAT_DIRECTIONS)[number];
export type RepeatLayout = (typeof REPEAT_LAYOUTS)[number];
export type RepeatFlip = (typeof REPEAT_FLIPS)[number];
export type MirrorSide = (typeof MIRROR_SIDES)[number];

export interface Repeat {
  mode: RepeatMode;
  count?: number;
  shown?: number;
  radius?: number;
  startAngle?: number;
  sweep?: number;
  direction?: RepeatDirection | "";
  upright?: boolean;
  reverseOverlap?: boolean;
  rows?: number;
  columns?: number;
  gapX?: number;
  gapY?: number;
  layout?: RepeatLayout | "";
  offset?: number;
  flipRows?: RepeatFlip | "";
  flipColumns?: RepeatFlip | "";
  angle?: number;
  gap?: number;
  side?: MirrorSide | "";
}

export const REPEAT_RANGES = {
  radius: [1, 4096],
  startAngle: [-180, 180],
  sweep: [1, 360],
  gap: [-4096, 4096],
  offset: [0, 1],
  angle: [0, 180],
} as const;

export interface RepeatBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const RADIAL_FIELDS = ["count", "shown", "radius", "startAngle", "sweep", "direction", "upright", "reverseOverlap"] as const;
const GRID_FIELDS = ["rows", "columns", "gapX", "gapY", "layout", "offset", "flipRows", "flipColumns"] as const;
const MIRROR_FIELDS = ["angle", "gap", "side"] as const;
const FIELDS: Record<RepeatMode, readonly (keyof Repeat)[]> = { radial: RADIAL_FIELDS, grid: GRID_FIELDS, mirror: MIRROR_FIELDS };
const ALL_FIELDS = [...RADIAL_FIELDS, ...GRID_FIELDS, ...MIRROR_FIELDS];
const FULL_TURN = 360;
const DEFAULT_COUNT = 8;
const DEFAULT_START = -90;
const DEFAULT_CELLS = 3;
const DEFAULT_AXIS = 90;
const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function within(value: number, [lo, hi]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= lo && value <= hi;
}

function oneOf(value: string | undefined, allowed: readonly string[]): boolean {
  return (value ?? "") === "" || allowed.includes(value ?? "");
}

function absent(value: unknown): boolean {
  return value === undefined || value === 0 || value === "" || value === false;
}

function wholeAtLeast(value: number | undefined, least: number): boolean {
  return value !== undefined && Number.isInteger(value) && value >= least;
}

function radialIssue(r: Repeat): IssueCode | null {
  if (!wholeAtLeast(r.count, 2) || !Number.isInteger(r.shown ?? 0) || (r.shown ?? 0) < 0 || (r.shown ?? 0) > (r.count ?? 0)) return "out_of_range";
  if (!within(r.radius ?? 0, REPEAT_RANGES.radius) || !within(r.startAngle ?? 0, REPEAT_RANGES.startAngle)) return "out_of_range";
  if ((r.sweep ?? 0) !== 0 && !within(r.sweep ?? 0, REPEAT_RANGES.sweep)) return "out_of_range";
  return oneOf(r.direction, REPEAT_DIRECTIONS) ? null : "unknown";
}

function gridIssue(r: Repeat): IssueCode | null {
  if (!wholeAtLeast(r.rows, 1) || !wholeAtLeast(r.columns, 1) || (r.rows ?? 0) * (r.columns ?? 0) < 2) return "out_of_range";
  if (!within(r.gapX ?? 0, REPEAT_RANGES.gap) || !within(r.gapY ?? 0, REPEAT_RANGES.gap) || !within(r.offset ?? 0, REPEAT_RANGES.offset)) return "out_of_range";
  if (!oneOf(r.layout, REPEAT_LAYOUTS) || !oneOf(r.flipRows, REPEAT_FLIPS) || !oneOf(r.flipColumns, REPEAT_FLIPS)) return "unknown";
  return (r.offset ?? 0) !== 0 && (r.layout ?? "") !== "brick-row" && r.layout !== "brick-column" ? "invalid" : null;
}

function mirrorIssue(r: Repeat): IssueCode | null {
  if (!within(r.angle ?? 0, REPEAT_RANGES.angle) || !within(r.gap ?? 0, REPEAT_RANGES.gap)) return "out_of_range";
  return oneOf(r.side, MIRROR_SIDES) ? null : "unknown";
}

export function repeatIssue(r: Repeat): IssueCode | null {
  if (!(REPEAT_MODES as readonly string[]).includes(r.mode)) return "unknown";
  const own = new Set<keyof Repeat>(FIELDS[r.mode]);
  if (ALL_FIELDS.some((field) => !own.has(field) && !absent(r[field]))) return "invalid";
  if (r.mode === "radial") return radialIssue(r);
  return r.mode === "grid" ? gridIssue(r) : mirrorIssue(r);
}

export function repeatsIssue(groups: readonly StudioGroup[], layers: readonly Layer[]): IssueCode | null {
  const repeating = groups.filter((g) => g.repeat);
  if (repeating.length === 0) return null;
  const doc = { layers: [...layers], groups: [...groups] };
  const parents = groupParents(doc);
  const repeats = new Set(repeating.map((g) => g.id));
  for (const group of repeating) {
    const code = repeatIssue(group.repeat!);
    if (code) return code;
    if (groupLayerIds(doc, group.id).length === 0) return "invalid";
    if (ancestry(parents, parents.get(group.id) ?? null).some((id) => repeats.has(id))) return "invalid";
  }
  return null;
}

export function defaultRepeat(mode: RepeatMode, box: RepeatBox): Repeat {
  if (mode === "radial") return { mode, count: DEFAULT_COUNT, radius: Math.max(1, Math.round(Math.max(box.right - box.left, box.bottom - box.top))), startAngle: DEFAULT_START };
  if (mode === "grid") return { mode, rows: DEFAULT_CELLS, columns: DEFAULT_CELLS };
  return { mode, angle: DEFAULT_AXIS };
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function rotationAbout(degrees: number, x: number, y: number): Affine {
  const cos = Math.cos(radians(degrees));
  const sin = Math.sin(radians(degrees));
  return { a: cos, b: sin, c: -sin, d: cos, e: x - (cos * x - sin * y), f: y - (sin * x + cos * y) };
}

function translation(x: number, y: number): Affine {
  return { ...IDENTITY, e: x, f: y };
}

function reflectionAcross(degrees: number, x: number, y: number): Affine {
  const cos = Math.cos(radians(2 * degrees));
  const sin = Math.sin(radians(2 * degrees));
  return { a: cos, b: sin, c: sin, d: -cos, e: x - (cos * x + sin * y), f: y - (sin * x - cos * y) };
}

function radialPlaces(r: Repeat, box: RepeatBox): Affine[] {
  const count = r.count ?? DEFAULT_COUNT;
  const radius = r.radius ?? 1;
  const start = r.startAngle ?? 0;
  const sweep = r.sweep || FULL_TURN;
  const step = sweep >= FULL_TURN ? sweep / count : sweep / (count - 1);
  const sign = r.direction === "ccw" ? -1 : 1;
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const ox = cx - radius * Math.cos(radians(start));
  const oy = cy - radius * Math.sin(radians(start));
  const shown = r.shown || count;
  return Array.from({ length: shown }, (_, i) => {
    const turn = sign * i * step;
    if (!r.upright) return rotationAbout(turn, ox, oy);
    const angle = radians(start + turn);
    return translation(ox + radius * Math.cos(angle) - cx, oy + radius * Math.sin(angle) - cy);
  });
}

function flips(flip: Repeat["flipRows"]): { h: boolean; v: boolean } {
  return { h: flip === "horizontal" || flip === "both", v: flip === "vertical" || flip === "both" };
}

function gridPlaces(r: Repeat, box: RepeatBox): Affine[] {
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const pitchX = width + (r.gapX ?? 0);
  const pitchY = height + (r.gapY ?? 0);
  const rowFlip = flips(r.flipRows);
  const columnFlip = flips(r.flipColumns);
  const places: Affine[] = [];
  for (let row = 0; row < (r.rows ?? 1); row++) {
    for (let column = 0; column < (r.columns ?? 1); column++) {
      const dx = column * pitchX + (r.layout === "brick-row" && row % 2 === 1 ? (r.offset ?? 0) * pitchX : 0);
      const dy = row * pitchY + (r.layout === "brick-column" && column % 2 === 1 ? (r.offset ?? 0) * pitchY : 0);
      const flipH = (row % 2 === 1 && rowFlip.h) !== (column % 2 === 1 && columnFlip.h);
      const flipV = (row % 2 === 1 && rowFlip.v) !== (column % 2 === 1 && columnFlip.v);
      const cx = (box.left + box.right) / 2 + dx;
      const cy = (box.top + box.bottom) / 2 + dy;
      const sx = flipH ? -1 : 1;
      const sy = flipV ? -1 : 1;
      places.push({ a: sx, b: 0, c: 0, d: sy, e: cx - sx * (cx - dx), f: cy - sy * (cy - dy) });
    }
  }
  return places;
}

function mirrorPlaces(r: Repeat, box: RepeatBox): Affine[] {
  const angle = r.angle ?? DEFAULT_AXIS;
  const sin = Math.sin(radians(angle));
  const cos = Math.cos(radians(angle));
  const toward = Math.abs(sin) < 1e-9 ? { x: 0, y: 1 } : { x: sin, y: -cos };
  const normal = r.side === "start" ? { x: -toward.x, y: -toward.y } : toward;
  const extent = ((box.right - box.left) * Math.abs(normal.x) + (box.bottom - box.top) * Math.abs(normal.y)) / 2;
  const reach = extent + (r.gap ?? 0) / 2;
  const px = (box.left + box.right) / 2 + normal.x * reach;
  const py = (box.top + box.bottom) / 2 + normal.y * reach;
  return [IDENTITY, reflectionAcross(angle, px, py)];
}

export interface Pose {
  x: number;
  y: number;
  rotation: number;
  flipX: boolean;
}

export interface PlacedPose extends Pose {
  scale: number;
}

export function placeBy(m: Affine, pose: Pose): PlacedPose {
  const x = m.a * pose.x + m.c * pose.y + m.e;
  const y = m.b * pose.x + m.d * pose.y + m.f;
  const det = m.a * m.d - m.b * m.c;
  const scale = Math.sqrt(Math.abs(det));
  const turn = (Math.atan2(m.b, m.a) * 180) / Math.PI;
  if (det > 0) return { x, y, rotation: pose.rotation + turn, flipX: pose.flipX, scale };
  return { x, y, rotation: turn - pose.rotation + 180, flipX: !pose.flipX, scale };
}

export function multiply(m: Affine, n: Affine): Affine {
  return { a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b, c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d, e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f };
}

export function inverse(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  return { a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det, e: (m.c * m.f - m.d * m.e) / det, f: (m.b * m.e - m.a * m.f) / det };
}

export const IDENTITY_AFFINE: Affine = IDENTITY;

export function repeatInstances(r: Repeat, box: RepeatBox): Affine[] {
  if (r.mode === "radial") return radialPlaces(r, box);
  return r.mode === "grid" ? gridPlaces(r, box) : mirrorPlaces(r, box);
}

function clamp(value: number, [lo, hi]: readonly [number, number]): number {
  return Math.min(Math.max(value, lo), hi);
}

export function scaledRepeat(r: Repeat, fit: number): Repeat {
  if (r.mode === "radial") return { ...r, radius: clamp((r.radius ?? 1) * fit, REPEAT_RANGES.radius) };
  if (r.mode === "grid") return { ...r, ...(r.gapX ? { gapX: clamp(r.gapX * fit, REPEAT_RANGES.gap) } : {}), ...(r.gapY ? { gapY: clamp(r.gapY * fit, REPEAT_RANGES.gap) } : {}) };
  return r.gap ? { ...r, gap: clamp(r.gap * fit, REPEAT_RANGES.gap) } : r;
}
