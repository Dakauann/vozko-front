import { isRoundChart, shownSeries, drawsLines, type ChartKind, type ChartSpec } from "./chart";
import { chartParts, wedgePath, type ChartPart } from "./chart-parts";
import type { Clip, Layer, Transform } from "./document";
import { ease, isEasing, type Easing } from "./keyframes";
import { lineFrame } from "./line-geometry";
import type { ClipPatch } from "./timeline";
import type { IssueCode } from "./validate";

export const CHART_ANIMATION_STYLES = ["grow", "draw", "sweep", "fade"] as const;

export type ChartAnimationStyle = (typeof CHART_ANIMATION_STYLES)[number];

export const CHART_ANIMATION_ORDERS = ["series", "category"] as const;

export type ChartAnimationOrder = (typeof CHART_ANIMATION_ORDERS)[number];

export const CHART_ANIMATION_LIMITS = { durationMs: [100, 10_000], staggerMs: [0, 5_000] } as const;

export interface ChartAnimator {
  style: ChartAnimationStyle;
  order: ChartAnimationOrder;
  durationMs: number;
  staggerMs: number;
  easing: Easing;
}

export interface ChartMotion {
  animator: ChartAnimator;
  localMs: number;
}

type PartEffect = "scale" | "trim" | "sweep" | "opacity" | "none";

interface PartPose {
  effect: PartEffect;
  progress: number;
}

const TRIM_STEP_PX = 2;

const STATIC_ROLES: ReadonlySet<ChartPart["role"]> = new Set(["grid", "axis", "tick", "legend"]);

export function isChartAnimationStyle(value: unknown): value is ChartAnimationStyle {
  return typeof value === "string" && (CHART_ANIMATION_STYLES as readonly string[]).includes(value);
}

export function isChartAnimationOrder(value: unknown): value is ChartAnimationOrder {
  return typeof value === "string" && (CHART_ANIMATION_ORDERS as readonly string[]).includes(value);
}

function defaultChartStyle(kind: ChartKind): ChartAnimationStyle {
  if (isRoundChart(kind)) return "sweep";
  return drawsLines(kind) && kind !== "scatter" ? "draw" : "grow";
}

export function defaultChartAnimator(kind: ChartKind, style: ChartAnimationStyle = defaultChartStyle(kind)): ChartAnimator {
  if (isRoundChart(kind) && style === "sweep") return { style, order: "category", durationMs: 400, staggerMs: 400, easing: "linear" };
  return { style, order: drawsLines(kind) && kind !== "scatter" ? "series" : "category", durationMs: 800, staggerMs: 120, easing: "easeOut" };
}

function animatesChart(clip: Pick<Clip, "type" | "layer">): boolean {
  return clip.type === "overlay" && clip.layer?.type === "chart" && Boolean(clip.layer.chart);
}

function within(value: unknown, [low, high]: readonly [number, number]): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= low && value <= high;
}

export function chartAnimatorIssue(animator: ChartAnimator): IssueCode | null {
  if (!isChartAnimationStyle(animator.style) || !isChartAnimationOrder(animator.order) || !isEasing(animator.easing)) return "unknown";
  return within(animator.durationMs, CHART_ANIMATION_LIMITS.durationMs) && within(animator.staggerMs, CHART_ANIMATION_LIMITS.staggerMs) ? null : "out_of_range";
}

export function chartInIssue(clip: Clip): IssueCode | null {
  if (!clip.chartIn) return null;
  if (!animatesChart(clip)) return "invalid";
  return chartAnimatorIssue(clip.chartIn);
}

export function chartInPatch(animator: ChartAnimator | null): ClipPatch {
  return { chartIn: animator ?? undefined };
}

export function chartUnits(spec: ChartSpec, order: ChartAnimationOrder): number {
  return order === "series" ? Math.max(1, isRoundChart(spec.kind) ? 1 : shownSeries(spec).length) : Math.max(1, spec.data.labels.length);
}

export function chartAnimationSpan(animator: ChartAnimator, units: number): number {
  return animator.durationMs + animator.staggerMs * Math.max(0, units - 1);
}

export function chartMotionOf(clip: Clip, localMs: number): ChartMotion | undefined {
  const animator = clip.chartIn;
  const spec = clip.layer?.chart;
  if (!animator || !spec || !animatesChart(clip)) return undefined;
  return localMs < chartAnimationSpan(animator, chartUnits(spec, animator.order)) ? { animator, localMs } : undefined;
}

function unitOf(part: ChartPart, spec: ChartSpec, order: ChartAnimationOrder): number | null {
  if (order === "category") return part.category ?? null;
  if (part.series === undefined) return null;
  return Math.max(0, shownSeries(spec).indexOf(part.series));
}

function eased(animator: ChartAnimator, startMs: number, durationMs: number, localMs: number): number {
  const p = durationMs <= 0 ? 1 : Math.min(1, Math.max(0, (localMs - startMs) / durationMs));
  return p <= 0 ? 0 : p >= 1 ? 1 : ease(animator.easing, p);
}

export function partProgress(part: ChartPart, spec: ChartSpec, motion: ChartMotion): number {
  const { animator, localMs } = motion;
  const unit = unitOf(part, spec, animator.order);
  if (unit === null) return eased(animator, 0, chartAnimationSpan(animator, chartUnits(spec, animator.order)), localMs);
  return eased(animator, unit * animator.staggerMs, animator.durationMs, localMs);
}

function effectOf(part: ChartPart, style: ChartAnimationStyle): PartEffect {
  if (STATIC_ROLES.has(part.role)) return "none";
  if (style === "fade" || part.role === "value") return "opacity";
  switch (part.role) {
    case "bar":
      return "scale";
    case "line":
      return style === "grow" ? "scale" : "trim";
    case "slice":
      return style === "grow" ? "scale" : "sweep";
    case "area":
    case "point":
      return style === "grow" ? "scale" : "opacity";
  }
  return "opacity";
}

export function partPose(part: ChartPart, spec: ChartSpec, motion: ChartMotion): PartPose {
  const effect = effectOf(part, motion.animator.style);
  return { effect, progress: effect === "none" ? 1 : partProgress(part, spec, motion) };
}

export function scaledTransform(part: ChartPart, progress: number, size: { width: number; height: number }): Transform {
  const t = part.layer.transform;
  if (part.role === "slice" || !part.base) return { ...t, w: t.w * progress, h: t.h * progress };
  if (part.base.axis === "x") {
    const left = t.x - t.w / 2;
    const right = t.x + t.w / 2;
    const from = part.base.at + (left - part.base.at) * progress;
    const to = part.base.at + (right - part.base.at) * progress;
    return { ...t, x: (from + to) / 2, w: Math.max(Math.abs(to - from), 1 / Math.max(1, size.width) / 1000) };
  }
  const top = t.y - t.h / 2;
  const bottom = t.y + t.h / 2;
  const from = part.base.at + (top - part.base.at) * progress;
  const to = part.base.at + (bottom - part.base.at) * progress;
  if (part.role === "point") return { ...t, y: (from + to) / 2 };
  return { ...t, y: (from + to) / 2, h: Math.max(Math.abs(to - from), 1 / Math.max(1, size.height) / 1000) };
}

function unitText(value: number): string {
  return String(Math.round(value * 1e4) / 1e4 || 0);
}

export function trimmedPath(layer: Layer, progress: number, size: { width: number; height: number }): string | null {
  const frame = lineFrame({ layer, widthPx: size.width, heightPx: size.height, line: { trim: { start: 0, end: progress, offset: 0, sequential: false } }, color: layer.stroke ?? "", step: TRIM_STEP_PX });
  const t = layer.transform;
  const w = t.w * size.width;
  const h = t.h * size.height;
  const left = t.x * size.width - w / 2;
  const top = t.y * size.height - h / 2;
  const data = frame.runs
    .filter((run) => run.points.length > 1)
    .map((run) => run.points.map((point, i) => `${i === 0 ? "M" : "L"}${unitText((point.x - left) / w)} ${unitText((point.y - top) / h)}`).join(" "))
    .join(" ");
  return data === "" ? null : data;
}

export function posedLayer(part: ChartPart, spec: ChartSpec, pose: PartPose, size: { width: number; height: number }): Layer | null {
  const layer = part.layer;
  if (pose.effect === "none" || pose.progress >= 1) return layer;
  if (pose.progress <= 0) return null;
  switch (pose.effect) {
    case "opacity":
      return { ...layer, transform: { ...layer.transform, opacity: layer.transform.opacity * pose.progress } };
    case "scale":
      return { ...layer, transform: scaledTransform(part, pose.progress, size) };
    case "trim": {
      const path = trimmedPath(layer, pose.progress, size);
      return path ? { ...layer, path } : null;
    }
    case "sweep": {
      const wedge = part.wedge;
      if (!wedge) return layer;
      const path = wedgePath(wedge.start, wedge.start + (wedge.end - wedge.start) * pose.progress, spec.kind === "donut" ? spec.style.hole : 0);
      return path ? { ...layer, path, fillRule: undefined } : null;
    }
  }
  return layer;
}

export function posedChartLayers(parts: readonly ChartPart[], spec: ChartSpec, motion: ChartMotion, size: { width: number; height: number }): Layer[] {
  return parts.flatMap((part) => {
    const layer = posedLayer(part, spec, partPose(part, spec, motion), size);
    return layer ? [layer] : [];
  });
}

export function chartFrameLayers(layer: Layer, motion: ChartMotion, size: { width: number; height: number }): Layer[] {
  return layer.chart ? posedChartLayers(chartParts(layer.chart, size), layer.chart, motion, size) : [];
}

export function sweepPolygon(wedge: { start: number; end: number }, progress: number, width: number, height: number): number[] {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.hypot(width, height);
  const end = wedge.start + (wedge.end - wedge.start) * progress;
  const steps = Math.max(2, Math.ceil(((end - wedge.start) / (Math.PI * 2)) * 64));
  const points = [cx, cy];
  for (let i = 0; i <= steps; i++) {
    const angle = wedge.start + ((end - wedge.start) * i) / steps;
    points.push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  return points;
}
