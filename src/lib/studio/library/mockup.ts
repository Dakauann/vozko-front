import { newStudioId, videoCanvasSize, type CanvasSize, type Clip, type Layer, type Transform, type VideoDocument } from "../document";
import { placeStack } from "../edits";
import { overlayClip } from "../media-clips";
import { artLayers } from "../svg-import";
import { updateClip } from "../timeline";
import { frameMask, frameSlotLayer, needsMask, WHOLE_BOX, type FrameShape } from "./frame-shapes";
import type { LibraryLayers } from "./model";
import { emojiArt, type EmojiPart } from "./sets/format";

const MOCKUP_SHARE = 0.6;

export interface MockupScreen {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
}

export interface MockupDesign {
  w: number;
  h: number;
  screen: MockupScreen;
  below: readonly EmojiPart[];
  above?: readonly EmojiPart[];
}

interface DeviceBox {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

export function mockupRatio(design: MockupDesign): number {
  return design.w / design.h;
}

function screenShape(design: MockupDesign): FrameShape {
  const { w, h, radius } = design.screen;
  return { kind: "rect", radius: Math.min(1, (2 * radius) / Math.min(w, h)) };
}

function deviceBox(design: MockupDesign, canvas: CanvasSize): DeviceBox {
  const side = Math.min(canvas.width, canvas.height) * MOCKUP_SHARE;
  const ratio = mockupRatio(design);
  const width = ratio >= 1 ? side : side * ratio;
  return { cx: canvas.width / 2, cy: canvas.height / 2, width, height: width / ratio };
}

function screenTransform(design: MockupDesign, box: DeviceBox, canvas: CanvasSize): Transform {
  const scale = box.width / design.w;
  const { x, y, w, h } = design.screen;
  const left = box.cx - box.width / 2 + x * scale;
  const top = box.cy - box.height / 2 + y * scale;
  return { x: (left + (w * scale) / 2) / canvas.width, y: (top + (h * scale) / 2) / canvas.height, w: (w * scale) / canvas.width, h: (h * scale) / canvas.height, rotation: 0, opacity: 1 };
}

function chrome(design: MockupDesign, parts: readonly EmojiPart[], box: DeviceBox, canvas: CanvasSize): Layer[] {
  if (parts.length === 0) return [];
  const target = { center: { x: box.cx, y: box.cy }, width: box.width, height: box.height, rotation: 0 };
  return artLayers(emojiArt({ w: design.w, h: design.h, p: parts }), canvas, { target }).layers.map((layer) => ({ ...layer, groupId: undefined }));
}

export function mockupLayers(design: MockupDesign, canvas: CanvasSize): LibraryLayers {
  const box = deviceBox(design, canvas);
  const slot = frameSlotLayer(screenShape(design), screenTransform(design, box, canvas));
  const layers = [...chrome(design, design.below, box, canvas), slot, ...chrome(design, design.above ?? [], box, canvas)];
  const group = { id: newStudioId("g"), baseId: layers[0].id };
  return { layers: layers.map((layer) => ({ ...layer, groupId: group.id })), groups: [group] };
}

export function mockupClip(doc: VideoDocument, clip: Clip, trackId: string, design: MockupDesign): { document: VideoDocument; ids: string[] } | null {
  const canvas = videoCanvasSize(doc);
  const box = deviceBox(design, canvas);
  const shape = screenShape(design);
  const transform = { ...screenTransform(design, box, canvas), opacity: clip.transform.opacity };
  const framed = updateClip(doc, clip.id, { transform, fit: "cover", masks: needsMask(shape) ? [frameMask(shape, WHOLE_BOX)] : undefined });
  const linkId = newStudioId("k");
  const parts: Clip[] = chrome(design, [...design.below, ...(design.above ?? [])], box, canvas).map((layer) => ({ ...overlayClip(layer, clip.startMs), durationMs: clip.durationMs, linkId }));
  const placed = placeStack(framed, parts, framed.tracks.findIndex((track) => track.id === trackId));
  return placed ? { document: placed.document, ids: [clip.id, ...placed.ids] } : null;
}
