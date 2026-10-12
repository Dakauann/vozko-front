import type { Clip, VideoDocument } from "../document";
import { editKeyed, isAnimated } from "../keyframe-edit";
import { lineIssue, lineOptionsPatch, takesLineAnimation, toggleLineGroup, WAVE_MODES, type LineAnimation, type WaveMode } from "../line-animation";
import { LINE_GROUPS, LINE_PROPERTIES, LINE_RANGES, WIGGLE_SEED_RANGE, lineGroupOf, type LineGroup, type LineProperty } from "../line-properties";
import { findClip, updateClip, type ClipPatch } from "../timeline";

export interface AgentLineFields {
  trim_start?: number;
  trim_end?: number;
  trim_offset?: number;
  trim_sequential?: boolean;
  wave_mode?: WaveMode;
  wave_amount?: number;
  wave_length?: number;
  wave_speed?: number;
  wave_phase?: number;
  wiggle_size?: number;
  wiggle_detail?: number;
  wiggle_rate?: number;
  wiggle_seed?: number;
  taper_start_length?: number;
  taper_end_length?: number;
  taper_start_width?: number;
  taper_end_width?: number;
  taper_start_ease?: number;
  taper_end_ease?: number;
  line_clear?: LineGroup[];
}

type AgentLineValue = Exclude<keyof AgentLineFields, "trim_sequential" | "wave_mode" | "wiggle_seed" | "line_clear">;

export const LINE_ARGS: Record<LineProperty, AgentLineValue> = {
  trimStart: "trim_start",
  trimEnd: "trim_end",
  trimOffset: "trim_offset",
  waveAmount: "wave_amount",
  waveLength: "wave_length",
  waveSpeed: "wave_speed",
  wavePhase: "wave_phase",
  wiggleSize: "wiggle_size",
  wiggleDetail: "wiggle_detail",
  wiggleRate: "wiggle_rate",
  taperStartLength: "taper_start_length",
  taperEndLength: "taper_end_length",
  taperStartWidth: "taper_start_width",
  taperEndWidth: "taper_end_width",
  taperStartEase: "taper_start_ease",
  taperEndEase: "taper_end_ease",
};

export interface LineOpInput extends AgentLineFields {
  op: string;
  clip_id?: string;
  at_ms?: number;
}

export type LineOpResult = { ok: true; document: VideoDocument } | { ok: false; reason: string };

export interface OutlineLine {
  trim?: { start: number; end: number; offset: number; sequential?: boolean };
  wave?: { mode: WaveMode; amount: number; wavelength: number; speed: number; phase: number };
  wiggle?: { size: number; detail: number; rate: number; seed: number };
  taper?: { start_length: number; end_length: number; start_width: number; end_width: number; start_ease: number; end_ease: number };
}

const OPTION_GROUPS: Record<"trim_sequential" | "wave_mode" | "wiggle_seed", LineGroup> = { trim_sequential: "trim", wave_mode: "wave", wiggle_seed: "wiggle" };

function refuse(reason: string): LineOpResult {
  return { ok: false, reason };
}

export function lineLayerRefusal(clip: Clip): string | null {
  if (clip.type === "overlay" && clip.layer && takesLineAnimation(clip.layer)) return null;
  return `o clipe ${clip.id} não anima o traço: precisa ser uma linha, seta ou forma com stroke e stroke_width maior que 0, sem shadow nem effects`;
}

export function lineGroupFor(clip: Clip, property: LineProperty): ClipPatch | string {
  const refusal = lineLayerRefusal(clip);
  if (refusal) return refusal;
  const group = lineGroupOf(property);
  return clip.line?.[group] ? {} : toggleLineGroup(clip, group, true);
}

function rangeText(property: LineProperty): string {
  const [low, high] = LINE_RANGES[property];
  return `${LINE_ARGS[property]} vai de ${low} a ${high}`;
}

function inputIssue(op: LineOpInput): string | null {
  const unknown = (op.line_clear ?? []).find((group) => !(LINE_GROUPS as readonly string[]).includes(group));
  if (unknown !== undefined) return `line_clear aceita: ${LINE_GROUPS.join(", ")}`;
  if (op.wave_mode !== undefined && !(WAVE_MODES as readonly string[]).includes(op.wave_mode)) return `wave_mode precisa ser um de: ${WAVE_MODES.join(", ")}`;
  if (op.wiggle_seed !== undefined && (!Number.isInteger(op.wiggle_seed) || op.wiggle_seed < WIGGLE_SEED_RANGE[0] || op.wiggle_seed > WIGGLE_SEED_RANGE[1])) return `wiggle_seed é um inteiro de ${WIGGLE_SEED_RANGE[0]} a ${WIGGLE_SEED_RANGE[1]}`;
  const outside = LINE_PROPERTIES.find((property) => {
    const value = op[LINE_ARGS[property]];
    const [low, high] = LINE_RANGES[property];
    return value !== undefined && !(Number.isFinite(value) && value >= low && value <= high);
  });
  return outside ? rangeText(outside) : null;
}

function touchedGroups(op: LineOpInput): LineGroup[] {
  const groups = new Set<LineGroup>();
  for (const property of LINE_PROPERTIES) if (op[LINE_ARGS[property]] !== undefined) groups.add(lineGroupOf(property));
  for (const [field, group] of Object.entries(OPTION_GROUPS) as [keyof typeof OPTION_GROUPS, LineGroup][]) if (op[field] !== undefined) groups.add(group);
  return LINE_GROUPS.filter((group) => groups.has(group));
}

function setLine(doc: VideoDocument, op: LineOpInput): LineOpResult {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return refuse(`o clipe ${op.clip_id ?? "(sem id)"} não existe; leia o projeto de novo com studio_read`);
  if (found.track.locked) return refuse(`o clipe ${found.clip.id} está numa faixa travada; destrave com update_track antes`);
  const layerRefusal = lineLayerRefusal(found.clip);
  if (layerRefusal) return refuse(layerRefusal);
  const issue = inputIssue(op);
  if (issue) return refuse(`set_line: ${issue}`);
  const groups = touchedGroups(op);
  if (groups.length === 0 && (op.line_clear ?? []).length === 0) return refuse(`set_line precisa de ao menos um campo de ${LINE_GROUPS.join(", ")} ou de line_clear`);
  if (op.at_ms !== undefined && (op.at_ms < 0 || op.at_ms > found.clip.durationMs)) return refuse(`at_ms conta do início do clipe: de 0 a ${found.clip.durationMs}`);
  let clip: Clip = found.clip;
  const apply = (patch: ClipPatch) => {
    clip = { ...clip, ...patch };
  };
  for (const group of op.line_clear ?? []) apply(toggleLineGroup(clip, group, false));
  for (const group of groups) if (!clip.line?.[group]) apply(toggleLineGroup(clip, group, true));
  apply(lineOptionsPatch(clip, { mode: op.wave_mode, sequential: op.trim_sequential, seed: op.wiggle_seed }));
  for (const property of LINE_PROPERTIES) {
    const value = op[LINE_ARGS[property]];
    if (value === undefined) continue;
    if (isAnimated(clip, property) && op.at_ms === undefined) {
      return refuse(`${LINE_ARGS[property]} está animado; mande at_ms (ms dentro do clipe) para gravar uma chave nesse momento, ou troque as chaves com animate property ${property}`);
    }
    apply(editKeyed(clip, property, value, op.at_ms === undefined ? null : Math.round(op.at_ms)).patch);
  }
  const code = lineIssue(clip);
  if (code) return refuse(`set_line deixaria a linha inválida (${code})`);
  return { ok: true, document: updateClip(doc, clip.id, { line: clip.line, keyframes: clip.keyframes }) };
}

export function lineOperation(doc: VideoDocument, op: LineOpInput): LineOpResult | null {
  return op.op === "set_line" ? setLine(doc, op) : null;
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function lineOutline(line: LineAnimation): OutlineLine {
  return {
    ...(line.trim ? { trim: { start: rounded(line.trim.start), end: rounded(line.trim.end), offset: rounded(line.trim.offset), ...(line.trim.sequential ? { sequential: true } : {}) } } : {}),
    ...(line.wave ? { wave: { mode: line.wave.mode, amount: rounded(line.wave.amount), wavelength: rounded(line.wave.wavelength), speed: rounded(line.wave.speed), phase: rounded(line.wave.phase) } } : {}),
    ...(line.wiggle ? { wiggle: { size: rounded(line.wiggle.size), detail: rounded(line.wiggle.detail), rate: rounded(line.wiggle.rate), seed: line.wiggle.seed } } : {}),
    ...(line.taper
      ? {
          taper: {
            start_length: rounded(line.taper.startLength),
            end_length: rounded(line.taper.endLength),
            start_width: rounded(line.taper.startWidth),
            end_width: rounded(line.taper.endWidth),
            start_ease: rounded(line.taper.startEase),
            end_ease: rounded(line.taper.endEase),
          },
        }
      : {}),
  };
}
