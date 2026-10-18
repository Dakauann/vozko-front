import { produce } from "immer";

import { newStudioId, STUDIO_LIMITS, type Marker, type VideoDocument } from "./document";
import { isLabelColor, type LabelColor } from "./labels";
import { isValidToken, runes } from "./tokens";
import type { IssueCode } from "./validate";

export interface MarkerFields {
  durationMs?: number;
  label?: string;
  color?: LabelColor;
  note?: string;
}

export interface MarkerPatch {
  atMs?: number;
  durationMs?: number;
  label?: string;
  color?: LabelColor | null;
  note?: string;
}

export type MarkerRefusal = "missing" | "taken";

type MarkerListResult<M extends Marker> = { ok: true; list: M[] } | { ok: false; reason: MarkerRefusal };

type MarkerResult = { ok: true; document: VideoDocument } | { ok: false; reason: MarkerRefusal };

function clampTo(value: number, low: number, high: number): number {
  return Math.min(Math.max(low, Math.round(value)), high);
}

function cleanText(value: string, limit: number): string {
  return [...value.trim()].slice(0, limit).join("");
}

function shapedMarker<M extends Marker>(marker: M, patch: MarkerPatch, maxAtMs: number): M {
  const atMs = clampTo(patch.atMs ?? marker.atMs, 0, maxAtMs);
  const durationMs = clampTo(patch.durationMs ?? marker.durationMs ?? 0, 0, maxAtMs - atMs);
  const label = cleanText(patch.label ?? marker.label ?? "", STUDIO_LIMITS.maxMarkerLabelRunes);
  const note = cleanText(patch.note ?? marker.note ?? "", STUDIO_LIMITS.maxMarkerNoteRunes);
  const color = patch.color === null ? undefined : (patch.color ?? marker.color);
  const next: M = { ...marker, atMs };
  delete next.durationMs;
  delete next.label;
  delete next.color;
  delete next.note;
  return { ...next, ...(durationMs > 0 ? { durationMs } : {}), ...(label ? { label } : {}), ...(color ? { color } : {}), ...(note ? { note } : {}) };
}

function sorted<M extends Marker>(list: readonly M[]): M[] {
  return [...list].sort((a, b) => a.atMs - b.atMs);
}

export function insertMarkerInto<M extends Marker>(list: readonly M[], marker: M, maxAtMs: number): MarkerListResult<M> {
  const shaped = shapedMarker(marker, {}, maxAtMs);
  if (list.some((m) => m.atMs === shaped.atMs)) return { ok: false, reason: "taken" };
  return { ok: true, list: sorted([...list, shaped]) };
}

export function editMarkerIn<M extends Marker>(list: readonly M[], markerId: string, patch: MarkerPatch, maxAtMs: number): MarkerListResult<M> {
  const marker = list.find((m) => m.id === markerId);
  if (!marker) return { ok: false, reason: "missing" };
  const shaped = shapedMarker(marker, patch, maxAtMs);
  if (list.some((m) => m.id !== markerId && m.atMs === shaped.atMs)) return { ok: false, reason: "taken" };
  return { ok: true, list: sorted(list.map((m) => (m.id === markerId ? shaped : m))) };
}

function markerFieldsIssue(marker: Marker, maxAtMs: number): IssueCode | null {
  const durationMs = marker.durationMs ?? 0;
  if (!Number.isInteger(marker.atMs) || marker.atMs < 0 || marker.atMs > maxAtMs) return "out_of_range";
  if (!Number.isInteger(durationMs) || durationMs < 0 || marker.atMs + durationMs > maxAtMs) return "out_of_range";
  if ((marker.color ?? "") !== "" && !isLabelColor(marker.color)) return "unknown";
  if (runes(marker.label ?? "") > STUDIO_LIMITS.maxMarkerLabelRunes || runes(marker.note ?? "") > STUDIO_LIMITS.maxMarkerNoteRunes) return "too_large";
  return null;
}

export function markerListIssue(markers: readonly Marker[], maxAtMs: number): IssueCode | null {
  const seen = new Set<string>();
  for (const marker of markers) {
    if (!isValidToken(marker.id)) return "invalid";
    if (seen.has(marker.id)) return "duplicate";
    seen.add(marker.id);
    const code = markerFieldsIssue(marker, maxAtMs);
    if (code) return code;
  }
  return null;
}

export function markerEndMs(marker: Pick<Marker, "atMs" | "durationMs">): number {
  return marker.atMs + (marker.durationMs ?? 0);
}

function markersOf(doc: VideoDocument): Marker[] {
  return doc.markers ?? [];
}

function withMarkers(doc: VideoDocument, list: Marker[]): VideoDocument {
  return produce(doc, (draft) => {
    draft.markers = list;
  });
}

export function addMarker(doc: VideoDocument, atMs: number, fields: MarkerFields = {}): { document: VideoDocument; markerId: string | null } {
  const marker: Marker = { id: newStudioId("k"), atMs, ...fields };
  const result = insertMarkerInto(markersOf(doc), marker, STUDIO_LIMITS.maxVideoMs);
  if (!result.ok) return { document: doc, markerId: null };
  return { document: withMarkers(doc, result.list), markerId: marker.id };
}

export function updateMarker(doc: VideoDocument, markerId: string, patch: MarkerPatch): MarkerResult {
  const result = editMarkerIn(markersOf(doc), markerId, patch, STUDIO_LIMITS.maxVideoMs);
  if (!result.ok) return result;
  return { ok: true, document: withMarkers(doc, result.list) };
}

export function removeMarker(doc: VideoDocument, markerId: string): VideoDocument {
  if (!markersOf(doc).some((m) => m.id === markerId)) return doc;
  return withMarkers(
    doc,
    markersOf(doc).filter((m) => m.id !== markerId),
  );
}

export function adjacentMarker(doc: VideoDocument, fromMs: number, direction: 1 | -1): Marker | null {
  const markers = markersOf(doc);
  if (direction > 0) return markers.find((m) => m.atMs > fromMs) ?? null;
  return [...markers].reverse().find((m) => m.atMs < fromMs) ?? null;
}
