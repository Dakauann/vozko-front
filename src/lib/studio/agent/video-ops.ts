import { produce } from "immer";

import { captionsFromText, captionWindow } from "../captions";
import { newIconLayer, STUDIO_LIMITS, VIDEO_ASPECT_SIZES, VIDEO_ASPECTS, type Clip, type Fit, type Layer, type TrackKind, type VideoAspect, type VideoDocument } from "../document";
import { duplicateGroup, magnetize, moveGroup, placeStack, splitAt, trimLinked, withLinked } from "../edits";
import { KEYFRAME_PROPERTIES, keyframeFault, type Easing, type KeyframeProperty, type Keyframes } from "../keyframes";
import { KEYFRAME_PRESETS, withPreset, type KeyframePresetId } from "../keyframe-presets";
import { addMarker } from "../markers";
import { DEFAULT_OVERLAY_MS, overlayClip, sizedMediaClips, type MediaClipType } from "../media-clips";
import { DEFAULT_MOTION_MS, ENTRANCE_PRESETS, motionPresetPatch, type MotionPreset } from "../motion";
import { TEXT_STYLE_PRESETS, textPresetClips, type TextStylePreset } from "../text-presets";
import {
  addTrack,
  clipEnd,
  deleteClips,
  edgeBlock,
  findClip,
  moveTrack,
  placeClips,
  removeTrack,
  rippleDeleteClips,
  setClipTrimIn,
  trackAccepts,
  updateClip,
  updateTrack,
  type ClipPatch,
  type EdgeBlock,
  type TrackPatch,
} from "../timeline";
import { toggleDisabled } from "../tools";
import { clipIssue, isValidColor } from "../validate";
import type { AgentFocus, AgentOutcome } from "./batch";
import { keyframeFaultText, keyOutsideClipText } from "./keyframe-text";
import { fitsLayer, hasBox, hasStyle, issueText, LAYER_CLEARS, shapeLayerOf, stylePatch, withBox, type AgentBox, type AgentStyle } from "./layer-style";

export const VIDEO_OPERATIONS = [
  "add_media",
  "add_text",
  "add_shape",
  "add_icon",
  "add_captions",
  "move_clip",
  "trim_clip",
  "slip_clip",
  "split_clip",
  "delete_clips",
  "duplicate_clips",
  "update_clip",
  "animate",
  "motion_preset",
  "entrance",
  "exit",
  "add_track",
  "move_track",
  "update_track",
  "remove_track",
  "add_marker",
  "set_canvas",
  "seek",
  "select",
] as const;

export type VideoOpName = (typeof VIDEO_OPERATIONS)[number];

export const VIDEO_ID_FIELDS = ["clip_id", "clip_ids", "track_id"] as const;

export interface AgentKey {
  at_ms: number;
  value: number;
  easing?: Easing;
}

export interface VideoOperation extends AgentBox, AgentStyle {
  op: VideoOpName;
  ref?: string;
  clip_id?: string;
  clip_ids?: string[];
  track_id?: string;
  media_id?: string;
  at_ms?: number;
  start_ms?: number;
  end_ms?: number;
  duration_ms?: number;
  trim_in_ms?: number;
  to_index?: number;
  style?: TextStylePreset;
  preset?: KeyframePresetId;
  effect?: MotionPreset;
  property?: KeyframeProperty;
  keys?: AgentKey[];
  volume?: number;
  fade_in_ms?: number;
  fade_out_ms?: number;
  fit?: Fit;
  kind?: TrackKind;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  muted?: boolean;
  disabled?: boolean;
  ripple?: boolean;
  aspect?: VideoAspect;
  background?: string;
  icon_id?: string;
}

export interface VideoOpContext {
  playheadMs: number;
  magnetic: boolean;
  mediaType: (mediaId: string) => MediaClipType | null;
  sourceDuration: (assetId: string) => number | undefined;
  captions: (mediaId: string) => string | undefined;
  captionTrackName: string;
  icons: readonly string[];
}

type Outcome = AgentOutcome<VideoDocument>;

const READ_AGAIN = "leia o projeto de novo com studio_read";

function refuse(reason: string): Outcome {
  return { ok: false, reason };
}

function missingClip(id: string | undefined): Outcome {
  return refuse(`o clipe ${id ?? "(sem id)"} não existe; ${READ_AGAIN}`);
}

function missingTrack(id: string | undefined): Outcome {
  return refuse(`a faixa ${id ?? "(sem id)"} não existe; ${READ_AGAIN}`);
}

type TrackIssue = { kind: "missing" } | { kind: "locked" } | { kind: "wrong"; trackKind: TrackKind } | { kind: "busy"; clip: Clip };

function trackIssue(doc: VideoDocument, trackId: string, clip: Clip): TrackIssue | null {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track) return { kind: "missing" };
  if (track.locked) return { kind: "locked" };
  if (!trackAccepts(track.kind, clip.type)) return { kind: "wrong", trackKind: track.kind };
  const busy = track.clips.find((c) => c.startMs < clip.startMs + clip.durationMs && clipEnd(c) > clip.startMs);
  return busy ? { kind: "busy", clip: busy } : null;
}

function trackNote(trackId: string, issue: Exclude<TrackIssue, { kind: "missing" }>, placement: string): string {
  switch (issue.kind) {
    case "locked":
      return `a faixa ${trackId} está travada; ${placement}`;
    case "wrong":
      return `a faixa ${trackId} é de ${issue.trackKind === "audio" ? "áudio" : "vídeo"} e não recebe esse clipe; ${placement}`;
    case "busy":
      return `a faixa ${trackId} já tem o clipe ${issue.clip.id} de ${issue.clip.startMs} a ${clipEnd(issue.clip)} ms nesse trecho; ${placement}`;
  }
}

function noRoom(clips: readonly Clip[]): Outcome {
  const first = clips[0];
  return refuse(`o clipe em ${first.startMs} ms precisa de pelo menos ${STUDIO_LIMITS.minClipMs} ms antes do fim do vídeo, que vai até ${STUDIO_LIMITS.maxVideoMs} ms; use um at_ms menor`);
}

function onScreenFloor(doc: VideoDocument, startMs: number, durationMs: number): number {
  return doc.tracks.reduce((top, track, index) => {
    const busy = track.kind === "visual" && track.clips.some((c) => c.startMs < startMs + durationMs && clipEnd(c) > startMs);
    return busy ? index : top;
  }, -1);
}

type Placed = { document: VideoDocument; ids: string[]; notes: string[] };

function placedWith(result: { document: VideoDocument; ids: string[] } | null, clips: readonly Clip[], notes: string[]): Outcome | Placed {
  return result ? { ...result, notes } : noRoom(clips);
}

function placeOn(doc: VideoDocument, clips: readonly Clip[], trackId: string | undefined): Outcome | Placed {
  const issue = trackId ? trackIssue(doc, trackId, clips[0]) : null;
  if (!trackId || !issue) return placedWith(placeClips(doc, clips, trackId), clips, []);
  if (issue.kind === "missing") return missingTrack(trackId);
  if (issue.kind === "wrong") return placedWith(placeClips(doc, clips), clips, [trackNote(trackId, issue, "coloquei numa faixa livre do tipo certo")]);
  const index = doc.tracks.findIndex((t) => t.id === trackId);
  const added = addTrack(doc, doc.tracks[index].kind, index + 1);
  return placedWith(placeClips(added.document, clips, added.trackId), clips, [trackNote(trackId, issue, `coloquei numa faixa nova logo acima dela (${added.trackId})`)]);
}

function done(document: VideoDocument, focus: AgentFocus, label: string, extra: Partial<Extract<Outcome, { ok: true }>> = {}): Outcome {
  return { ok: true, document, focus, label, ...extra };
}

function targets(op: VideoOperation): string[] {
  if (op.clip_ids && op.clip_ids.length > 0) return op.clip_ids;
  return op.clip_id ? [op.clip_id] : [];
}

function sourceOf(doc: VideoDocument, ctx: VideoOpContext) {
  return (clipId: string) => {
    const assetId = findClip(doc, clipId)?.clip.assetId;
    return assetId ? ctx.sourceDuration(assetId) : undefined;
  };
}

function lockedClip(doc: VideoDocument, ids: readonly string[]): Outcome | null {
  const held = ids.find((id) => findClip(doc, id)?.track.locked);
  return held ? refuse(`o clipe ${held} está numa faixa travada; destrave com update_track antes`) : null;
}

function checkedClips(before: VideoDocument, after: VideoDocument, ids: readonly string[], unchanged: string | null): Outcome | null {
  if (after === before && unchanged !== null) return refuse(unchanged);
  for (const id of ids) {
    const found = findClip(after, id);
    if (!found) continue;
    const fault = keyframeFault(found.clip.keyframes, found.clip.transform);
    if (fault) return refuse(`o clipe ${id} ficaria inválido: ${keyframeFaultText(fault)}`);
    const code = clipIssue(found.clip, found.track.kind, after.durationMs);
    if (code) return refuse(`o clipe ${id} ficaria inválido: ${issueText(code)}`);
  }
  return null;
}

function newIds(before: VideoDocument, after: VideoDocument): string[] {
  const known = new Set(before.tracks.flatMap((t) => t.clips.map((c) => c.id)));
  return after.tracks.flatMap((t) => t.clips.map((c) => c.id)).filter((id) => !known.has(id));
}

function timed(clip: Clip, atMs: number, durationMs: number | undefined): Clip {
  return { ...clip, startMs: Math.round(atMs), durationMs: Math.round(durationMs ?? clip.durationMs) };
}

function addMedia(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const mediaId = op.media_id ?? "";
  const type = mediaId ? ctx.mediaType(mediaId) : null;
  if (!type) return refuse(`a mídia ${mediaId || "(sem media_id)"} não está na biblioteca ou não é vídeo, imagem ou áudio`);
  const at = op.at_ms ?? ctx.playheadMs;
  const source = type === "image" ? undefined : ctx.sourceDuration(mediaId);
  const clips = sizedMediaClips(type, mediaId, at, source, op.duration_ms);
  const placed = placeOn(doc, clips, op.track_id);
  if ("ok" in placed) return placed;
  return done(placed.document, { kind: "clip", clipId: placed.ids[0] }, "add_media", { created: placed.ids, notes: placed.notes });
}

function styled(clip: Clip, op: VideoOperation): { ok: true; clip: Clip } | { ok: false; reason: string } {
  const style = stylePatch(op, LAYER_CLEARS);
  if (!style.ok) return style;
  const layer = { ...clip.layer!, ...style.value };
  return { ok: true, clip: { ...clip, layer, transform: withBox(clip.transform, op) } };
}

function addText(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (!op.text || op.text.trim() === "") return refuse("add_text precisa de text");
  const preset = op.style ?? "headline";
  if (!(TEXT_STYLE_PRESETS as readonly string[]).includes(preset)) return refuse(`o estilo ${preset} não existe`);
  const at = op.at_ms ?? ctx.playheadMs;
  const clips = textPresetClips(preset, op.text, at).map((c) => timed(c, at, op.duration_ms ?? DEFAULT_OVERLAY_MS));
  const textIndex = clips.findIndex((c) => c.layer?.type === "text");
  const text = clips[textIndex];
  const restyled = styled(text, op);
  if (!restyled.ok) return refuse(restyled.reason);
  const dx = restyled.clip.transform.x - text.transform.x;
  const dy = restyled.clip.transform.y - text.transform.y;
  const shifted = clips.map((c, i) => (i === textIndex ? restyled.clip : { ...c, transform: { ...c.transform, x: c.transform.x + dx, y: c.transform.y + dy } }));
  const issue = op.track_id ? trackIssue(doc, op.track_id, shifted[0]) : null;
  if (op.track_id && issue?.kind === "missing") return missingTrack(op.track_id);
  const requested = op.track_id ? doc.tracks.findIndex((t) => t.id === op.track_id) : -1;
  const onScreen = onScreenFloor(doc, shifted[0].startMs, shifted[0].durationMs);
  const floor = !op.track_id || issue?.kind === "wrong" ? onScreen : issue ? requested : requested - 1;
  const notes = op.track_id && issue && issue.kind !== "missing" ? [trackNote(op.track_id, issue, issue.kind === "wrong" ? "coloquei acima do que está na tela" : "coloquei numa faixa acima dela")] : [];
  const placed = placeStack(doc, shifted, floor);
  if (!placed) return noRoom(shifted);
  const textId = placed.ids[textIndex];
  const created = [textId, ...placed.ids.filter((id) => id !== textId)];
  return checkedClips(doc, placed.document, created, "o texto não pôde ser criado") ?? done(placed.document, { kind: "clip", clipId: textId }, "add_text", { created, notes });
}

function addShape(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const shape = shapeLayerOf(op, VIDEO_ASPECT_SIZES[doc.canvas.aspect]);
  if (!shape.ok) return refuse(shape.reason);
  const base = shape.value;
  return placeOverlay(doc, op, ctx, base, shape.ignored, "add_shape", "a forma não pôde ser criada");
}

function addIcon(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (!op.icon_id || !ctx.icons.includes(op.icon_id)) return refuse(`o ícone ${op.icon_id ?? "(sem icon_id)"} não existe; use um de: ${ctx.icons.join(", ")}`);
  return placeOverlay(doc, op, ctx, newIconLayer(op.icon_id), [], "add_icon", "o ícone não pôde ser colocado");
}

function placeOverlay(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext, base: Layer, earlier: readonly string[], label: string, failure: string): Outcome {
  const patch = stylePatch(op, LAYER_CLEARS);
  const style = patch.ok ? fitsLayer(base, patch.value) : patch;
  if (!style.ok) return refuse(style.reason);
  const notes = [...earlier, ...style.ignored];
  const at = op.at_ms ?? ctx.playheadMs;
  const clip = timed(overlayClip({ ...base, ...style.value }, at, withBox(base.transform, op)), at, op.duration_ms ?? DEFAULT_OVERLAY_MS);
  const placed = placeOn(doc, [clip], op.track_id);
  if ("ok" in placed) return placed;
  return checkedClips(doc, placed.document, placed.ids, failure) ?? done(placed.document, { kind: "clip", clipId: placed.ids[0] }, label, { created: placed.ids, notes: [...notes, ...placed.notes] });
}

function addCaptions(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const source = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!source) return missingClip(op.clip_id);
  const text = op.media_id ? ctx.captions(op.media_id) : undefined;
  if (text === undefined) return refuse("o arquivo de legendas não pôde ser lido; confira o media_id em studio_jobs");
  const outcome = captionsFromText(doc, text, captionWindow(source.clip), ctx.captionTrackName);
  if (outcome.status === "unreadable") return refuse("o arquivo não tem nenhuma legenda em WebVTT ou SRT; se veio de studio_jobs, a fala não foi encontrada");
  if (outcome.status === "empty") return refuse("as legendas não têm fala dentro desse clipe");
  if (outcome.status === "invalid") return refuse("as legendas deixariam o projeto inválido: alguma legenda passa do tamanho de texto permitido ou o projeto ficaria grande demais");
  const created = outcome.document.tracks.find((t) => t.id === outcome.trackId)!.clips.map((c) => c.id);
  return done(outcome.document, { kind: "track", trackId: outcome.trackId, atMs: source.clip.startMs }, "add_captions", { created, changed: [outcome.trackId] });
}

function blockText(block: EdgeBlock, edge: "start" | "end"): string {
  switch (block.kind) {
    case "neighbour":
      return edge === "end" ? `o clipe ${block.clipId} começa em ${block.ms} ms na mesma faixa` : `o clipe ${block.clipId} termina em ${block.ms} ms na mesma faixa`;
    case "source":
      return `o arquivo de origem só alcança ${block.ms} ms da linha do tempo`;
    case "video":
      return `o vídeo vai de 0 a ${STUDIO_LIMITS.maxVideoMs} ms`;
    case "minimum":
      return `o clipe precisa de pelo menos ${STUDIO_LIMITS.minClipMs} ms`;
    case "locked":
      return `a faixa ${block.trackId} está travada`;
  }
}

function tightest(doc: VideoDocument, ids: readonly string[], edge: "start" | "end", requested: number, ctx: VideoOpContext): EdgeBlock | null {
  const blocks = ids.flatMap((id) => {
    const clip = findClip(doc, id)?.clip;
    const block = clip ? edgeBlock(doc, id, edge, requested, clip.assetId ? ctx.sourceDuration(clip.assetId) : undefined) : null;
    return block ? [block] : [];
  });
  const locked = blocks.find((b) => b.kind === "locked");
  if (locked) return locked;
  const timed = blocks.filter((b): b is Exclude<EdgeBlock, { kind: "locked" }> => b.kind !== "locked");
  if (timed.length === 0) return null;
  return timed.reduce((best, b) => (edge === "end" ? (b.ms < best.ms ? b : best) : b.ms > best.ms ? b : best));
}

function busyOn(doc: VideoDocument, trackId: string, startMs: number, durationMs: number, except: ReadonlySet<string>): string | null {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track) return null;
  if (track.locked) return `a faixa ${trackId} está travada`;
  const hit = track.clips.find((c) => !except.has(c.id) && c.startMs < startMs + durationMs && clipEnd(c) > startMs);
  return hit ? `a faixa ${trackId} já tem o clipe ${hit.id} de ${hit.startMs} a ${clipEnd(hit)} ms nesse trecho` : null;
}

function moveBlocks(doc: VideoDocument, primaryId: string, group: readonly string[], trackId: string | undefined, start: number): string[] {
  const primary = findClip(doc, primaryId)!;
  const except = new Set(group);
  return group.flatMap((id) => {
    const { clip, track } = findClip(doc, id)!;
    const target = id === primaryId ? (trackId ?? track.id) : track.id;
    const reason = busyOn(doc, target, start + (clip.startMs - primary.clip.startMs), clip.durationMs, except);
    return reason ? [reason] : [];
  });
}

function moveOne(doc: VideoDocument, op: VideoOperation): Outcome {
  if (!op.clip_id || !findClip(doc, op.clip_id)) return missingClip(op.clip_id);
  const start = op.start_ms ?? op.at_ms;
  if (start === undefined) return refuse("move_clip precisa de start_ms");
  if (op.track_id && !doc.tracks.some((t) => t.id === op.track_id)) return missingTrack(op.track_id);
  const group = withLinked(doc, [op.clip_id]);
  const exactly = (result: VideoDocument, trackId: string | undefined) => {
    const moved = findClip(result, op.clip_id!);
    return result !== doc && moved !== null && moved.clip.startMs === Math.max(0, Math.round(start)) && (!trackId || moved.track.id === trackId);
  };
  const next = moveGroup(doc, op.clip_id, group, op.track_id ?? null, start);
  if (exactly(next, op.track_id)) return done(next, { kind: "clip", clipId: op.clip_id }, "move_clip", { changed: group });
  const blocks = moveBlocks(doc, op.clip_id, group, op.track_id, start);
  const home = findClip(doc, op.clip_id)!;
  const targetId = op.track_id ?? home.track.id;
  const target = doc.tracks.find((t) => t.id === targetId)!;
  if (group.length === 1 && blocks.length > 0 && trackAccepts(target.kind, home.clip.type)) {
    const added = addTrack(doc, target.kind, doc.tracks.indexOf(target) + 1);
    const placed = moveGroup(added.document, op.clip_id, group, added.trackId, start);
    if (exactly(placed, added.trackId)) return done(placed, { kind: "clip", clipId: op.clip_id }, "move_clip", { changed: group, notes: [`${blocks[0]}; coloquei numa faixa nova logo acima dela (${added.trackId})`] });
  }
  const reason = blocks.length > 0 ? blocks.join("; ") : `a faixa ${targetId} não recebe esse clipe ou o tempo ${start} ms fica fora do vídeo`;
  return refuse(`o clipe não pôde ir para ${start} ms: ${reason}; mova ou apague o que está no caminho antes, ou use outra faixa`);
}

function trim(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (!op.clip_id || !findClip(doc, op.clip_id)) return missingClip(op.clip_id);
  if (op.start_ms === undefined && op.end_ms === undefined && op.duration_ms === undefined) return refuse("trim_clip precisa de start_ms, end_ms ou duration_ms");
  const group = withLinked(doc, [op.clip_id]);
  const notes: string[] = [];
  const problems: string[] = [];
  let moved = false;
  let next = doc;
  const edgeTo = (edge: "start" | "end", requested: number) => {
    const block = tightest(next, group, edge, requested, ctx);
    if (block?.kind !== "locked") next = trimLinked(next, op.clip_id!, edge, block ? block.ms : requested, sourceOf(next, ctx));
    const clip = findClip(next, op.clip_id!)!.clip;
    const reached = edge === "start" ? clip.startMs : clipEnd(clip);
    const before = findClip(doc, op.clip_id!)!.clip;
    const unchanged = reached === (edge === "start" ? before.startMs : clipEnd(before));
    if (!unchanged) moved = true;
    if (reached === Math.round(requested) || !block) return;
    const label = edge === "start" ? "o início" : "o fim";
    (unchanged ? problems : notes).push(unchanged ? `${label} não mudou: ${blockText(block, edge)}` : `${label} ficou em ${reached} ms porque ${blockText(block, edge)}`);
  };
  if (op.start_ms !== undefined) edgeTo("start", op.start_ms);
  const end = op.end_ms ?? (op.duration_ms !== undefined ? findClip(next, op.clip_id)!.clip.startMs + op.duration_ms : undefined);
  if (end !== undefined) edgeTo("end", end);
  if (!moved) return refuse(problems.length > 0 ? `${problems.join("; ")}; mova ou apague esse clipe antes, ou corte só até lá` : "o clipe já tem esse início e esse fim");
  return checkedClips(doc, next, [op.clip_id], null) ?? done(next, { kind: "clip", clipId: op.clip_id }, "trim_clip", { changed: withLinked(next, [op.clip_id]), notes: [...notes, ...problems] });
}

function slip(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return missingClip(op.clip_id);
  if (op.trim_in_ms === undefined) return refuse("slip_clip precisa de trim_in_ms");
  const next = setClipTrimIn(doc, found.clip.id, op.trim_in_ms, found.clip.assetId ? ctx.sourceDuration(found.clip.assetId) : undefined);
  if (next === doc) return refuse("o ponto de entrada não mudou: só vídeo e áudio têm origem, a faixa pode estar travada ou o valor já é esse");
  return done(next, { kind: "clip", clipId: found.clip.id }, "slip_clip", { changed: [found.clip.id] });
}

function split(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (!op.clip_id || !findClip(doc, op.clip_id)) return missingClip(op.clip_id);
  const at = op.at_ms ?? ctx.playheadMs;
  const next = splitAt(doc, at, withLinked(doc, [op.clip_id]));
  if (next === doc) return refuse("o corte precisa cair dentro do clipe, a pelo menos 100 ms das pontas, numa faixa destravada");
  const created = newIds(doc, next);
  const right = created.find((id) => findClip(next, id)?.track.id === findClip(doc, op.clip_id!)!.track.id);
  return done(next, { kind: "clip", clipId: op.clip_id }, "split_clip", { created: right ? [right, ...created.filter((id) => id !== right)] : created });
}

function remove(doc: VideoDocument, op: VideoOperation): Outcome {
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const group = withLinked(doc, ids);
  const next = op.ripple ? rippleDeleteClips(doc, group) : deleteClips(doc, group);
  if (group.some((id) => findClip(next, id))) return refuse("nada foi apagado: algum clipe está numa faixa travada");
  const anchor = findClip(doc, ids[0])!;
  return done(next, { kind: "track", trackId: anchor.track.id, atMs: anchor.clip.startMs }, "delete_clips", { changed: group });
}

function duplicate(doc: VideoDocument, op: VideoOperation): Outcome {
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const result = duplicateGroup(doc, withLinked(doc, ids));
  if (result.clipIds.length === 0) return refuse(`a cópia não cabe antes do fim do vídeo, que vai até ${STUDIO_LIMITS.maxVideoMs} ms, ou a faixa está travada`);
  return done(result.document, { kind: "clip", clipId: result.clipIds[0] }, "duplicate_clips", { created: result.clipIds });
}

function clipPatch(clip: Clip, op: VideoOperation): { ok: true; patch: ClipPatch; ignored: string[] } | { ok: false; reason: string } {
  const patch: ClipPatch = {};
  if (op.volume !== undefined) patch.volume = op.volume;
  if (op.fade_in_ms !== undefined) patch.fadeInMs = Math.round(op.fade_in_ms);
  if (op.fade_out_ms !== undefined) patch.fadeOutMs = Math.round(op.fade_out_ms);
  if (op.fit !== undefined) {
    if (clip.type !== "video" && clip.type !== "image") return { ok: false, reason: "fit só vale para vídeos e imagens" };
    patch.fit = op.fit;
  }
  if (hasBox(op)) {
    if (clip.type === "audio") return { ok: false, reason: "um áudio não tem posição na tela" };
    patch.transform = withBox(clip.transform, op);
  }
  if (hasStyle(op)) {
    const style = stylePatch(op, LAYER_CLEARS);
    if (!style.ok) return style;
    const allowed = fitsLayer(clip.layer, style.value);
    if (!allowed.ok) return allowed;
    if (Object.keys(allowed.value).length > 0) patch.layer = { ...clip.layer!, ...allowed.value };
    return { ok: true, patch, ignored: allowed.ignored };
  }
  return { ok: true, patch, ignored: [] };
}

function update(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const held = lockedClip(doc, ids);
  if (held) return held;
  let next = doc;
  const notes: string[] = [];
  for (const id of ids) {
    const clip = findClip(next, id)!.clip;
    const built = clipPatch(clip, op);
    if (!built.ok) return refuse(`clipe ${id}: ${built.reason}`);
    notes.push(...built.ignored.map((note) => `clipe ${id}: ${note}`));
    if (Object.keys(built.patch).length > 0) next = updateClip(next, id, built.patch);
    if (op.duration_ms !== undefined) next = trimLinked(next, id, "end", clip.startMs + op.duration_ms, sourceOf(next, ctx));
  }
  if (op.disabled !== undefined) {
    const flip = ids.filter((id) => Boolean(findClip(next, id)!.clip.disabled) !== op.disabled);
    if (flip.length > 0) next = toggleDisabled(next, flip);
  }
  if (next === doc && notes.length > 0) return refuse(`nada foi aplicado: ${notes.join("; ")}`);
  return checkedClips(doc, next, ids, null) ?? done(next, focusOf(next, ids[0], op), "update_clip", { changed: ids, notes });
}

function focusOf(doc: VideoDocument, clipId: string, op: VideoOperation): AgentFocus {
  const clip = findClip(doc, clipId)?.clip;
  if (clip && clip.type !== "audio" && (hasBox(op) || hasStyle(op))) return { kind: "frame", x: clip.transform.x, y: clip.transform.y, w: clip.transform.w, h: clip.transform.h };
  return { kind: "clip", clipId };
}

function animate(doc: VideoDocument, op: VideoOperation): Outcome {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return missingClip(op.clip_id);
  if (found.clip.type === "audio") return refuse("áudio não tem animação; use fade_in_ms e fade_out_ms");
  if (!op.property || !(KEYFRAME_PROPERTIES as readonly string[]).includes(op.property)) return refuse(`animate precisa de property: ${KEYFRAME_PROPERTIES.join(", ")}`);
  const held = lockedClip(doc, [found.clip.id]);
  if (held) return held;
  const frames = (op.keys ?? [])
    .map((k) => ({ atMs: Math.round(k.at_ms), value: k.value, easing: k.easing ?? "easeInOut" }))
    .sort((a, b) => a.atMs - b.atMs);
  const outside = frames.find((f) => f.atMs < 0 || f.atMs > found.clip.durationMs);
  if (outside) return refuse(keyOutsideClipText(op.property, outside.atMs, found.clip.durationMs));
  const keyframes: Keyframes = { ...found.clip.keyframes };
  if (frames.length === 0) delete keyframes[op.property];
  else keyframes[op.property] = frames;
  const next = Object.values(keyframes).some((list) => list && list.length > 0) ? keyframes : undefined;
  const fault = keyframeFault(next, found.clip.transform);
  if (fault) return refuse(keyframeFaultText(fault));
  const after = updateClip(doc, found.clip.id, { keyframes: next });
  return done(after, { kind: "frame", x: found.clip.transform.x, y: found.clip.transform.y, w: found.clip.transform.w, h: found.clip.transform.h }, "animate", { changed: [found.clip.id] });
}

function preset(doc: VideoDocument, op: VideoOperation): Outcome {
  if (!op.preset || !(KEYFRAME_PRESETS as readonly string[]).includes(op.preset)) return refuse(`motion_preset precisa de preset: ${KEYFRAME_PRESETS.join(", ")}`);
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const held = lockedClip(doc, ids);
  if (held) return held;
  let next = doc;
  for (const id of ids) {
    const clip = findClip(next, id)!.clip;
    if (clip.type === "audio") return refuse(`o clipe ${id} é áudio e não tem animação`);
    const keyframes = withPreset(clip, op.preset);
    const fault = keyframeFault(keyframes, clip.transform);
    if (fault) return refuse(`o clipe ${id} não aceita ${op.preset}: ${keyframeFaultText(fault)}`);
    next = updateClip(next, id, { keyframes });
  }
  return checkedClips(doc, next, ids, null) ?? done(next, { kind: "clip", clipId: ids[0] }, "motion_preset", { changed: ids });
}

function edge(doc: VideoDocument, op: VideoOperation, side: "in" | "out"): Outcome {
  const effect = op.effect ?? "fade";
  if (!(ENTRANCE_PRESETS as readonly string[]).includes(effect)) return refuse(`effect precisa ser um de: ${ENTRANCE_PRESETS.join(", ")}`);
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const held = lockedClip(doc, ids);
  if (held) return held;
  let next = doc;
  for (const id of ids) {
    const clip = findClip(next, id)!.clip;
    if (clip.type === "audio" && effect !== "fade" && effect !== "none") return refuse(`o clipe ${id} é áudio: só fade ou none`);
    next = updateClip(next, id, motionPresetPatch(side, effect, op.duration_ms ?? DEFAULT_MOTION_MS));
  }
  return checkedClips(doc, next, ids, null) ?? done(next, { kind: "clip", clipId: ids[0] }, side === "in" ? "entrance" : "exit", { changed: ids });
}

function addTrackOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const kind = op.kind ?? "visual";
  const added = addTrack(doc, kind, op.to_index ?? doc.tracks.length);
  const named = op.name ? updateTrack(added.document, added.trackId, { name: op.name.slice(0, 64) }) : added.document;
  return done(named, { kind: "track", trackId: added.trackId }, "add_track", { created: [added.trackId] });
}

function moveTrackOp(doc: VideoDocument, op: VideoOperation): Outcome {
  if (!op.track_id || !doc.tracks.some((t) => t.id === op.track_id)) return missingTrack(op.track_id);
  if (op.to_index === undefined) return refuse("move_track precisa de to_index");
  const next = moveTrack(doc, op.track_id, op.to_index);
  return done(next, { kind: "track", trackId: op.track_id }, "move_track", { changed: [op.track_id] });
}

function updateTrackOp(doc: VideoDocument, op: VideoOperation): Outcome {
  if (!op.track_id || !doc.tracks.some((t) => t.id === op.track_id)) return missingTrack(op.track_id);
  const patch: TrackPatch = {};
  if (op.name !== undefined) patch.name = op.name.slice(0, 64);
  if (op.hidden !== undefined) patch.hidden = op.hidden;
  if (op.locked !== undefined) patch.locked = op.locked;
  if (op.muted !== undefined) patch.muted = op.muted;
  if (Object.keys(patch).length === 0) return refuse("update_track precisa de name, hidden, locked ou muted");
  return done(updateTrack(doc, op.track_id, patch), { kind: "track", trackId: op.track_id }, "update_track", { changed: [op.track_id] });
}

function removeTrackOp(doc: VideoDocument, op: VideoOperation): Outcome {
  if (!op.track_id || !doc.tracks.some((t) => t.id === op.track_id)) return missingTrack(op.track_id);
  const next = removeTrack(doc, op.track_id);
  if (next === doc) return refuse("a faixa está travada; destrave antes de remover");
  return done(next, { kind: "time", atMs: 0 }, "remove_track", { changed: [op.track_id] });
}

function marker(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const at = op.at_ms ?? ctx.playheadMs;
  const result = addMarker(doc, at, op.name);
  if (!result.markerId) return refuse("já existe um marcador nesse ponto ou o limite de marcadores foi atingido");
  return done(result.document, { kind: "time", atMs: at }, "add_marker", { created: [result.markerId] });
}

function canvas(doc: VideoDocument, op: VideoOperation): Outcome {
  if (op.aspect === undefined && op.background === undefined) return refuse("set_canvas precisa de aspect ou background");
  if (op.aspect !== undefined && !VIDEO_ASPECTS.includes(op.aspect)) return refuse(`aspect precisa ser um de: ${VIDEO_ASPECTS.join(", ")}`);
  if (op.background !== undefined && (!isValidColor(op.background, true) || op.background.length !== 7)) return refuse("background precisa ser uma cor #rrggbb");
  const next = produce(doc, (draft) => {
    if (op.aspect) draft.canvas.aspect = op.aspect;
    if (op.background) draft.canvas.background = op.background;
  });
  return done(next, { kind: "frame", x: 0.5, y: 0.5 }, "set_canvas");
}

function select(doc: VideoDocument, op: VideoOperation): Outcome {
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (missing) return missingClip(missing);
  return done(doc, ids[0] ? { kind: "clip", clipId: ids[0] } : { kind: "time", atMs: 0 }, "select", { select: ids });
}

function seek(doc: VideoDocument, op: VideoOperation): Outcome {
  if (op.at_ms === undefined) return refuse("seek precisa de at_ms");
  const at = Math.max(0, Math.min(Math.round(op.at_ms), doc.durationMs));
  return done(doc, { kind: "time", atMs: at }, "seek", { seekMs: at });
}

const LAYOUT_OPS: ReadonlySet<VideoOpName> = new Set(["add_media", "add_text", "add_shape", "move_clip", "trim_clip", "split_clip", "delete_clips", "duplicate_clips", "update_clip"]);

function dispatch(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  switch (op.op) {
    case "add_media":
      return addMedia(doc, op, ctx);
    case "add_text":
      return addText(doc, op, ctx);
    case "add_icon":
      return addIcon(doc, op, ctx);
    case "add_shape":
      return addShape(doc, op, ctx);
    case "add_captions":
      return addCaptions(doc, op, ctx);
    case "move_clip":
      return moveOne(doc, op);
    case "trim_clip":
      return trim(doc, op, ctx);
    case "slip_clip":
      return slip(doc, op, ctx);
    case "split_clip":
      return split(doc, op, ctx);
    case "delete_clips":
      return remove(doc, op);
    case "duplicate_clips":
      return duplicate(doc, op);
    case "update_clip":
      return update(doc, op, ctx);
    case "animate":
      return animate(doc, op);
    case "motion_preset":
      return preset(doc, op);
    case "entrance":
      return edge(doc, op, "in");
    case "exit":
      return edge(doc, op, "out");
    case "add_track":
      return addTrackOp(doc, op);
    case "move_track":
      return moveTrackOp(doc, op);
    case "update_track":
      return updateTrackOp(doc, op);
    case "remove_track":
      return removeTrackOp(doc, op);
    case "add_marker":
      return marker(doc, op, ctx);
    case "set_canvas":
      return canvas(doc, op);
    case "seek":
      return seek(doc, op);
    case "select":
      return select(doc, op);
  }
  return refuse(`a operação ${String((op as { op: unknown }).op)} não existe`);
}

export function applyVideoOperation(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): AgentOutcome<VideoDocument> {
  const outcome = dispatch(doc, op, ctx);
  if (!outcome.ok || !ctx.magnetic || !LAYOUT_OPS.has(op.op)) return outcome;
  return { ...outcome, document: magnetize(outcome.document, true) };
}

export function videoIds(doc: VideoDocument): string[] {
  return doc.tracks.flatMap((track) => [track.id, ...track.clips.map((c) => c.id)]);
}
