import { addClipMarker, beatSource, markBeats, removeClipMarker, updateClipMarker, type BeatMarkRefusal, type ClipMarkerRefusal } from "../clip-marker-edits";
import { placedClipMarkers } from "../clip-markers";
import type { Clip, ClipMarker, Marker, Track, VideoDocument } from "../document";
import { LABEL_COLORS, type LabelColor } from "../labels";
import type { LoudnessSource } from "../loudness";
import { addMarker, markerEndMs, removeMarker, updateMarker, type MarkerFields, type MarkerPatch } from "../markers";
import { cleanClipName } from "../organize";
import { findClip, type ClipPatch, type TrackPatch } from "../timeline";
import type { AgentFocus } from "./batch";

export const ORGANIZE_OPERATIONS = ["mark_beats"] as const;

export const MARKER_OPERATIONS = ["add_marker", "update_marker", "remove_marker", ...ORGANIZE_OPERATIONS] as const;

export type MarkerOpName = (typeof MARKER_OPERATIONS)[number];

export const NO_LABEL = "none";

export type AgentLabel = LabelColor | typeof NO_LABEL;

export const AGENT_LABELS: readonly AgentLabel[] = [...LABEL_COLORS, NO_LABEL];

export interface AgentOrganizeFields {
  marker_color?: AgentLabel;
  note?: string;
  label_color?: AgentLabel;
  shy?: boolean;
  guide?: boolean;
  beat_every?: number;
  unset?: ("name" | "note")[];
}

export interface MarkerOpInput extends AgentOrganizeFields {
  op: string;
  marker_id?: string;
  clip_id?: string;
  at_ms?: number;
  duration_ms?: number;
  name?: string;
}

export type MarkerOpResult = { ok: true; document: VideoDocument; focus: AgentFocus; created: string[]; changed: string[]; notes: string[] } | { ok: false; reason: string };

export interface OutlineMarker {
  id: string;
  at_ms: number;
  duration_ms?: number;
  label?: string;
  color?: LabelColor;
  note?: string;
  beat?: boolean;
}

const READ_AGAIN = "leia o projeto de novo com studio_read";

const REFUSALS: Record<ClipMarkerRefusal, string> = {
  missing: `o marcador ou o clipe não existe; ${READ_AGAIN}`,
  taken: "já existe um marcador nesse ponto",
  locked: "a faixa do clipe está travada; destrave antes",
  outside: "o instante cai fora do clipe; use at_ms entre start_ms e end_ms do clipe",
};

export function isMarkerOp(name: string): name is MarkerOpName {
  return (MARKER_OPERATIONS as readonly string[]).includes(name);
}

function colorOf(label: AgentLabel | undefined): LabelColor | null | undefined {
  if (label === undefined) return undefined;
  return label === NO_LABEL ? null : label;
}

function patchOf(op: MarkerOpInput): MarkerPatch {
  const patch: MarkerPatch = {};
  if (op.at_ms !== undefined) patch.atMs = op.at_ms;
  if (op.duration_ms !== undefined) patch.durationMs = op.duration_ms;
  if (op.name !== undefined) patch.label = op.name;
  if (op.note !== undefined) patch.note = op.note;
  if (op.unset?.includes("name")) patch.label = "";
  if (op.unset?.includes("note")) patch.note = "";
  const color = colorOf(op.marker_color);
  if (color !== undefined) patch.color = color;
  return patch;
}

function fieldsOf(op: MarkerOpInput): MarkerFields {
  const patch = patchOf(op);
  return {
    ...(patch.durationMs !== undefined ? { durationMs: patch.durationMs } : {}),
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    ...(patch.color ? { color: patch.color } : {}),
  };
}

function ok(document: VideoDocument, focus: AgentFocus, extra: Partial<Pick<Extract<MarkerOpResult, { ok: true }>, "created" | "changed" | "notes">>): MarkerOpResult {
  return { ok: true, document, focus, created: extra.created ?? [], changed: extra.changed ?? [], notes: extra.notes ?? [] };
}

function clipMarkerHome(doc: VideoDocument, markerId: string): Clip[] {
  return doc.tracks.flatMap((track) => track.clips).filter((clip) => (clip.markers ?? []).some((m) => m.id === markerId));
}

function addMarkerOp(doc: VideoDocument, op: MarkerOpInput, playheadMs: number): MarkerOpResult {
  const at = op.at_ms ?? playheadMs;
  if (op.clip_id) {
    const result = addClipMarker(doc, op.clip_id, at, fieldsOf(op));
    if (!result.ok) return { ok: false, reason: `clipe ${op.clip_id}: ${REFUSALS[result.reason]}` };
    return ok(result.document, { kind: "clip", clipId: op.clip_id }, { created: [result.markerId] });
  }
  const result = addMarker(doc, at, fieldsOf(op));
  if (!result.markerId) return { ok: false, reason: REFUSALS.taken };
  return ok(result.document, { kind: "time", atMs: Math.round(at) }, { created: [result.markerId] });
}

function homeClip(doc: VideoDocument, op: MarkerOpInput): { clipId: string } | { film: true } | { reason: string } {
  const markerId = op.marker_id ?? "";
  if (op.clip_id) return findClip(doc, op.clip_id) ? { clipId: op.clip_id } : { reason: `o clipe ${op.clip_id} não existe; ${READ_AGAIN}` };
  if ((doc.markers ?? []).some((m) => m.id === markerId)) return { film: true };
  const homes = clipMarkerHome(doc, markerId);
  if (homes.length === 1) return { clipId: homes[0].id };
  if (homes.length > 1) return { reason: `o marcador ${markerId} está em mais de um clipe (${homes.map((c) => c.id).join(", ")}); diga qual com clip_id` };
  return { reason: `o marcador ${markerId || "(sem marker_id)"} não existe; ${READ_AGAIN}` };
}

function updateMarkerOp(doc: VideoDocument, op: MarkerOpInput): MarkerOpResult {
  const patch = patchOf(op);
  if (Object.keys(patch).length === 0) return { ok: false, reason: "update_marker precisa de name, at_ms, duration_ms, marker_color ou note" };
  const home = homeClip(doc, op);
  if ("reason" in home) return { ok: false, reason: home.reason };
  const markerId = op.marker_id!;
  if ("clipId" in home) {
    const result = updateClipMarker(doc, home.clipId, markerId, patch);
    if (!result.ok) return { ok: false, reason: `clipe ${home.clipId}: ${REFUSALS[result.reason]}` };
    return ok(result.document, { kind: "clip", clipId: home.clipId }, { changed: [markerId] });
  }
  const result = updateMarker(doc, markerId, patch);
  if (!result.ok) return { ok: false, reason: REFUSALS[result.reason] };
  const at = (result.document.markers ?? []).find((m) => m.id === markerId)!.atMs;
  return ok(result.document, { kind: "time", atMs: at }, { changed: [markerId] });
}

function removeMarkerOp(doc: VideoDocument, op: MarkerOpInput): MarkerOpResult {
  const home = homeClip(doc, op);
  if ("reason" in home) return { ok: false, reason: home.reason };
  const markerId = op.marker_id!;
  if ("clipId" in home) {
    const result = removeClipMarker(doc, home.clipId, markerId);
    if (!result.ok) return { ok: false, reason: `clipe ${home.clipId}: ${REFUSALS[result.reason]}` };
    return ok(result.document, { kind: "clip", clipId: home.clipId }, { changed: [markerId] });
  }
  const at = (doc.markers ?? []).find((m) => m.id === markerId)!.atMs;
  return ok(removeMarker(doc, markerId), { kind: "time", atMs: at }, { changed: [markerId] });
}

const BEAT_REFUSALS: Record<BeatMarkRefusal, string> = {
  missing: `o clipe não existe; ${READ_AGAIN}`,
  locked: "a faixa do clipe está travada; destrave antes",
  notAudio: "mark_beats lê as batidas de um clipe de áudio (música); use o clip_id de um clipe de áudio",
  noPulse: "não há uma pulsação clara nesse som (silêncio, fala ou trecho curto demais); marque à mão com add_marker e clip_id",
  outside: "nenhuma batida caiu dentro do trecho que o clipe toca",
};

function markBeatsOp(doc: VideoDocument, op: MarkerOpInput, loudness: LoudnessSource): MarkerOpResult {
  const clipId = op.clip_id ?? "";
  const source = beatSource(doc, clipId);
  if (!source.ok) return { ok: false, reason: `clipe ${clipId || "(sem clip_id)"}: ${BEAT_REFUSALS[source.reason]}` };
  const profile = loudness(source.assetId);
  if (!profile) return { ok: false, reason: "o som do clipe ainda não foi lido; tente de novo em instantes" };
  const color = colorOf(op.marker_color);
  const result = markBeats(doc, clipId, profile, { every: op.beat_every, ...(color ? { color } : {}) });
  if (!result.ok) return { ok: false, reason: `clipe ${clipId}: ${BEAT_REFUSALS[result.reason]}` };
  return ok(result.document, { kind: "clip", clipId }, { changed: [clipId], notes: [`${result.placed} batidas marcadas no clipe ${clipId}, ${result.bpm} BPM; studio_read traz cada uma em markers com at_ms na linha do tempo`] });
}

export function markerOperation(doc: VideoDocument, op: MarkerOpInput, playheadMs: number, loudness: LoudnessSource): MarkerOpResult | null {
  switch (op.op) {
    case "add_marker":
      return addMarkerOp(doc, op, playheadMs);
    case "update_marker":
      return updateMarkerOp(doc, op);
    case "remove_marker":
      return removeMarkerOp(doc, op);
    case "mark_beats":
      return markBeatsOp(doc, op, loudness);
  }
  return null;
}

export function organizeClipPatch(clip: Clip, op: Pick<MarkerOpInput, "name" | "label_color" | "guide" | "unset">): { ok: true; patch: ClipPatch } | { ok: false; reason: string } {
  const patch: ClipPatch = {};
  if (op.name !== undefined) patch.name = cleanClipName(op.name);
  if (op.unset?.includes("name")) patch.name = undefined;
  const color = colorOf(op.label_color);
  if (color !== undefined) patch.labelColor = color ?? undefined;
  if (op.guide !== undefined) {
    if (clip.type === "null") return { ok: false, reason: "um nulo não aparece na imagem; guide vale para clipes que aparecem ou tocam" };
    patch.guide = op.guide || undefined;
  }
  return { ok: true, patch };
}

export function organizeTrackPatch(op: Pick<MarkerOpInput, "label_color" | "shy">): TrackPatch {
  const patch: TrackPatch = {};
  const color = colorOf(op.label_color);
  if (color !== undefined) patch.labelColor = color ?? undefined;
  if (op.shy !== undefined) patch.shy = op.shy || undefined;
  return patch;
}

export function markerOutline(marker: Marker | ClipMarker, atMs: number = marker.atMs, endMs: number = markerEndMs(marker)): OutlineMarker {
  return {
    id: marker.id,
    at_ms: atMs,
    ...(endMs > atMs ? { duration_ms: endMs - atMs } : {}),
    ...(marker.label ? { label: marker.label } : {}),
    ...(marker.color ? { color: marker.color } : {}),
    ...(marker.note ? { note: marker.note } : {}),
    ...("beat" in marker && marker.beat ? { beat: true } : {}),
  };
}

export function clipOrganizeOutline(clip: Clip): { name?: string; label_color?: LabelColor; guide?: boolean; markers?: OutlineMarker[] } {
  const markers = placedClipMarkers(clip).map((placed) => markerOutline(placed.marker, placed.startMs, placed.endMs));
  return {
    ...(clip.name ? { name: clip.name } : {}),
    ...(clip.labelColor ? { label_color: clip.labelColor } : {}),
    ...(clip.guide ? { guide: true } : {}),
    ...(markers.length > 0 ? { markers } : {}),
  };
}

export function trackOrganizeOutline(track: Track): { label_color?: LabelColor; shy?: boolean } {
  return { ...(track.labelColor ? { label_color: track.labelColor } : {}), ...(track.shy ? { shy: true } : {}) };
}
