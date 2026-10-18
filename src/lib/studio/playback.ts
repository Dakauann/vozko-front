import { canvasAspect, videoCanvasSize, type BlendMode, type CanvasSize, type Clip, type Fit, type Layer, type Track, type Transform, type VideoDocument } from "./document";
import { edgeLook, transitionLook, type Reveal, type Tint, type TransitionLook, type TransitionRole } from "./transition-effects";
import { edgePartAt } from "./edge-transitions";
import { transitionWindow, type Transition } from "./transitions";
import { animatedBlur, COLOR_PROPERTIES, colorFramesOf, colorSegment, type ColorProperty, type ColorSegment } from "./keyframes";
import { clipLookup, worldPlacementAt, type ClipLookup } from "./parenting";
import { behaviorLane, NO_LEVELS, type TrackLevels } from "./behaviors";
import type { MotionTrail } from "./motion-blur";
import { motionOffset, movedTransform } from "./motion";
import type { AudioRetime } from "./audio-retime";
import type { ColorGrade } from "./color-grade";
import { gradeAt } from "./grade-keys";
import type { GradientMap } from "./gradient-map";
import { gainPoints, type GainContext, type GainPoint } from "./audio-gain";
import { voiceEdges, type SourceLength } from "./audio-crossfade";
import { isCentered, panPoints } from "./audio-pan";
import { duckDb, timelineSpeech, type SpeechSource } from "./ducking";
import { chromaAt, type ChromaKey } from "./chroma-key";
import { lumaAt, type LumaKey } from "./luma-key";
import { matteOf, type Matte } from "./matte";
import { masksAt, type Mask } from "./masks";
import { changesPerFrame, layerAt } from "./layer-at";
import { clipHaloAt, type ClipHalo } from "./clip-style";
import { lineStateAt, type LineState } from "./line-animation";
import { pathOpsState, type PathOpsState } from "./path-ops";
import { clipRepeatAt, type ClipRepeat } from "./clip-repeat";
import { clipSpeed, fadeLevel, hasSpeedCurve, retimed, sourceAt, sourceSpanMs, speedAt, speedKeys, travelMs } from "./clip-time";
import { stabilizedWindow, type FrameWindow } from "./point-track";
import { textMotionOf, type TextMotion } from "./text-animation";
import { chartMotionOf, type ChartMotion } from "./chart-animation";
import { glyphFrameAt, type GlyphFrame } from "./text-glyphs";
import { clipEnd } from "./timeline";
import { groupTimeline, isGroupClip, nestedTracks, type GroupClip } from "./group-scope";
import { groupedVoices, groupKey, heardGroups } from "./group-audio";
import { drawnLooks, shakenTransform, vfxLooks, type VfxLook } from "./vfx";
import { withSound } from "./vfx-sound";
import { timedPlan } from "./vfx-time";
import { cameraView } from "./adjustment";
import { clipTiltAt, type ClipTilt } from "./clip-tilt";
import type { TimeSpan } from "./work-area";

export const PREMOUNT_MS = 1500;
const DRIFT_TOLERANCE_MS = 80;
const PAUSED_TOLERANCE_MS = 17;
const MAX_SHUTTLE_RATE = 8;
export const MAX_OUTPUT_LATENCY_SEC = 0.5;

export interface PlaybackClock {
  playing: boolean;
  rate: number;
  originMs: number;
  originSec: number;
}

export function idleClock(positionMs: number): PlaybackClock {
  return { playing: false, rate: 0, originMs: positionMs, originSec: 0 };
}

export function clampPosition(ms: number, durationMs: number): number {
  return Math.min(Math.max(0, ms), Math.max(0, durationMs));
}

function travelledMs(clock: PlaybackClock, nowSec: number): number {
  return Math.max(0, nowSec - clock.originSec) * 1000 * clock.rate;
}

export function clockPosition(clock: PlaybackClock, nowSec: number, durationMs: number): number {
  if (!clock.playing) return clampPosition(clock.originMs, durationMs);
  return clampPosition(clock.originMs + travelledMs(clock, nowSec), durationMs);
}

export function startClock(positionMs: number, nowSec: number, rate: number = 1): PlaybackClock {
  return { playing: rate !== 0, rate, originMs: positionMs, originSec: nowSec };
}

export function stopClock(clock: PlaybackClock, nowSec: number, durationMs: number): PlaybackClock {
  return idleClock(clockPosition(clock, nowSec, durationMs));
}

export function clockReachedEdge(clock: PlaybackClock, nowSec: number, span: TimeSpan): boolean {
  if (!clock.playing) return false;
  const position = clock.originMs + travelledMs(clock, nowSec);
  return clock.rate > 0 ? position >= span.endMs : position <= span.startMs;
}

interface OutputLatency {
  outputLatency?: number;
  baseLatency?: number;
}

function seconds(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}

export function outputLatencySec(context: OutputLatency): number {
  return Math.min(seconds(context.outputLatency) + seconds(context.baseLatency), MAX_OUTPUT_LATENCY_SEC);
}

export type ShuttleDirection = -1 | 0 | 1;

export const PREVIEW_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const MAX_AUDIO_RATE = 2;

export function audibleRate(rate: number): boolean {
  return rate > 0 && rate <= MAX_AUDIO_RATE;
}

export function shuttleRate(current: number, playing: boolean, direction: ShuttleDirection): number {
  if (direction === 0) return 0;
  const sameWay = playing && Math.sign(current) === direction;
  if (!sameWay) return direction;
  return direction * Math.min(Math.abs(current) * 2, MAX_SHUTTLE_RATE);
}

export type VisualKind = "video" | "image" | "overlay" | "effect" | "null" | "group";

export interface GroupFrame {
  doc: VideoDocument;
  items: VisualItem[];
}

export type PaintMix = Partial<Record<ColorProperty, ColorSegment>>;

function paintOf(clip: Clip, localMs: number): PaintMix | undefined {
  if (!clip.layer || !clip.keyframes) return undefined;
  const mix: PaintMix = {};
  for (const property of COLOR_PROPERTIES) {
    const frames = colorFramesOf(clip.keyframes, property);
    if (frames.length > 0) mix[property] = colorSegment(frames, localMs);
  }
  return Object.keys(mix).length > 0 ? mix : undefined;
}

function haloOf(clip: Clip, localMs: number): Pick<VisualItem, "halo"> {
  const halo = clipHaloAt(clip, localMs);
  return halo ? { halo } : {};
}

function tiltOf(clip: Clip, localMs: number): Pick<VisualItem, "tilt"> {
  const tilt = clipTiltAt(clip, localMs);
  return tilt ? { tilt } : {};
}

export interface VisualItem {
  clipId: string;
  trackIndex: number;
  type: VisualKind;
  assetId?: string;
  layer?: Layer;
  live?: boolean;
  transform: Transform;
  base: Transform;
  fit: Fit;
  active: boolean;
  opacity: number;
  blurPx: number;
  paint?: PaintMix;
  tint?: Tint;
  reveal?: Reveal;
  revealInBox?: boolean;
  text?: TextMotion;
  chart?: ChartMotion;
  glyphs?: GlyphFrame;
  color?: ColorGrade;
  gradientMap?: GradientMap;
  chromaKey?: ChromaKey;
  lumaKey?: LumaKey;
  masks?: Mask[];
  halo?: ClipHalo;
  matte?: Matte;
  blendMode?: BlendMode;
  line?: LineState;
  shape?: PathOpsState;
  repeat?: ClipRepeat;
  flipX?: boolean;
  flipY?: boolean;
  vfx?: VfxLook[];
  trail?: MotionTrail;
  echo?: VisualItem[];
  camera?: MotionTrail;
  tilt?: ClipTilt;
  window?: FrameWindow;
  group?: GroupFrame;
  sourceMs: number;
  speed: number;
  frameMix?: boolean;
  backward: boolean;
  startMs: number;
  endMs: number;
}

function shapeOf(clip: Clip, canvas: CanvasSize): Pick<VisualItem, "shape"> {
  const shape = pathOpsState(clip.layer, { width: clip.transform.w * canvas.width, height: clip.transform.h * canvas.height });
  return shape ? { shape } : {};
}

export function heldLocalMs(clip: Pick<Clip, "startMs" | "durationMs">, ms: number): number {
  return ms >= clipEnd(clip) ? clip.durationMs - 1 : Math.max(0, ms - clip.startMs);
}

function looksAt(clip: Clip, localMs: number, levels: TrackLevels = NO_LEVELS): VfxLook[] {
  return clip.vfx?.length ? withSound(vfxLooks(clip.vfx, localMs), clip.vfx, clip.startMs + localMs, levels) : [];
}

function posed(clip: Clip, placed: Transform, localMs: number, looks: readonly VfxLook[], canvas: CanvasSize): Transform {
  return shakenTransform(movedTransform(placed, motionOffset(clip, localMs)), clip.type === "effect" ? [] : looks, canvas.width, canvas.height);
}

export function poseAt(lookup: ClipLookup, clip: Clip, localMs: number, aspect: number, canvas: CanvasSize, levels: TrackLevels = NO_LEVELS): Transform {
  return posed(clip, worldPlacementAt(lookup, clip, localMs, aspect, levels), localMs, looksAt(clip, localMs), canvas);
}

interface TransitionPart {
  transition: Transition;
  role: TransitionRole;
  t: number;
}

function transitionParts(track: Track, ms: number): Map<string, TransitionPart> {
  const parts = new Map<string, TransitionPart>();
  for (const transition of track.transitions ?? []) {
    const window = transitionWindow(transition, track);
    if (!window || ms < window.startMs || ms >= window.endMs) continue;
    const t = (ms - window.startMs) / (window.endMs - window.startMs);
    parts.set(transition.fromClipId, { transition, role: "from", t });
    parts.set(transition.toClipId, { transition, role: "to", t });
  }
  return parts;
}

function boxedLook(look: TransitionLook, transform: Transform, canvas: { width: number; height: number }): TransitionLook {
  if (!look.origin) return look;
  const radians = (transform.rotation * Math.PI) / 180;
  const ox = (look.origin.x - 0.5) * transform.w * canvas.width;
  const oy = (look.origin.y - 0.5) * transform.h * canvas.height;
  const x = transform.x + (ox * Math.cos(radians) - oy * Math.sin(radians)) / canvas.width;
  const y = transform.y + (ox * Math.sin(radians) + oy * Math.cos(radians)) / canvas.height;
  return { ...look, origin: { x, y } };
}

function withLook(item: VisualItem, look: TransitionLook, inBox: boolean): VisualItem {
  const t = item.transform;
  const x = look.origin ? t.x + (t.x - look.origin.x) * (look.scale - 1) : t.x;
  const y = look.origin ? t.y + (t.y - look.origin.y) * (look.scale - 1) : t.y;
  return {
    ...item,
    transform: { ...t, x: x + look.dx, y: y + look.dy, w: t.w * look.scale, h: t.h * look.scale },
    opacity: item.opacity * look.opacity,
    blurPx: item.blurPx + look.blurPx,
    ...(look.tint && look.tint.amount > 0 ? { tint: look.tint } : {}),
    ...(look.reveal ? { reveal: look.reveal, ...(inBox ? { revealInBox: true } : {}) } : {}),
  };
}

function ordered(entries: { item: VisualItem; part?: TransitionPart; above: boolean }[]): VisualItem[] {
  const keyed = entries.map((entry, index) => {
    if (!entry.above || !entry.part) return { item: entry.item, key: index };
    const partner = entries.findIndex((other) => other.part?.transition.id === entry.part!.transition.id && other.part.role !== entry.part!.role);
    return { item: entry.item, key: partner >= 0 ? partner + 0.5 : index };
  });
  return keyed.sort((a, b) => a.key - b.key).map((entry) => entry.item);
}

function colorOf(clip: Clip, localMs: number): Pick<VisualItem, "color" | "gradientMap"> {
  const color = gradeAt(clip, localMs);
  return { ...(color ? { color } : {}), ...(clip.gradientMap ? { gradientMap: clip.gradientMap } : {}) };
}

function sped(items: readonly VisualItem[], factor: number): VisualItem[] {
  return items.map((item) => ({ ...item, speed: item.speed * factor, ...(item.group ? { group: { ...item.group, items: sped(item.group.items, factor) } } : {}) }));
}

function groupFrame(doc: VideoDocument, group: GroupClip, localMs: number, premountMs: number, levels: TrackLevels): GroupFrame {
  const inner = groupTimeline(doc, group);
  const factor = clipSpeed(group);
  return { doc: inner, items: sped(visualPlan(inner, sourceAt(group, localMs), premountMs * factor, levels), factor) };
}

export function visualPlan(doc: VideoDocument, ms: number, premountMs: number = PREMOUNT_MS, levels: TrackLevels = NO_LEVELS): VisualItem[] {
  return timedPlan(doc, ms, (timeline, at) => framePlan(timeline, at, premountMs, levels));
}

function framePlan(doc: VideoDocument, ms: number, premountMs: number, levels: TrackLevels): VisualItem[] {
  const items: VisualItem[] = [];
  const aspect = canvasAspect(doc);
  const canvas = videoCanvasSize(doc);
  const lookup = clipLookup(doc);
  doc.tracks.forEach((track, trackIndex) => {
    if (track.kind !== "visual" || track.hidden) return;
    const parts = transitionParts(track, ms);
    const entries: { item: VisualItem; part?: TransitionPart; above: boolean }[] = [];
    for (const clip of track.clips) {
      const end = clipEnd(clip);
      const part = parts.get(clip.id);
      if (!part && (ms >= end || ms < clip.startMs - premountMs)) continue;
      if (clip.type === "audio" || clip.disabled) continue;
      const active = ms >= clip.startMs || part !== undefined;
      const localMs = active ? heldLocalMs(clip, ms) : 0;
      const transform = active ? worldPlacementAt(lookup, clip, localMs, aspect, levels) : clip.transform;
      const paint = paintOf(clip, localMs);
      const text = active ? textMotionOf(clip, localMs) : undefined;
      const chart = active ? chartMotionOf(clip, localMs) : undefined;
      const glyphs = glyphFrameAt(clip, localMs);
      const line = lineStateAt(clip, localMs);
      const looks = active ? looksAt(clip, localMs, levels) : [];
      const adjusts = clip.type === "effect";
      const drawn = drawnLooks(looks, adjusts);
      const matte = matteOf(clip);
      const camera = adjusts && active ? cameraView(clip, localMs, canvas) : null;
      const item: VisualItem = {
        clipId: clip.id,
        trackIndex,
        type: clip.type,
        assetId: clip.assetId,
        layer: active ? layerAt(clip, localMs) : clip.layer,
        ...(changesPerFrame(clip) ? { live: true } : {}),
        transform: active ? posed(clip, transform, localMs, looks, canvas) : clip.transform,
        base: clip.transform,
        fit: clip.type === "overlay" ? "contain" : (clip.fit ?? "cover"),
        active,
        opacity: active && clip.type !== "null" ? transform.opacity * fadeLevel(clip, localMs) : 0,
        blurPx: animatedBlur(clip.blur, clip.keyframes, localMs, behaviorLane(clip, localMs, levels)),
        ...(paint ? { paint } : {}),
        ...(text ? { text } : {}),
        ...(chart ? { chart } : {}),
        ...(glyphs ? { glyphs } : {}),
        ...colorOf(clip, localMs),
        ...(clip.chromaKey ? { chromaKey: chromaAt(clip.chromaKey, localMs) } : {}),
        ...(clip.lumaKey ? { lumaKey: lumaAt(clip.lumaKey, localMs) } : {}),
        ...(clip.masks?.length ? { masks: masksAt(clip.masks, localMs) } : {}),
        ...haloOf(clip, active ? localMs : 0),
        ...(matte ? { matte } : {}),
        ...(clip.blendMode && clip.blendMode !== "normal" ? { blendMode: clip.blendMode } : {}),
        ...(line ? { line } : {}),
        ...shapeOf(clip, canvas),
        ...(clip.repeat ? { repeat: clipRepeatAt(clip.repeat, localMs) } : {}),
        ...(clip.flipX ? { flipX: true } : {}),
        ...(clip.flipY ? { flipY: true } : {}),
        ...(drawn.length > 0 ? { vfx: drawn } : {}),
        ...(camera ? { camera } : {}),
        ...(active ? tiltOf(clip, localMs) : {}),
        ...stabilizedWindow(clip, localMs),
        ...(isGroupClip(clip) ? { group: groupFrame(doc, clip, localMs, premountMs, levels) } : {}),
        sourceMs: clip.type === "video" ? sourceAt(clip, localMs) : 0,
        speed: speedAt(clip, localMs),
        ...(clip.frameMix ? { frameMix: true } : {}),
        backward: Boolean(clip.reverse),
        startMs: clip.startMs,
        endMs: end,
      };
      const edge = !part && active ? edgePartAt(clip, localMs) : null;
      const look = part ? transitionLook(part.transition, part.role, part.t, clip.type !== "overlay") : edge ? boxedLook(edgeLook(edge.transition, edge.side, edge.t), item.transform, canvas) : null;
      entries.push({ item: look ? withLook(item, look, edge !== null) : item, part, above: look?.above ?? false });
    }
    items.push(...ordered(entries));
  });
  return items;
}

interface VideoCommand {
  seekToMs: number | null;
  play: boolean;
  playbackRate: number;
}

interface VideoSyncState {
  playing: boolean;
  rate: number;
  active: boolean;
  speed: number;
  backward: boolean;
}

const MAX_ELEMENT_RATE = 16;

export function syncVideo(currentMs: number, targetMs: number, state: VideoSyncState): VideoCommand {
  const flowing = state.playing && state.active && state.rate > 0 && state.speed > 0 && !state.backward;
  const tolerance = flowing ? DRIFT_TOLERANCE_MS * Math.max(1, state.speed) : PAUSED_TOLERANCE_MS;
  const drift = Math.abs(currentMs - targetMs);
  return {
    seekToMs: drift > tolerance ? Math.max(0, targetMs) : null,
    play: flowing,
    playbackRate: flowing ? Math.min(state.rate * state.speed, MAX_ELEMENT_RATE) : 1,
  };
}

export interface VoicePan {
  points: GainPoint[];
  track: number;
}

export interface AudioVoice {
  retime?: AudioRetime;
  clipId: string;
  trackId: string;
  assetId: string;
  delayMs: number;
  offsetMs: number;
  durationMs: number;
  gain: GainPoint[];
  pan?: VoicePan;
}

export interface AudioPlanOptions {
  soloTrackIds?: readonly string[];
  speech?: SpeechSource;
  rate?: number;
  sourceMs?: SourceLength;
}

type AudibleClip = Clip & { assetId: string };

export function soundAssetIds(doc: VideoDocument): string[] {
  return [...new Set([...nestedTracks(doc.tracks)].filter(({ track }) => track.kind === "audio").flatMap(({ track }) => track.clips.flatMap((clip) => (clip.assetId ? [clip.assetId] : []))))];
}

function audibleTracks(doc: VideoDocument, options: AudioPlanOptions): Track[] {
  const solo = new Set(options.soloTrackIds ?? []);
  return doc.tracks.filter((track) => track.kind === "audio" && !track.hidden && !track.muted && (solo.size === 0 || solo.has(track.id)));
}

function audibleOf(track: Track): AudibleClip[] {
  return track.clips.filter((clip): clip is AudibleClip => Boolean(clip.assetId) && !clip.disabled && clip.volume > 0);
}

export function gainContext(doc: VideoDocument, track: Track, options: AudioPlanOptions): GainContext {
  const rule = track.ducking;
  if (!rule || !options.speech) return { trackGainDb: track.gainDb ?? 0 };
  const regions = timelineSpeech(doc, rule, options.speech);
  return { trackGainDb: track.gainDb ?? 0, duckDb: (ms) => duckDb(regions, rule, ms) };
}

function duckingKey(doc: VideoDocument, track: Track, options: AudioPlanOptions): string {
  const rule = track.ducking;
  if (!rule) return "";
  const triggers = doc.tracks.filter((t) => rule.triggerTrackIds.includes(t.id));
  return JSON.stringify([rule, triggers.map((t) => [t.muted, t.hidden, t.clips.map((c) => [c.assetId, c.startMs, c.durationMs, c.trimInMs, c.speed, c.keyframes?.speed, c.reverse, c.disabled, c.volume, Boolean(c.assetId && options.speech?.(c.assetId))])])]);
}

export function audioPlan(doc: VideoDocument, fromMs: number, options: AudioPlanOptions = {}): AudioVoice[] {
  const rate = options.rate ?? 1;
  const wall = (ms: number) => ms / rate;
  const voices: AudioVoice[] = [];
  for (const track of audibleTracks(doc, options)) {
    const context = gainContext(doc, track, options);
    for (const clip of audibleOf(track)) {
      const edges = voiceEdges(track, clip, options.sourceMs);
      const first = -edges.headMs;
      const last = clip.durationMs + edges.tailMs;
      if (clip.startMs + last <= fromMs) continue;
      const localMs = Math.max(fromMs - clip.startMs, first);
      const stretched = retimed(clip) || rate !== 1;
      const speed = clipSpeed(clip);
      const head = travelMs(clip, first, 0);
      const tail = travelMs(clip, clip.durationMs, last);
      const before = clip.reverse ? tail : head;
      const after = clip.reverse ? head : tail;
      const curve = hasSpeedCurve(clip) ? { curve: { keys: [...speedKeys(clip)], fromMs: first, toMs: last, rate } } : {};
      const scaled = (points: GainPoint[]) => points.map((point) => ({ ...point, atMs: wall(point.atMs) }));
      voices.push({
        clipId: clip.id,
        trackId: track.id,
        assetId: clip.assetId,
        delayMs: wall(clip.startMs + localMs - fromMs),
        offsetMs: stretched ? wall(localMs - first) : clip.trimInMs + localMs,
        ...(stretched ? { retime: { trimInMs: clip.trimInMs - before, spanMs: sourceSpanMs(clip) + before + after, speed: speed * rate, reverse: Boolean(clip.reverse), preservePitch: clip.preservePitch ?? true, ...curve } } : {}),
        durationMs: wall(last - localMs),
        gain: scaled(gainPoints(clip, localMs, { ...context, fadeIn: edges.fadeIn, fadeOut: edges.fadeOut }, last)),
        ...(isCentered(clip, track) ? {} : { pan: { points: scaled(panPoints(clip, localMs, last)), track: track.pan ?? 0 } }),
      });
    }
  }
  for (const heard of heardGroups(doc, options)) voices.push(...groupedVoices(heard, fromMs, rate, (inner, innerFromMs, innerRate) => audioPlan(inner, innerFromMs, { ...options, soloTrackIds: undefined, rate: innerRate })));
  return voices;
}

function groupVoiceKeys(doc: VideoDocument, options: AudioPlanOptions): [string, string][] {
  return heardGroups(doc, options).flatMap((heard) => [...audioVoiceKeys(heard.inner, { ...options, soloTrackIds: undefined })].map(([clipId, key]): [string, string] => [clipId, groupKey(heard) + key]));
}

export function audioVoiceKeys(doc: VideoDocument, options: AudioPlanOptions = {}): Map<string, string> {
  return new Map([
    ...groupVoiceKeys(doc, options),
    ...audibleTracks(doc, options).flatMap((track) => {
      const ducking = duckingKey(doc, track, options);
      return audibleOf(track).map((clip): [string, string] => [
        clip.id,
        JSON.stringify([clip.assetId, track.id, clip.startMs, clip.durationMs, clip.trimInMs, clip.volume, clip.fadeInMs, clip.fadeOutMs, clip.speed, clip.reverse, clip.preservePitch, clip.keyframes?.speed, clip.keyframes?.gainDb, clip.pan, clip.keyframes?.pan, track.gainDb, track.pan, voiceEdges(track, clip, options.sourceMs), ducking]),
      ]);
    }),
  ]);
}

interface AudioPlanChange {
  stop: string[];
  start: string[];
}

export function audioPlanChange(previous: ReadonlyMap<string, string>, next: ReadonlyMap<string, string>): AudioPlanChange {
  return {
    stop: [...previous].filter(([clipId, key]) => next.get(clipId) !== key).map(([clipId]) => clipId),
    start: [...next].filter(([clipId, key]) => previous.get(clipId) !== key).map(([clipId]) => clipId),
  };
}

interface BoxStyle {
  left: string;
  top: string;
  width: string;
  height: string;
  transform: string;
  opacity: number;
  zIndex: number;
}

export function boxStyle(item: Pick<VisualItem, "transform" | "opacity" | "trackIndex">): BoxStyle {
  const t = item.transform;
  return {
    left: `${(t.x - t.w / 2) * 100}%`,
    top: `${(t.y - t.h / 2) * 100}%`,
    width: `${t.w * 100}%`,
    height: `${t.h * 100}%`,
    transform: t.rotation ? `rotate(${t.rotation}deg)` : "none",
    opacity: item.opacity,
    zIndex: item.trackIndex + 1,
  };
}

interface ContentStretch {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}

export function contentStretch(item: Pick<VisualItem, "transform" | "base" | "flipX" | "flipY">): ContentStretch {
  const t = item.transform;
  const base = item.base;
  const width = base.w > 0 && t.w > 0 ? base.w / t.w : 1;
  const height = base.h > 0 && t.h > 0 ? base.h / t.h : 1;
  return { width, height, scaleX: (item.flipX ? -1 : 1) / width, scaleY: (item.flipY ? -1 : 1) / height };
}

const FOCUS_DIM = 0.3;

export function focusedPlan(items: readonly VisualItem[], focusClipId: string | null, solo: boolean): VisualItem[] {
  if (!focusClipId) return [...items];
  return items
    .filter((item) => !solo || item.clipId === focusClipId)
    .map((item) => (item.clipId === focusClipId ? item : { ...item, opacity: item.opacity * FOCUS_DIM }));
}

export function zoomAround(transform: { x: number; y: number; w: number; h: number }, maxScale: number = 3, fill: number = 0.6): { scale: number; originX: number; originY: number } {
  const size = Math.max(transform.w, transform.h, 0.01);
  return { scale: Math.max(1, Math.min(maxScale, fill / size)), originX: Math.min(1, Math.max(0, transform.x)), originY: Math.min(1, Math.max(0, transform.y)) };
}
