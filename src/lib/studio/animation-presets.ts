import { produce } from "immer";

import type { Behavior } from "./behaviors";
import { behaviorLane, behaviorProperties, NO_LEVELS } from "./behaviors";
import { newStudioId, STUDIO_LIMITS, type Clip, type Motion, type Transform, type VideoDocument } from "./document";
import type { ClipTransition } from "./edge-transitions";
import { animatedProperties, keyframeCount, replaceLanes, retimeKeyframes, timedFramesOf, type AnimatedProperty, type Keyframe, type Keyframes, type TimedKey } from "./keyframes";
import { takesMotionBlur } from "./motion-blur";
import type { PositionKeyframe } from "./path-keys";
import { placementAt } from "./clip-placement";
import { protectedTime } from "./retime";
import type { TextAnimator } from "./text-animation";
import type { TextUnitAnimator } from "./text-selectors";
import { findClip, updateClip, type ClipPatch } from "./timeline";
import { clipIssue, parseDocument, type IssueCode } from "./validate";
import { listensToTrack, type Vfx } from "./vfx";

const PRESET_SCOPES = ["visual", "text"] as const;

export type PresetScope = (typeof PRESET_SCOPES)[number];

const PRESET_LANES = ["x", "y", "position", "scale", "scaleX", "scaleY", "rotation", "opacity", "blur"] as const satisfies readonly AnimatedProperty[];

export const PRESET_TIMINGS = ["stretch", "edges", "keep"] as const;

export type PresetTiming = (typeof PRESET_TIMINGS)[number];

export const PRESET_LIMITS = { nameRunes: 120, descriptionRunes: 500, animationBytes: 1 << 20 } as const;

export interface PresetAnimation {
  scope: PresetScope;
  durationMs: number;
  keyframes?: Keyframes;
  behaviors?: Behavior[];
  motionIn?: Motion;
  motionOut?: Motion;
  transitionIn?: ClipTransition;
  transitionOut?: ClipTransition;
  textIn?: TextAnimator;
  textOut?: TextAnimator;
  textAnimators?: TextUnitAnimator[];
  vfx?: Vfx[];
  motionBlur?: boolean;
}

export type PresetLocale = "pt" | "en" | "es" | "de";

export interface AnimationPreset {
  id: string;
  name: string;
  description?: string;
  builtIn: boolean;
  names?: Partial<Record<PresetLocale, string>>;
  descriptions?: Partial<Record<PresetLocale, string>>;
  animation: PresetAnimation;
  createdAt?: string;
  updatedAt?: string;
}

interface PresetSummary {
  scope: PresetScope;
  duration_ms: number;
  keys: string[];
  behaviors: string[];
  entrance: "motion" | "transition" | "text" | "";
  exit: "motion" | "transition" | "text" | "";
  text_animators: number;
  vfx: string[];
  motion_blur: boolean;
}

const PRESET_FIELDS: ReadonlySet<string> = new Set(["scope", "durationMs", "keyframes", "behaviors", "motionIn", "motionOut", "transitionIn", "transitionOut", "textIn", "textOut", "textAnimators", "vfx", "motionBlur"]);
const TEXT_PARTS = ["textIn", "textOut", "textAnimators"] as const;
const SHIFTED_LANES: ReadonlySet<string> = new Set(["x", "y", "rotation"]);
const PROBE_BOX: Transform = { x: 0.5, y: 0.5, w: 0.5, h: 0.25, rotation: 0, opacity: 1 };

function laneOffset(property: string, base: Transform): number {
  if (property === "x") return base.x;
  if (property === "y") return base.y;
  return base.rotation;
}

function movedKeyframes(keyframes: Keyframes, base: Transform, sign: 1 | -1): Keyframes {
  const next: Partial<Record<AnimatedProperty, readonly TimedKey[]>> = {};
  for (const property of animatedProperties(keyframes)) {
    const frames = timedFramesOf(keyframes, property);
    if (property === "position") next.position = (frames as PositionKeyframe[]).map((key) => ({ ...key, x: key.x + sign * base.x, y: key.y + sign * base.y }));
    else if (SHIFTED_LANES.has(property)) next[property] = (frames as Keyframe[]).map((key) => ({ ...key, value: key.value + sign * laneOffset(property, base) }));
    else next[property] = frames;
  }
  return next as Keyframes;
}

function presetKeyframesAt(relative: Keyframes, base: Transform): Keyframes {
  return movedKeyframes(relative, base, 1);
}

function relativeKeyframes(absolute: Keyframes, base: Transform): Keyframes {
  return movedKeyframes(absolute, base, -1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function carriesSomething(animation: Record<string, unknown>): boolean {
  const listed = (key: string) => Array.isArray(animation[key]) && (animation[key] as unknown[]).length > 0;
  const lanes = isRecord(animation.keyframes) && Object.values(animation.keyframes).some((frames) => Array.isArray(frames) && frames.length > 0);
  return lanes || listed("behaviors") || listed("textAnimators") || listed("vfx") || ["motionIn", "motionOut", "transitionIn", "transitionOut", "textIn", "textOut"].some((key) => isRecord(animation[key])) || animation.motionBlur === true;
}

function probeLayer(scope: PresetScope): Record<string, unknown> {
  const transform = { ...PROBE_BOX };
  if (scope === "text") return { id: "probe-layer", type: "text", transform, text: "Aa", fontId: "inter", fontSize: 0.08, fontWeight: 700, align: "center", lineHeight: 1.2, fill: "#ffffff" };
  return { id: "probe-layer", type: "shape", shape: "rect", transform, fill: "#ffffff" };
}

function probeDocument(animation: Record<string, unknown>): unknown {
  const { scope, durationMs, keyframes, ...parts } = animation;
  const clip = {
    id: "probe-clip",
    type: "overlay",
    startMs: 0,
    durationMs,
    trimInMs: 0,
    volume: 1,
    fadeInMs: 0,
    fadeOutMs: 0,
    transform: { ...PROBE_BOX },
    layer: probeLayer(scope as PresetScope),
    ...(isRecord(keyframes) ? { keyframes: presetKeyframesAt(keyframes as Keyframes, PROBE_BOX) } : keyframes === undefined ? {} : { keyframes }),
    ...parts,
  };
  return { schema: "studio.video", version: 1, canvas: { aspect: "portrait", background: "#000000" }, durationMs, tracks: [{ id: "probe-track", kind: "visual", clips: [clip] }] };
}

export function presetAnimationIssue(raw: unknown): IssueCode | null {
  if (raw === undefined || raw === null) return "required";
  if (!isRecord(raw) || Object.keys(raw).some((key) => !PRESET_FIELDS.has(key))) return "invalid";
  if (JSON.stringify(raw).length > PRESET_LIMITS.animationBytes) return "too_large";
  if (!(PRESET_SCOPES as readonly unknown[]).includes(raw.scope)) return "unknown";
  if (typeof raw.durationMs !== "number" || !Number.isInteger(raw.durationMs) || raw.durationMs < STUDIO_LIMITS.minClipMs || raw.durationMs > STUDIO_LIMITS.maxVideoMs) return "out_of_range";
  if (isRecord(raw.keyframes) && Object.keys(raw.keyframes).some((lane) => !(PRESET_LANES as readonly string[]).includes(lane))) return "invalid";
  if (raw.scope === "visual" && TEXT_PARTS.some((part) => raw[part] !== undefined)) return "invalid";
  if (Array.isArray(raw.behaviors) && raw.behaviors.some((behavior) => isRecord(behavior) && behavior.trackId !== undefined && behavior.trackId !== "")) return "invalid";
  if (!carriesSomething(raw)) return "required";
  const parsed = parseDocument("video", probeDocument(raw));
  return parsed.ok ? null : parsed.issue.code;
}

function scopeOf(clip: Clip): PresetScope {
  return clip.type === "overlay" && clip.layer?.type === "text" ? "text" : "visual";
}

export type CaptureRefusal = "notVisual" | "nothing";

type CaptureResult = { ok: true; animation: PresetAnimation; skipped: string[] } | { ok: false; reason: CaptureRefusal };

const CAPTURED_TYPES: ReadonlySet<Clip["type"]> = new Set(["video", "image", "overlay", "group", "null"]);

function keptLanes(keyframes: Keyframes | undefined): { lanes: Keyframes | undefined; skipped: string[] } {
  const lanes: Partial<Record<AnimatedProperty, readonly TimedKey[]>> = {};
  const skipped: string[] = [];
  for (const property of animatedProperties(keyframes)) {
    if ((PRESET_LANES as readonly string[]).includes(property)) lanes[property] = timedFramesOf(keyframes, property);
    else skipped.push(`keys:${property}`);
  }
  return { lanes: keyframeCount(lanes as Keyframes) > 0 ? (lanes as Keyframes) : undefined, skipped };
}

export function captureAnimation(clip: Clip): CaptureResult {
  if (!CAPTURED_TYPES.has(clip.type)) return { ok: false, reason: "notVisual" };
  const scope = scopeOf(clip);
  const { lanes, skipped } = keptLanes(clip.keyframes);
  const behaviors = (clip.behaviors ?? []).filter((behavior) => behavior.kind !== "audioReact");
  if (behaviors.length < (clip.behaviors?.length ?? 0)) skipped.push("behaviors:audioReact");
  const vfx = (clip.vfx ?? []).filter((entry) => !listensToTrack(entry.kind));
  if (vfx.length < (clip.vfx?.length ?? 0)) skipped.push("vfx:sound");
  const animation: PresetAnimation = {
    scope,
    durationMs: clip.durationMs,
    ...(lanes ? { keyframes: relativeKeyframes(lanes, clip.transform) } : {}),
    ...(behaviors.length > 0 ? { behaviors } : {}),
    ...(clip.motionIn ? { motionIn: clip.motionIn } : {}),
    ...(clip.motionOut ? { motionOut: clip.motionOut } : {}),
    ...(clip.transitionIn ? { transitionIn: clip.transitionIn } : {}),
    ...(clip.transitionOut ? { transitionOut: clip.transitionOut } : {}),
    ...(scope === "text" && clip.textIn ? { textIn: clip.textIn } : {}),
    ...(scope === "text" && clip.textOut ? { textOut: clip.textOut } : {}),
    ...(scope === "text" && clip.textAnimators?.length ? { textAnimators: clip.textAnimators } : {}),
    ...(vfx.length ? { vfx } : {}),
    ...(clip.motionBlur ? { motionBlur: true } : {}),
  };
  if (!carriesSomething(animation as unknown as Record<string, unknown>)) return { ok: false, reason: "nothing" };
  return { ok: true, animation, skipped };
}

export function presetSummary(animation: PresetAnimation): PresetSummary {
  const edge = (motion: unknown, transition: unknown, text: unknown) => (text ? "text" : transition ? "transition" : motion ? "motion" : "");
  return {
    scope: animation.scope,
    duration_ms: animation.durationMs,
    keys: animatedProperties(animation.keyframes).map(String).sort(),
    behaviors: [...new Set((animation.behaviors ?? []).map((behavior) => behavior.kind))].sort(),
    entrance: edge(animation.motionIn, animation.transitionIn, animation.textIn),
    exit: edge(animation.motionOut, animation.transitionOut, animation.textOut),
    text_animators: animation.textAnimators?.length ?? 0,
    vfx: (animation.vfx ?? []).map((vfx) => vfx.kind),
    motion_blur: Boolean(animation.motionBlur),
  };
}

function timeMap(timing: PresetTiming, fromMs: number, toMs: number): (atMs: number) => number {
  if (timing === "keep" || fromMs === toMs) return (atMs) => atMs;
  if (timing === "edges") return (atMs) => protectedTime(atMs, fromMs, toMs, Infinity);
  return (atMs) => (atMs * toMs) / fromMs;
}

function retimedLanes<P extends string>(lanes: Partial<Record<P, Keyframe[]>> | undefined, timeOf: (atMs: number) => number, durationMs: number): Partial<Record<P, Keyframe[]>> | undefined {
  if (!lanes) return lanes;
  const next: Partial<Record<P, Keyframe[]>> = {};
  for (const [name, frames] of Object.entries(lanes) as [P, Keyframe[] | undefined][]) {
    if (!frames) continue;
    const moved = frames
      .map((frame) => ({ ...frame, atMs: Math.round(timeOf(frame.atMs)) }))
      .filter((frame, index, all) => frame.atMs <= durationMs && (index === all.length - 1 || all[index + 1].atMs > frame.atMs));
    if (moved.length > 0) next[name] = moved;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function fitted<T extends { durationMs: number }>(edge: T | undefined, durationMs: number): T | undefined {
  return edge ? { ...edge, durationMs: Math.min(edge.durationMs, Math.floor(durationMs / 2)) } : undefined;
}

interface PresetPartsResult {
  patch: ClipPatch;
  skipped: string[];
}

function presetPatch(clip: Clip, animation: PresetAnimation, timing: PresetTiming): PresetPartsResult {
  const skipped: string[] = [];
  const timeOf = timeMap(timing, animation.durationMs, clip.durationMs);
  const patch: ClipPatch = {};
  const text = scopeOf(clip) === "text";
  const nullClip = clip.type === "null";
  if (animation.keyframes) {
    const moved = retimeKeyframes(presetKeyframesAt(animation.keyframes, clip.transform), timeOf);
    const kept = moved ? Object.fromEntries(Object.entries(moved).map(([lane, frames]) => [lane, (frames as TimedKey[]).filter((frame) => frame.atMs <= clip.durationMs)]).filter(([, frames]) => (frames as TimedKey[]).length > 0)) : {};
    const lanes = nullClip ? Object.fromEntries(Object.entries(kept).filter(([lane]) => lane !== "opacity" && lane !== "blur")) : kept;
    if (Object.keys(lanes).length < Object.keys(kept).length) skipped.push("keys:opacity,blur");
    patch.keyframes = replaceLanes(clip.keyframes, lanes as Keyframes);
  }
  if (animation.behaviors) {
    const allowed = behaviorProperties(clip.type);
    const behaviors = animation.behaviors.filter((behavior) => allowed.includes(behavior.property)).map((behavior) => ({ ...behavior, id: newStudioId("b") }));
    if (behaviors.length < animation.behaviors.length) skipped.push("behaviors");
    patch.behaviors = behaviors.length > 0 ? behaviors : undefined;
  }
  const edges = !nullClip;
  for (const side of ["motionIn", "motionOut", "transitionIn", "transitionOut"] as const) {
    if (!animation[side]) continue;
    if (!edges) {
      skipped.push(side);
      continue;
    }
    Object.assign(patch, { [side]: fitted<Motion | ClipTransition>(animation[side], clip.durationMs) });
  }
  for (const side of ["textIn", "textOut"] as const) {
    if (!animation[side]) continue;
    if (text) patch[side] = animation[side];
    else skipped.push(side);
  }
  if (animation.textAnimators) {
    if (text) patch.textAnimators = animation.textAnimators.map((animator) => ({ ...animator, id: newStudioId("ta"), keyframes: retimedLanes(animator.keyframes, timeOf, clip.durationMs) }));
    else skipped.push("textAnimators");
  }
  if (animation.vfx) {
    if (clip.type === "video" || clip.type === "image" || clip.type === "overlay" || clip.type === "group") patch.vfx = animation.vfx.map((vfx) => ({ ...vfx, id: newStudioId("v"), keyframes: retimedLanes(vfx.keyframes, timeOf, clip.durationMs) }));
    else skipped.push("vfx");
  }
  if (animation.motionBlur) {
    if (takesMotionBlur(clip.type)) patch.motionBlur = true;
    else skipped.push("motionBlur");
  }
  return { patch, skipped };
}

type ApplyRefusal = "missing" | "locked" | "invalid";

type ApplyResult = { ok: true; document: VideoDocument; skipped: Record<string, string[]> } | { ok: false; reason: ApplyRefusal; clipId: string; code?: IssueCode };

function withoutEmptyKeys(clip: Clip): Clip {
  return produce(clip, (draft) => {
    for (const vfx of draft.vfx ?? []) if (!vfx.keyframes) delete vfx.keyframes;
    for (const animator of draft.textAnimators ?? []) if (!animator.keyframes) delete animator.keyframes;
  });
}

export function applyAnimation(doc: VideoDocument, clipIds: readonly string[], animation: PresetAnimation, timing: PresetTiming = "stretch"): ApplyResult {
  let document = doc;
  const skipped: Record<string, string[]> = {};
  for (const clipId of clipIds) {
    const found = findClip(document, clipId);
    if (!found) return { ok: false, reason: "missing", clipId };
    if (found.track.locked) return { ok: false, reason: "locked", clipId };
    const parts = presetPatch(found.clip, animation, timing);
    const next = updateClip(document, clipId, parts.patch);
    const placed = findClip(next, clipId)!;
    const cleaned = withoutEmptyKeys(placed.clip);
    const settled = cleaned === placed.clip ? next : produce(next, (draft) => {
      draft.tracks[placed.trackIndex].clips[placed.clipIndex] = cleaned;
    });
    const code = clipIssue(findClip(settled, clipId)!.clip, found.track.kind, settled.durationMs);
    if (code) return { ok: false, reason: "invalid", clipId, code };
    document = settled;
    if (parts.skipped.length > 0) skipped[clipId] = parts.skipped;
  }
  return { ok: true, document, skipped };
}

export function presetName(preset: AnimationPreset, locale: string): string {
  const key = locale.slice(0, 2) as PresetLocale;
  return preset.names?.[key] ?? preset.name;
}

export function presetDescription(preset: AnimationPreset, locale: string): string | undefined {
  const key = locale.slice(0, 2) as PresetLocale;
  return preset.descriptions?.[key] ?? preset.description;
}

const PREVIEW_ASPECT = 1;

export function presetPreviewClip(animation: PresetAnimation): Clip {
  const base: Clip = {
    id: "preview",
    type: "overlay",
    startMs: 0,
    durationMs: animation.durationMs,
    trimInMs: 0,
    volume: 1,
    fadeInMs: 0,
    fadeOutMs: 0,
    transform: { ...PROBE_BOX, w: 0.4, h: 0.4 },
    layer: probeLayer(animation.scope) as unknown as Clip["layer"],
  };
  return { ...base, ...presetPatch(base, animation, "keep").patch };
}

export function presetPoseAt(clip: Clip, localMs: number): Transform {
  return placementAt(clip, localMs, PREVIEW_ASPECT, behaviorLane(clip, localMs, NO_LEVELS));
}
