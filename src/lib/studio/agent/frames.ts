import type { Clip, Track, VideoDocument } from "../document";
import { COLOR_PROPERTIES, VISUAL_KEYFRAME_PROPERTIES } from "../keyframes";
import { LINE_PROPERTIES } from "../line-properties";
import { visualPlan, type VisualItem } from "../playback";
import { span, type TextAnimator, type TextUnit } from "../text-animation";
import { animatorWindow } from "../text-animator";
import { clipEnd } from "../timeline";
import { transitionWindow } from "../transitions";
import { argsOf, defined, numberField, numberList, textField } from "./args";
import { edgeLengthMs } from "../edge-transitions";

export const DEFAULT_LOOK_FRAMES = 6;
export const MAX_LOOK_FRAMES = 9;
export const MAX_LOOK_ZOOM = 4;
const MIN_GAP_MS = 100;

export interface VisionBudget {
  longEdge: number;
  pixels: number;
}

export const VISION_BUDGET: VisionBudget = { longEdge: 1568, pixels: 1_150_000 };

export interface LookRequest {
  times_ms?: number[];
  count?: number;
  from_ms?: number;
  to_ms?: number;
  focus_id?: string;
  region?: LookRegion;
  view?: string;
}

function lookRegionOf(value: unknown): LookRegion | undefined {
  const args = argsOf(value);
  const [x, y, w, h] = [args.x, args.y, args.w, args.h].map(numberField);
  return x !== undefined && y !== undefined && w !== undefined && h !== undefined ? { x, y, w, h } : undefined;
}

export function lookRequestOf(value: unknown): LookRequest {
  const args = argsOf(value);
  return defined({
    times_ms: numberList(args.times_ms),
    count: numberField(args.count),
    from_ms: numberField(args.from_ms),
    to_ms: numberField(args.to_ms),
    focus_id: textField(args.focus_id),
    region: lookRegionOf(args.region),
    view: textField(args.view),
  });
}

function cutPoints(doc: VideoDocument): number[] {
  const points = new Set<number>([0, doc.durationMs]);
  for (const track of doc.tracks) {
    if (track.kind !== "visual" || track.hidden) continue;
    for (const clip of track.clips) {
      if (clip.disabled) continue;
      points.add(clip.startMs);
      points.add(clipEnd(clip));
    }
  }
  return [...points].filter((p) => p >= 0 && p <= doc.durationMs).sort((a, b) => a - b);
}

export function cutMiddles(doc: VideoDocument): number[] {
  const cuts = cutPoints(doc);
  const middles: number[] = [];
  for (let i = 1; i < cuts.length; i++) {
    if (cuts[i] - cuts[i - 1] >= MIN_GAP_MS) middles.push(Math.round((cuts[i - 1] + cuts[i]) / 2));
  }
  return middles;
}

function spread<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  return Array.from({ length: count }, (_, i) => items[Math.round((i * (items.length - 1)) / Math.max(1, count - 1))]);
}

function inside(ms: number, durationMs: number): number {
  return Math.max(0, Math.min(Math.round(ms), Math.max(0, durationMs - 1)));
}

export function lookFrameCount(count: number | undefined): number {
  return count && count > 0 ? Math.min(count, MAX_LOOK_FRAMES) : DEFAULT_LOOK_FRAMES;
}

export function lookTimes(doc: VideoDocument, request: LookRequest): number[] {
  if (request.times_ms && request.times_ms.length > 0) {
    return [...new Set(request.times_ms.slice(0, MAX_LOOK_FRAMES).map((ms) => inside(ms, doc.durationMs)))].sort((a, b) => a - b);
  }
  const count = lookFrameCount(request.count);
  if (doc.durationMs <= 0) return [0];
  const chosen = spread(cutMiddles(doc), count);
  for (let i = 0; chosen.length < count && i < count * 4; i++) {
    const candidate = inside(((i % count) + 0.5) * (doc.durationMs / count) + Math.floor(i / count) * MIN_GAP_MS, doc.durationMs);
    if (chosen.every((t) => Math.abs(t - candidate) >= MIN_GAP_MS)) chosen.push(candidate);
  }
  return chosen.sort((a, b) => a - b);
}

export type MotionKind = "transition" | "entrance" | "exit" | "keyframes" | "text_in" | "text_out" | "text_animators";

export interface MotionWindow {
  id: string;
  kind: MotionKind;
  from_ms: number;
  to_ms: number;
}

function estimatedUnits(text: string | undefined, unit: TextUnit): number {
  const words = (text ?? "").split(/\s+/).filter(Boolean);
  if (unit === "word") return Math.max(1, words.length);
  if (unit === "char") return Math.max(1, words.join("").length);
  return Math.max(1, (text ?? "").split("\n").filter((line) => line.trim()).length);
}

function animatorSpanMs(clip: Clip, animator: TextAnimator): number {
  return Math.min(clip.durationMs, span(animator, estimatedUnits(clip.layer?.text, animator.unit)));
}

export function keyTimes(clip: Clip): number[] {
  const keyframes = clip.keyframes;
  if (!keyframes) return [];
  const lanes = [...VISUAL_KEYFRAME_PROPERTIES.map((p) => keyframes[p] ?? []), ...COLOR_PROPERTIES.map((p) => keyframes[p] ?? []), ...LINE_PROPERTIES.map((p) => keyframes[p] ?? [])];
  return [...new Set(lanes.flatMap((lane) => lane.map((key) => key.atMs)))].sort((a, b) => a - b);
}

function clipWindows(clip: Clip): MotionWindow[] {
  const windows: MotionWindow[] = [];
  const add = (kind: MotionKind, fromLocal: number, toLocal: number) => {
    if (toLocal > fromLocal) windows.push({ id: clip.id, kind, from_ms: clip.startMs + fromLocal, to_ms: clip.startMs + toLocal });
  };
  add("entrance", 0, Math.min(clip.durationMs, edgeLengthMs(clip, "in")));
  add("exit", Math.max(0, clip.durationMs - edgeLengthMs(clip, "out")), clip.durationMs);
  const keys = keyTimes(clip);
  if (keys.length > 1) add("keyframes", keys[0], keys[keys.length - 1]);
  if (clip.textIn) add("text_in", 0, animatorSpanMs(clip, clip.textIn));
  if (clip.textOut) add("text_out", clip.durationMs - animatorSpanMs(clip, clip.textOut), clip.durationMs);
  const unitWindow = animatorWindow(clip.textAnimators, clip.durationMs);
  if (unitWindow) add("text_animators", unitWindow[0], unitWindow[1]);
  return windows;
}

function visualTracks(doc: VideoDocument): Track[] {
  return doc.tracks.filter((track) => track.kind === "visual" && !track.hidden);
}

function transitionWindows(track: Track): (MotionWindow & { clips: string[] })[] {
  return (track.transitions ?? []).flatMap((transition) => {
    const window = transitionWindow(transition, track);
    return window ? [{ id: transition.id, kind: "transition" as const, from_ms: window.startMs, to_ms: window.endMs, clips: [transition.fromClipId, transition.toClipId] }] : [];
  });
}

function byTime(a: MotionWindow, b: MotionWindow): number {
  return a.from_ms - b.from_ms || a.to_ms - b.to_ms;
}

export function motionWindows(doc: VideoDocument): MotionWindow[] {
  const windows = visualTracks(doc).flatMap((track) => [
    ...transitionWindows(track).map(({ id, kind, from_ms, to_ms }) => ({ id, kind, from_ms, to_ms })),
    ...track.clips.filter((clip) => !clip.disabled && clip.type !== "audio").flatMap(clipWindows),
  ]);
  return windows.sort(byTime);
}

function sampleWindow(fromMs: number, toMs: number, count: number, durationMs: number): number[] {
  const last = Math.max(fromMs, toMs - 1);
  if (count <= 1) return [inside((fromMs + last) / 2, durationMs)];
  return Array.from({ length: count }, (_, i) => inside(fromMs + (i * (last - fromMs)) / (count - 1), durationMs));
}

type TimeSpan = Pick<MotionWindow, "from_ms" | "to_ms">;

function sampleWindows(windows: readonly TimeSpan[], count: number, durationMs: number): number[] {
  const used = windows.slice(0, Math.max(1, Math.min(windows.length, Math.floor(count / 2))));
  const base = Math.floor(count / used.length);
  const extra = count - base * used.length;
  return used.flatMap((window, i) => sampleWindow(window.from_ms, window.to_ms, base + (i < extra ? 1 : 0), durationMs));
}

function focusWindows(doc: VideoDocument, focusId: string): MotionWindow[] | null {
  for (const track of visualTracks(doc)) {
    const transition = transitionWindows(track).find((window) => window.id === focusId);
    if (transition) return [{ id: transition.id, kind: transition.kind, from_ms: transition.from_ms, to_ms: transition.to_ms }];
    const clip = track.clips.find((candidate) => candidate.id === focusId);
    if (!clip) continue;
    const touching = transitionWindows(track)
      .filter((window) => window.clips.includes(clip.id))
      .map(({ id, kind, from_ms, to_ms }) => ({ id, kind, from_ms, to_ms }));
    return [...clipWindows(clip), ...touching].sort(byTime);
  }
  return null;
}

function clipSpan(doc: VideoDocument, clipId: string): TimeSpan | null {
  for (const track of doc.tracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (clip) return { from_ms: clip.startMs, to_ms: clipEnd(clip) };
  }
  return null;
}

export type LookPlan = { ok: true; times: number[]; dense: boolean; windows: MotionWindow[] } | { ok: false; reason: string };

function unique(times: readonly number[]): number[] {
  return [...new Set(times)].sort((a, b) => a - b);
}

function closeTogether(times: readonly number[]): boolean {
  return times.some((t, i) => i > 0 && t - times[i - 1] < MIN_GAP_MS);
}

export function lookPlan(doc: VideoDocument, request: LookRequest): LookPlan {
  const count = lookFrameCount(request.count);
  if (request.times_ms && request.times_ms.length > 0) {
    const times = lookTimes(doc, request);
    return { ok: true, times, dense: closeTogether(times), windows: [] };
  }
  if (request.focus_id) {
    const windows = focusWindows(doc, request.focus_id);
    if (!windows) return { ok: false, reason: `focus_id ${request.focus_id} não é um clipe visual nem uma transição; copie o id de studio_read` };
    const sampled = windows.length > 0 ? windows : [clipSpan(doc, request.focus_id)!];
    return { ok: true, times: unique(sampleWindows(sampled, count, doc.durationMs)), dense: true, windows };
  }
  if (request.from_ms !== undefined || request.to_ms !== undefined) {
    const fromMs = inside(request.from_ms ?? 0, doc.durationMs);
    const toMs = Math.min(doc.durationMs, Math.round(request.to_ms ?? doc.durationMs));
    if (toMs <= fromMs) return { ok: false, reason: "to_ms precisa ser maior que from_ms e cair dentro do vídeo" };
    return { ok: true, times: unique(sampleWindow(fromMs, toMs, count, doc.durationMs)), dense: true, windows: [] };
  }
  return { ok: true, times: lookTimes(doc, request), dense: false, windows: [] };
}

export interface ClipState {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  blur_px?: number;
}

export interface ClipNote {
  id: string;
  type: string;
  text?: string;
  mark?: number;
  state?: ClipState;
  transition?: { id: string; kind: string; progress: number };
  text_in?: number;
  text_out?: number;
  vfx?: string[];
}

export interface SceneNote {
  at_ms: number;
  clips: ClipNote[];
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function animated(clip: Clip): boolean {
  return Boolean(edgeLengthMs(clip, "in") > 0 || edgeLengthMs(clip, "out") > 0 || clip.textIn || clip.textOut || animatorWindow(clip.textAnimators, clip.durationMs) || keyTimes(clip).length > 0);
}

function stateOf(item: VisualItem): ClipState {
  const t = item.transform;
  return {
    x: round(t.x, 3),
    y: round(t.y, 3),
    w: round(t.w, 3),
    h: round(t.h, 3),
    rotation: round(t.rotation, 1),
    opacity: round(item.opacity, 2),
    ...(item.blurPx > 0 ? { blur_px: round(item.blurPx, 1) } : {}),
  };
}

function transitionsAt(doc: VideoDocument, atMs: number): Map<string, { id: string; kind: string; progress: number }> {
  const found = new Map<string, { id: string; kind: string; progress: number }>();
  for (const track of visualTracks(doc)) {
    for (const transition of track.transitions ?? []) {
      const window = transitionWindow(transition, track);
      if (!window || atMs < window.startMs || atMs >= window.endMs) continue;
      const progress = round((atMs - window.startMs) / (window.endMs - window.startMs), 2);
      const part = { id: transition.id, kind: transition.kind, progress };
      found.set(transition.fromClipId, part);
      found.set(transition.toClipId, part);
    }
  }
  return found;
}

function textProgress(clip: Clip, atMs: number): Pick<ClipNote, "text_in" | "text_out"> {
  const local = atMs - clip.startMs;
  const progress = (from: number, length: number) => round(Math.min(1, Math.max(0, (local - from) / Math.max(1, length))), 2);
  return {
    ...(clip.textIn ? { text_in: progress(0, animatorSpanMs(clip, clip.textIn)) } : {}),
    ...(clip.textOut ? { text_out: progress(clip.durationMs - animatorSpanMs(clip, clip.textOut), animatorSpanMs(clip, clip.textOut)) } : {}),
  };
}

export function frameNote(doc: VideoDocument, atMs: number, marks: ReadonlyMap<string, number> | null): SceneNote {
  const clips = new Map(doc.tracks.flatMap((track) => track.clips.map((clip) => [clip.id, clip] as const)));
  const transitions = transitionsAt(doc, atMs);
  const notes = visibleItems(doc, atMs).map((item): ClipNote => {
    const clip = clips.get(item.clipId)!;
    const transition = transitions.get(item.clipId);
    return {
      id: item.clipId,
      type: item.type,
      ...(item.layer?.text ? { text: item.layer.text } : {}),
      ...(marks?.has(item.clipId) ? { mark: marks.get(item.clipId) } : {}),
      ...(animated(clip) || transition ? { state: stateOf(item) } : {}),
      ...(transition ? { transition } : {}),
      ...textProgress(clip, atMs),
      ...(item.vfx ? { vfx: item.vfx.map((look) => look.kind) } : {}),
    };
  });
  return { at_ms: atMs, clips: notes };
}

export function visibleItems(doc: VideoDocument, atMs: number): VisualItem[] {
  return visualPlan(doc, atMs, 0).filter((item) => item.active && item.opacity > 0);
}

export function frameLabel(index: number, atMs: number, dense: boolean): string {
  return `${index + 1} · ${dense ? preciseTimecode(atMs) : timecode(atMs)}`;
}

export const REGION_RULE = "region usa x, y, w e h de 0 a 1, com x e y no centro, como as transformações de camadas e clipes";

export interface LookRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RegionBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

function unit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function regionOf(region: Partial<LookRegion> | undefined): RegionBox | null {
  if (!region || !unit(region.x) || !unit(region.y) || !unit(region.w) || !unit(region.h) || region.w <= 0 || region.h <= 0) return null;
  const width = region.w;
  const height = region.h;
  return { left: Math.min(Math.max(region.x - width / 2, 0), 1 - width), top: Math.min(Math.max(region.y - height / 2, 0), 1 - height), width, height };
}

export interface PixelSize {
  width: number;
  height: number;
}

export function visionSize(width: number, height: number, budget: VisionBudget = VISION_BUDGET): PixelSize {
  const scale = Math.min(budget.longEdge / Math.max(width, height), Math.sqrt(budget.pixels / Math.max(1, width * height)), MAX_LOOK_ZOOM);
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export interface SheetLayout {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  width: number;
  height: number;
}

function gridAt(cols: number, count: number, frameAspect: number, budget: VisionBudget): SheetLayout {
  const rows = Math.ceil(count / cols);
  const cellWidth = Math.floor(Math.min(budget.longEdge / Math.max(cols, rows / frameAspect), Math.sqrt((budget.pixels * frameAspect) / (cols * rows))));
  const cellHeight = Math.floor(cellWidth / frameAspect);
  return { cols, rows, cellWidth, cellHeight, width: cols * cellWidth, height: rows * cellHeight };
}

export function sheetLayout(count: number, frameAspect: number, budget: VisionBudget = VISION_BUDGET): SheetLayout {
  const n = Math.max(1, count);
  let best = gridAt(1, n, frameAspect, budget);
  for (let cols = 2; cols <= n; cols++) {
    const grid = gridAt(cols, n, frameAspect, budget);
    if (grid.cellWidth > best.cellWidth) best = grid;
  }
  return best;
}

export interface SheetCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RowSheet {
  width: number;
  height: number;
  cells: SheetCell[];
}

function rowsAt(aspects: readonly number[], height: number, longEdge: number, gap: number): SheetCell[] {
  const cells: SheetCell[] = [];
  let x = 0;
  let y = 0;
  for (const aspect of aspects) {
    const width = Math.max(1, Math.round(height * aspect));
    if (x > 0 && x + width > longEdge) {
      x = 0;
      y += height + gap;
    }
    cells.push({ x, y, width, height });
    x += width + gap;
  }
  return cells;
}

const MIN_ROW_PX = 16;

export function rowSheet(aspects: readonly number[], budget: VisionBudget = VISION_BUDGET, gap = 0): RowSheet {
  const at = (height: number): RowSheet => {
    const cells = rowsAt(aspects, height, budget.longEdge, gap);
    return { width: Math.max(...cells.map((c) => c.x + c.width)), height: Math.max(...cells.map((c) => c.y + c.height)), cells };
  };
  const fits = (sheet: RowSheet) => sheet.width <= budget.longEdge && sheet.height <= budget.longEdge && sheet.width * sheet.height <= budget.pixels;
  let low = MIN_ROW_PX;
  let high = budget.longEdge;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(at(middle))) low = middle;
    else high = middle - 1;
  }
  return at(low);
}

export function timecode(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
}

function preciseTimecode(ms: number): string {
  const hundredths = Math.floor(Math.max(0, ms) / 10);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = Math.floor((hundredths % 6000) / 100);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(hundredths % 100).padStart(2, "0")}`;
}
