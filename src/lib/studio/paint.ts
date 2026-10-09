import { STAR_DEFAULTS, type BlendMode, type FrameKind, type Gradient, type Layer, type LineCap, type LineJoin } from "./document";
import type { Point } from "./viewport";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Composite = "source-over" | "source-atop" | Exclude<BlendMode, "normal">;

export function gradientLine(angle: number, box: Box): { start: Point; end: Point } {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const half = (Math.abs(dx) * box.width + Math.abs(dy) * box.height) / 2;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const tidy = (value: number) => Math.round(value * 1e9) / 1e9 || 0;
  return {
    start: { x: tidy(cx - dx * half), y: tidy(cy - dy * half) },
    end: { x: tidy(cx + dx * half), y: tidy(cy + dy * half) },
  };
}

export type GradientStops = (number | string)[];

export type GradientPaint =
  | { kind: "linear"; start: Point; end: Point; stops: GradientStops }
  | { kind: "radial"; center: Point; radius: number; stops: GradientStops };

export function gradientStops(gradient: Gradient): GradientStops {
  return gradient.via ? [0, gradient.from, 0.5, gradient.via, 1, gradient.to] : [0, gradient.from, 1, gradient.to];
}

export function gradientPaint(gradient: Gradient, box: Box): GradientPaint {
  const stops = gradientStops(gradient);
  if (gradient.kind !== "radial") return { kind: "linear", ...gradientLine(gradient.angle, box), stops };
  return {
    kind: "radial",
    center: { x: box.x + (gradient.cx ?? 0) * box.width, y: box.y + (gradient.cy ?? 0) * box.height },
    radius: ((gradient.radius ?? 0) * Math.max(box.width, box.height)) / 2,
    stops,
  };
}

export function compositeOf(mode: BlendMode | undefined): Composite {
  return !mode || mode === "normal" ? "source-over" : mode;
}

export function curvePath(width: number, height: number, curve: number): string {
  const mid = height / 2;
  if (Math.abs(curve) < 1e-3) return `M 0 ${mid} L ${width} ${mid}`;
  const sagitta = (Math.abs(curve) * width) / 2;
  const radius = (width * width) / 4 / (2 * sagitta) + sagitta / 2;
  const y = curve > 0 ? mid + sagitta / 2 : mid - sagitta / 2;
  return `M 0 ${y} A ${radius} ${radius} 0 0 ${curve > 0 ? 1 : 0} ${width} ${y}`;
}

export function starPolygon(star: Pick<Layer, "points" | "inner">, width: number, height: number): number[] {
  const count = star.points || STAR_DEFAULTS.points;
  const inner = star.inner || STAR_DEFAULTS.inner;
  const points: number[] = [];
  for (let i = 0; i < count * 2; i++) {
    const radius = i % 2 === 0 ? 0.5 : 0.5 * inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / count;
    points.push(width / 2 + Math.cos(angle) * radius * width, height / 2 + Math.sin(angle) * radius * height);
  }
  return points;
}

export function framePolygon(kind: Exclude<FrameKind, "ellipse">, width: number, height: number): number[] {
  if (kind === "triangle") return [width / 2, 0, width, height, 0, height];
  return starPolygon({}, width, height);
}

export function clipRuns(layers: readonly Layer[]): Layer[][] {
  const runs: Layer[][] = [];
  for (const layer of layers) {
    const last = runs[runs.length - 1];
    if (layer.clip && last && !last[0].clip) last.push(layer);
    else runs.push([layer]);
  }
  return runs;
}

export const MAX_CACHE_PIXEL_RATIO = 2;

export function cachePixelRatioFor(scale: number, devicePixelRatio: number, ceiling: number = MAX_CACHE_PIXEL_RATIO): number {
  const wanted = Math.min(ceiling, Math.max(0.25, scale * (devicePixelRatio || 1)));
  return Math.ceil(wanted * 4) / 4;
}

export const DEFAULT_MITER_LIMIT = 10;
export const LEGACY_DASH = [3, 2] as const;

export interface StrokeStyle {
  lineCap: LineCap;
  lineJoin: LineJoin;
  miterLimit: number;
  dash: number[] | undefined;
  dashOffset: number;
}

const ROUND_SHAPES = new Set<Layer["shape"]>(["triangle", "line", "arrow", "path"]);

export function strokeStyle(layer: Pick<Layer, "type" | "shape" | "strokeWidth" | "lineCap" | "lineJoin" | "miterLimit" | "dash" | "dashArray" | "dashOffset">): StrokeStyle {
  const round = layer.type === "shape" && ROUND_SHAPES.has(layer.shape);
  const width = layer.strokeWidth ?? 0;
  const pattern = layer.dashArray && layer.dashArray.length > 0 ? layer.dashArray : layer.dash ? LEGACY_DASH : null;
  return {
    lineCap: layer.lineCap ?? (round && layer.shape !== "triangle" ? "round" : "butt"),
    lineJoin: layer.lineJoin ?? (round ? "round" : "miter"),
    miterLimit: layer.miterLimit || DEFAULT_MITER_LIMIT,
    dash: pattern && width > 0 ? pattern.map((v) => v * width) : undefined,
    dashOffset: (layer.dashOffset ?? 0) * width,
  };
}
