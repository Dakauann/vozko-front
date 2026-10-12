import { isMediaEffectType, MEDIA_EFFECT_TYPES } from "../clip-style";
import { animateClipEffect, clipEffects, silhouetteLayer, styleOwner, type StyleEdit } from "../clip-style-edit";
import type { Clip, VideoDocument } from "../document";
import { EFFECT_PROPERTIES, effectRange, isEffectProperty } from "../effect-keys";
import { EFFECT_TYPES, type EffectType } from "../layer-paint";
import type { ClipPatch } from "../timeline";
import { clipAccessText, laneFrames, type AgentLaneKey } from "./lane-keys";
import { agentEffect, agentStroke, paintPatch, type AgentEffect, type AgentPaint, type AgentStroke } from "./paint-ops";

export interface AgentClipStyleFields {
  fills?: AgentPaint[];
  strokes?: AgentStroke[];
  effects?: AgentEffect[];
  effect_id?: string;
  effect_property?: string;
}

export interface AnimateEffectInput extends AgentClipStyleFields {
  clip_id?: string;
  keys?: AgentLaneKey[];
}

export type ClipStylePatch = { ok: true; patch: ClipPatch; ignored: string[] } | { ok: false; reason: string };

export type ClipStyleResult = { ok: true; document: VideoDocument } | { ok: false; reason: string };

export const CLIP_STYLE_OPERATIONS = ["animate_effect"] as const;

const MEDIA_TYPES_TEXT = MEDIA_EFFECT_TYPES.join(" e ");

export function hasClipStyle(op: AgentClipStyleFields): boolean {
  return op.fills !== undefined || op.strokes !== undefined || op.effects !== undefined;
}

export function clipStylePatch(clip: Clip, op: AgentClipStyleFields, knowsImage: (mediaId: string) => boolean): ClipStylePatch {
  const owner = styleOwner(clip);
  if (!owner) return { ok: false, reason: `fills, strokes e effects valem para textos, formas, ícones e clipes de vídeo e imagem; o clipe é ${clip.type}` };
  if (owner === "layer") {
    const painted = paintPatch({ fills: op.fills, strokes: op.strokes, effects: op.effects }, clip.layer!, knowsImage);
    return painted.ok ? { ok: true, patch: { layer: { ...clip.layer!, ...painted.value } }, ignored: painted.ignored } : painted;
  }
  if (op.fills !== undefined) return { ok: false, reason: "em clipes de vídeo e imagem fills não existe: a própria imagem é o preenchimento; use strokes e effects" };
  const inner = (op.effects ?? []).find((effect) => effect.type !== undefined && (EFFECT_TYPES as readonly string[]).includes(effect.type) && !isMediaEffectType(effect.type as EffectType));
  if (inner) return { ok: false, reason: `em clipes de vídeo e imagem effects aceita ${MEDIA_TYPES_TEXT}; ${inner.type} só vale em textos, formas e ícones` };
  const painted = paintPatch({ strokes: op.strokes, effects: op.effects }, silhouetteLayer(clip), knowsImage);
  if (!painted.ok) return painted;
  return {
    ok: true,
    patch: {
      ...(op.strokes !== undefined ? { strokes: painted.value.strokes } : {}),
      ...(op.effects !== undefined ? { effects: painted.value.effects } : {}),
    },
    ignored: painted.ignored,
  };
}

function refusalText(reason: Extract<StyleEdit, { ok: false }>["reason"], op: AnimateEffectInput): string {
  switch (reason) {
    case "missing":
    case "locked":
      return clipAccessText(reason, op.clip_id);
    case "notVisual":
    case "noStyle":
      return `o clipe ${op.clip_id} não tem efeitos: animate_effect vale para textos, formas, ícones e clipes de vídeo e imagem`;
    case "effectMissing":
      return `o efeito ${op.effect_id ?? "(sem id)"} não existe no clipe ${op.clip_id}; leia os ids em studio_read ou crie o efeito com update_clip effects`;
    case "outside":
    case "animated":
      return "as chaves precisam ficar dentro do clipe e nos limites do valor";
    case "invalid":
      return "o efeito ficaria inválido com essas chaves";
  }
}

export function animateEffect(doc: VideoDocument, op: AnimateEffectInput, clip: Clip): ClipStyleResult {
  const property = op.effect_property;
  if (!property || !isEffectProperty(property)) return { ok: false, reason: `animate_effect precisa de effect_property: ${EFFECT_PROPERTIES.join(", ")}` };
  const effects = clipEffects(clip);
  const effectId = op.effect_id ?? (effects.length === 1 ? effects[0].id : undefined);
  if (!effectId) return { ok: false, reason: `animate_effect precisa de effect_id: o clipe ${clip.id} tem ${effects.length} efeitos` };
  const frames = laneFrames(doc, clip.id, property, op.keys ?? []);
  if (typeof frames === "string") return { ok: false, reason: frames };
  const [low, high] = effectRange(property);
  const outside = frames.find((frame) => frame.value < low || frame.value > high);
  if (outside) return { ok: false, reason: `${property} do efeito vai de ${low} a ${high}; a chave em ${outside.atMs} ms vale ${outside.value}` };
  const result = animateClipEffect(doc, clip.id, effectId, property, frames);
  return result.ok ? result : { ok: false, reason: refusalText(result.reason, { ...op, effect_id: effectId }) };
}

export function clipStyleOutline(clip: Pick<Clip, "effects" | "strokes">): { effects?: ReturnType<typeof agentEffect>[]; strokes?: AgentStroke[] } {
  return {
    ...(clip.effects?.length ? { effects: clip.effects.map(agentEffect) } : {}),
    ...(clip.strokes?.length ? { strokes: clip.strokes.map(agentStroke) } : {}),
  };
}
