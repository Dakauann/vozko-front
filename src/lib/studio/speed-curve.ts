import { produce } from "immer";

import { sameFootage, sourceSpanMs, speedAt, speedKeys, timeAfterTravel, travelAlong } from "./clip-time";
import { STUDIO_LIMITS, type Clip, type VideoDocument } from "./document";
import { rearrange, shiftChanges, type ClipChange, type ClipSource } from "./edits";
import { settleSmooth } from "./keyframe-ease";
import { curveExtent, isEasing, type Easing, type Keyframe } from "./keyframes";
import { applyPace, DEFAULT_RAMP_EASING, followers, groupOf, groupRefusal, pacedKeyframes, withinSpeed, type Pace, type RetimeRefusal, type RetimeResult } from "./retime";
import { SPEED_LIMITS, SPEED_PROPERTY } from "./speed-range";
import { clipEnd, findClip, type ClipLocation } from "./timeline";

export interface SpeedCurvePoint {
  at: number;
  speed: number;
}

export const SPEED_CURVE_PRESET_IDS = ["montage", "hero", "bullet", "jumpCut", "flashIn", "flashOut"] as const;

export type SpeedCurvePreset = (typeof SPEED_CURVE_PRESET_IDS)[number];

export const SPEED_CURVE_PRESETS: Record<SpeedCurvePreset, readonly SpeedCurvePoint[]> = {
  montage: [
    { at: 0, speed: 1 },
    { at: 0.25, speed: 4 },
    { at: 0.5, speed: 0.5 },
    { at: 0.75, speed: 4 },
    { at: 1, speed: 1 },
  ],
  hero: [
    { at: 0, speed: 1.5 },
    { at: 0.35, speed: 0.3 },
    { at: 0.65, speed: 0.3 },
    { at: 1, speed: 1.5 },
  ],
  bullet: [
    { at: 0, speed: 2 },
    { at: 0.45, speed: 0.2 },
    { at: 0.55, speed: 0.2 },
    { at: 1, speed: 2 },
  ],
  jumpCut: [
    { at: 0, speed: 1 },
    { at: 0.4, speed: 1 },
    { at: 0.5, speed: 6 },
    { at: 0.6, speed: 1 },
    { at: 1, speed: 1 },
  ],
  flashIn: [
    { at: 0, speed: 6 },
    { at: 0.35, speed: 1 },
    { at: 1, speed: 1 },
  ],
  flashOut: [
    { at: 0, speed: 1 },
    { at: 0.65, speed: 1 },
    { at: 1, speed: 6 },
  ],
};

export const MIN_CURVE_GAP = 0.02;

export interface SpeedCurveRequest {
  points: readonly SpeedCurvePoint[];
  smooth?: boolean;
  keep?: "source" | "duration";
  ripple?: boolean;
}

export interface SmoothRampRequest {
  atMs: number;
  rampMs: number;
  toSpeed: number;
  easing?: Easing;
  ripple?: boolean;
}

type Refused = { ok: false; reason: RetimeRefusal };

function refuse(reason: RetimeRefusal): Refused {
  return { ok: false, reason };
}

export function isSpeedCurvePreset(value: string): value is SpeedCurvePreset {
  return (SPEED_CURVE_PRESET_IDS as readonly string[]).includes(value);
}

export function presetPoints(preset: SpeedCurvePreset): SpeedCurvePoint[] {
  return SPEED_CURVE_PRESETS[preset].map((point) => ({ ...point }));
}

export function speedCurvePointsIssue(points: readonly SpeedCurvePoint[]): boolean {
  if (points.length < 2 || points[0].at !== 0 || points[points.length - 1].at !== 1) return true;
  return points.some((point, i) => !Number.isFinite(point.at) || !withinSpeed(point.speed) || (i > 0 && point.at - points[i - 1].at < MIN_CURVE_GAP - 1e-9));
}

export type SpeedPointEdit = { ok: true; points: SpeedCurvePoint[]; index: number } | { ok: false; reason: "crowded" | "ends" | "missing" };

function clampSpeed(speed: number): number {
  return Math.min(SPEED_LIMITS[1], Math.max(SPEED_LIMITS[0], Math.round(speed * 100) / 100));
}

export function addSpeedPoint(points: readonly SpeedCurvePoint[], at: number, speed: number): SpeedPointEdit {
  const placed = Math.round(Math.min(1, Math.max(0, at)) * 1000) / 1000;
  if (points.some((point) => Math.abs(point.at - placed) < MIN_CURVE_GAP)) return { ok: false, reason: "crowded" };
  const next = [...points, { at: placed, speed: clampSpeed(speed) }].sort((a, b) => a.at - b.at);
  return { ok: true, points: next, index: next.findIndex((point) => point.at === placed) };
}

export function moveSpeedPoint(points: readonly SpeedCurvePoint[], index: number, at: number, speed: number): SpeedPointEdit {
  if (index < 0 || index >= points.length) return { ok: false, reason: "missing" };
  const end = index === 0 || index === points.length - 1;
  const low = end ? points[index].at : points[index - 1].at + MIN_CURVE_GAP;
  const high = end ? points[index].at : points[index + 1].at - MIN_CURVE_GAP;
  const placed = Math.round(Math.min(high, Math.max(low, at)) * 1000) / 1000;
  return { ok: true, points: points.map((point, i) => (i === index ? { at: placed, speed: clampSpeed(speed) } : point)), index };
}

export function removeSpeedPoint(points: readonly SpeedCurvePoint[], index: number): SpeedPointEdit {
  if (index < 0 || index >= points.length) return { ok: false, reason: "missing" };
  if (index === 0 || index === points.length - 1) return { ok: false, reason: "ends" };
  return { ok: true, points: points.filter((_, i) => i !== index), index: index - 1 };
}

export function curveKeys(points: readonly SpeedCurvePoint[], durationMs: number, smooth: boolean): Keyframe[] {
  const keys: Keyframe[] = points.map((point) => ({ atMs: Math.round(point.at * durationMs), value: point.speed, easing: smooth ? "easeInOut" : "linear", ...(smooth ? { smooth: true } : {}) }));
  return smooth ? (settleSmooth({ speed: keys })?.speed ?? keys) : keys;
}

export function speedCurvePoints(clip: Pick<Clip, "durationMs" | "keyframes" | "speed" | "freeze">): SpeedCurvePoint[] {
  const inside = speedKeys(clip).filter((key) => key.atMs > 0 && key.atMs < clip.durationMs);
  return [{ at: 0, speed: speedAt(clip, 0) }, ...inside.map((key) => ({ at: key.atMs / clip.durationMs, speed: key.value })), { at: 1, speed: speedAt(clip, clip.durationMs) }];
}

export function isSmoothCurve(clip: Pick<Clip, "keyframes">): boolean {
  const keys = speedKeys(clip);
  return keys.length > 0 && keys.every((key, i) => i === keys.length - 1 || key.smooth || key.easing !== "linear");
}

function shortOf(group: readonly ClipLocation[], span: number, source: ClipSource): boolean {
  return group.some((member) => {
    const media = source(member.clip.id);
    return media !== undefined && member.clip.trimInMs + span > media;
  });
}

function rePaced(doc: VideoDocument, group: readonly ClipLocation[], clip: Clip, pace: Pace, durationMs: number, timeOf: ((atMs: number) => number) | null, ripple: boolean): RetimeResult {
  const ids = new Set(group.map((member) => member.clip.id));
  const patched = produce(doc, (draft) => {
    for (const track of draft.tracks) {
      for (const target of track.clips) {
        if (!ids.has(target.id)) continue;
        applyPace(target, pace);
        const keyframes = pacedKeyframes(target.keyframes, pace, timeOf);
        if (keyframes) target.keyframes = keyframes;
        else delete target.keyframes;
      }
    }
  });
  const delta = durationMs - clip.durationMs;
  const changes = new Map<string, ClipChange>(group.map((member) => [member.clip.id, { durationMs }]));
  if (ripple && delta !== 0) for (const [id, change] of shiftChanges(patched, followers(doc, group, (member) => clipEnd(member.clip)), delta)) changes.set(id, change);
  const document = rearrange(patched, changes);
  return document ? { ok: true, document } : refuse("noRoom");
}

function located(doc: VideoDocument, clipId: string): { group: ClipLocation[]; clip: Clip } | Refused {
  const group = groupOf(doc, clipId);
  const refusal = groupRefusal(group);
  if (refusal) return refuse(refusal);
  if (group.some((member) => member.clip.type !== "video" && member.clip.type !== "audio")) return refuse("notSourced");
  return { group, clip: findClip(doc, clipId)!.clip };
}

export function setSpeedCurve(doc: VideoDocument, clipId: string, request: SpeedCurveRequest, source: ClipSource): RetimeResult {
  const found = located(doc, clipId);
  if ("ok" in found) return found;
  const { group, clip } = found;
  if (speedCurvePointsIssue(request.points)) return refuse("range");
  const smooth = request.smooth ?? true;
  const span = sourceSpanMs(clip);
  const probe = curveKeys(request.points, clip.durationMs, smooth);
  const mean = travelAlong(probe, 0, clip.durationMs) / clip.durationMs;
  const keepDuration = request.keep === "duration";
  const durationMs = keepDuration ? clip.durationMs : Math.round(span / mean);
  if (durationMs < STUDIO_LIMITS.minClipMs || durationMs > STUDIO_LIMITS.maxVideoMs) return refuse("range");
  const keys = curveKeys(request.points, durationMs, smooth);
  const [low, high] = curveExtent(keys);
  if (!withinSpeed(low) || !withinSpeed(high)) return refuse("range");
  if (keepDuration && shortOf(group, Math.round(travelAlong(keys, 0, durationMs)), source)) return refuse("source");
  const after = { ...clip, speed: undefined, durationMs, keyframes: { speed: keys } };
  return rePaced(doc, group, clip, { keys }, durationMs, keepDuration ? null : sameFootage(clip, after), request.ripple !== false);
}

export function clearSpeedCurve(doc: VideoDocument, clipId: string): RetimeResult {
  const found = located(doc, clipId);
  if ("ok" in found) return found;
  const { group, clip } = found;
  const speed = sourceSpanMs(clip) / clip.durationMs;
  if (!withinSpeed(speed)) return refuse("range");
  return rePaced(doc, group, clip, { speed: Math.round(speed * 1000) / 1000 }, clip.durationMs, null, false);
}

export function smoothRamp(doc: VideoDocument, clipId: string, request: SmoothRampRequest): RetimeResult {
  const found = located(doc, clipId);
  if ("ok" in found) return found;
  const { group, clip } = found;
  if (!withinSpeed(request.toSpeed) || !(request.rampMs >= 1)) return refuse("range");
  if (request.easing !== undefined && !isEasing(request.easing)) return refuse("range");
  const startMs = Math.min(Math.max(Math.round(request.atMs) - clip.startMs, 0), clip.durationMs);
  const before = speedKeys(clip).filter((key) => key.atMs < startMs);
  const keys: Keyframe[] = [...before, { atMs: startMs, value: speedAt(clip, startMs), easing: request.easing ?? DEFAULT_RAMP_EASING }, { atMs: startMs + Math.round(request.rampMs), value: request.toSpeed, easing: "linear" }];
  const durationMs = Math.round(timeAfterTravel(keys, 0, sourceSpanMs(clip)));
  if (durationMs < STUDIO_LIMITS.minClipMs || durationMs > STUDIO_LIMITS.maxVideoMs) return refuse("range");
  const [low, high] = curveExtent(keys);
  if (!withinSpeed(low) || !withinSpeed(high)) return refuse("range");
  const after = { ...clip, speed: undefined, durationMs, keyframes: { [SPEED_PROPERTY]: keys } };
  return rePaced(doc, group, clip, { keys }, durationMs, sameFootage(clip, after), request.ripple !== false);
}
