import { simplifyPoints } from "../freehand";
import type { Point } from "../viewport";
import { maskLoops } from "./contours";
import { quantize, type RgbaImage, type TraceMode } from "./quantize";

export type RasterImage = RgbaImage;

export interface TraceOptions {
  mode: TraceMode;
  colors: number;
  threshold: number;
  detail: number;
  noise: number;
  ignoreWhite: boolean;
}

export interface TraceResult {
  svg: string;
  shapes: number;
}

export const TRACE_DEFAULTS: TraceOptions = { mode: "color", colors: 6, threshold: 128, detail: 0.6, noise: 8, ignoreWhite: true };

const SMOOTH_TURN_DEGREES = 50;
const NEAR_WHITE = 240;

function loopArea(loop: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function simplifyLoop(loop: readonly Point[], tolerance: number): Point[] {
  if (loop.length <= 4) return [...loop];
  let farthest = 0;
  let reach = -1;
  loop.forEach((p, i) => {
    const d = Math.hypot(p.x - loop[0].x, p.y - loop[0].y);
    if (d > reach) {
      reach = d;
      farthest = i;
    }
  });
  const first = simplifyPoints(loop.slice(0, farthest + 1), tolerance);
  const second = simplifyPoints([...loop.slice(farthest), loop[0]], tolerance);
  const joined = [...first.slice(0, -1), ...second.slice(0, -1)];
  return joined.length >= 3 ? joined : [...loop];
}

function round(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function turnDegrees(previous: Point, at: Point, next: Point): number {
  const a = Math.atan2(at.y - previous.y, at.x - previous.x);
  const b = Math.atan2(next.y - at.y, next.x - at.x);
  const turn = Math.abs(((b - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  return (turn * 180) / Math.PI;
}

function loopPath(points: readonly Point[]): string {
  const count = points.length;
  const handles = points.map((at, i) => {
    const previous = points[(i - 1 + count) % count];
    const next = points[(i + 1) % count];
    if (turnDegrees(previous, at, next) > SMOOTH_TURN_DEGREES) return null;
    const tx = (next.x - previous.x) / 6;
    const ty = (next.y - previous.y) / 6;
    return { in: { x: at.x - tx, y: at.y - ty }, out: { x: at.x + tx, y: at.y + ty } };
  });
  const parts = [`M${round(points[0].x)} ${round(points[0].y)}`];
  for (let i = 0; i < count; i++) {
    const to = (i + 1) % count;
    const out = handles[i]?.out;
    const into = handles[to]?.in;
    if (!out && !into) parts.push(`L${round(points[to].x)} ${round(points[to].y)}`);
    else {
      const c1 = out ?? points[i];
      const c2 = into ?? points[to];
      parts.push(`C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(points[to].x)} ${round(points[to].y)}`);
    }
  }
  parts.push("Z");
  return parts.join(" ");
}

function nearWhite(color: string): boolean {
  return [1, 3, 5].every((at) => parseInt(color.slice(at, at + 2), 16) >= NEAR_WHITE);
}

export function traceRaster(image: RasterImage, options: TraceOptions): TraceResult {
  const { classes, palette } = quantize(image, options);
  const tolerance = 0.4 + (1 - Math.min(1, Math.max(0, options.detail))) * 2.1;
  const shapes: string[] = [];
  palette.forEach((color, cls) => {
    if (options.ignoreWhite && nearWhite(color)) return;
    const loops = maskLoops(classes, image.width, image.height, cls).filter((loop) => loopArea(loop) >= options.noise);
    if (loops.length === 0) return;
    const data = loops.map((loop) => loopPath(simplifyLoop(loop, tolerance))).join(" ");
    shapes.push(`<path fill="${color}" fill-rule="evenodd" d="${data}"/>`);
  });
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${image.width} ${image.height}">${shapes.join("")}</svg>`, shapes: shapes.length };
}
