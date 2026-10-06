import { produce } from "immer";

import { newStudioId, STUDIO_LIMITS, type Marker, type VideoDocument } from "./document";

function markersOf(doc: VideoDocument): Marker[] {
  return doc.markers ?? [];
}

function clampAt(ms: number): number {
  return Math.min(Math.max(0, Math.round(ms)), STUDIO_LIMITS.maxVideoMs);
}

export function addMarker(doc: VideoDocument, atMs: number, label?: string): { document: VideoDocument; markerId: string | null } {
  const at = clampAt(atMs);
  const markers = markersOf(doc);
  if (markers.length >= STUDIO_LIMITS.maxMarkers || markers.some((m) => m.atMs === at)) return { document: doc, markerId: null };
  const marker: Marker = { id: newStudioId("k"), atMs: at, ...(label ? { label: label.slice(0, STUDIO_LIMITS.maxMarkerLabelRunes) } : {}) };
  const document = produce(doc, (draft) => {
    draft.markers = [...markers, marker].sort((a, b) => a.atMs - b.atMs);
  });
  return { document, markerId: marker.id };
}

export function removeMarker(doc: VideoDocument, markerId: string): VideoDocument {
  if (!markersOf(doc).some((m) => m.id === markerId)) return doc;
  return produce(doc, (draft) => {
    draft.markers = markersOf(draft as VideoDocument).filter((m) => m.id !== markerId);
  });
}

export function moveMarker(doc: VideoDocument, markerId: string, atMs: number): VideoDocument {
  const at = clampAt(atMs);
  const marker = markersOf(doc).find((m) => m.id === markerId);
  if (!marker || marker.atMs === at || markersOf(doc).some((m) => m.id !== markerId && m.atMs === at)) return doc;
  return produce(doc, (draft) => {
    const target = draft.markers!.find((m) => m.id === markerId)!;
    target.atMs = at;
    draft.markers!.sort((a, b) => a.atMs - b.atMs);
  });
}

export function renameMarker(doc: VideoDocument, markerId: string, label: string): VideoDocument {
  const clean = label.trim().slice(0, STUDIO_LIMITS.maxMarkerLabelRunes);
  const marker = markersOf(doc).find((m) => m.id === markerId);
  if (!marker || (marker.label ?? "") === clean) return doc;
  return produce(doc, (draft) => {
    const target = draft.markers!.find((m) => m.id === markerId)!;
    if (clean) target.label = clean;
    else delete target.label;
  });
}

export function adjacentMarker(doc: VideoDocument, fromMs: number, direction: 1 | -1): Marker | null {
  const markers = markersOf(doc);
  if (direction > 0) return markers.find((m) => m.atMs > fromMs) ?? null;
  return [...markers].reverse().find((m) => m.atMs < fromMs) ?? null;
}
