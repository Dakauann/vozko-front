import { fieldValue, lanesIssue, shiftLanes, type AnimatedFields, type Lanes } from "./animated-fields";
import { FILL_RULES, LINE_JOINS, newStudioId, type CanvasSize, type FillRule, type Layer, type LineJoin } from "./document";
import { curveExtent } from "./keyframes";
import { BOOLEAN_OPS, type BooleanOp } from "./path-boolean";
import { mergeShape, offsetShape, placedOperand, puckerBloatShape, roundCornersShape, twistShape, ZIG_ZAG_POINTS, zigZagShape, type Shape, type ZigZagPoints } from "./path-op-geometry";
import { mapSubpaths, pathBounds, pathToSubpaths, subpathsToPath } from "./path-nodes";
import { isValidToken } from "./tokens";
import type { IssueCode } from "./validate";
import { isValidPath } from "./vector-path";
import { vectorLayerOf } from "./vector-layer";

export const PATH_OP_KINDS = ["offset", "puckerBloat", "roundCorners", "zigZag", "twist", "merge"] as const;

export type PathOpKind = (typeof PATH_OP_KINDS)[number];

export const PATH_OP_FIELDS = ["amount", "copies", "copyOffset", "miterLimit", "radius", "size", "ridges", "angle", "centerX", "centerY", "x", "y", "w", "h", "rotation"] as const;

export type PathOpField = (typeof PATH_OP_FIELDS)[number];

export const MERGE_MODES = BOOLEAN_OPS;

export type MergeMode = BooleanOp;

export { ZIG_ZAG_POINTS, type ZigZagPoints };

interface PathOpBase {
  id: string;
  hidden?: boolean;
  keyframes?: Lanes<PathOpField>;
}

export interface OffsetOp extends PathOpBase {
  kind: "offset";
  amount: number;
  copies: number;
  copyOffset: number;
  join: LineJoin;
  miterLimit: number;
}

export interface PuckerBloatOp extends PathOpBase {
  kind: "puckerBloat";
  amount: number;
}

export interface RoundCornersOp extends PathOpBase {
  kind: "roundCorners";
  radius: number;
}

export interface ZigZagOp extends PathOpBase {
  kind: "zigZag";
  size: number;
  ridges: number;
  points: ZigZagPoints;
}

export interface TwistOp extends PathOpBase {
  kind: "twist";
  angle: number;
  centerX: number;
  centerY: number;
}

export interface MergeOp extends PathOpBase {
  kind: "merge";
  mode: MergeMode;
  path: string;
  fillRule?: FillRule;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export type PathOp = OffsetOp | PuckerBloatOp | RoundCornersOp | ZigZagOp | TwistOp | MergeOp;

const UNBOUNDED = Number.POSITIVE_INFINITY;

const PATH_OP_RANGES: { [K in PathOpKind]: Partial<Record<PathOpField, readonly [number, number]>> } = {
  offset: { amount: [-1000, 1000], copies: [1, UNBOUNDED], copyOffset: [-1000, 1000], miterLimit: [1, 20] },
  puckerBloat: { amount: [-100, 100] },
  roundCorners: { radius: [0, 2000] },
  zigZag: { size: [-1000, 1000], ridges: [0, UNBOUNDED] },
  twist: { angle: [-3600, 3600], centerX: [-1, 2], centerY: [-1, 2] },
  merge: { x: [-2, 3], y: [-2, 3], w: [0.001, 8], h: [0.001, 8], rotation: [-3600, 3600] },
};

export const WHOLE_PATH_OP_FIELDS: readonly PathOpField[] = ["copies", "ridges"];

const TEXT_FIELDS = ["join", "points", "mode", "path", "fillRule"] as const;

const TEXT_OWNERS: Record<(typeof TEXT_FIELDS)[number], PathOpKind> = { join: "offset", points: "zigZag", mode: "merge", path: "merge", fillRule: "merge" };

export const MERGE_OPERAND_PATHS = {
  ellipse: "M0 0.5 A0.5 0.5 0 0 1 1 0.5 A0.5 0.5 0 0 1 0 0.5 Z",
  rect: "M0 0 L1 0 L1 1 L0 1 Z",
  triangle: "M0.5 0 L1 1 L0 1 Z",
  star: "M0.5 0 L0.6176 0.3382 L0.9755 0.3455 L0.6902 0.5618 L0.7939 0.9045 L0.5 0.7 L0.2061 0.9045 L0.3098 0.5618 L0.0245 0.3455 L0.3824 0.3382 Z",
} as const;

export type MergeOperandShape = keyof typeof MERGE_OPERAND_PATHS;

export const MERGE_OPERAND_SHAPES = Object.keys(MERGE_OPERAND_PATHS) as MergeOperandShape[];

export function pathOpFields(kind: PathOpKind): PathOpField[] {
  return PATH_OP_FIELDS.filter((field) => PATH_OP_RANGES[kind][field] !== undefined);
}

export function pathOpRange(kind: PathOpKind, field: PathOpField): readonly [number, number] | null {
  return PATH_OP_RANGES[kind][field] ?? null;
}

function numberOf(op: PathOp, field: PathOpField): number {
  const value = (op as unknown as Record<string, unknown>)[field];
  return typeof value === "number" ? value : 0;
}

export const PATH_OP_SPEC: AnimatedFields<PathOp, PathOpField> = {
  staticValue: numberOf,
  withStatic: (op, field, value) => ({ ...op, [field]: WHOLE_PATH_OP_FIELDS.includes(field) ? Math.round(value) : value }),
  range: (field, op) => PATH_OP_RANGES[op.kind][field] ?? [0, 0],
};

export function newPathOp(kind: PathOpKind): PathOp {
  const id = newStudioId("op");
  switch (kind) {
    case "offset":
      return { id, kind, amount: 12, copies: 1, copyOffset: 12, join: "round", miterLimit: 4 };
    case "puckerBloat":
      return { id, kind, amount: 30 };
    case "roundCorners":
      return { id, kind, radius: 24 };
    case "zigZag":
      return { id, kind, size: 10, ridges: 6, points: "corner" };
    case "twist":
      return { id, kind, angle: 90, centerX: 0.5, centerY: 0.5 };
    case "merge":
      return { id, kind, mode: "subtract", path: MERGE_OPERAND_PATHS.ellipse, x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0 };
  }
}

function listed<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function holds(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

function textIssue(op: PathOp): IssueCode | null {
  const record = op as unknown as Record<string, unknown>;
  for (const field of TEXT_FIELDS) {
    const value = record[field];
    if (TEXT_OWNERS[field] !== op.kind && value !== undefined && value !== "") return "invalid";
  }
  if (op.kind === "offset" && !listed(LINE_JOINS, op.join)) return "unknown";
  if (op.kind === "zigZag" && !listed(ZIG_ZAG_POINTS, op.points)) return "unknown";
  if (op.kind !== "merge") return null;
  if (!listed(MERGE_MODES, op.mode) || ((op.fillRule ?? "") !== "" && !listed(FILL_RULES, op.fillRule))) return "unknown";
  return isValidPath(op.path ?? "") ? null : "invalid";
}

export function pathOpIssue(op: PathOp): IssueCode | null {
  if (!listed(PATH_OP_KINDS, op.kind)) return "unknown";
  if (!isValidToken(op.id)) return "invalid";
  const textCode = textIssue(op);
  if (textCode) return textCode;
  for (const field of PATH_OP_FIELDS) {
    const range = PATH_OP_RANGES[op.kind][field];
    const value = numberOf(op, field);
    if (!range) {
      if (value !== 0) return "invalid";
      continue;
    }
    if (!holds(value, range)) return "out_of_range";
    if (WHOLE_PATH_OP_FIELDS.includes(field) && !Number.isInteger(value)) return "invalid";
  }
  return lanesIssue(op.keyframes ?? {}, (field) => pathOpRange(op.kind, field as PathOpField));
}

export function takesPathOps(layer: Pick<Layer, "type" | "shape">): boolean {
  return layer.type === "shape" && layer.shape !== undefined && layer.shape !== "line" && layer.shape !== "arrow";
}

export function pathOpsKeyed(ops: readonly PathOp[] | undefined): boolean {
  return (ops ?? []).some((op) => Object.values(op.keyframes ?? {}).some((frames) => (frames?.length ?? 0) > 0));
}

export function pathOpsIssue(layer: Layer): IssueCode | null {
  const ops = layer.pathOps ?? [];
  if (ops.length === 0) return null;
  if (!takesPathOps(layer)) return "invalid";
  const ids = new Set<string>();
  for (const op of ops) {
    if (ids.has(op.id)) return "invalid";
    ids.add(op.id);
    const code = pathOpIssue(op);
    if (code) return code;
  }
  return null;
}

export function stillPathOpsIssue(layer: Layer): IssueCode | null {
  return pathOpsKeyed(layer.pathOps) ? "invalid" : null;
}

export function pathOpValue(op: PathOp, field: PathOpField, localMs: number): number {
  return fieldValue(PATH_OP_SPEC, op, field, localMs);
}

function pathOpsAt(ops: readonly PathOp[], localMs: number): PathOp[] {
  return ops.map((op) => {
    if (!op.keyframes) return op;
    const resolved = { ...op } as PathOp;
    delete resolved.keyframes;
    for (const field of pathOpFields(op.kind)) Object.assign(resolved, { [field]: pathOpValue(op, field, localMs) });
    return resolved;
  });
}

export function layerAtTime(layer: Layer, localMs: number): Layer {
  return pathOpsKeyed(layer.pathOps) ? { ...layer, pathOps: pathOpsAt(layer.pathOps!, localMs) } : layer;
}

export function splitPathOps(ops: readonly PathOp[], atLocalMs: number): PathOp[] {
  return ops.map((op) => {
    const keyframes = shiftLanes(op.keyframes, -atLocalMs);
    return keyframes ? { ...op, keyframes } : op;
  });
}

function activeOps(layer: Layer): PathOp[] {
  return (layer.pathOps ?? []).filter((op) => !op.hidden);
}

function applied(shape: Shape, op: PathOp, width: number, height: number): Shape {
  switch (op.kind) {
    case "offset":
      return offsetShape(shape, op);
    case "puckerBloat":
      return puckerBloatShape(shape, op.amount);
    case "roundCorners":
      return roundCornersShape(shape, op.radius);
    case "zigZag":
      return zigZagShape(shape, op);
    case "twist":
      return twistShape(shape, op.angle, { x: op.centerX * width, y: op.centerY * height });
    case "merge":
      return mergeShape(shape, placedOperand(op.path, op.fillRule || "nonzero", op, width, height), op.mode);
  }
}

const CACHE_LIMIT = 64;
const shapes = new Map<string, { path: string; fillRule: FillRule }>();

function remembered(key: string, build: () => { path: string; fillRule: FillRule }): { path: string; fillRule: FillRule } {
  const known = shapes.get(key);
  if (known) {
    shapes.delete(key);
    shapes.set(key, known);
    return known;
  }
  const made = build();
  if (shapes.size >= CACHE_LIMIT) shapes.delete(shapes.keys().next().value!);
  shapes.set(key, made);
  return made;
}

export function pathOpsLayer(layer: Layer, canvas: CanvasSize): Layer {
  const ops = activeOps(layer);
  if (ops.length === 0 || !takesPathOps(layer)) return layer.pathOps ? { ...layer, pathOps: undefined } : layer;
  const vector = vectorLayerOf({ ...layer, pathOps: undefined }, canvas);
  const width = layer.transform.w * canvas.width;
  const height = layer.transform.h * canvas.height;
  if (!vector || width <= 0 || height <= 0) return { ...layer, pathOps: undefined };
  const key = JSON.stringify([vector.path, layer.fillRule, width, height, ops.map((op) => ({ ...op, id: undefined, keyframes: undefined }))]);
  const result = remembered(key, () => {
    const base: Shape = { subpaths: mapSubpaths(pathToSubpaths(vector.path ?? ""), (p) => ({ x: p.x * width, y: p.y * height })), fillRule: layer.fillRule ?? "nonzero" };
    const shaped = ops.reduce((shape, op) => applied(shape, op, width, height), base);
    return { path: subpathsToPath(mapSubpaths(shaped.subpaths, (p) => ({ x: p.x / width, y: p.y / height }))), fillRule: shaped.fillRule };
  });
  return { ...layer, shape: "path", path: result.path, fillRule: result.fillRule === "evenodd" ? "evenodd" : undefined, radius: undefined, points: undefined, inner: undefined, pathOps: undefined };
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function extentOf(op: PathOp, field: PathOpField): readonly [number, number] {
  const frames = op.keyframes?.[field] ?? [];
  const value = numberOf(op, field);
  return frames.length > 0 ? curveExtent(frames) : [value, value];
}

function biggest(op: PathOp, field: PathOpField): number {
  const [low, high] = extentOf(op, field);
  return Math.max(Math.abs(low), Math.abs(high));
}

function grown(box: Box, by: number): Box {
  return { left: box.left - by, top: box.top - by, right: box.right + by, bottom: box.bottom + by };
}

function joined(a: Box, b: Box): Box {
  return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
}

const SMOOTH_OVERSHOOT = 1.25;

function offsetReach(op: OffsetOp): number {
  const [, amount] = extentOf(op, "amount");
  const [lowStep, highStep] = extentOf(op, "copyOffset");
  const copies = Math.max(1, Math.round(extentOf(op, "copies")[1]));
  const farthest = Math.max(amount, amount + (copies - 1) * Math.max(lowStep, highStep));
  const corner = op.join === "miter" ? Math.max(1, extentOf(op, "miterLimit")[1]) : 1;
  return Math.max(0, farthest) * corner;
}

function twistBox(box: Box, op: TwistOp, width: number, height: number): Box {
  const xs = extentOf(op, "centerX").map((value) => value * width);
  const ys = extentOf(op, "centerY").map((value) => value * height);
  let out = box;
  for (const cx of xs) {
    for (const cy of ys) {
      const reach = Math.max(Math.hypot(box.left - cx, box.top - cy), Math.hypot(box.right - cx, box.top - cy), Math.hypot(box.left - cx, box.bottom - cy), Math.hypot(box.right - cx, box.bottom - cy));
      out = joined(out, { left: cx - reach, top: cy - reach, right: cx + reach, bottom: cy + reach });
    }
  }
  return out;
}

function operandBox(op: MergeOp, width: number, height: number): Box {
  const xs = extentOf(op, "x").map((value) => value * width);
  const ys = extentOf(op, "y").map((value) => value * height);
  const half = Math.hypot(extentOf(op, "w")[1] * width, extentOf(op, "h")[1] * height) / 2;
  return { left: Math.min(...xs) - half, top: Math.min(...ys) - half, right: Math.max(...xs) + half, bottom: Math.max(...ys) + half };
}

function reachedBox(box: Box, op: PathOp, width: number, height: number): Box {
  switch (op.kind) {
    case "offset":
      return grown(box, offsetReach(op));
    case "puckerBloat":
      return grown(box, (biggest(op, "amount") / 100) * Math.hypot(box.right - box.left, box.bottom - box.top));
    case "roundCorners":
      return box;
    case "zigZag":
      return grown(box, biggest(op, "size") * (op.points === "smooth" ? SMOOTH_OVERSHOOT : 1));
    case "twist":
      return twistBox(box, op, width, height);
    case "merge":
      return op.mode === "union" || op.mode === "exclude" ? joined(box, operandBox(op, width, height)) : box;
  }
}

export function pathOpsReach(layer: Layer, canvas: CanvasSize): number {
  const ops = activeOps(layer);
  if (ops.length === 0 || !takesPathOps(layer)) return 0;
  const width = layer.transform.w * canvas.width;
  const height = layer.transform.h * canvas.height;
  const vector = vectorLayerOf({ ...layer, pathOps: undefined }, canvas);
  const unit = pathBounds(pathToSubpaths(vector?.path ?? ""));
  const start: Box = { left: Math.min(0, unit.left * width), top: Math.min(0, unit.top * height), right: Math.max(width, unit.right * width), bottom: Math.max(height, unit.bottom * height) };
  const box = ops.reduce((current, op) => reachedBox(current, op, width, height), start);
  return Math.ceil(Math.max(0, -box.left, -box.top, box.right - width, box.bottom - height));
}

export interface PathOpsState {
  keyed: boolean;
  reachPx: number;
}

export function pathOpsState(layer: Layer | undefined, box: CanvasSize): PathOpsState | undefined {
  if (!layer || activeOps(layer).length === 0 || !takesPathOps(layer)) return undefined;
  return { keyed: pathOpsKeyed(layer.pathOps), reachPx: pathOpsReach(layer, box) };
}
