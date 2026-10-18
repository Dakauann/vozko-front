import { editFieldValue, setFieldLane } from "../animated-fields";
import { CLIP_REPEAT_MODES, CLIP_REPEAT_RANGES, CLIP_REPEAT_SPEC, clipRepeatFields, clipRepeatIssue, defaultClipRepeat, REPEAT_ORDERS, type ClipRepeat, type ClipRepeatField, type ClipRepeatMode } from "../clip-repeat";
import { videoCanvasSize, type Clip, type VideoDocument } from "../document";
import type { Keyframe } from "../keyframes";
import type { RepeatBox } from "../repeat";
import { findClip, updateClip } from "../timeline";
import { clipAccessText, laneFrames, type AgentLaneKey } from "./lane-keys";
import { agentRepeat, repeatOf, type AgentRepeat } from "./repeat-ops";

export interface AgentClipRepeat extends AgentRepeat {
  copies?: number;
  shift?: number;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  start_opacity?: number;
  end_opacity?: number;
  order?: string;
}

export interface AgentClipRepeatFields {
  repeat?: AgentClipRepeat;
  repeat_property?: string;
}

type OwnArg = "copies" | "shift" | "x" | "y" | "scale" | "rotation" | "start_opacity" | "end_opacity";

const OWN_ARGS: Record<OwnArg, ClipRepeatField> = { copies: "copies", shift: "shift", x: "x", y: "y", scale: "scale", rotation: "rotation", start_opacity: "startOpacity", end_opacity: "endOpacity" };
const LINEAR_ARGS: readonly OwnArg[] = ["copies", "shift", "x", "y", "scale", "rotation"];
const SHARED_ARGS: Partial<Record<keyof AgentRepeat, ClipRepeatField>> = { radius: "radius", start_angle: "startAngle", sweep: "sweep", gap_x: "gapX", gap_y: "gapY", angle: "angle", gap: "gap" };

type ClipRepeatOutcome = { ok: true; value: ClipRepeat } | { ok: false; reason: string };

function rangeText(field: ClipRepeatField): string {
  const [low, high] = CLIP_REPEAT_RANGES[field];
  return Number.isFinite(high) ? `de ${low} a ${high}` : `a partir de ${low}`;
}

function imageArgs(input: AgentClipRepeat): AgentRepeat {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) if (!(key in OWN_ARGS) && key !== "order") rest[key] = value;
  return rest as AgentRepeat;
}

function ownProblem(input: AgentClipRepeat, mode: ClipRepeatMode): string | null {
  if (input.order !== undefined && !(REPEAT_ORDERS as readonly string[]).includes(input.order)) return `repeat.order precisa ser um de: ${REPEAT_ORDERS.join(", ")}`;
  for (const [arg, field] of Object.entries(OWN_ARGS) as [OwnArg, ClipRepeatField][]) {
    const value = input[arg];
    if (value === undefined) continue;
    if (mode !== "linear" && LINEAR_ARGS.includes(arg)) return `repeat.${arg} vale só para mode linear`;
    const [low, high] = CLIP_REPEAT_RANGES[field];
    if (!(Number.isFinite(value) && value >= low && value <= high)) return `repeat.${arg} vai ${rangeText(field)}`;
    if (arg === "copies" && !Number.isInteger(value)) return "repeat.copies é um número inteiro a partir de 1";
  }
  if (mode === "linear") {
    const foreign = Object.keys(imageArgs(input)).find((key) => key !== "mode" && input[key as keyof AgentRepeat] !== undefined);
    if (foreign) return `repeat.${foreign} não vale para mode linear; campos de linear: ${LINEAR_ARGS.join(", ")}, start_opacity, end_opacity, order`;
  }
  return null;
}

function keyedValue(repeat: ClipRepeat, field: ClipRepeatField, value: number, atMs: number | null): ClipRepeat | string {
  const edited = editFieldValue(CLIP_REPEAT_SPEC, repeat, field, value, atMs);
  return edited ?? `repeat ${field} está animado; mande at_ms (ms dentro do clipe) para gravar uma chave nesse momento, ou troque as chaves com animate_repeat`;
}

function clipRepeatFrom(input: AgentClipRepeat, current: ClipRepeat | undefined, box: RepeatBox, atMs: number | null): ClipRepeatOutcome {
  const mode = (input.mode ?? current?.mode) as ClipRepeatMode | undefined;
  if (!mode || !(CLIP_REPEAT_MODES as readonly string[]).includes(mode)) return { ok: false, reason: `repeat.mode precisa ser um de: ${CLIP_REPEAT_MODES.join(", ")}` };
  const problem = ownProblem(input, mode);
  if (problem) return { ok: false, reason: problem };
  const kept = current && current.mode === mode ? current : defaultClipRepeat(mode, box);
  let repeat: ClipRepeat = kept;
  if (mode !== "linear") {
    const shape = imageArgs(input);
    const lanesFree = Object.fromEntries(Object.entries(shape).filter(([key]) => !(key in SHARED_ARGS && kept.keyframes?.[SHARED_ARGS[key as keyof AgentRepeat]!]?.length)));
    const merged = repeatOf({ ...(lanesFree as AgentRepeat), mode }, { ...kept, mode }, box);
    if (!merged.ok) return merged;
    repeat = { ...merged.value, ...(kept.startOpacity !== undefined ? { startOpacity: kept.startOpacity } : {}), ...(kept.endOpacity !== undefined ? { endOpacity: kept.endOpacity } : {}), ...(kept.order ? { order: kept.order } : {}), ...(kept.keyframes ? { keyframes: kept.keyframes } : {}) };
    for (const [arg, field] of Object.entries(SHARED_ARGS) as [keyof AgentRepeat, ClipRepeatField][]) {
      const value = input[arg] as number | undefined;
      if (value === undefined || !kept.keyframes?.[field]?.length) continue;
      const next = keyedValue(repeat, field, value, atMs);
      if (typeof next === "string") return { ok: false, reason: next };
      repeat = next;
    }
  }
  for (const [arg, field] of Object.entries(OWN_ARGS) as [OwnArg, ClipRepeatField][]) {
    const value = input[arg];
    if (value === undefined) continue;
    const next = keyedValue(repeat, field, value, atMs);
    if (typeof next === "string") return { ok: false, reason: next };
    repeat = next;
  }
  if (input.order !== undefined) repeat = input.order === "above" ? { ...repeat, order: undefined } : { ...repeat, order: "below" };
  const cleaned = Object.fromEntries(Object.entries(repeat).filter(([, value]) => value !== undefined)) as unknown as ClipRepeat;
  const code = clipRepeatIssue(cleaned);
  return code ? { ok: false, reason: `a repetição ficaria inválida (${code})` } : { ok: true, value: cleaned };
}

function clipRepeatLaneFrom(repeat: ClipRepeat | undefined, property: string | undefined, frames: readonly Keyframe[]): ClipRepeatOutcome {
  if (!repeat) return { ok: false, reason: "o clipe não tem repetição; ligue com set_repeat antes de animar" };
  const allowed = clipRepeatFields(repeat.mode);
  if (!property || !allowed.includes(property as ClipRepeatField)) return { ok: false, reason: `repeat_property no mode ${repeat.mode} precisa ser um de: ${allowed.join(", ")}` };
  const next = setFieldLane(CLIP_REPEAT_SPEC, repeat, property as ClipRepeatField, frames);
  const code = clipRepeatIssue(next);
  return code ? { ok: false, reason: `as chaves de ${property} vão ${rangeText(property as ClipRepeatField)}` } : { ok: true, value: next };
}

export function agentClipRepeat(repeat: ClipRepeat): AgentClipRepeat {
  const round = (value: number) => Math.round(value * 1000) / 1000;
  const own: AgentClipRepeat = {};
  for (const [arg, field] of Object.entries(OWN_ARGS) as [OwnArg, ClipRepeatField][]) {
    const value = repeat[field];
    if (value !== undefined && value !== 0) own[arg] = round(value);
  }
  if (repeat.order === "below") own.order = "below";
  if (repeat.mode === "linear") return { mode: "linear", ...own };
  return { ...agentRepeat({ ...repeat, mode: repeat.mode }), ...own, mode: repeat.mode };
}

export const CLIP_REPEAT_OPERATIONS = ["set_repeat", "clear_repeat", "animate_repeat"] as const;

interface ClipRepeatInput extends AgentClipRepeatFields {
  op: string;
  clip_id?: string;
  clip_ids?: string[];
  at_ms?: number;
  keys?: AgentLaneKey[];
}

type ClipRepeatResult = { ok: true; document: VideoDocument; clipIds: string[] } | { ok: false; reason: string };

function repeatTarget(doc: VideoDocument, clipId: string): Clip | string {
  const found = findClip(doc, clipId);
  if (!found) return clipAccessText("missing", clipId);
  if (found.track.locked) return clipAccessText("locked", clipId);
  if (found.clip.type !== "overlay") return `o clipe ${clipId} não é um texto, forma, ícone ou imagem sobreposta; a repetição vale só para esses clipes`;
  return found.clip;
}

function clipBox(doc: VideoDocument, clip: Clip): RepeatBox {
  const { width, height } = videoCanvasSize(doc);
  const t = clip.transform;
  return { left: (t.x - t.w / 2) * width, top: (t.y - t.h / 2) * height, right: (t.x + t.w / 2) * width, bottom: (t.y + t.h / 2) * height };
}

export function clipRepeatOperation(doc: VideoDocument, op: ClipRepeatInput): ClipRepeatResult | null {
  if (!(CLIP_REPEAT_OPERATIONS as readonly string[]).includes(op.op)) return null;
  const ids = op.clip_ids?.length ? op.clip_ids : op.clip_id ? [op.clip_id] : [];
  if (ids.length === 0) return { ok: false, reason: `${op.op} precisa de clip_id` };
  let document = doc;
  for (const id of ids) {
    const clip = repeatTarget(document, id);
    if (typeof clip === "string") return { ok: false, reason: clip };
    if (op.op === "clear_repeat") {
      if (!clip.repeat) return { ok: false, reason: `o clipe ${id} não tem repetição` };
      document = updateClip(document, id, { repeat: undefined });
      continue;
    }
    if (op.op === "animate_repeat") {
      const frames = laneFrames(document, id, op.repeat_property ?? "repeat_property", op.keys ?? []);
      if (typeof frames === "string") return { ok: false, reason: frames };
      const result = clipRepeatLaneFrom(clip.repeat, op.repeat_property, frames);
      if (!result.ok) return result;
      document = updateClip(document, id, { repeat: result.value });
      continue;
    }
    if (!op.repeat) return { ok: false, reason: "set_repeat precisa de repeat com mode: linear, radial, grid ou mirror" };
    if (op.at_ms !== undefined && (op.at_ms < 0 || op.at_ms > clip.durationMs)) return { ok: false, reason: `at_ms conta do início do clipe: de 0 a ${clip.durationMs}` };
    const result = clipRepeatFrom(op.repeat, clip.repeat, clipBox(document, clip), op.at_ms === undefined ? null : Math.round(op.at_ms));
    if (!result.ok) return result;
    document = updateClip(document, id, { repeat: result.value });
  }
  return { ok: true, document, clipIds: ids };
}
