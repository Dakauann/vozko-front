import type { VideoDocument } from "../document";
import { animateClipLuma, removeClipLuma, setClipLuma, type LumaPatch } from "../luma-edit";
import { isLumaKeyMode, LUMA_KEY_MODES, LUMA_PROPERTIES, LUMA_RANGES, type LumaKeyMode, type LumaProperty } from "../luma-key";
import { settledKeyer, type KeyerOpResult, type KeyerWords } from "./keyer-text";
import { laneFrames, type AgentLaneKey } from "./lane-keys";

export const LUMA_OPERATIONS = ["set_luma_key", "animate_luma", "remove_luma_key"] as const;

export interface AgentLumaFields {
  luma_mode?: LumaKeyMode;
  luma_threshold?: number;
  luma_softness?: number;
  luma_property?: LumaProperty;
}

export interface LumaOpInput extends AgentLumaFields {
  op: string;
  clip_id?: string;
  at_ms?: number;
  keys?: AgentLaneKey[];
}

const LUMA_WORDS: KeyerWords = { name: "recorte por brilho", setOp: "set_luma_key", animateOp: "animate_luma", values: "luma_mode e os valores" };

const AGENT_VALUES: Record<LumaProperty, keyof AgentLumaFields> = { threshold: "luma_threshold", softness: "luma_softness" };

export function lumaPatchOf(op: AgentLumaFields): LumaPatch | string {
  if (op.luma_mode !== undefined && !isLumaKeyMode(op.luma_mode)) return `luma_mode precisa ser um de: ${LUMA_KEY_MODES.join(", ")}`;
  const patch: LumaPatch = op.luma_mode ? { mode: op.luma_mode } : {};
  for (const property of LUMA_PROPERTIES) {
    const field = AGENT_VALUES[property];
    const value = op[field];
    if (value === undefined) continue;
    const [low, high] = LUMA_RANGES[property];
    if (typeof value !== "number" || !(value >= low && value <= high)) return `${field} vai de ${low} a ${high}`;
    patch[property] = value;
  }
  return patch;
}

function setLuma(doc: VideoDocument, op: LumaOpInput): KeyerOpResult {
  const patch = lumaPatchOf(op);
  if (typeof patch === "string") return { ok: false, reason: patch };
  return settledKeyer(setClipLuma(doc, op.clip_id ?? "", patch, op.at_ms ?? null), op.clip_id, LUMA_WORDS);
}

function animateLuma(doc: VideoDocument, op: LumaOpInput): KeyerOpResult {
  const property = op.luma_property;
  if (!property || !(LUMA_PROPERTIES as readonly string[]).includes(property)) return { ok: false, reason: `animate_luma precisa de luma_property: ${LUMA_PROPERTIES.join(", ")}` };
  const frames = laneFrames(doc, op.clip_id, property, op.keys ?? []);
  if (typeof frames === "string") return { ok: false, reason: frames };
  return settledKeyer(animateClipLuma(doc, op.clip_id ?? "", property, frames), op.clip_id, LUMA_WORDS);
}

export function lumaOperation(doc: VideoDocument, op: LumaOpInput): KeyerOpResult | null {
  switch (op.op) {
    case "set_luma_key":
      return setLuma(doc, op);
    case "animate_luma":
      return animateLuma(doc, op);
    case "remove_luma_key":
      return settledKeyer(removeClipLuma(doc, op.clip_id ?? ""), op.clip_id, LUMA_WORDS);
  }
  return null;
}
