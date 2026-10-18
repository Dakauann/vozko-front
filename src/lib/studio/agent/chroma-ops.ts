import { animateClipChroma, removeClipChroma, setClipChroma, type ChromaEdit, type ChromaPatch } from "../chroma-edit";
import { settledKeyer, type KeyerOpResult, type KeyerWords } from "./keyer-text";
import { CHROMA_PRESETS, CHROMA_PROPERTIES, CHROMA_RANGES, type ChromaPreset, type ChromaProperty } from "../chroma-key";
import type { Clip, VideoDocument } from "../document";
import { findClip } from "../timeline";
import { clipKeySample, keyMoment, keySampleId, type KeySample } from "../chroma-detect";
import { laneFrames, type AgentLaneKey } from "./lane-keys";

const AUTO_CHROMA = "auto";

export type AgentChromaPreset = ChromaPreset | typeof AUTO_CHROMA;

const AGENT_CHROMA_PRESETS: readonly AgentChromaPreset[] = [...(Object.keys(CHROMA_PRESETS) as ChromaPreset[]), AUTO_CHROMA];

const KEY_COLOR_NOT_FOUND = "não achei um fundo verde ou azul dominante na borda da imagem; mande chroma_color com a cor do fundo ou chroma_preset green ou blue";

type ClipKeyColor = (clip: Clip, atMs: number | undefined) => string | undefined;

export interface AgentChromaFields {
  chroma_color?: string;
  chroma_preset?: AgentChromaPreset;
  chroma_property?: ChromaProperty;
  similarity?: number;
  smoothness?: number;
  spill?: number;
}

interface ChromaOpInput extends AgentChromaFields {
  op: string;
  clip_id?: string;
  at_ms?: number;
  keys?: AgentLaneKey[];
}

type ChromaOpResult = KeyerOpResult;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const CHROMA_WORDS: KeyerWords = { name: "recorte de fundo", setOp: "set_chroma_key", animateOp: "animate_chroma", values: "chroma_color e os valores" };

function settled(edit: ChromaEdit, op: ChromaOpInput): ChromaOpResult {
  return settledKeyer(edit, op.clip_id, CHROMA_WORDS);
}

function presetColor(preset: AgentChromaPreset | undefined, detected: () => string | undefined): string | undefined | null {
  if (preset === undefined) return undefined;
  return preset === AUTO_CHROMA ? (detected() ?? null) : CHROMA_PRESETS[preset];
}

export function chromaPatchOf(op: AgentChromaFields, detected: () => string | undefined): ChromaPatch | string {
  if (op.chroma_preset !== undefined && !AGENT_CHROMA_PRESETS.includes(op.chroma_preset)) return `chroma_preset precisa ser um de: ${AGENT_CHROMA_PRESETS.join(", ")}`;
  if (op.chroma_color !== undefined && !HEX_COLOR.test(op.chroma_color)) return "chroma_color precisa ser uma cor #rrggbb";
  const patch: ChromaPatch = {};
  const color = op.chroma_color ?? presetColor(op.chroma_preset, detected);
  if (color === null) return KEY_COLOR_NOT_FOUND;
  if (color) patch.color = color;
  for (const property of CHROMA_PROPERTIES) {
    const value = op[property];
    if (value === undefined) continue;
    const [low, high] = CHROMA_RANGES[property];
    if (!(value >= low && value <= high)) return `${property} vai de ${low} a ${high}`;
    patch[property] = value;
  }
  return patch;
}

function setChroma(doc: VideoDocument, op: ChromaOpInput, keyColor: ClipKeyColor): ChromaOpResult {
  const clip = findClip(doc, op.clip_id ?? "")?.clip;
  const patch = chromaPatchOf(op, () => (clip ? keyColor(clip, op.at_ms) : undefined));
  if (typeof patch === "string") return { ok: false, reason: patch };
  return settled(setClipChroma(doc, op.clip_id ?? "", patch, op.at_ms ?? null), op);
}

function animateChroma(doc: VideoDocument, op: ChromaOpInput): ChromaOpResult {
  const property = op.chroma_property;
  if (!property || !(CHROMA_PROPERTIES as readonly string[]).includes(property)) return { ok: false, reason: `animate_chroma precisa de chroma_property: ${CHROMA_PROPERTIES.join(", ")}` };
  const frames = laneFrames(doc, op.clip_id, property, op.keys ?? []);
  if (typeof frames === "string") return { ok: false, reason: frames };
  return settled(animateClipChroma(doc, op.clip_id ?? "", property, frames), op);
}

export function wantsDetectedKey(op: AgentChromaFields & { op: string }): boolean {
  return op.op === "set_chroma_key" && op.chroma_preset === AUTO_CHROMA && op.chroma_color === undefined;
}

export function autoKeySamples(doc: VideoDocument, operations: readonly ChromaOpInput[], playheadMs: number): KeySample[] {
  const samples = new Map<string, KeySample>();
  for (const op of operations) {
    if (!wantsDetectedKey(op)) continue;
    const clip = findClip(doc, op.clip_id ?? "")?.clip;
    const sample = clip ? clipKeySample(clip, keyMoment(clip, op.at_ms, playheadMs)) : null;
    if (sample) samples.set(keySampleId(sample), sample);
  }
  return [...samples.values()];
}

export function chromaOperation(doc: VideoDocument, op: ChromaOpInput, keyColor: ClipKeyColor): ChromaOpResult | null {
  switch (op.op) {
    case "set_chroma_key":
      return setChroma(doc, op, keyColor);
    case "animate_chroma":
      return animateChroma(doc, op);
    case "remove_chroma_key":
      return settled(removeClipChroma(doc, op.clip_id ?? ""), op);
  }
  return null;
}
