import type { ImageSurface, Transform, VideoDocument } from "../document";
import { visibleLayers } from "../image-edits";
import { layerBounds, type Bounds } from "../layers";
import { boxCorners } from "../arrange";
import type { RegionBox } from "./frames";

export const MARK_SHARE = 0.025;
export const MIN_MARK_RADIUS = 9;

export interface MarkTarget {
  n: number;
  id: string;
  transform: Transform;
  kind?: string;
}

export interface Mark {
  n: number;
  id: string;
  x: number;
  y: number;
  box: Bounds;
  corners: [number, number][];
}

export function markRadius(width: number, height: number): number {
  return Math.max(MIN_MARK_RADIUS, Math.round(Math.min(width, height) * MARK_SHARE));
}

export function imageMarkTargets(doc: ImageSurface, first = 1): MarkTarget[] {
  return visibleLayers(doc.layers).map((layer, index) => ({ n: first + index, id: layer.id, transform: layer.transform, kind: layer.type }));
}

export function clipMarkNumbers(doc: VideoDocument): Map<string, number> {
  const ids = doc.tracks.flatMap((track) => (track.kind === "visual" ? track.clips.map((clip) => clip.id) : []));
  return new Map(ids.map((id, index) => [id, index + 1]));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function regionTargets(targets: readonly MarkTarget[], region: RegionBox | null): readonly MarkTarget[] {
  if (!region) return targets;
  return targets.flatMap((target) => {
    const t = target.transform;
    const bounds = layerBounds(t, { width: 1, height: 1 });
    const outside = bounds.right <= region.left || bounds.left >= region.left + region.width || bounds.bottom <= region.top || bounds.top >= region.top + region.height;
    if (outside) return [];
    const transform = { ...t, x: (t.x - region.left) / region.width, y: (t.y - region.top) / region.height, w: t.w / region.width, h: t.h / region.height };
    return [{ ...target, transform }];
  });
}

export function placeMarks(targets: readonly MarkTarget[], width: number, height: number, radius: number): Mark[] {
  const placed: Mark[] = [];
  const covers = (x: number, y: number) => placed.some((mark) => Math.hypot(mark.x - x, mark.y - y) < radius * 2);
  for (const target of targets) {
    const box = layerBounds(target.transform, { width, height });
    let x = clamp(box.left + radius, radius, width - radius);
    const y = clamp(box.top + radius, radius, height - radius);
    while (covers(x, y) && x + radius * 2 <= width - radius) x += radius * 2;
    placed.push({ n: target.n, id: target.id, x, y, box, corners: boxCorners(target.transform, { width, height }) });
  }
  return placed;
}
