import type { BlendMode, FrameKind, Layer } from "./document";
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

const STAR_POINTS = 5;
const STAR_INNER = 0.45;

export function framePolygon(kind: Exclude<FrameKind, "ellipse">, width: number, height: number): number[] {
  if (kind === "triangle") return [width / 2, 0, width, height, 0, height];
  const points: number[] = [];
  for (let i = 0; i < STAR_POINTS * 2; i++) {
    const radius = i % 2 === 0 ? 0.5 : 0.5 * STAR_INNER;
    const angle = -Math.PI / 2 + (i * Math.PI) / STAR_POINTS;
    points.push(width / 2 + Math.cos(angle) * radius * width, height / 2 + Math.sin(angle) * radius * height);
  }
  return points;
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

export function cachePixelRatioFor(scale: number, devicePixelRatio: number): number {
  const wanted = Math.min(MAX_CACHE_PIXEL_RATIO, Math.max(0.25, scale * (devicePixelRatio || 1)));
  return Math.ceil(wanted * 4) / 4;
}
