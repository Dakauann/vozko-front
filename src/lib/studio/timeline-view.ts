import { FRAMES_PER_SECOND } from "./document";

export const MIN_PX_PER_SECOND = 4;
export const MAX_PX_PER_SECOND = 640;
export const DEFAULT_PX_PER_SECOND = 60;
export const ZOOM_STEP = 1.25;
export const SNAP_RADIUS_PX = 8;
export const MIN_LABEL_SPACING_PX = 72;

const RULER_STEPS_MS = [100, 200, 500, 1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000];

export function clampZoom(pxPerSecond: number): number {
  if (!Number.isFinite(pxPerSecond)) return DEFAULT_PX_PER_SECOND;
  return Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, pxPerSecond));
}

export function zoomToSlider(pxPerSecond: number): number {
  const span = Math.log(MAX_PX_PER_SECOND / MIN_PX_PER_SECOND);
  return Math.log(clampZoom(pxPerSecond) / MIN_PX_PER_SECOND) / span;
}

export function sliderToZoom(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return clampZoom(MIN_PX_PER_SECOND * Math.pow(MAX_PX_PER_SECOND / MIN_PX_PER_SECOND, t));
}

export function zoomBy(pxPerSecond: number, steps: number): number {
  return clampZoom(pxPerSecond * Math.pow(ZOOM_STEP, steps));
}

export function msToPx(ms: number, pxPerSecond: number): number {
  return (ms * pxPerSecond) / 1000;
}

export function pxToMs(px: number, pxPerSecond: number): number {
  return (px * 1000) / pxPerSecond;
}

export function anchoredScroll(anchorMs: number, anchorViewportPx: number, pxPerSecond: number): number {
  return Math.max(0, msToPx(anchorMs, pxPerSecond) - anchorViewportPx);
}

export function fitZoom(contentMs: number, viewportPx: number): number {
  if (contentMs <= 0 || viewportPx <= 0) return DEFAULT_PX_PER_SECOND;
  return clampZoom((viewportPx * 1000) / contentMs);
}

export function snapThresholdMs(pxPerSecond: number, radiusPx: number = SNAP_RADIUS_PX): number {
  return pxToMs(radiusPx, pxPerSecond);
}

export interface RulerStep {
  majorMs: number;
  minorMs: number;
}

export function rulerStep(pxPerSecond: number, minLabelPx: number = MIN_LABEL_SPACING_PX): RulerStep {
  const majorMs = RULER_STEPS_MS.find((step) => msToPx(step, pxPerSecond) >= minLabelPx) ?? RULER_STEPS_MS[RULER_STEPS_MS.length - 1];
  const index = RULER_STEPS_MS.indexOf(majorMs);
  const minorMs = index > 0 ? RULER_STEPS_MS[index - 1] : majorMs / 2;
  return { majorMs, minorMs: minorMs === majorMs ? majorMs / 2 : minorMs };
}

export interface RulerTick {
  ms: number;
  major: boolean;
}

export function rulerTicks(pxPerSecond: number, fromMs: number, toMs: number, minLabelPx: number = MIN_LABEL_SPACING_PX): RulerTick[] {
  const { majorMs, minorMs } = rulerStep(pxPerSecond, minLabelPx);
  const ticks: RulerTick[] = [];
  const first = Math.max(0, Math.floor(fromMs / minorMs) * minorMs);
  for (let ms = first; ms <= toMs; ms += minorMs) {
    ticks.push({ ms, major: ms % majorMs === 0 });
  }
  return ticks;
}

export function formatTimecode(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const frames = Math.floor(((total % 1000) * FRAMES_PER_SECOND) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(frames).padStart(2, "0")}`;
}

export function formatRulerLabel(ms: number, majorMs: number): string {
  const total = Math.max(0, Math.round(ms));
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const base = `${minutes}:${String(seconds).padStart(2, "0")}`;
  if (majorMs >= 1000) return base;
  return `${base}.${Math.floor((total % 1000) / 100)}`;
}

export function formatSeconds(ms: number): string {
  return (Math.round(ms / 10) / 100).toFixed(2);
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function normalizedRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), right: Math.max(x1, x2), bottom: Math.max(y1, y2) };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

export interface ClipBox {
  id: string;
  rect: Rect;
}

export function idsInMarquee(boxes: readonly ClipBox[], marquee: Rect): string[] {
  return boxes.filter((box) => rectsIntersect(box.rect, marquee)).map((box) => box.id);
}

export function toggledSelection(selection: readonly string[], id: string, additive: boolean): string[] {
  if (!additive) return [id];
  return selection.includes(id) ? selection.filter((current) => current !== id) : [...selection, id];
}

export interface LaneTrack {
  id: string;
  kind: "visual" | "audio";
  clips: readonly { id: string; startMs: number; durationMs: number }[];
}

export function laneOrder<T extends LaneTrack>(tracks: readonly T[]): T[] {
  return [...tracks.filter((t) => t.kind === "visual").reverse(), ...tracks.filter((t) => t.kind === "audio")];
}

export type LaneHeight = number | ((kind: LaneTrack["kind"]) => number);

function heightOf(laneHeight: LaneHeight, kind: LaneTrack["kind"]): number {
  return typeof laneHeight === "number" ? laneHeight : laneHeight(kind);
}

export function laneTops(tracks: readonly LaneTrack[], laneHeight: LaneHeight): number[] {
  let top = 0;
  return laneOrder(tracks).map((track) => {
    const at = top;
    top += heightOf(laneHeight, track.kind);
    return at;
  });
}

export function laneIndexAt(tracks: readonly LaneTrack[], laneHeight: LaneHeight, y: number): number {
  if (y < 0) return -1;
  const lanes = laneOrder(tracks);
  let top = 0;
  for (let i = 0; i < lanes.length; i++) {
    top += heightOf(laneHeight, lanes[i].kind);
    if (y < top) return i;
  }
  return -1;
}

export function laneBoxes(tracks: readonly LaneTrack[], pxPerSecond: number, laneHeight: LaneHeight): ClipBox[] {
  const tops = laneTops(tracks, laneHeight);
  return laneOrder(tracks).flatMap((track, lane) =>
    track.clips.map((clip) => ({
      id: clip.id,
      rect: {
        left: msToPx(clip.startMs, pxPerSecond),
        right: msToPx(clip.startMs + clip.durationMs, pxPerSecond),
        top: tops[lane],
        bottom: tops[lane] + heightOf(laneHeight, track.kind),
      },
    })),
  );
}

export function contentWidthPx(durationMs: number, maxMs: number, pxPerSecond: number, viewportPx: number): number {
  const contentMs = Math.min(Math.max(durationMs + 15_000, 30_000), maxMs);
  return Math.max(viewportPx, Math.ceil(msToPx(contentMs, pxPerSecond)) + 120);
}

export function followScroll(playheadPx: number, scrollLeft: number, viewportPx: number): number | null {
  if (viewportPx <= 0) return null;
  if (playheadPx >= scrollLeft && playheadPx <= scrollLeft + viewportPx * 0.95) return null;
  return Math.max(0, playheadPx - viewportPx * 0.1);
}

export interface EnvelopeInput {
  durationMs: number;
  fadeInMs: number;
  fadeOutMs: number;
}

export function envelopePoints(clip: EnvelopeInput, widthPx: number, heightPx: number, level: number): [number, number][] {
  const top = heightPx * (1 - Math.min(1, Math.max(0, level)));
  const scale = clip.durationMs > 0 ? widthPx / clip.durationMs : 0;
  const fadeIn = clip.fadeInMs * scale;
  const fadeOut = clip.fadeOutMs * scale;
  return [
    [0, fadeIn > 0 ? heightPx : top],
    [fadeIn, top],
    [widthPx - fadeOut, top],
    [widthPx, fadeOut > 0 ? heightPx : top],
  ];
}

export function levelFromY(y: number, heightPx: number, maxLevel: number): number {
  if (heightPx <= 0) return 0;
  const fraction = 1 - Math.min(heightPx, Math.max(0, y)) / heightPx;
  return Math.round(fraction * maxLevel * 100) / 100;
}

export function formatSmpte(ms: number): string {
  const totalFrames = Math.max(0, Math.round((ms * FRAMES_PER_SECOND) / 1000));
  const frames = totalFrames % FRAMES_PER_SECOND;
  const totalSeconds = Math.floor(totalFrames / FRAMES_PER_SECOND);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}:${pad(frames)}`;
}

export interface Span {
  fromPx: number;
  toPx: number;
}

export function visibleSpan(leftPx: number, widthPx: number, scrollLeft: number, viewportPx: number, overscanPx: number = 0): Span | null {
  const fromPx = Math.max(0, scrollLeft - overscanPx - leftPx);
  const toPx = Math.min(widthPx, scrollLeft + viewportPx + overscanPx - leftPx);
  return toPx > fromPx ? { fromPx, toPx } : null;
}

export function steppedSpan(span: Span | null, stepPx: number, widthPx: number): Span | null {
  if (!span) return null;
  return { fromPx: Math.floor(span.fromPx / stepPx) * stepPx, toPx: Math.min(widthPx, Math.ceil(span.toPx / stepPx) * stepPx) };
}

export interface OverviewWindow {
  left: number;
  width: number;
}

export function overviewMs(durationMs: number, viewportMs: number): number {
  return Math.max(durationMs, viewportMs, 1000);
}

export function overviewWindow(scrollLeft: number, viewportPx: number, pxPerSecond: number, overviewPx: number, totalMs: number): OverviewWindow {
  const scale = overviewPx / totalMs;
  const fromMs = pxToMs(scrollLeft, pxPerSecond);
  const spanMs = pxToMs(viewportPx, pxPerSecond);
  const left = Math.min(overviewPx, fromMs * scale);
  return { left, width: Math.max(2, Math.min(overviewPx - left, spanMs * scale)) };
}

export function overviewToMs(x: number, overviewPx: number, totalMs: number): number {
  if (overviewPx <= 0) return 0;
  return Math.min(totalMs, Math.max(0, (x / overviewPx) * totalMs));
}

export function scrollToCenter(ms: number, viewportPx: number, pxPerSecond: number): number {
  return Math.max(0, msToPx(ms, pxPerSecond) - viewportPx / 2);
}

export function rangeView(fromMs: number, toMs: number, viewportPx: number): { pxPerSecond: number; scrollLeft: number } {
  const span = Math.max(100, Math.abs(toMs - fromMs));
  const pxPerSecond = clampZoom((viewportPx * 1000) / span);
  return { pxPerSecond, scrollLeft: Math.max(0, msToPx(Math.min(fromMs, toMs), pxPerSecond)) };
}

export const FOCUS_MARGIN = 0.08;

export function focusView(startMs: number, durationMs: number, viewportPx: number, margin: number = FOCUS_MARGIN): { pxPerSecond: number; scrollLeft: number } {
  const pad = Math.max(200, durationMs * margin);
  return rangeView(Math.max(0, startMs - pad), startMs + durationMs + pad, viewportPx);
}

export function stackTops(heights: readonly number[]): number[] {
  return heights.reduce<number[]>((tops, _, index) => [...tops, index === 0 ? 0 : tops[index - 1] + heights[index - 1]], []);
}
