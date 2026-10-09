"use client";

import { loadAssetImage } from "@/components/studio/canvas/asset-images";
import { videoCanvasSize, type ImageSurface, type VideoDocument } from "@/lib/studio/document";
import { rowSheet, sheetLayout, timecode, SHEET_LONG_EDGE } from "@/lib/studio/agent/frames";
import { markRadius, placeMarks, type Mark, type MarkTarget } from "@/lib/studio/agent/marks";
import { fitRect } from "@/lib/studio/fit";
import { visibleLayers } from "@/lib/studio/image-edits";
import { visualPlan, type VisualItem } from "@/lib/studio/playback";

import type { FrameExtractor } from "../video/timeline/frame-extractor";

export const IMAGE_CAPTURE_EDGE = 1024;
const JPEG_QUALITY = 0.82;
const FALLBACK_QUALITIES = [0.82, 0.68, 0.55, 0.42];
export const MAX_CAPTURE_URL_CHARS = 2_000_000;
const MEDIA_FRAME_HEIGHT = 320;
const ARTBOARD_SHEET_GAP = 24;
const ARTBOARD_SHEET_FILL = "#1f2937";
const ARTBOARD_LABEL_PX = 20;

export interface CapturedFrame {
  canvas: HTMLCanvasElement;
  label: string;
}

export interface FrameNote {
  n: number;
  at_ms: number;
  clips: { id: string; type: string; text?: string; mark?: number }[];
  unreadable?: string[];
}

const MARK_FILL = "#ffd400";
const MARK_INK = "#000000";

function drawMarks(context: CanvasRenderingContext2D, targets: readonly MarkTarget[]): Mark[] {
  const { width, height } = context.canvas;
  const radius = markRadius(width, height);
  const marks = placeMarks(targets, width, height, radius);
  context.save();
  context.font = `700 ${Math.round(radius * 1.1)}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = Math.max(2, radius / 6);
  for (const mark of marks) {
    context.beginPath();
    context.arc(mark.x, mark.y, radius, 0, Math.PI * 2);
    context.fillStyle = MARK_FILL;
    context.fill();
    context.strokeStyle = MARK_INK;
    context.stroke();
    context.fillStyle = MARK_INK;
    context.fillText(String(mark.n), mark.x, mark.y + radius * 0.05);
  }
  context.restore();
  return marks;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("frame image could not be decoded"));
    image.src = src;
  });
}

async function videoSource(frames: FrameExtractor, item: VisualItem, heightPx: number, signal: AbortSignal): Promise<CanvasImageSource | null> {
  if (!item.assetId) return null;
  const url = await frames.request(item.assetId, item.sourceMs, Math.max(32, Math.ceil(heightPx / 2)), signal);
  return url ? loadImage(url) : null;
}

async function overlaySource(item: VisualItem, width: number, height: number, fontBasePx: number): Promise<CanvasImageSource | null> {
  if (!item.layer) return null;
  const { rasterizeLayer } = await import("@/components/studio/canvas/rasterize");
  const blob = await rasterizeLayer(item.layer, width, height, { fontBasePx });
  return createImageBitmap(blob);
}

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  if (source instanceof HTMLImageElement) return { width: source.naturalWidth, height: source.naturalHeight };
  const sized = source as { width: number; height: number };
  return { width: sized.width, height: sized.height };
}

export async function composeVideoFrame(
  doc: VideoDocument,
  atMs: number,
  widthPx: number,
  frames: FrameExtractor,
  signal: AbortSignal,
  marks: ReadonlyMap<string, number> | null = null,
): Promise<{ canvas: HTMLCanvasElement; note: Omit<FrameNote, "n"> }> {
  const size = videoCanvasSize(doc);
  const scale = widthPx / size.width;
  const width = Math.round(size.width * scale);
  const height = Math.round(size.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = doc.canvas.background;
  context.fillRect(0, 0, width, height);
  const items = visualPlan(doc, atMs, 0).filter((item) => item.active && item.opacity > 0);
  const unreadable: string[] = [];
  for (const item of items) {
    const t = item.transform;
    const boxW = Math.max(1, t.w * width);
    const boxH = Math.max(1, t.h * height);
    let source: CanvasImageSource | null = null;
    try {
      if (item.type === "video") source = await videoSource(frames, item, boxH, signal);
      else if (item.type === "image" && item.assetId) source = await loadAssetImage(item.assetId);
      else source = await overlaySource(item, boxW, boxH, size.height * scale);
    } catch {
      source = null;
    }
    if (!source) {
      unreadable.push(item.clipId);
      continue;
    }
    context.save();
    context.globalAlpha = item.opacity;
    context.translate(t.x * width, t.y * height);
    context.rotate((t.rotation * Math.PI) / 180);
    context.translate(-boxW / 2, -boxH / 2);
    if (item.type === "overlay") context.drawImage(source, 0, 0, boxW, boxH);
    else {
      const natural = sourceSize(source);
      const r = fitRect(natural.width, natural.height, boxW, boxH, item.fit);
      context.drawImage(source, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    }
    context.restore();
  }
  if (marks) drawMarks(context, items.flatMap((item) => (marks.has(item.clipId) ? [{ n: marks.get(item.clipId)!, id: item.clipId, transform: item.transform }] : [])));
  const clips = items.map((item) => ({
    id: item.clipId,
    type: item.type,
    ...(item.layer?.text ? { text: item.layer.text } : {}),
    ...(marks?.has(item.clipId) ? { mark: marks.get(item.clipId) } : {}),
  }));
  return { canvas, note: { at_ms: atMs, clips, ...(unreadable.length > 0 ? { unreadable } : {}) } };
}

function labelPx(cellWidth: number): number {
  return Math.max(12, Math.round(cellWidth / 18));
}

function labelHeight(fontPx: number): number {
  return fontPx + Math.round(fontPx / 2) * 3;
}

function drawLabel(context: CanvasRenderingContext2D, text: string, x: number, y: number, fontPx: number) {
  context.font = `600 ${fontPx}px system-ui, sans-serif`;
  const padding = Math.round(fontPx / 2);
  const width = context.measureText(text).width + padding * 2;
  context.fillStyle = "rgba(0, 0, 0, 0.72)";
  context.fillRect(x + padding, y + padding, width, fontPx + padding * 2);
  context.fillStyle = "#ffffff";
  context.textBaseline = "top";
  context.fillText(text, x + padding * 2, y + padding * 2);
}

export function contactSheet(frames: readonly CapturedFrame[], frameAspect: number, longEdge: number = SHEET_LONG_EDGE): string {
  const layout = sheetLayout(frames.length, frameAspect, longEdge);
  const sheet = document.createElement("canvas");
  sheet.width = layout.width;
  sheet.height = layout.height;
  const context = sheet.getContext("2d")!;
  context.fillStyle = "#111111";
  context.fillRect(0, 0, layout.width, layout.height);
  frames.forEach((frame, index) => {
    const x = (index % layout.cols) * layout.cellWidth;
    const y = Math.floor(index / layout.cols) * layout.cellHeight;
    context.drawImage(frame.canvas, x, y, layout.cellWidth, layout.cellHeight);
    context.strokeStyle = "#111111";
    context.lineWidth = 2;
    context.strokeRect(x, y, layout.cellWidth, layout.cellHeight);
    drawLabel(context, frame.label, x, y, labelPx(layout.cellWidth));
  });
  return encodeWithin(sheet);
}

export function encodeWithin(canvas: HTMLCanvasElement, maxChars: number = MAX_CAPTURE_URL_CHARS): string {
  for (const quality of FALLBACK_QUALITIES) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= maxChars) return url;
  }
  const half = document.createElement("canvas");
  half.width = Math.max(1, Math.round(canvas.width / 2));
  half.height = Math.max(1, Math.round(canvas.height / 2));
  half.getContext("2d")!.drawImage(canvas, 0, 0, half.width, half.height);
  return encodeWithin(half, maxChars);
}

export async function captureVideo(
  doc: VideoDocument,
  times: readonly number[],
  frames: FrameExtractor,
  signal: AbortSignal,
  marks: ReadonlyMap<string, number> | null = null,
): Promise<{ image: string; notes: FrameNote[] }> {
  const size = videoCanvasSize(doc);
  const aspect = size.width / size.height;
  const cell = sheetLayout(times.length, aspect);
  const captured: CapturedFrame[] = [];
  const notes: FrameNote[] = [];
  for (const [index, atMs] of times.entries()) {
    const { canvas, note } = await composeVideoFrame(doc, atMs, cell.cellWidth, frames, signal, marks);
    captured.push({ canvas, label: `${index + 1} · ${timecode(atMs)}` });
    notes.push({ n: index + 1, ...note });
  }
  return { image: contactSheet(captured, aspect), notes };
}

export async function captureMediaFrames(assetId: string, times: readonly number[], frames: FrameExtractor, signal: AbortSignal): Promise<string | null> {
  const images: { image: HTMLImageElement; atMs: number }[] = [];
  for (const atMs of times) {
    const url = await frames.request(assetId, atMs, MEDIA_FRAME_HEIGHT, signal);
    if (url) images.push({ image: await loadImage(url), atMs });
  }
  if (images.length === 0) return null;
  const aspect = images[0].image.naturalWidth / Math.max(1, images[0].image.naturalHeight);
  const cell = sheetLayout(images.length, aspect);
  const captured: CapturedFrame[] = [];
  for (const [index, { image, atMs }] of images.entries()) {
    const canvas = document.createElement("canvas");
    canvas.width = cell.cellWidth;
    canvas.height = cell.cellHeight;
    const r = fitRect(image.naturalWidth, image.naturalHeight, cell.cellWidth, cell.cellHeight, "contain");
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    captured.push({ canvas, label: `${index + 1} · ${timecode(atMs)}` });
  }
  return contactSheet(captured, aspect);
}

export async function captureLibraryImage(assetId: string): Promise<string> {
  const image = await loadAssetImage(assetId);
  const scale = Math.min(1, IMAGE_CAPTURE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return encodeWithin(canvas);
}

async function markedImage(blob: Blob, targets: readonly MarkTarget[]): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d")!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  drawMarks(context, targets);
  return encodeWithin(canvas);
}

async function surfaceBlob(doc: ImageSurface, pixelRatio: number): Promise<Blob> {
  const { rasterizeLayers } = await import("@/components/studio/canvas/rasterize");
  const { width, height, background, gradient } = doc.canvas;
  return rasterizeLayers(visibleLayers(doc.layers), width, height, {
    background: gradient ? undefined : background || "#ffffff",
    backgroundGradient: gradient,
    mimeType: "image/jpeg",
    quality: JPEG_QUALITY,
    pixelRatio,
  });
}

export interface ArtboardShot {
  surface: ImageSurface;
  label: string;
  marks: readonly MarkTarget[];
}

export async function captureArtboards(shots: readonly ArtboardShot[]): Promise<string> {
  const sheet = rowSheet(shots.map((shot) => shot.surface.canvas.width / shot.surface.canvas.height), SHEET_LONG_EDGE, ARTBOARD_SHEET_GAP);
  const canvas = document.createElement("canvas");
  canvas.width = sheet.width;
  canvas.height = sheet.height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = ARTBOARD_SHEET_FILL;
  context.fillRect(0, 0, sheet.width, sheet.height);
  for (const [index, shot] of shots.entries()) {
    const cell = sheet.cells[index];
    const bitmap = await createImageBitmap(await surfaceBlob(shot.surface, Math.min(1, cell.width / shot.surface.canvas.width)));
    const tile = document.createElement("canvas");
    tile.width = cell.width;
    tile.height = cell.height;
    const tileContext = tile.getContext("2d")!;
    tileContext.drawImage(bitmap, 0, 0, cell.width, cell.height);
    bitmap.close();
    drawMarks(tileContext, shot.marks);
    context.drawImage(tile, cell.x, cell.y);
    drawLabel(context, shot.label, cell.x, cell.y + cell.height - labelHeight(ARTBOARD_LABEL_PX), ARTBOARD_LABEL_PX);
  }
  return encodeWithin(canvas);
}

export async function captureArtboard(doc: ImageSurface, marks: readonly MarkTarget[] = []): Promise<string> {
  const { width, height } = doc.canvas;
  const blob = await surfaceBlob(doc, Math.min(1, IMAGE_CAPTURE_EDGE / Math.max(width, height)));
  if (marks.length > 0) return markedImage(blob, marks);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("capture could not be read")));
    reader.onerror = () => reject(new Error("capture could not be read"));
    reader.readAsDataURL(blob);
  });
}
