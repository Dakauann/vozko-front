import { mapSubpaths, subpathsToPath, type Subpath } from "@/lib/studio/path-nodes";
import { screenToWorld, worldToScreen, type Point, type Viewport } from "@/lib/studio/viewport";

export const VECTOR_INK = "#6366f1";
export const VECTOR_PAPER = "#ffffff";
export const ANCHOR_PX = 8;
export const HANDLE_PX = 7;
export const HIT_STROKE_PX = 12;
export const CLOSE_RADIUS_PX = 8;
export const DRAG_START_PX = 2;
export const DRAW_TOLERANCE_PX = 1.5;
export const DRAW_CLOSE_PX = 10;

export function canvasPoint(event: { clientX: number; clientY: number }, surface: Element, view: Viewport): Point {
  const rect = surface.getBoundingClientRect();
  return screenToWorld(view, { x: event.clientX - rect.left, y: event.clientY - rect.top });
}

export function screenPath(subpaths: readonly Subpath[], view: Viewport): string {
  return subpathsToPath(mapSubpaths(subpaths, (p) => worldToScreen(view, p)));
}
