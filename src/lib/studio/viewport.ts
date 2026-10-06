import type { CanvasSize } from "./document";

export interface Viewport {
  scale: number;
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 4;
export const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;
export const FIT_PADDING_PX = 48;
export const MIN_RULER_GAP_PX = 50;

const WHEEL_SENSITIVITY = 0.0015;

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(Math.max(scale, MIN_ZOOM), MAX_ZOOM);
}

export function fitViewport(container: CanvasSize, canvas: CanvasSize, padding: number = FIT_PADDING_PX): Viewport {
  const room = { width: Math.max(1, container.width - padding * 2), height: Math.max(1, container.height - padding * 2) };
  const scale = clampZoom(Math.min(room.width / canvas.width, room.height / canvas.height));
  return { scale, x: (container.width - canvas.width * scale) / 2, y: (container.height - canvas.height * scale) / 2 };
}

export function screenToWorld(v: Viewport, point: Point): Point {
  return { x: (point.x - v.x) / v.scale, y: (point.y - v.y) / v.scale };
}

export function zoomAt(v: Viewport, nextScale: number, anchor: Point): Viewport {
  const scale = clampZoom(nextScale);
  const world = screenToWorld(v, anchor);
  return { scale, x: anchor.x - world.x * scale, y: anchor.y - world.y * scale };
}

export function stepZoom(scale: number, direction: 1 | -1): number {
  const epsilon = 1e-6;
  if (direction === 1) return ZOOM_PRESETS.find((preset) => preset > scale + epsilon) ?? MAX_ZOOM;
  return [...ZOOM_PRESETS].reverse().find((preset) => preset < scale - epsilon) ?? clampZoom(scale);
}

export function wheelZoom(scale: number, deltaY: number): number {
  return clampZoom(scale * Math.exp(-deltaY * WHEEL_SENSITIVITY));
}

export interface RulerTick {
  screen: number;
  value: number;
}

function rulerStep(scale: number): number {
  const raw = MIN_RULER_GAP_PX / scale;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  for (const factor of [1, 2, 5, 10]) {
    if (magnitude * factor >= raw) return magnitude * factor;
  }
  return magnitude * 10;
}

export function rulerTicks(scale: number, offset: number, lengthPx: number): RulerTick[] {
  const step = rulerStep(scale);
  const first = Math.ceil(-offset / scale / step) * step;
  const ticks: RulerTick[] = [];
  for (let value = first; value * scale + offset <= lengthPx; value += step) {
    ticks.push({ screen: value * scale + offset, value: Math.round(value) || 0 });
  }
  return ticks;
}

export function followViewport(fit: boolean, current: Viewport, container: CanvasSize | null, canvas: CanvasSize): Viewport {
  if (!fit || !container || container.width <= 0 || container.height <= 0) return current;
  return fitViewport(container, canvas);
}
