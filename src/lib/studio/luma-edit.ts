import type { VideoDocument } from "./document";
import type { Keyframe } from "./keyframes";
import { animateKeyer, editKeyer, keyerSelectionEdit, patchKeyerValues, removeKeyer, toggleKeyerKey, type Keyer, type KeyerEdit } from "./keyer-edit";
import { LUMA_FIELDS, LUMA_PROPERTIES, lumaIssue, newLumaKey, type LumaKey, type LumaKeyMode, type LumaProperty } from "./luma-key";
import type { SelectionEdit } from "./selection-edit";

export type LumaEdit = KeyerEdit;

export type LumaPatch = Partial<Record<LumaProperty, number>> & { mode?: LumaKeyMode };

const LUMA_KEYER: Keyer<LumaKey, LumaProperty> = {
  fields: LUMA_FIELDS,
  properties: LUMA_PROPERTIES,
  create: () => newLumaKey(),
  read: (clip) => clip.lumaKey,
  write: (lumaKey) => ({ lumaKey }),
  issue: lumaIssue,
};

function patchLuma(current: LumaKey, patch: LumaPatch, localMs: number | null): LumaKey | "animated" | "invalid" {
  return patchKeyerValues(LUMA_KEYER, patch.mode === undefined ? current : { ...current, mode: patch.mode }, patch, localMs);
}

export function setClipLuma(doc: VideoDocument, clipId: string, patch: LumaPatch, localMs: number | null): LumaEdit {
  return editKeyer(LUMA_KEYER, doc, clipId, (current) => patchLuma(current ?? newLumaKey(), patch, localMs));
}

export function removeClipLuma(doc: VideoDocument, clipId: string): LumaEdit {
  return removeKeyer(LUMA_KEYER, doc, clipId);
}

export function animateClipLuma(doc: VideoDocument, clipId: string, property: LumaProperty, frames: readonly Keyframe[]): LumaEdit {
  return animateKeyer(LUMA_KEYER, doc, clipId, property, frames);
}

export function toggleClipLumaKey(doc: VideoDocument, clipId: string, property: LumaProperty, localMs: number): LumaEdit {
  return toggleKeyerKey(LUMA_KEYER, doc, clipId, property, localMs);
}

export function lumaSelectionEdit(edit: LumaEdit): SelectionEdit {
  return keyerSelectionEdit(edit);
}
