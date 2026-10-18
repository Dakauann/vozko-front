import { CHROMA_FIELDS, CHROMA_PROPERTIES, chromaIssue, newChromaKey, type ChromaKey, type ChromaProperty } from "./chroma-key";
import type { Layer, VideoDocument } from "./document";
import type { Keyframe } from "./keyframes";
import { animateKeyer, editKeyer, keyerSelectionEdit, patchKeyerValues, removeKeyer, toggleKeyerKey, type Keyer, type KeyerEdit } from "./keyer-edit";
import type { SelectionEdit } from "./selection-edit";

export type ChromaEdit = KeyerEdit;

export type ChromaPatch = Partial<Record<ChromaProperty, number>> & { color?: string };

const CHROMA_KEYER: Keyer<ChromaKey, ChromaProperty> = {
  fields: CHROMA_FIELDS,
  properties: CHROMA_PROPERTIES,
  create: () => newChromaKey(),
  read: (clip) => clip.chromaKey,
  write: (chromaKey) => ({ chromaKey }),
  issue: chromaIssue,
};

function patchChroma(current: ChromaKey, patch: ChromaPatch, localMs: number | null): ChromaKey | "animated" | "invalid" {
  return patchKeyerValues(CHROMA_KEYER, patch.color === undefined ? current : { ...current, color: patch.color.toLowerCase() }, patch, localMs);
}

export function layerChroma(layer: Layer, patch: ChromaPatch): ChromaKey | "notImage" | "invalid" {
  if (layer.type !== "image") return "notImage";
  const next = patchChroma(layer.chromaKey ?? newChromaKey(), patch, null);
  return next === "animated" || next === "invalid" || chromaIssue(next) ? "invalid" : next;
}

export function setClipChroma(doc: VideoDocument, clipId: string, patch: ChromaPatch, localMs: number | null): ChromaEdit {
  return editKeyer(CHROMA_KEYER, doc, clipId, (current) => patchChroma(current ?? newChromaKey(), patch, localMs));
}

export function removeClipChroma(doc: VideoDocument, clipId: string): ChromaEdit {
  return removeKeyer(CHROMA_KEYER, doc, clipId);
}

export function animateClipChroma(doc: VideoDocument, clipId: string, property: ChromaProperty, frames: readonly Keyframe[]): ChromaEdit {
  return animateKeyer(CHROMA_KEYER, doc, clipId, property, frames);
}

export function toggleClipChromaKey(doc: VideoDocument, clipId: string, property: ChromaProperty, localMs: number): ChromaEdit {
  return toggleKeyerKey(CHROMA_KEYER, doc, clipId, property, localMs);
}

export function chromaSelectionEdit(edit: ChromaEdit): SelectionEdit {
  return keyerSelectionEdit(edit);
}
