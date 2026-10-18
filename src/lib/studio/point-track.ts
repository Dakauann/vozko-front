import { framePointOf } from "./clip-placement";
import { sourceAt, sourceSpanMs } from "./clip-time";
import { STUDIO_LIMITS, type Clip, type Fit, type Transform } from "./document";
import { fitRect } from "./fit";
import type { PathPoint } from "./position-path";
import { isValidToken, runes } from "./tokens";
import type { TrackDirection, TrackJob } from "./tracking/track-run";
import type { IssueCode } from "./validate";

export interface TrackSample {
  atMs: number;
  x: number;
  y: number;
  confidence: number;
}

export interface PointTracker {
  id: string;
  name?: string;
  frameWidth: number;
  frameHeight: number;
  size: number;
  referenceMs: number;
  samples: TrackSample[];
}

export interface Stabilize {
  trackerId: string;
  secondTrackerId?: string;
  rotation?: boolean;
  scale?: boolean;
  smoothMs?: number;
  zoom: number;
}

export type StabilizeChoice = Omit<Stabilize, "zoom">;

export interface FrameWindow {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface FrameSize {
  width: number;
  height: number;
}

export const TRACKER_LIMITS = {
  size: [0.01, 0.5],
  frameSide: [1, 16384],
  zoom: [1, 4],
  smoothMs: [100, 10000],
  zoomStep: 1000,
} as const;

export const DEFAULT_TRACK_SIZE = 0.06;

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

export function trackerOf(clip: Pick<Clip, "trackers">, trackerId: string | undefined): PointTracker | undefined {
  return trackerId === undefined ? undefined : clip.trackers?.find((tracker) => tracker.id === trackerId);
}

function frameSizeOf(tracker: Pick<PointTracker, "frameWidth" | "frameHeight">): FrameSize {
  return { width: tracker.frameWidth, height: tracker.frameHeight };
}

function sampleIndexAtOrBefore(samples: readonly TrackSample[], atMs: number): number {
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (samples[middle].atMs <= atMs) low = middle;
    else high = middle - 1;
  }
  return low;
}

function pointOn(samples: readonly TrackSample[], atMs: number): PathPoint {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (atMs <= first.atMs) return { x: first.x, y: first.y };
  if (atMs >= last.atMs) return { x: last.x, y: last.y };
  const index = sampleIndexAtOrBefore(samples, atMs);
  const a = samples[index];
  const b = samples[index + 1];
  const t = (atMs - a.atMs) / (b.atMs - a.atMs);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function trackerPointAt(tracker: Pick<PointTracker, "samples">, sourceMs: number): PathPoint {
  return pointOn(tracker.samples, sourceMs);
}

function samplesIssue(tracker: PointTracker): IssueCode | null {
  const samples = tracker.samples;
  if (samples.length === 0) return "invalid";
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (!Number.isSafeInteger(sample.atMs) || sample.atMs < 0) return "invalid";
    if (i > 0 && sample.atMs <= samples[i - 1].atMs) return "invalid";
    if (!within(sample.x, [0, 1]) || !within(sample.y, [0, 1]) || !within(sample.confidence, [0, 1])) return "out_of_range";
  }
  const reference = samples[sampleIndexAtOrBefore(samples, tracker.referenceMs)];
  return reference.atMs === tracker.referenceMs ? null : "invalid";
}

function trackerIssue(tracker: PointTracker): IssueCode | null {
  if (!isValidToken(tracker.id) || runes(tracker.name ?? "") > STUDIO_LIMITS.maxLayerNameRunes) return "invalid";
  if (![tracker.frameWidth, tracker.frameHeight].every((side) => Number.isInteger(side) && within(side, TRACKER_LIMITS.frameSide))) return "invalid";
  if (!within(tracker.size, TRACKER_LIMITS.size)) return "out_of_range";
  return samplesIssue(tracker);
}

export function trackersIssue(clip: Pick<Clip, "type" | "trackers">): IssueCode | null {
  const trackers = clip.trackers;
  if (!trackers || trackers.length === 0) return null;
  if (clip.type !== "video") return "invalid";
  const ids = new Set<string>();
  for (const tracker of trackers) {
    if (ids.has(tracker.id)) return "invalid";
    ids.add(tracker.id);
    const code = trackerIssue(tracker);
    if (code) return code;
  }
  return null;
}

export function stabilizeIssue(clip: Pick<Clip, "type" | "freeze" | "trackers" | "stabilize">): IssueCode | null {
  const s = clip.stabilize;
  if (!s) return null;
  if (clip.type !== "video" || clip.freeze) return "invalid";
  const first = trackerOf(clip, s.trackerId);
  if (!first) return "invalid";
  if (s.secondTrackerId) {
    const second = trackerOf(clip, s.secondTrackerId);
    if (!second || second.id === first.id || second.frameWidth !== first.frameWidth || second.frameHeight !== first.frameHeight) return "invalid";
  } else if (s.rotation || s.scale) {
    return "invalid";
  }
  if (s.smoothMs && (!Number.isInteger(s.smoothMs) || !within(s.smoothMs, TRACKER_LIMITS.smoothMs))) return "out_of_range";
  return within(s.zoom, TRACKER_LIMITS.zoom) ? null : "out_of_range";
}

const SMOOTHED = new WeakMap<readonly TrackSample[], Map<number, TrackSample[]>>();

function smoothedSamples(samples: readonly TrackSample[], smoothMs: number): readonly TrackSample[] {
  let byWidth = SMOOTHED.get(samples);
  if (!byWidth) {
    byWidth = new Map();
    SMOOTHED.set(samples, byWidth);
  }
  const known = byWidth.get(smoothMs);
  if (known) return known;
  const sigma = smoothMs / 4;
  const reach = smoothMs / 2;
  const out: TrackSample[] = [];
  let low = 0;
  let high = 0;
  for (const sample of samples) {
    while (samples[low].atMs < sample.atMs - reach) low++;
    while (high + 1 < samples.length && samples[high + 1].atMs <= sample.atMs + reach) high++;
    let weight = 0;
    let x = 0;
    let y = 0;
    for (let i = low; i <= high; i++) {
      const d = samples[i].atMs - sample.atMs;
      const w = Math.exp(-(d * d) / (2 * sigma * sigma));
      weight += w;
      x += w * samples[i].x;
      y += w * samples[i].y;
    }
    out.push({ ...sample, x: x / weight, y: y / weight });
  }
  byWidth.set(smoothMs, out);
  return out;
}

interface Motion {
  point: PathPoint;
  target: PathPoint;
  turn: number;
  growth: number;
}

function pixels(point: PathPoint, size: FrameSize): PathPoint {
  return { x: point.x * size.width, y: point.y * size.height };
}

function wrapTurn(radians: number): number {
  return radians - 2 * Math.PI * Math.round(radians / (2 * Math.PI));
}

function motionAt(first: PointTracker, second: PointTracker | undefined, choice: StabilizeChoice, sourceMs: number): Motion {
  const size = frameSizeOf(first);
  const smooth = choice.smoothMs;
  const goal = (tracker: PointTracker) => (smooth ? pointOn(smoothedSamples(tracker.samples, smooth), sourceMs) : trackerPointAt(tracker, first.referenceMs));
  const point = pixels(trackerPointAt(first, sourceMs), size);
  const target = pixels(goal(first), size);
  if (!second || !(choice.rotation || choice.scale)) return { point, target, turn: 0, growth: 1 };
  const other = pixels(trackerPointAt(second, sourceMs), size);
  const otherTarget = pixels(goal(second), size);
  const now = { x: other.x - point.x, y: other.y - point.y };
  const then = { x: otherTarget.x - target.x, y: otherTarget.y - target.y };
  const nowLength = Math.hypot(now.x, now.y);
  const thenLength = Math.hypot(then.x, then.y);
  const usable = nowLength > 1e-9 && thenLength > 1e-9;
  return {
    point,
    target,
    turn: choice.rotation && usable ? wrapTurn(Math.atan2(now.y, now.x) - Math.atan2(then.y, then.x)) : 0,
    growth: choice.scale && usable ? nowLength / thenLength : 1,
  };
}

function turned(vector: PathPoint, radians: number): PathPoint {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}

function windowCenter(motion: Motion, size: FrameSize): PathPoint {
  const offset = turned({ x: size.width / 2 - motion.target.x, y: size.height / 2 - motion.target.y }, motion.turn);
  return { x: motion.point.x + motion.growth * offset.x, y: motion.point.y + motion.growth * offset.y };
}

function chosen(clip: Pick<Clip, "trackers">, choice: StabilizeChoice): { first: PointTracker; second: PointTracker | undefined } | null {
  const first = trackerOf(clip, choice.trackerId);
  return first ? { first, second: trackerOf(clip, choice.secondTrackerId) } : null;
}

export function frameWindowAt(clip: Pick<Clip, "trackers" | "stabilize">, sourceMs: number): FrameWindow | null {
  const s = clip.stabilize;
  const found = s ? chosen(clip, s) : null;
  if (!s || !found) return null;
  const size = frameSizeOf(found.first);
  const motion = motionAt(found.first, found.second, s, sourceMs);
  const center = windowCenter(motion, size);
  return { x: center.x / size.width, y: center.y / size.height, scale: motion.growth / s.zoom, rotation: (motion.turn * 180) / Math.PI };
}

export function stabilizedWindow(clip: Pick<Clip, "type" | "trimInMs" | "durationMs" | "speed" | "reverse" | "freeze" | "trackers" | "stabilize">, localMs: number): { window?: FrameWindow } {
  if (clip.type !== "video" || !clip.stabilize) return {};
  const window = frameWindowAt(clip, sourceAt(clip, localMs));
  return window ? { window } : {};
}

interface WindowPlacement {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export function windowPlacement(window: FrameWindow, width: number, height: number): WindowPlacement {
  const radians = (-window.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = (0.5 - window.x) * width;
  const dy = (0.5 - window.y) * height;
  return { x: width / 2 + (dx * cos - dy * sin) / window.scale, y: height / 2 + (dx * sin + dy * cos) / window.scale, scale: 1 / window.scale, rotation: radians };
}

export function realOfShown(window: FrameWindow, size: FrameSize, point: PathPoint): PathPoint {
  const offset = turned({ x: (point.x - 0.5) * size.width * window.scale, y: (point.y - 0.5) * size.height * window.scale }, (window.rotation * Math.PI) / 180);
  return { x: window.x + offset.x / size.width, y: window.y + offset.y / size.height };
}

export function shownOfReal(window: FrameWindow, size: FrameSize, point: PathPoint): PathPoint {
  const offset = turned({ x: (point.x - window.x) * size.width, y: (point.y - window.y) * size.height }, (-window.rotation * Math.PI) / 180);
  return { x: 0.5 + offset.x / (size.width * window.scale), y: 0.5 + offset.y / (size.height * window.scale) };
}

export function stabilizeSpan(clip: Pick<Clip, "trimInMs" | "durationMs" | "speed" | "freeze">): [number, number] {
  return [clip.trimInMs, clip.trimInMs + sourceSpanMs(clip)];
}

export function neededZoom(clip: Pick<Clip, "trackers">, choice: StabilizeChoice, [fromMs, toMs]: readonly [number, number]): number | null {
  const found = chosen(clip, choice);
  if (!found) return null;
  const size = frameSizeOf(found.first);
  const times = [fromMs, toMs, ...found.first.samples.map((sample) => sample.atMs).filter((atMs) => atMs > fromMs && atMs < toMs)];
  let most = 1;
  for (const atMs of times) {
    const motion = motionAt(found.first, found.second, choice, atMs);
    const center = windowCenter(motion, size);
    if (center.x < 0 || center.y < 0 || center.x > size.width || center.y > size.height) return null;
    for (const corner of [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: 1, y: 1 },
    ]) {
      const reach = turned({ x: (corner.x * size.width * motion.growth) / 2, y: (corner.y * size.height * motion.growth) / 2 }, motion.turn);
      for (const [c, r, side] of [
        [center.x, reach.x, size.width],
        [center.y, reach.y, size.height],
      ] as const) {
        if (r > 1e-12) most = Math.min(most, (side - c) / r);
        else if (r < -1e-12) most = Math.min(most, -c / r);
      }
    }
  }
  if (most <= 0) return null;
  const zoom = Math.max(TRACKER_LIMITS.zoom[0], Math.ceil((1 / most) * TRACKER_LIMITS.zoomStep - 1e-9) / TRACKER_LIMITS.zoomStep);
  return zoom <= TRACKER_LIMITS.zoom[1] ? zoom : null;
}

function fitOf(size: FrameSize, boxAspect: number, fit: Fit) {
  return fitRect(size.width, size.height, boxAspect, 1, fit);
}

export function boxPointOfFrame(point: PathPoint, size: FrameSize, boxAspect: number, fit: Fit): PathPoint {
  const r = fitOf(size, boxAspect, fit);
  return { x: (r.dx + ((point.x * size.width - r.sx) * r.dw) / r.sw) / boxAspect, y: r.dy + ((point.y * size.height - r.sy) * r.dh) / r.sh };
}

export function framePointOfBox(point: PathPoint, size: FrameSize, boxAspect: number, fit: Fit): PathPoint {
  const r = fitOf(size, boxAspect, fit);
  return { x: (r.sx + ((point.x * boxAspect - r.dx) * r.sw) / r.dw) / size.width, y: (r.sy + ((point.y - r.dy) * r.sh) / r.dh) / size.height };
}

function framePixelsPerBoxHeight(size: FrameSize, boxAspect: number, fit: Fit): number {
  const r = fitOf(size, boxAspect, fit);
  return r.sh / r.dh;
}

export function baseAspect(clip: Pick<Clip, "transform">, canvasAspect: number): number {
  return (clip.transform.w * canvasAspect) / clip.transform.h;
}

function flipped(point: PathPoint, clip: Pick<Clip, "flipX" | "flipY">): PathPoint {
  return { x: clip.flipX ? 1 - point.x : point.x, y: clip.flipY ? 1 - point.y : point.y };
}

function shownTrackerPoint(clip: Pick<Clip, "trackers" | "stabilize">, tracker: PointTracker, sourceMs: number): PathPoint {
  const raw = trackerPointAt(tracker, sourceMs);
  const window = frameWindowAt(clip, sourceMs);
  return window ? shownOfReal(window, frameSizeOf(tracker), raw) : raw;
}

type TrackedClip = Pick<Clip, "type" | "trimInMs" | "durationMs" | "speed" | "reverse" | "freeze" | "trackers" | "stabilize" | "transform" | "fit" | "flipX" | "flipY">;

export function trackedPoint(clip: TrackedClip, tracker: PointTracker, localMs: number, placed: Transform, canvasAspect: number): PathPoint {
  const shown = shownTrackerPoint(clip, tracker, sourceAt(clip, localMs));
  const inBox = boxPointOfFrame(shown, frameSizeOf(tracker), baseAspect(clip, canvasAspect), clip.fit ?? "cover");
  return framePointOf(placed, flipped(inBox, clip), canvasAspect);
}

export function boxFractionOf(clip: Pick<Clip, "flipX" | "flipY">, inBox: PathPoint): PathPoint {
  return flipped(inBox, clip);
}

export interface BoxTrackRequest {
  boxPoint: PathPoint;
  boxSize: number;
  boxAspect: number;
  fit: Fit;
  window?: FrameWindow;
  atMs: number;
  fromMs: number;
  toMs: number;
  direction: TrackDirection;
}

export function frameJobOf(request: BoxTrackRequest, size: FrameSize): TrackJob | null {
  const shown = framePointOfBox(request.boxPoint, size, request.boxAspect, request.fit);
  const point = request.window ? realOfShown(request.window, size, shown) : shown;
  const scale = request.window?.scale ?? 1;
  const sidePx = request.boxSize * framePixelsPerBoxHeight(size, request.boxAspect, request.fit) * scale;
  if (![point.x, point.y, sidePx].every(Number.isFinite)) return null;
  const size01 = Math.min(TRACKER_LIMITS.size[1], Math.max(TRACKER_LIMITS.size[0], sidePx / size.height));
  return { point, size: size01, atMs: request.atMs, fromMs: request.fromMs, toMs: request.toMs, direction: request.direction };
}

interface TrackerSummary {
  frames: number;
  meanConfidence: number;
  lowestConfidence: number;
}

export function trackerSummary(tracker: Pick<PointTracker, "samples">): TrackerSummary {
  const confidences = tracker.samples.map((sample) => sample.confidence);
  const mean = confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
  return { frames: confidences.length, meanConfidence: Math.round(mean * 1000) / 1000, lowestConfidence: confidences.reduce((low, value) => Math.min(low, value), 1) };
}
