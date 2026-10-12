import type { Clip, VideoDocument } from "./document";
import { findClip, updateClip, type ClipPatch } from "./timeline";

export type ClipItemsRefusal = "missing" | "locked" | "notVisual" | "invalid";

export type ClipItemsEdit<R extends string> = { ok: true; document: VideoDocument } | { ok: false; reason: ClipItemsRefusal | R };

export interface ClipItems<T extends { id: string }> {
  read(clip: Clip): readonly T[];
  write(items: T[], clip: Clip): ClipPatch;
  invalid(items: readonly T[], clip: Clip): boolean;
}

export function insertItem<T>(items: readonly T[], item: T, index?: number): T[] {
  const next = [...items];
  next.splice(index ?? next.length, 0, item);
  return next;
}

export function removeItem<T extends { id: string }>(items: readonly T[], id: string): T[] | null {
  return items.some((item) => item.id === id) ? items.filter((item) => item.id !== id) : null;
}

export function moveItem<T extends { id: string }>(items: readonly T[], id: string, toIndex: number): T[] | null {
  const from = items.findIndex((item) => item.id === id);
  if (from < 0) return null;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, moved);
  return next;
}

function editableClip(doc: VideoDocument, clipId: string): Clip | ClipItemsRefusal {
  const found = findClip(doc, clipId);
  if (!found) return "missing";
  if (found.track.locked) return "locked";
  if (found.track.kind !== "visual" || found.clip.type === "audio") return "notVisual";
  return found.clip;
}

export function editVisualClip<R extends string = never>(doc: VideoDocument, clipId: string, change: (clip: Clip) => ClipPatch | ClipItemsRefusal | R): ClipItemsEdit<R> {
  const clip = editableClip(doc, clipId);
  if (typeof clip === "string") return { ok: false, reason: clip };
  const patch = change(clip);
  if (typeof patch === "string") return { ok: false, reason: patch };
  return { ok: true, document: updateClip(doc, clipId, patch) };
}

export function editClipItems<T extends { id: string }, R extends string = never>(doc: VideoDocument, clipId: string, list: ClipItems<T>, change: (items: T[], clip: Clip) => T[] | R): ClipItemsEdit<R> {
  return editVisualClip<R>(doc, clipId, (clip) => {
    const items = change([...list.read(clip)], clip);
    if (typeof items === "string") return items;
    return list.invalid(items, clip) ? "invalid" : list.write(items, clip);
  });
}

export function editClipItem<T extends { id: string }, R extends string>(doc: VideoDocument, clipId: string, itemId: string, list: ClipItems<T>, missing: R, change: (item: T, clip: Clip) => T | R): ClipItemsEdit<R> {
  return editClipItems<T, R>(doc, clipId, list, (items, clip) => {
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) return missing;
    const next = change(items[index], clip);
    if (typeof next === "string") return next;
    items[index] = next;
    return items;
  });
}
