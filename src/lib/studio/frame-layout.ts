import { alignShift, alignTarget, boxBounds, distributeShifts, isStill, unionBounds, type Alignment, type Bounds, type DistributeAxis, type Shift } from "./arrange";
import { moveBox } from "./clip-transform";
import { canvasAspect, videoCanvasSize, type CanvasSize, type Clip, type ClipType, type Transform, type VideoDocument } from "./document";
import { clipLookup, parentsFirst, worldPlacementAt, type ClipLookup } from "./parenting";
import { visualPlan } from "./playback";
import { checkedDocument, clipTime, placedPatch } from "./selection-edit";
import { boundsTargets, frameTargets, measureGaps, mergeTargets, snapMove, type Gap, type SnapGuides, type SnapTargets } from "./snapping";
import { findClip, updateClip, type ClipLocation } from "./timeline";

export const SAFE_AREA = { left: 0.06, top: 0.06, right: 0.94, bottom: 0.8 } as const;

export type AlignTo = "selection" | "frame";

export const ALIGN_TO: readonly AlignTo[] = ["selection", "frame"];

export type FrameLayoutRefusal = "missing" | "locked" | "notVisual" | "keyframeOutside" | "outOfRange" | "tooFew" | "invalid";

export type FrameLayoutResult =
  | { ok: true; document: VideoDocument; changed: string[]; keyed: string[]; skipped: string[] }
  | { ok: false; reason: FrameLayoutRefusal; clipId?: string };

export interface FrameLayoutOptions {
  playheadMs: number;
  relativeTo?: AlignTo;
}

const FRAMED: ReadonlySet<ClipType> = new Set(["video", "image", "overlay", "group"]);

export function hasFrame(type: ClipType): boolean {
  return FRAMED.has(type);
}

export function placedAt(parents: ClipLookup, clip: Clip, playheadMs: number, aspect: number): Transform {
  return worldPlacementAt(parents, clip, clipTime(clip, playheadMs), aspect);
}

export function clipEdgesPx(parents: ClipLookup, clip: Clip, playheadMs: number, size: CanvasSize): Bounds {
  return boxBounds(placedAt(parents, clip, playheadMs, size.width / size.height), size);
}

export function frameBounds(size: CanvasSize): Bounds {
  return { left: 0, top: 0, right: size.width, bottom: size.height };
}

export function safeAreaTargets(size: CanvasSize): SnapTargets {
  return { x: [SAFE_AREA.left * size.width, SAFE_AREA.right * size.width], y: [SAFE_AREA.top * size.height, SAFE_AREA.bottom * size.height] };
}

export function frameSnapTargets(doc: VideoDocument, playheadMs: number, movingIds: readonly string[], safeArea: boolean): { targets: SnapTargets; others: Bounds[] } {
  const size = videoCanvasSize(doc);
  const moving = new Set(movingIds);
  const others = visualPlan(doc, playheadMs, 0)
    .filter((item) => item.active && item.type !== "effect" && !moving.has(item.clipId))
    .map((item) => boxBounds(item.transform, size));
  const targets = mergeTargets(frameTargets(size), ...(safeArea ? [safeAreaTargets(size)] : []), boundsTargets(others));
  return { targets, others };
}

export interface FrameScene {
  targets: SnapTargets;
  others: Bounds[];
}

export interface FrameSnap {
  dx: number;
  dy: number;
  guides: SnapGuides;
  gaps: Gap[];
}

const NO_GUIDES: SnapGuides = { vertical: [], horizontal: [] };

function movedBounds(boxes: readonly Transform[], dx: number, dy: number, size: CanvasSize): Bounds {
  return unionBounds(boxes.map((box) => boxBounds(moveBox(box, dx, dy), size)));
}

export function snapFrameMove(boxes: readonly Transform[], dx: number, dy: number, size: CanvasSize, scene: FrameScene, thresholdPx: number | null): FrameSnap {
  const snap = thresholdPx === null ? null : snapMove(movedBounds(boxes, dx, dy, size), scene.targets, thresholdPx);
  const nextDx = dx + (snap ? snap.dx / size.width : 0);
  const nextDy = dy + (snap ? snap.dy / size.height : 0);
  return { dx: nextDx, dy: nextDy, guides: snap?.guides ?? NO_GUIDES, gaps: measureGaps(movedBounds(boxes, nextDx, nextDy, size), scene.others, frameBounds(size)) };
}

type Located = { ok: true; visual: ClipLocation[]; skipped: string[] } | { ok: false; reason: FrameLayoutRefusal; clipId?: string };

function locate(doc: VideoDocument, ids: readonly string[]): Located {
  const visual: ClipLocation[] = [];
  const skipped: string[] = [];
  for (const id of ids) {
    const found = findClip(doc, id);
    if (!found) return { ok: false, reason: "missing", clipId: id };
    if (!hasFrame(found.clip.type)) skipped.push(id);
    else visual.push(found);
  }
  if (visual.length === 0) return { ok: false, reason: "notVisual", clipId: skipped[0] };
  const held = visual.find((found) => found.track.locked);
  if (held) return { ok: false, reason: "locked", clipId: held.clip.id };
  return { ok: true, visual, skipped };
}

function shifted(doc: VideoDocument, visual: readonly ClipLocation[], shifts: readonly Shift[], playheadMs: number, skipped: string[]): FrameLayoutResult {
  const size = videoCanvasSize(doc);
  const aspect = canvasAspect(doc);
  const parents = clipLookup(doc);
  let next = doc;
  const changed: string[] = [];
  const keyed: string[] = [];
  const ordered = parentsFirst(parents, visual.map((location, index) => ({ ...location, shift: shifts[index] })));
  for (const { clip, shift } of ordered) {
    if (isStill(shift)) continue;
    const placed = placedAt(parents, clip, playheadMs, aspect);
    const desired = { ...placed, x: placed.x + shift[0] / size.width, y: placed.y + shift[1] / size.height };
    if (desired.x < 0 || desired.x > 1 || desired.y < 0 || desired.y > 1) return { ok: false, reason: "outOfRange", clipId: clip.id };
    const patch = placedPatch(clipLookup(next), clip, desired, playheadMs, aspect);
    if (typeof patch === "string") return { ok: false, reason: patch === "keyframeOutside" ? "keyframeOutside" : "invalid", clipId: clip.id };
    if (patch.keyframes !== undefined && patch.keyframes !== clip.keyframes) keyed.push(clip.id);
    next = updateClip(next, clip.id, patch);
    changed.push(clip.id);
  }
  const checked = checkedDocument(doc, next);
  return checked.ok ? { ok: true, document: checked.document, changed, keyed, skipped } : { ok: false, reason: "invalid" };
}

function boundsOf(doc: VideoDocument, visual: readonly ClipLocation[], playheadMs: number): Bounds[] {
  const size = videoCanvasSize(doc);
  const aspect = canvasAspect(doc);
  const parents = clipLookup(doc);
  return visual.map(({ clip }) => boxBounds(placedAt(parents, clip, playheadMs, aspect), size));
}

export function alignClips(doc: VideoDocument, ids: readonly string[], alignment: Alignment, options: FrameLayoutOptions): FrameLayoutResult {
  const located = locate(doc, ids);
  if (!located.ok) return located;
  const bounds = boundsOf(doc, located.visual, options.playheadMs);
  const frame = frameBounds(videoCanvasSize(doc));
  const target = options.relativeTo === "frame" ? frame : alignTarget(bounds, frame);
  const shifts = bounds.map((b) => alignShift(b, target, alignment));
  return shifted(doc, located.visual, shifts, options.playheadMs, located.skipped);
}

export function distributeClips(doc: VideoDocument, ids: readonly string[], axis: DistributeAxis, options: FrameLayoutOptions): FrameLayoutResult {
  const located = locate(doc, ids);
  if (!located.ok) return located;
  if (located.visual.length < 3) return { ok: false, reason: "tooFew" };
  const shifts = distributeShifts(boundsOf(doc, located.visual, options.playheadMs), axis);
  return shifted(doc, located.visual, shifts, options.playheadMs, located.skipped);
}
