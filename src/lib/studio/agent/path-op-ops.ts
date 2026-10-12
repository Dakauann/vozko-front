import { FILL_RULES, LINE_JOINS, newStudioId, type Clip, type FillRule, type Layer, type LineJoin, type VideoDocument } from "../document";
import { editPathOpField, pathOpsPatch, retyped, setPathOpLane } from "../path-op-edits";
import {
  MERGE_MODES,
  MERGE_OPERAND_PATHS,
  MERGE_OPERAND_SHAPES,
  newPathOp,
  PATH_OP_FIELDS,
  PATH_OP_KINDS,
  pathOpFields,
  pathOpIssue,
  pathOpRange,
  takesPathOps,
  WHOLE_PATH_OP_FIELDS,
  ZIG_ZAG_POINTS,
  type MergeMode,
  type MergeOperandShape,
  type PathOp,
  type PathOpField,
  type PathOpKind,
  type ZigZagPoints,
} from "../path-ops";
import type { Keyframe } from "../keyframes";
import { findClip, updateClip } from "../timeline";
import { isValidPath } from "../vector-path";
import { clipAccessText, laneFrames, type AgentLaneKey } from "./lane-keys";

export interface AgentPathOp {
  id?: string;
  kind?: string;
  hidden?: boolean;
  amount?: number;
  copies?: number;
  copy_offset?: number;
  join?: string;
  miter_limit?: number;
  radius?: number;
  size?: number;
  ridges?: number;
  points?: string;
  angle?: number;
  center_x?: number;
  center_y?: number;
  mode?: string;
  operand?: string;
  path?: string;
  fill_rule?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
}

export interface AgentPathOpFields {
  path_ops?: AgentPathOp[];
  path_op_id?: string;
  path_op_property?: string;
}

type NumberArg = Exclude<{ [K in keyof AgentPathOp]-?: AgentPathOp[K] extends number | undefined ? K : never }[keyof AgentPathOp], undefined>;

export const PATH_OP_ARGS: Record<PathOpField, NumberArg> = {
  amount: "amount",
  copies: "copies",
  copyOffset: "copy_offset",
  miterLimit: "miter_limit",
  radius: "radius",
  size: "size",
  ridges: "ridges",
  angle: "angle",
  centerX: "center_x",
  centerY: "center_y",
  x: "x",
  y: "y",
  w: "w",
  h: "h",
  rotation: "rotation",
};

const TEXT_OWNERS = { join: "offset", points: "zigZag", mode: "merge", operand: "merge", path: "merge", fill_rule: "merge" } as const satisfies Partial<Record<keyof AgentPathOp, PathOpKind>>;

export type PathOpsOutcome = { ok: true; ops: PathOp[] } | { ok: false; reason: string };

function listed(list: readonly string[], value: string | undefined): boolean {
  return value === undefined || list.includes(value);
}

function rangeText(kind: PathOpKind, field: PathOpField): string {
  const [low, high] = pathOpRange(kind, field)!;
  return Number.isFinite(high) ? `de ${low} a ${high}` : `a partir de ${low}`;
}

function textProblem(item: AgentPathOp, kind: PathOpKind, at: string): string | null {
  for (const [field, owner] of Object.entries(TEXT_OWNERS) as [keyof typeof TEXT_OWNERS, PathOpKind][]) {
    if (item[field] !== undefined && owner !== kind) return `${at}.${field} vale só para kind ${owner}`;
  }
  if (!listed(LINE_JOINS, item.join)) return `${at}.join precisa ser um de: ${LINE_JOINS.join(", ")}`;
  if (!listed(ZIG_ZAG_POINTS, item.points)) return `${at}.points precisa ser um de: ${ZIG_ZAG_POINTS.join(", ")}`;
  if (!listed(MERGE_MODES, item.mode)) return `${at}.mode precisa ser um de: ${MERGE_MODES.join(", ")}`;
  if (!listed(MERGE_OPERAND_SHAPES, item.operand)) return `${at}.operand precisa ser um de: ${MERGE_OPERAND_SHAPES.join(", ")}`;
  if (!listed(FILL_RULES, item.fill_rule)) return `${at}.fill_rule precisa ser um de: ${FILL_RULES.join(", ")}`;
  if (item.operand !== undefined && item.path !== undefined) return `${at}: mande operand ou path, não os dois`;
  if (item.path !== undefined && !isValidPath(item.path)) return `${at}.path precisa ser um caminho SVG com coordenadas de 0 a 1 (comandos M L H V C S Q T A Z)`;
  return null;
}

function numberProblem(item: AgentPathOp, kind: PathOpKind, at: string): string | null {
  for (const field of PATH_OP_FIELDS) {
    const value = item[PATH_OP_ARGS[field]];
    if (value === undefined) continue;
    const range = pathOpRange(kind, field);
    if (!range) return `${at}.${PATH_OP_ARGS[field]} não vale para kind ${kind}; campos de ${kind}: ${pathOpFields(kind).map((f) => PATH_OP_ARGS[f]).join(", ")}`;
    if (!(Number.isFinite(value) && value >= range[0] && value <= range[1])) return `${at}.${PATH_OP_ARGS[field]} vai ${rangeText(kind, field)}`;
    if (WHOLE_PATH_OP_FIELDS.includes(field) && !Number.isInteger(value)) return `${at}.${PATH_OP_ARGS[field]} é um número inteiro`;
  }
  return null;
}

function withText(op: PathOp, item: AgentPathOp): PathOp {
  const next = { ...op } as PathOp & Record<string, unknown>;
  if (item.hidden !== undefined) {
    if (item.hidden) next.hidden = true;
    else delete next.hidden;
  }
  if (item.join !== undefined) next.join = item.join as LineJoin;
  if (item.points !== undefined) next.points = item.points as ZigZagPoints;
  if (item.mode !== undefined) next.mode = item.mode as MergeMode;
  if (item.operand !== undefined) next.path = MERGE_OPERAND_PATHS[item.operand as MergeOperandShape];
  if (item.path !== undefined) next.path = item.path;
  if (item.fill_rule !== undefined) {
    if (item.fill_rule === "nonzero") delete next.fillRule;
    else next.fillRule = item.fill_rule as FillRule;
  }
  return next;
}

function placedOp(item: AgentPathOp, current: readonly PathOp[], index: number, atMs: number | null): PathOp | string {
  const at = `path_ops[${index}]`;
  if (!item.kind || !(PATH_OP_KINDS as readonly string[]).includes(item.kind)) return `${at}.kind precisa ser um de: ${PATH_OP_KINDS.join(", ")}`;
  const kind = item.kind as PathOpKind;
  const existing = item.id === undefined ? undefined : current.find((op) => op.id === item.id);
  if (item.id !== undefined && !existing) return `${at}.id ${item.id} não existe nesta forma; leia o projeto de novo com studio_read ou mande o operador sem id para criar um novo`;
  const problem = textProblem(item, kind, at) ?? numberProblem(item, kind, at);
  if (problem) return problem;
  let op = withText(existing ? retyped(existing, kind) : { ...newPathOp(kind), id: newStudioId("op") }, item);
  for (const field of PATH_OP_FIELDS) {
    const value = item[PATH_OP_ARGS[field]];
    if (value === undefined) continue;
    const edited = editPathOpField(op, field, value, atMs);
    if (!edited) return `${at}.${PATH_OP_ARGS[field]} está animado; mande at_ms (ms dentro do clipe) para gravar uma chave nesse momento, ou troque as chaves com animate_path_op`;
    op = edited;
  }
  const code = pathOpIssue(op);
  return code ? `${at} ficaria inválido (${code})` : op;
}

export function pathOpsFrom(items: readonly AgentPathOp[], current: readonly PathOp[] | undefined, atMs: number | null): PathOpsOutcome {
  const ops: PathOp[] = [];
  for (const [index, item] of items.entries()) {
    const placed = placedOp(item, current ?? [], index, atMs);
    if (typeof placed === "string") return { ok: false, reason: placed };
    if (ops.some((op) => op.id === placed.id)) return { ok: false, reason: `path_ops[${index}].id ${placed.id} aparece duas vezes` };
    ops.push(placed);
  }
  return { ok: true, ops };
}

export function pathOpLaneFrom(ops: readonly PathOp[] | undefined, id: string | undefined, property: string | undefined, frames: readonly Keyframe[]): PathOpsOutcome {
  const target = (ops ?? []).find((op) => op.id === id);
  if (!target) return { ok: false, reason: `o operador ${id ?? "(sem path_op_id)"} não existe nesta forma; leia o projeto de novo com studio_read` };
  if (!property || !(PATH_OP_FIELDS as readonly string[]).includes(property) || !pathOpRange(target.kind, property as PathOpField)) {
    return { ok: false, reason: `path_op_property de um operador ${target.kind} precisa ser um de: ${pathOpFields(target.kind).join(", ")}` };
  }
  const next = setPathOpLane(target, property as PathOpField, frames);
  const code = pathOpIssue(next);
  if (code) return { ok: false, reason: `as chaves de ${property} vão ${rangeText(target.kind, property as PathOpField)}` };
  return { ok: true, ops: (ops ?? []).map((op) => (op.id === next.id ? next : op)) };
}

export function agentPathOp(op: PathOp): AgentPathOp {
  const out: AgentPathOp = { id: op.id, kind: op.kind };
  if (op.hidden) out.hidden = true;
  for (const field of pathOpFields(op.kind)) out[PATH_OP_ARGS[field]] = Math.round(((op as unknown as Record<string, number>)[field] ?? 0) * 1000) / 1000;
  if (op.kind === "offset") out.join = op.join;
  if (op.kind === "zigZag") out.points = op.points;
  if (op.kind === "merge") {
    out.mode = op.mode;
    const shape = MERGE_OPERAND_SHAPES.find((name) => MERGE_OPERAND_PATHS[name] === op.path);
    if (shape) out.operand = shape;
    else out.path = op.path;
    if (op.fillRule) out.fill_rule = op.fillRule;
  }
  return out;
}

export const PATH_OP_VIDEO_OPERATIONS = ["set_path_ops", "animate_path_op"] as const;

export interface PathOpVideoInput extends AgentPathOpFields {
  op: string;
  clip_id?: string;
  at_ms?: number;
  keys?: AgentLaneKey[];
}

export type PathOpVideoResult = { ok: true; document: VideoDocument; clipId: string; created: string[] } | { ok: false; reason: string };

function shapeClip(doc: VideoDocument, clipId: string | undefined): { clip: Clip; layer: Layer } | string {
  const found = clipId ? findClip(doc, clipId) : null;
  if (!found) return clipAccessText("missing", clipId);
  if (found.track.locked) return clipAccessText("locked", clipId);
  const layer = found.clip.layer;
  if (found.clip.type !== "overlay" || !layer || !takesPathOps(layer)) return `o clipe ${found.clip.id} não aceita operadores de caminho: eles valem para formas (retângulo, elipse, triângulo, estrela e caminho), não para linhas, setas, textos, ícones ou mídia`;
  return { clip: found.clip, layer };
}

export function pathOpVideoOperation(doc: VideoDocument, op: PathOpVideoInput): PathOpVideoResult | null {
  if (!(PATH_OP_VIDEO_OPERATIONS as readonly string[]).includes(op.op)) return null;
  const target = shapeClip(doc, op.clip_id);
  if (typeof target === "string") return { ok: false, reason: target };
  const { clip, layer } = target;
  if (op.op === "set_path_ops") {
    if (!op.path_ops) return { ok: false, reason: "set_path_ops precisa de path_ops: a pilha inteira de operadores, ou [] para tirar todos" };
    if (op.at_ms !== undefined && (op.at_ms < 0 || op.at_ms > clip.durationMs)) return { ok: false, reason: `at_ms conta do início do clipe: de 0 a ${clip.durationMs}` };
    const result = pathOpsFrom(op.path_ops, layer.pathOps, op.at_ms === undefined ? null : Math.round(op.at_ms));
    if (!result.ok) return result;
    const before = new Set((layer.pathOps ?? []).map((item) => item.id));
    return { ok: true, document: updateClip(doc, clip.id, { layer: { ...layer, ...pathOpsPatch(result.ops) } }), clipId: clip.id, created: result.ops.filter((item) => !before.has(item.id)).map((item) => item.id) };
  }
  const frames = laneFrames(doc, clip.id, op.path_op_property ?? "path_op_property", op.keys ?? []);
  if (typeof frames === "string") return { ok: false, reason: frames };
  const result = pathOpLaneFrom(layer.pathOps, op.path_op_id, op.path_op_property, frames);
  if (!result.ok) return result;
  return { ok: true, document: updateClip(doc, clip.id, { layer: { ...layer, ...pathOpsPatch(result.ops) } }), clipId: clip.id, created: [] };
}
