import type { ImageSurface } from "./document";
import { containsPoint } from "./geometry";
import { isPickable } from "./layers";

export function pickFromStack(stack: readonly string[], selection: readonly string[], through: boolean): string | null {
  if (stack.length === 0) return null;
  if (!through) return stack[0];
  const chosen = new Set(selection);
  const deepest = stack.reduce((found, id, index) => (chosen.has(id) ? index : found), -1);
  return stack[(deepest + 1) % stack.length];
}

export function pressMovesSelection(stack: readonly string[], selection: readonly string[]): boolean {
  return stack.length > 0 && selection.includes(stack[0]);
}

export function layerStackAt(surface: ImageSurface, point: { x: number; y: number }): string[] {
  return surface.layers
    .filter((layer) => isPickable(layer) && containsPoint(layer.transform, surface.canvas, point))
    .map((layer) => layer.id)
    .reverse();
}
