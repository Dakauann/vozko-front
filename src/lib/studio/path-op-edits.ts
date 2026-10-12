import { editFieldValue, fieldKeyState, setFieldLane, toggleFieldKey } from "./animated-fields";
import { newStudioId, type Layer } from "./document";
import type { KeyState } from "./keyframe-edit";
import type { Keyframe } from "./keyframes";
import type { LayerPatch } from "./layers";
import { MERGE_OPERAND_PATHS, newPathOp, PATH_OP_SPEC, type MergeMode, type MergeOp, type PathOp, type PathOpField, type PathOpKind } from "./path-ops";

export function pathOpsPatch(ops: readonly PathOp[]): LayerPatch {
  return { pathOps: ops.length > 0 ? [...ops] : undefined };
}

export function withPathOp(ops: readonly PathOp[] | undefined, op: PathOp): PathOp[] {
  return [...(ops ?? []), op];
}

export function replacedPathOp(ops: readonly PathOp[] | undefined, id: string, change: (op: PathOp) => PathOp | null): PathOp[] {
  return (ops ?? []).flatMap((op) => {
    if (op.id !== id) return [op];
    const next = change(op);
    return next ? [next] : [];
  });
}

export function movedPathOp(ops: readonly PathOp[] | undefined, id: string, toIndex: number): PathOp[] {
  const list = [...(ops ?? [])];
  const from = list.findIndex((op) => op.id === id);
  if (from < 0) return list;
  const [op] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(list.length, toIndex)), 0, op);
  return list;
}

export function pathOpKeyState(op: PathOp, field: PathOpField, localMs: number | null): KeyState {
  return fieldKeyState(op, field, localMs);
}

export function editPathOpField(op: PathOp, field: PathOpField, value: number, localMs: number | null): PathOp | null {
  return editFieldValue(PATH_OP_SPEC, op, field, value, localMs);
}

export function togglePathOpKey(op: PathOp, field: PathOpField, localMs: number): PathOp {
  return toggleFieldKey(PATH_OP_SPEC, op, field, localMs);
}

export function setPathOpLane(op: PathOp, field: PathOpField, frames: readonly Keyframe[]): PathOp {
  return setFieldLane(PATH_OP_SPEC, op, field, frames);
}

export function retyped(op: PathOp, kind: PathOpKind): PathOp {
  return op.kind === kind ? op : { ...newPathOp(kind), id: op.id, ...(op.hidden ? { hidden: true } : {}) };
}

export const PATH_OP_PRESETS = ["softCorners", "wavyEdge", "sawEdge", "seal", "doubleOutline", "ripples", "puffy", "pinched", "swirl", "donut", "bite"] as const;

export type PathOpPreset = (typeof PATH_OP_PRESETS)[number];

function op<K extends PathOpKind>(kind: K, values: Partial<Extract<PathOp, { kind: K }>>): PathOp {
  return { ...newPathOp(kind), ...values } as PathOp;
}

function merge(mode: MergeMode, values: Partial<MergeOp>): PathOp {
  return op("merge", { mode, ...values });
}

export function presetPathOps(preset: PathOpPreset): PathOp[] {
  switch (preset) {
    case "softCorners":
      return [op("roundCorners", { radius: 24 })];
    case "wavyEdge":
      return [op("zigZag", { size: 8, ridges: 6, points: "smooth" })];
    case "sawEdge":
      return [op("zigZag", { size: 8, ridges: 8, points: "corner" })];
    case "seal":
      return [op("zigZag", { size: 10, ridges: 3, points: "smooth" }), op("roundCorners", { radius: 6 })];
    case "doubleOutline":
      return [op("offset", { amount: 10, copies: 2, copyOffset: 12, join: "round" })];
    case "ripples":
      return [op("offset", { amount: -8, copies: 4, copyOffset: -14, join: "round" })];
    case "puffy":
      return [op("puckerBloat", { amount: 35 })];
    case "pinched":
      return [op("puckerBloat", { amount: -35 })];
    case "swirl":
      return [op("twist", { angle: 180 })];
    case "donut":
      return [merge("subtract", { path: MERGE_OPERAND_PATHS.ellipse, w: 0.45, h: 0.45 })];
    case "bite":
      return [merge("subtract", { path: MERGE_OPERAND_PATHS.ellipse, x: 1, y: 0.15, w: 0.5, h: 0.5 })];
  }
}

export function withPreset(ops: readonly PathOp[] | undefined, preset: PathOpPreset): PathOp[] {
  return [...(ops ?? []), ...presetPathOps(preset).map((made) => ({ ...made, id: newStudioId("op") }))];
}

export function appliedPreset(layer: Layer, preset: PathOpPreset): LayerPatch {
  return pathOpsPatch(withPreset(layer.pathOps, preset));
}

export function toggledHidden(op: PathOp): PathOp {
  if (!op.hidden) return { ...op, hidden: true };
  const shown = { ...op };
  delete shown.hidden;
  return shown;
}
