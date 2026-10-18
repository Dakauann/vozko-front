import { ANCHOR_RANGE, CENTER_ANCHOR, type Anchor, type Clip, type Transform } from "./document";
import { KEYED_LANE, KEYFRAME_LIMITS, keyframeCount, pathFramesOf, scaleAt, valueAt, type KeyframeProperty, type Keyframes, type LaneValue } from "./keyframes";
import { headingAt, positionAt, type PathPoint } from "./position-path";
import type { IssueCode } from "./validate";

export type PlacedClip = Pick<Clip, "transform" | "keyframes" | "anchor" | "autoOrient">;

function boxFit(w: number, h: number): number {
  const side = Math.max(w, h);
  return side > KEYFRAME_LIMITS.maxAnimatedBox ? KEYFRAME_LIMITS.maxAnimatedBox / side : 1;
}

export function animatedTransform(base: Transform, k: Keyframes | undefined, localMs: number, aspect: number, lane?: LaneValue): Transform {
  if (!lane && (!k || keyframeCount(k) === 0)) return base;
  const shown = lane ?? KEYED_LANE;
  const at = (property: KeyframeProperty, fallback: number) => {
    const frames = k?.[property] ?? [];
    return shown(property, frames.length === 0 ? fallback : valueAt(frames, localMs));
  };
  const path = pathFramesOf(k);
  const travelled = path.length > 0 ? positionAt(path, localMs, aspect) : null;
  const position = travelled ? { x: shown("x", travelled.x), y: shown("y", travelled.y) } : { x: at("x", base.x), y: at("y", base.y) };
  const scale = scaleAt(k, localMs, shown);
  const fit = lane ? boxFit(base.w * scale.x, base.h * scale.y) : 1;
  return { x: position.x, y: position.y, w: base.w * scale.x * fit, h: base.h * scale.y * fit, rotation: at("rotation", base.rotation), opacity: Math.min(1, Math.max(0, at("opacity", base.opacity))) };
}

export function anchorOf(clip: Pick<Clip, "anchor">): Anchor {
  return clip.anchor ?? CENTER_ANCHOR;
}

export function isCentered(anchor: Anchor): boolean {
  return anchor.x === CENTER_ANCHOR.x && anchor.y === CENTER_ANCHOR.y;
}

export function anchorOffset(anchor: Anchor, w: number, h: number): PathPoint {
  return { x: (anchor.x - CENTER_ANCHOR.x) * w, y: (anchor.y - CENTER_ANCHOR.y) * h };
}

export function rotated(offset: PathPoint, degrees: number, aspect: number): PathPoint {
  const radians = (degrees * Math.PI) / 180;
  const x = offset.x * aspect;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: (x * cos - offset.y * sin) / aspect, y: x * sin + offset.y * cos };
}

export function headingOf(clip: Pick<Clip, "keyframes" | "autoOrient">, localMs: number, aspect: number): number {
  return clip.autoOrient ? (headingAt(pathFramesOf(clip.keyframes), localMs, aspect) ?? 0) : 0;
}

function placedTransform(clip: PlacedClip, shown: Transform, localMs: number, aspect: number): Transform {
  const anchor = anchorOf(clip);
  const rotation = shown.rotation + headingOf(clip, localMs, aspect);
  if (isCentered(anchor)) return rotation === shown.rotation ? shown : { ...shown, rotation };
  const pivot = anchorOffset(anchor, clip.transform.w, clip.transform.h);
  const swing = rotated(anchorOffset(anchor, shown.w, shown.h), rotation, aspect);
  return { ...shown, x: shown.x + pivot.x - swing.x, y: shown.y + pivot.y - swing.y, rotation };
}

export function placementAt(clip: PlacedClip, localMs: number, aspect: number, lane?: LaneValue): Transform {
  return placedTransform(clip, animatedTransform(clip.transform, clip.keyframes, localMs, aspect, lane), localMs, aspect);
}

export function pivotFrom(clip: Pick<Clip, "transform" | "anchor">, position: PathPoint): PathPoint {
  const offset = anchorOffset(anchorOf(clip), clip.transform.w, clip.transform.h);
  return { x: position.x + offset.x, y: position.y + offset.y };
}

export function pivotPoint(clip: PlacedClip, localMs: number, aspect: number): PathPoint {
  return pivotFrom(clip, animatedTransform(clip.transform, clip.keyframes, localMs, aspect));
}

export function carriesPlacement(clip: Pick<Clip, "anchor" | "flipX" | "flipY" | "autoOrient">): boolean {
  return clip.anchor !== undefined || Boolean(clip.flipX) || Boolean(clip.flipY) || Boolean(clip.autoOrient);
}

export function anchorFits(anchor: Anchor): boolean {
  const [low, high] = ANCHOR_RANGE;
  return [anchor.x, anchor.y].every((value) => Number.isFinite(value) && value >= low && value <= high);
}

export function placementIssue(clip: Pick<Clip, "anchor">): IssueCode | null {
  return !clip.anchor || anchorFits(clip.anchor) ? null : "out_of_range";
}

export function turnedAbout(placed: Transform, pivot: PathPoint, anchor: Anchor, rotation: number, aspect: number): Transform {
  const swing = rotated(anchorOffset(anchor, placed.w, placed.h), rotation, aspect);
  return { ...placed, rotation, x: pivot.x - swing.x, y: pivot.y - swing.y };
}

export function boxPointAt(placed: Transform, point: PathPoint, aspect: number): PathPoint {
  const local = rotated({ x: point.x - placed.x, y: point.y - placed.y }, -placed.rotation, aspect);
  return { x: CENTER_ANCHOR.x + (placed.w > 0 ? local.x / placed.w : 0), y: CENTER_ANCHOR.y + (placed.h > 0 ? local.y / placed.h : 0) };
}

export function framePointOf(placed: Transform, fraction: PathPoint, aspect: number): PathPoint {
  const swing = rotated(anchorOffset(fraction, placed.w, placed.h), placed.rotation, aspect);
  return { x: placed.x + swing.x, y: placed.y + swing.y };
}

export function anchorAt(placed: Transform, point: PathPoint, aspect: number): Anchor {
  return boxPointAt(placed, point, aspect);
}

export function placedPivot(placed: Transform, anchor: Anchor, aspect: number): PathPoint {
  return framePointOf(placed, anchor, aspect);
}

export const ANCHOR_POINTS = {
  "top-left": { x: 0, y: 0 },
  top: { x: 0.5, y: 0 },
  "top-right": { x: 1, y: 0 },
  left: { x: 0, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  right: { x: 1, y: 0.5 },
  "bottom-left": { x: 0, y: 1 },
  bottom: { x: 0.5, y: 1 },
  "bottom-right": { x: 1, y: 1 },
} as const satisfies Record<string, Anchor>;

export type AnchorPoint = keyof typeof ANCHOR_POINTS;

export function isAnchorPoint(value: string): value is AnchorPoint {
  return Object.hasOwn(ANCHOR_POINTS, value);
}
