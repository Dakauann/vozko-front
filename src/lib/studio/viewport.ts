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
const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;
export const ZOOM_MENU_PRESETS: readonly number[] = ZOOM_PRESETS.filter((preset) => preset >= 0.5);
export const FIT_PADDING_PX = 24;
const MIN_RULER_GAP_PX = 50;

const WHEEL_SENSITIVITY = 0.0015;

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(Math.max(scale, MIN_ZOOM), MAX_ZOOM);
}

interface Area {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function fitBounds(container: CanvasSize, area: Area, padding: number = FIT_PADDING_PX): Viewport {
  const width = Math.max(1, area.right - area.left);
  const height = Math.max(1, area.bottom - area.top);
  const room = { width: Math.max(1, container.width - padding * 2), height: Math.max(1, container.height - padding * 2) };
  const scale = clampZoom(Math.min(room.width / width, room.height / height));
  return { scale, x: (container.width - width * scale) / 2 - area.left * scale, y: (container.height - height * scale) / 2 - area.top * scale };
}

export function fitViewport(container: CanvasSize, canvas: CanvasSize, padding: number = FIT_PADDING_PX): Viewport {
  return fitBounds(container, { left: 0, top: 0, right: canvas.width, bottom: canvas.height }, padding);
}

export function viewArea(v: Viewport, container: CanvasSize): Area {
  return { left: (0 - v.x) / v.scale, top: (0 - v.y) / v.scale, right: (container.width - v.x) / v.scale, bottom: (container.height - v.y) / v.scale };
}

export function visibleShare(area: Area, view: Area): number {
  const width = Math.max(0, Math.min(area.right, view.right) - Math.max(area.left, view.left));
  const height = Math.max(0, Math.min(area.bottom, view.bottom) - Math.max(area.top, view.top));
  const whole = Math.max(1e-9, (area.right - area.left) * (area.bottom - area.top));
  return (width * height) / whole;
}

export function localViewport(v: Viewport, origin: Point): Viewport {
  return { scale: v.scale, x: v.x + origin.x * v.scale, y: v.y + origin.y * v.scale };
}

export function screenToWorld(v: Viewport, point: Point): Point {
  return { x: (point.x - v.x) / v.scale, y: (point.y - v.y) / v.scale };
}

export function worldToScreen(v: Viewport, point: Point): Point {
  return { x: point.x * v.scale + v.x, y: point.y * v.scale + v.y };
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

interface WheelInput {
  deltaX: number;
  deltaY: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export function wheelViewport(v: Viewport, wheel: WheelInput, anchor: Point): Viewport {
  if (wheel.ctrlKey || wheel.metaKey) return zoomAt(v, wheelZoom(v.scale, wheel.deltaY), anchor);
  const sideways = wheel.shiftKey && wheel.deltaX === 0;
  const dx = sideways ? wheel.deltaY : wheel.deltaX;
  const dy = sideways ? 0 : wheel.deltaY;
  return { ...v, x: v.x - dx, y: v.y - dy };
}

export function zoomAtCenter(v: Viewport, nextScale: number, container: CanvasSize | null): Viewport {
  return zoomAt(v, nextScale, container ? { x: container.width / 2, y: container.height / 2 } : { x: 0, y: 0 });
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function frameRect(v: Viewport, canvas: CanvasSize): ScreenRect {
  return { left: v.x, top: v.y, width: canvas.width * v.scale, height: canvas.height * v.scale };
}

export interface FramePlacement {
  frame: ScreenRect;
  visible: ScreenRect;
}

export function placeFrame(v: Viewport, canvas: CanvasSize, container: CanvasSize): FramePlacement {
  const exact = frameRect(v, canvas);
  const frame = { left: Math.round(exact.left), top: Math.round(exact.top), width: Math.round(exact.width), height: Math.round(exact.height) };
  return { frame, visible: visibleFrame(frame, container) };
}

export function visibleFrame(frame: ScreenRect, container: CanvasSize): ScreenRect {
  const left = Math.max(0, -frame.left);
  const top = Math.max(0, -frame.top);
  const width = Math.min(frame.width, container.width - frame.left) - left;
  const height = Math.min(frame.height, container.height - frame.top) - top;
  if (width <= 0 || height <= 0) return { left: 0, top: 0, width: 0, height: 0 };
  return { left, top, width, height };
}

interface RulerTick {
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

export function followViewport(fit: boolean, current: Viewport, container: CanvasSize | null, area: Area): Viewport {
  if (!fit || !container || container.width <= 0 || container.height <= 0) return current;
  return fitBounds(container, area);
}
