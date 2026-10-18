import { stackAt } from "../clip-transform";
import { canvasAspect, videoCanvasSize, type Clip, type VideoDocument } from "../document";
import { visualPlan } from "../playback";
import { findClip, updateClip } from "../timeline";
import { containedBox, frameMask, needsMask, WHOLE_BOX, type FrameShape } from "./frame-shapes";
import { cellCount, gridCells, type GridNode } from "./grid-layout";
import { mockupClip, type MockupDesign } from "./mockup";
import type { LibraryItem } from "./model";

export type FramingRefusal = "noClips" | "notMedia" | "locked" | "tooMany";

type Framed = { ok: true; document: VideoDocument; ids: string[] } | { ok: false; reason: FramingRefusal; count?: number };

const FRAMED_TYPES = new Set<Clip["type"]>(["video", "image"]);

function framesClip(clip: Pick<Clip, "type">): boolean {
  return FRAMED_TYPES.has(clip.type);
}

function targets(doc: VideoDocument, clipIds: readonly string[]): { ok: true; clips: Clip[] } | { ok: false; reason: FramingRefusal } {
  const ids = [...new Set(clipIds)];
  if (ids.length === 0) return { ok: false, reason: "noClips" };
  const clips: Clip[] = [];
  for (const id of ids) {
    const found = findClip(doc, id);
    if (!found || !framesClip(found.clip)) return { ok: false, reason: "notMedia" };
    if (found.track.locked) return { ok: false, reason: "locked" };
    clips.push(found.clip);
  }
  return { ok: true, clips };
}

function frameClips(doc: VideoDocument, clipIds: readonly string[], shape: FrameShape, ratio: number): Framed {
  const found = targets(doc, clipIds);
  if (!found.ok) return found;
  const canvas = videoCanvasSize(doc);
  const document = found.clips.reduce((current, clip) => {
    const boxRatio = (clip.transform.w * canvas.width) / (clip.transform.h * canvas.height);
    return updateClip(current, clip.id, { masks: [frameMask(shape, containedBox(ratio, boxRatio))] });
  }, doc);
  return { ok: true, document, ids: found.clips.map((clip) => clip.id) };
}

export function gridClips(doc: VideoDocument, clipIds: readonly string[], root: GridNode): Framed {
  const found = targets(doc, clipIds);
  if (!found.ok) return found;
  const count = cellCount(root);
  if (found.clips.length > count) return { ok: false, reason: "tooMany", count };
  const canvas = videoCanvasSize(doc);
  const cells = gridCells(root, canvas);
  const document = found.clips.reduce((current, clip, index) => {
    const { rect, shape } = cells[index];
    const transform = { ...clip.transform, x: (rect.left + rect.width / 2) / canvas.width, y: (rect.top + rect.height / 2) / canvas.height, w: rect.width / canvas.width, h: rect.height / canvas.height, rotation: 0 };
    return updateClip(current, clip.id, { transform, fit: "cover", masks: needsMask(shape) ? [frameMask(shape, WHOLE_BOX)] : undefined });
  }, doc);
  return { ok: true, document, ids: found.clips.map((clip) => clip.id) };
}

function mockupClips(doc: VideoDocument, clipIds: readonly string[], design: MockupDesign): Framed {
  const found = targets(doc, clipIds);
  if (!found.ok) return found;
  if (found.clips.length > 1) return { ok: false, reason: "tooMany", count: 1 };
  const track = findClip(doc, found.clips[0].id)?.track;
  const mocked = track ? mockupClip(doc, found.clips[0], track.id, design) : null;
  return mocked ? { ok: true, ...mocked } : { ok: false, reason: "locked" };
}

export function mediaClipAt(doc: VideoDocument, atMs: number, x: number, y: number): string | null {
  const items = visualPlan(doc, atMs).filter((item) => item.active && (item.type === "video" || item.type === "image"));
  const stack = stackAt(
    items.map((item) => ({ ...item, zIndex: item.trackIndex })),
    x,
    y,
    canvasAspect(doc),
  );
  const top = stack[0];
  return top && findClip(doc, top.clipId) ? top.clipId : null;
}

export function framesItem(item: LibraryItem): boolean {
  return item.template.kind === "frame" || item.template.kind === "grid" || item.template.kind === "mockup";
}

export function frameWithItem(doc: VideoDocument, item: LibraryItem, clipIds: readonly string[]): Framed | null {
  const template = item.template;
  if (template.kind === "frame") return frameClips(doc, clipIds, template.shape, item.ratio);
  if (template.kind === "grid") return gridClips(doc, clipIds, template.root);
  if (template.kind === "mockup") return mockupClips(doc, clipIds, template.design);
  return null;
}

export function framingSlots(item: LibraryItem): number {
  return item.template.kind === "grid" ? cellCount(item.template.root) : 1;
}
