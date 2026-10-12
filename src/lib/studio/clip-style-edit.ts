import { editVisualClip, type ClipItemsEdit } from "./clip-items";
import { takesClipStyle } from "./clip-style";
import type { Clip, Layer, VideoDocument } from "./document";
import { editEffectValue, effectRange, setEffectLane, toggleEffectKey, type EffectProperty } from "./effect-keys";
import type { Keyframe } from "./keyframes";
import type { Effect, Paint, StrokePaint } from "./layer-paint";
import { asSelectionEdit, type Refusal, type SelectionEdit } from "./selection-edit";
import { findClip, type ClipPatch } from "./timeline";
import { clipIssue } from "./validate";

export type StyleRefusal = "noStyle" | "effectMissing" | "outside" | "animated";

export type StyleEdit = ClipItemsEdit<StyleRefusal>;

export interface StyleLists {
  fills?: Paint[];
  strokes?: StrokePaint[];
  effects?: Effect[];
}

export function styleOwner(clip: Pick<Clip, "type" | "layer">): "layer" | "clip" | null {
  if (clip.type === "overlay" && clip.layer) return "layer";
  return takesClipStyle(clip) ? "clip" : null;
}

export function clipEffects(clip: Pick<Clip, "type" | "layer" | "effects">): readonly Effect[] {
  return styleOwner(clip) === "layer" ? (clip.layer?.effects ?? []) : (clip.effects ?? []);
}

function listsPatch(clip: Clip, lists: StyleLists): ClipPatch | StyleRefusal {
  const owner = styleOwner(clip);
  if (!owner || (owner === "clip" && lists.fills !== undefined)) return "noStyle";
  const shown = (list: unknown[] | undefined) => (list && list.length > 0 ? list : undefined);
  if (owner === "clip") {
    return {
      ...("strokes" in lists ? { strokes: shown(lists.strokes) as StrokePaint[] | undefined } : {}),
      ...("effects" in lists ? { effects: shown(lists.effects) as Effect[] | undefined } : {}),
    };
  }
  const layer: Layer = { ...clip.layer! };
  if ("fills" in lists) Object.assign(layer, { fills: shown(lists.fills), fill: undefined, gradient: undefined, pattern: undefined });
  if ("strokes" in lists) Object.assign(layer, { strokes: shown(lists.strokes), stroke: undefined, strokeWidth: undefined, dash: undefined, dashArray: undefined, dashOffset: undefined, lineCap: undefined, lineJoin: undefined, miterLimit: undefined });
  if ("effects" in lists) Object.assign(layer, { effects: shown(lists.effects), shadow: undefined });
  return { layer };
}

function checked(doc: VideoDocument, clipId: string, change: (clip: Clip) => ClipPatch | StyleRefusal): StyleEdit {
  const edit = editVisualClip<StyleRefusal>(doc, clipId, change);
  if (!edit.ok) return edit;
  const found = findClip(edit.document, clipId)!;
  return clipIssue(found.clip, found.track.kind, edit.document.durationMs) ? { ok: false, reason: "invalid" } : edit;
}

export function setClipStyle(doc: VideoDocument, clipId: string, lists: StyleLists): StyleEdit {
  return checked(doc, clipId, (clip) => listsPatch(clip, lists));
}

function withEffect(doc: VideoDocument, clipId: string, effectId: string, change: (effect: Effect, clip: Clip) => Effect | StyleRefusal): StyleEdit {
  return checked(doc, clipId, (clip) => {
    const effects = clipEffects(clip);
    const index = effects.findIndex((effect) => effect.id === effectId);
    if (!styleOwner(clip)) return "noStyle";
    if (index < 0) return "effectMissing";
    const next = change(effects[index], clip);
    if (typeof next === "string") return next;
    return listsPatch(clip, { effects: effects.map((effect, i) => (i === index ? next : effect)) });
  });
}

function inside(clip: Clip, atMs: number): boolean {
  return atMs >= 0 && atMs <= clip.durationMs;
}

export function toggleClipEffectKey(doc: VideoDocument, clipId: string, effectId: string, property: EffectProperty, localMs: number): StyleEdit {
  return withEffect(doc, clipId, effectId, (effect, clip) => (inside(clip, localMs) ? toggleEffectKey(effect, property, localMs) : "outside"));
}

export function animateClipEffect(doc: VideoDocument, clipId: string, effectId: string, property: EffectProperty, frames: readonly Keyframe[]): StyleEdit {
  return withEffect(doc, clipId, effectId, (effect, clip) => {
    const [low, high] = effectRange(property);
    if (frames.some((frame) => !inside(clip, frame.atMs) || !(frame.value >= low && frame.value <= high))) return "outside";
    return setEffectLane(effect, property, frames);
  });
}

export function editClipEffect(doc: VideoDocument, clipId: string, effectId: string, values: Partial<Record<EffectProperty, number>>, localMs: number | null): StyleEdit {
  return withEffect(doc, clipId, effectId, (effect, clip) => {
    let next = effect;
    const at = localMs !== null && inside(clip, localMs) ? localMs : null;
    for (const [property, value] of Object.entries(values) as [EffectProperty, number][]) {
      const edited = editEffectValue(next, property, value, at);
      if (!edited) return "animated";
      next = edited;
    }
    return next;
  });
}

const SELECTION_REFUSALS: Record<Extract<StyleEdit, { ok: false }>["reason"], Refusal> = {
  missing: "invalid",
  locked: "locked",
  notVisual: "invalid",
  invalid: "invalid",
  noStyle: "invalid",
  effectMissing: "invalid",
  outside: "keyframeOutside",
  animated: "keyframeOutside",
};

export function styleSelectionEdit(edit: StyleEdit): SelectionEdit {
  return asSelectionEdit(edit, SELECTION_REFUSALS);
}

export function silhouetteLayer(clip: Clip): Layer {
  return { id: clip.id, type: "image", transform: clip.transform, strokes: clip.strokes, effects: clip.effects };
}
