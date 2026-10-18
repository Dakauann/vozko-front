import { produce, type Draft } from "immer";

import { clipSpeed, hasSourceTime, hasSpeedCurve, sourceAt, sourceSpanMs, speedKeys, SPEED_LIMITS, stretchedCurve } from "./clip-time";
import { canvasAspect, newStudioId, STUDIO_LIMITS, type Clip, type VideoDocument } from "./document";
import { linkGroup, rearrange, shiftChanges, splitAt, withLinked, type ClipChange, type ClipSource } from "./edits";
import { animatedBlur, curveExtent, ease, KEYFRAME_RANGES, keyframesInRange, retimeKeyframes, scaleAt, withLane, withoutProperty, type Easing, type Keyframe, type Keyframes } from "./keyframes";
import { SPEED_PROPERTY } from "./speed-range";
import { placementAt } from "./clip-placement";
import { clampClipTransform } from "./clip-transform";
import { clipEnd, findClip, type ClipLocation } from "./timeline";

export const DEFAULT_FREEZE_MS = 2000;

export interface RetimeRequest {
  speed?: number;
  durationMs?: number;
  keep?: "source" | "duration";
  reverse?: boolean;
  preservePitch?: boolean;
  ripple?: boolean;
  keyframes?: "stretch" | "keep";
  protectEdgesMs?: number;
}

export type RetimeRefusal = "missing" | "locked" | "notSourced" | "notVideo" | "frozen" | "range" | "source" | "noRoom";

export type RetimeResult = { ok: true; document: VideoDocument } | { ok: false; reason: RetimeRefusal };

type FreezeResult = { ok: true; document: VideoDocument; clipId: string } | { ok: false; reason: RetimeRefusal };

function refuse(reason: RetimeRefusal): { ok: false; reason: RetimeRefusal } {
  return { ok: false, reason };
}

export function groupOf(doc: VideoDocument, clipId: string): ClipLocation[] {
  return linkGroup(doc, clipId).flatMap((id) => {
    const found = findClip(doc, id);
    return found ? [found] : [];
  });
}

export function groupRefusal(group: readonly ClipLocation[]): RetimeRefusal | null {
  if (group.length === 0) return "missing";
  if (group.some((member) => member.track.locked)) return "locked";
  if (group.some((member) => !hasSourceTime(member.clip.type))) return "notSourced";
  if (group.some((member) => member.clip.freeze)) return "frozen";
  return null;
}

export function withinSpeed(speed: number): boolean {
  return Number.isFinite(speed) && speed >= SPEED_LIMITS[0] && speed <= SPEED_LIMITS[1];
}

export function followers(doc: VideoDocument, group: readonly ClipLocation[], fromMs: (member: ClipLocation) => number): string[] {
  const own = new Set(group.map((member) => member.clip.id));
  const later = group.flatMap((member) => member.track.clips.filter((c) => !own.has(c.id) && c.startMs >= fromMs(member)).map((c) => c.id));
  return withLinked(doc, later).filter((id) => !own.has(id));
}

export function protectedTime(atMs: number, fromMs: number, toMs: number, protectMs: number): number {
  const edge = Math.max(0, Math.min(protectMs, fromMs / 2, toMs / 2));
  if (atMs <= edge) return atMs;
  if (atMs >= fromMs - edge) return atMs - fromMs + toMs;
  return edge + ((atMs - edge) * (toMs - 2 * edge)) / (fromMs - 2 * edge);
}

export type Pace = { speed: number } | { keys: Keyframe[] };

export function pacedKeyframes(keyframes: Keyframes | undefined, pace: Pace, timeOf: ((atMs: number) => number) | null): Keyframes | undefined {
  const rest = withoutProperty(keyframes, SPEED_PROPERTY);
  const moved = timeOf ? retimeKeyframes(rest, timeOf) : rest;
  return "keys" in pace ? withLane(moved, SPEED_PROPERTY, pace.keys) : moved;
}

export function applyPace(clip: Draft<Clip>, pace: Pace): void {
  if ("keys" in pace || pace.speed === 1) delete clip.speed;
  else clip.speed = pace.speed;
}

function applyTiming(clip: Draft<Clip>, pace: Pace, request: RetimeRequest, fromMs: number, durationMs: number) {
  applyPace(clip, pace);
  if (request.reverse !== undefined) {
    if (request.reverse) clip.reverse = true;
    else delete clip.reverse;
  }
  if (request.preservePitch !== undefined) {
    if (request.preservePitch) delete clip.preservePitch;
    else clip.preservePitch = false;
  }
  const protect = request.protectEdgesMs ?? 0;
  const timed = pacedKeyframes(clip.keyframes, pace, request.keyframes === "keep" || fromMs === durationMs ? null : (atMs) => protectedTime(atMs, fromMs, durationMs, protect));
  const keyframes = request.keyframes === "keep" ? keyframesInRange(timed, 0, durationMs) : timed;
  if (keyframes) clip.keyframes = keyframes;
  else delete clip.keyframes;
}

function curvePace(clip: Clip, request: RetimeRequest): { pace: Pace; durationMs: number } | null {
  const durationMs = request.durationMs !== undefined ? Math.round(request.durationMs) : clip.durationMs;
  const keys = stretchedCurve(speedKeys(clip), durationMs / clip.durationMs);
  const [low, high] = curveExtent(keys);
  return withinSpeed(low) && withinSpeed(high) ? { pace: { keys }, durationMs } : null;
}

export function retimeClip(doc: VideoDocument, clipId: string, request: RetimeRequest, source: ClipSource): RetimeResult {
  const group = groupOf(doc, clipId);
  const refusal = groupRefusal(group);
  if (refusal) return refuse(refusal);
  const clip = findClip(doc, clipId)!.clip;
  if (request.protectEdgesMs !== undefined && !(Number.isFinite(request.protectEdgesMs) && request.protectEdgesMs >= 0)) return refuse("range");
  if (hasSpeedCurve(clip) && request.speed === undefined) {
    const curved = curvePace(clip, request);
    if (!curved || curved.durationMs < STUDIO_LIMITS.minClipMs) return refuse("range");
    return retimedGroup(doc, group, clip, curved.pace, curved.durationMs, request);
  }
  const span = sourceSpanMs(clip);
  const speed = request.durationMs !== undefined ? span / request.durationMs : (request.speed ?? clipSpeed(clip));
  if (!withinSpeed(speed)) return refuse("range");
  const keepDuration = request.keep === "duration";
  const durationMs = request.durationMs !== undefined ? Math.round(request.durationMs) : keepDuration ? clip.durationMs : Math.round(span / speed);
  if (durationMs < STUDIO_LIMITS.minClipMs) return refuse("range");
  if (keepDuration) {
    const short = group.some((member) => {
      const media = source(member.clip.id);
      return media !== undefined && member.clip.trimInMs + Math.round(durationMs * speed) > media;
    });
    if (short) return refuse("source");
  }
  return retimedGroup(doc, group, clip, { speed }, durationMs, request);
}

function retimedGroup(doc: VideoDocument, group: readonly ClipLocation[], clip: Clip, pace: Pace, durationMs: number, request: RetimeRequest): RetimeResult {
  const ids = new Set(group.map((member) => member.clip.id));
  const patched = produce(doc, (draft) => {
    for (const track of draft.tracks) for (const target of track.clips) if (ids.has(target.id)) applyTiming(target, pace, request, clip.durationMs, durationMs);
  });
  const delta = durationMs - clip.durationMs;
  const changes = new Map<string, ClipChange>(group.map((member) => [member.clip.id, { durationMs }]));
  if (request.ripple !== false && delta !== 0) {
    for (const [id, change] of shiftChanges(patched, followers(doc, group, (member) => clipEnd(member.clip)), delta)) changes.set(id, change);
  }
  const document = rearrange(patched, changes);
  return document ? { ok: true, document } : refuse("noRoom");
}

function frozenPlacement(clip: Clip, localMs: number, aspect: number): Pick<Clip, "transform" | "keyframes"> {
  const placed = placementAt(clip, localMs, aspect);
  const scale = scaleAt(clip.keyframes, localMs);
  if (Math.abs(scale.x - scale.y) < 1e-9) return { transform: clampClipTransform(placed) };
  const [low, high] = KEYFRAME_RANGES.scaleX;
  const held = (value: number) => [{ atMs: 0, value: Math.min(high, Math.max(low, value)), easing: "linear" as const }];
  return { transform: clampClipTransform({ ...placed, w: clip.transform.w, h: clip.transform.h }), keyframes: { scaleX: held(scale.x), scaleY: held(scale.y) } };
}

function frozenClip(clip: Clip, startMs: number, localMs: number, durationMs: number, aspect: number): Clip {
  const blur = animatedBlur(clip.blur, clip.keyframes, localMs);
  return {
    id: newStudioId("c"),
    type: "video",
    assetId: clip.assetId,
    startMs,
    durationMs,
    trimInMs: Math.round(sourceAt(clip, localMs)),
    volume: clip.volume,
    fadeInMs: 0,
    fadeOutMs: 0,
    fit: clip.fit,
    ...frozenPlacement(clip, localMs, aspect),
    freeze: true,
    ...(blur > 0 ? { blur } : {}),
    ...(clip.flipX ? { flipX: true } : {}),
    ...(clip.flipY ? { flipY: true } : {}),
    ...(clip.parentId ? { parentId: clip.parentId } : {}),
    ...(clip.parentTracker ? { parentTracker: clip.parentTracker } : {}),
  };
}

function freezePoint(clip: Clip, atMs: number): number {
  const at = Math.min(Math.max(Math.round(atMs), clip.startMs), clipEnd(clip));
  if (at - clip.startMs < STUDIO_LIMITS.minClipMs) return clip.startMs;
  if (clipEnd(clip) - at < STUDIO_LIMITS.minClipMs) return clipEnd(clip);
  return at;
}

export function freezeFrame(doc: VideoDocument, clipId: string, atMs: number, durationMs: number = DEFAULT_FREEZE_MS): FreezeResult {
  const group = groupOf(doc, clipId);
  const refusal = groupRefusal(group);
  if (refusal && refusal !== "notSourced") return refuse(refusal);
  const found = findClip(doc, clipId);
  if (!found || found.clip.type !== "video") return refuse("notVideo");
  if (!Number.isFinite(durationMs) || Math.round(durationMs) < STUDIO_LIMITS.minClipMs) return refuse("range");
  const at = freezePoint(found.clip, atMs);
  const localMs = Math.min(at - found.clip.startMs, found.clip.durationMs - 1);
  const still = frozenClip(found.clip, at, localMs, Math.round(durationMs), canvasAspect(doc));
  const split = at > found.clip.startMs && at < clipEnd(found.clip) ? splitAt(doc, at, group.map((member) => member.clip.id)) : doc;
  const tracks = new Set(group.map((member) => member.track.id));
  const pushed = withLinked(split, split.tracks.filter((track) => tracks.has(track.id)).flatMap((track) => track.clips.filter((c) => c.startMs >= at).map((c) => c.id)));
  const document = rearrange(split, shiftChanges(split, pushed, still.durationMs), [{ trackId: found.track.id, clip: still }]);
  return document ? { ok: true, document, clipId: still.id } : refuse("noRoom");
}

export const RAMP_STEPS = 5;

export const DEFAULT_RAMP_EASING: Easing = "easeInOut";

export interface RampRequest {
  atMs: number;
  rampMs: number;
  toSpeed: number;
  steps?: number;
  easing?: Easing;
}

function rampCuts(clip: Clip, start: number, end: number, steps: number, tailMs: number): number[] {
  const inner = Array.from({ length: Math.max(0, steps - 1) }, (_, i) => start + Math.round(((i + 1) * (end - start)) / steps));
  const fits = (cut: number) => cut - clip.startMs >= STUDIO_LIMITS.minClipMs && clipEnd(clip) - cut >= STUDIO_LIMITS.minClipMs;
  const tailFits = (cut: number) => cut !== end || clipEnd(clip) - end >= tailMs;
  return [...new Set([start, ...inner, end])].filter((cut) => fits(cut) && tailFits(cut));
}

function piecesWithin(doc: VideoDocument, trackIds: ReadonlySet<string>, fromMs: number, toMs: number): Clip[] {
  return doc.tracks.filter((track) => trackIds.has(track.id)).flatMap((track) => track.clips.filter((c) => c.startMs >= fromMs && clipEnd(c) <= toMs));
}

export function rampSpeed(doc: VideoDocument, clipId: string, request: RampRequest, source: ClipSource): RetimeResult {
  const group = groupOf(doc, clipId);
  const refusal = groupRefusal(group);
  if (refusal) return refuse(refusal);
  if (!withinSpeed(request.toSpeed)) return refuse("range");
  const located = findClip(doc, clipId)!;
  const clip = located.clip;
  const from = clipSpeed(clip);
  const start = Math.min(Math.max(Math.round(request.atMs), clip.startMs), clipEnd(clip));
  const end = Math.min(start + Math.max(0, Math.round(request.rampMs)), clipEnd(clip));
  const fastest = Math.max(from, request.toSpeed) / from;
  const steps = Math.max(1, Math.min(request.steps ?? RAMP_STEPS, Math.floor((end - start) / (STUDIO_LIMITS.minClipMs * fastest))));
  const tracks = new Set(group.map((member) => member.track.id));
  let next = doc;
  for (const cut of rampCuts(clip, start, end, steps, STUDIO_LIMITS.minClipMs * (request.toSpeed / from))) next = splitAt(next, cut, piecesWithin(next, tracks, clip.startMs, clipEnd(clip)).map((c) => c.id));
  const pieces = piecesWithin(next, new Set([located.track.id]), clip.startMs, clipEnd(clip)).sort((a, b) => a.startMs - b.startMs);
  const inRamp = pieces.filter((piece) => piece.startMs >= start && piece.startMs < end);
  const speedOf = (piece: Clip): number => {
    if (piece.startMs < start) return from;
    const step = inRamp.indexOf(piece);
    if (step < 0) return request.toSpeed;
    return from + (request.toSpeed - from) * ease(request.easing ?? DEFAULT_RAMP_EASING, (step + 0.5) / inRamp.length);
  };
  for (const piece of pieces) {
    const result = retimeClip(next, piece.id, { speed: speedOf(piece), keep: "source" }, source);
    if (!result.ok) return result;
    next = result.document;
  }
  return { ok: true, document: next };
}
