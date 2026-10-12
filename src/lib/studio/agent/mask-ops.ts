import { newStudioId, type VideoDocument } from "../document";
import { addClipMask, animateClipMask, animateClipMaskPath, moveClipMask, patchMask, removeClipMask, updateClipMask, type MaskEdit, type MaskEditRefusal, type MaskPatch } from "../mask-edit";
import { MASK_MODES, MASK_POINTS_RANGE, MASK_PROPERTIES, MASK_RANGES, MASK_SHAPES, newMask, type MaskMode, type MaskProperty, type MaskShape } from "../masks";
import { clipAccessText, laneFrames, morphLaneFrames, type AgentPathKey } from "./lane-keys";
import type { AgentBox } from "./layer-style";
import { findClip } from "../timeline";

export interface AgentMaskFields {
  mask_id?: string;
  mask_shape?: MaskShape;
  mask_mode?: MaskMode;
  mask_property?: MaskProperty | "path";
  invert?: boolean;
  points?: number;
  path?: string;
  roundness?: number;
  inner?: number;
  feather?: number;
  expansion?: number;
}

export interface MaskOpInput extends AgentMaskFields, AgentBox {
  op: string;
  clip_id?: string;
  at_ms?: number;
  to_index?: number;
  keys?: AgentPathKey[];
}

export type MaskOpResult = { ok: true; document: VideoDocument; maskId: string } | { ok: false; reason: string };

const RANGES_TEXT = MASK_PROPERTIES.map((property) => `${property} de ${MASK_RANGES[property][0]} a ${MASK_RANGES[property][1]}`).join(", ");

function refusalText(reason: MaskEditRefusal, op: MaskOpInput): string {
  switch (reason) {
    case "missing":
    case "locked":
      return clipAccessText(reason, op.clip_id);
    case "notVisual":
      return `o clipe ${op.clip_id} é áudio; máscaras valem só para clipes com imagem`;
    case "maskMissing":
      return `a máscara ${op.mask_id ?? "(sem id)"} não existe no clipe ${op.clip_id}; leia o projeto de novo com studio_read`;
    case "animated":
      return "essa propriedade da máscara tem chaves; mande at_ms (ms dentro do clipe) para gravar uma chave nesse momento, ou troque as chaves com animate_mask";
    case "outside":
      return `as chaves precisam ficar entre 0 e a duração do clipe ${op.clip_id}`;
    case "invalid":
      return `a máscara ficaria inválida; limites: ${RANGES_TEXT}; points de ${MASK_POINTS_RANGE[0]} a ${MASK_POINTS_RANGE[1]} só em star; roundness só em rectangle; path (SVG de 0 a 1 na caixa da máscara) só em path`;
  }
}

function settled(result: MaskEdit, op: MaskOpInput, maskId: string): MaskOpResult {
  return result.ok ? { ok: true, document: result.document, maskId } : { ok: false, reason: refusalText(result.reason, op) };
}

function patchOf(op: MaskOpInput): MaskPatch | string {
  if (op.mask_shape !== undefined && !(MASK_SHAPES as readonly string[]).includes(op.mask_shape)) return `mask_shape precisa ser um de: ${MASK_SHAPES.join(", ")}`;
  if (op.mask_mode !== undefined && !(MASK_MODES as readonly string[]).includes(op.mask_mode)) return `mask_mode precisa ser um de: ${MASK_MODES.join(", ")}`;
  const values: Partial<Record<MaskProperty, number>> = {};
  for (const property of MASK_PROPERTIES) {
    const value = op[property];
    if (value === undefined) continue;
    const [low, high] = MASK_RANGES[property];
    if (!(value >= low && value <= high)) return `${property} da máscara vai de ${low} a ${high}`;
    values[property] = value;
  }
  return { ...values, shape: op.mask_shape, mode: op.mask_mode, invert: op.invert, points: op.points, path: op.path };
}

function addMask(doc: VideoDocument, op: MaskOpInput): MaskOpResult {
  if (!op.mask_shape) return { ok: false, reason: `add_mask precisa de mask_shape: ${MASK_SHAPES.join(", ")}` };
  const patch = patchOf(op);
  if (typeof patch === "string") return { ok: false, reason: patch };
  const id = newStudioId("mask");
  const mask = patchMask(newMask(op.mask_shape, id), patch, null);
  if (typeof mask === "string") return { ok: false, reason: refusalText(mask, op) };
  return settled(addClipMask(doc, op.clip_id ?? "", mask, op.to_index), op, id);
}

function updateMask(doc: VideoDocument, op: MaskOpInput): MaskOpResult {
  const patch = patchOf(op);
  if (typeof patch === "string") return { ok: false, reason: patch };
  return settled(updateClipMask(doc, op.clip_id ?? "", op.mask_id ?? "", patch, op.at_ms ?? null), op, op.mask_id ?? "");
}

const ANIMATED_MASK_FIELDS = [...MASK_PROPERTIES, "path"];

function animateMaskPath(doc: VideoDocument, op: MaskOpInput): MaskOpResult {
  const mask = findClip(doc, op.clip_id ?? "")?.clip.masks?.find((entry) => entry.id === op.mask_id);
  if (mask && mask.shape !== "path") return { ok: false, reason: `a máscara ${op.mask_id} é ${mask.shape}; só máscaras path animam o caminho; troque a forma com update_mask mask_shape path antes` };
  const frames = morphLaneFrames(doc, op.clip_id, op.keys ?? []);
  if (typeof frames === "string") return { ok: false, reason: frames };
  return settled(animateClipMaskPath(doc, op.clip_id ?? "", op.mask_id ?? "", frames), op, op.mask_id ?? "");
}

function animateMask(doc: VideoDocument, op: MaskOpInput): MaskOpResult {
  const property = op.mask_property;
  if (property === "path") return animateMaskPath(doc, op);
  if (!property || !(MASK_PROPERTIES as readonly string[]).includes(property)) return { ok: false, reason: `animate_mask precisa de mask_property: ${ANIMATED_MASK_FIELDS.join(", ")}` };
  const frames = laneFrames(doc, op.clip_id, property, op.keys ?? []);
  if (typeof frames === "string") return { ok: false, reason: frames };
  return settled(animateClipMask(doc, op.clip_id ?? "", op.mask_id ?? "", property, frames), op, op.mask_id ?? "");
}

export function maskOperation(doc: VideoDocument, op: MaskOpInput): MaskOpResult | null {
  switch (op.op) {
    case "add_mask":
      return addMask(doc, op);
    case "update_mask":
      return updateMask(doc, op);
    case "animate_mask":
      return animateMask(doc, op);
    case "move_mask":
      return settled(moveClipMask(doc, op.clip_id ?? "", op.mask_id ?? "", op.to_index ?? 0), op, op.mask_id ?? "");
    case "remove_mask":
      return settled(removeClipMask(doc, op.clip_id ?? "", op.mask_id ?? ""), op, op.mask_id ?? "");
  }
  return null;
}
