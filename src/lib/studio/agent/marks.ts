import type { ImageSurface, Transform, VideoDocument } from "../document";
import { visibleLayers } from "../image-edits";
import { layerBounds } from "../layers";

export const MARK_SHARE = 0.025;
export const MIN_MARK_RADIUS = 9;

export interface MarkTarget {
  n: number;
  id: string;
  transform: Transform;
}

export interface Mark {
  n: number;
  id: string;
  x: number;
  y: number;
}

export function markRadius(width: number, height: number): number {
  return Math.max(MIN_MARK_RADIUS, Math.round(Math.min(width, height) * MARK_SHARE));
}

export function imageMarkTargets(doc: ImageSurface, first = 1): MarkTarget[] {
  return visibleLayers(doc.layers).map((layer, index) => ({ n: first + index, id: layer.id, transform: layer.transform }));
}

export function clipMarkNumbers(doc: VideoDocument): Map<string, number> {
  const ids = doc.tracks.flatMap((track) => (track.kind === "visual" ? track.clips.map((clip) => clip.id) : []));
  return new Map(ids.map((id, index) => [id, index + 1]));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function placeMarks(targets: readonly MarkTarget[], width: number, height: number, radius: number): Mark[] {
  const placed: Mark[] = [];
  const covers = (x: number, y: number) => placed.some((mark) => Math.hypot(mark.x - x, mark.y - y) < radius * 2);
  for (const target of targets) {
    const bounds = layerBounds(target.transform, { width, height });
    let x = clamp(bounds.left + radius, radius, width - radius);
    const y = clamp(bounds.top + radius, radius, height - radius);
    while (covers(x, y) && x + radius * 2 <= width - radius) x += radius * 2;
    placed.push({ n: target.n, id: target.id, x, y });
  }
  return placed;
}
