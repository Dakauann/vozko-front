"use client";

import { loadAssetImage, loadUrlImage } from "@/components/studio/canvas/asset-images";
import { videoCanvasSize, type CanvasSize, type ImageSurface, type Layer, type VideoDocument } from "@/lib/studio/document";
import { frameLabel, frameNote, MAX_LOOK_ZOOM, rowSheet, sheetLayout, timecode, visibleItems, VISION_BUDGET, visionSize, type RegionBox, type SceneNote, type SheetLayout } from "@/lib/studio/agent/frames";
import { clipMarkNumbers, markRadius, placeMarks, regionTargets, type MarkTarget } from "@/lib/studio/agent/marks";
import { guideReport, isUpright, type LookView } from "@/lib/studio/agent/look-views";
import type { PixelGrid } from "@/lib/studio/agent/legibility";
import { guideTicks, PERCEPTION_AREA_ALPHA, PERCEPTION_GUIDE_DASH, PERCEPTION_GUIDE_TICK, PERCEPTION_INKS, PERCEPTION_LINE_SHARE, type PerceptionShape, type UnitPoint } from "@/lib/studio/agent/perception";
import { boxCorners } from "@/lib/studio/arrange";
import { fitRect } from "@/lib/studio/fit";
import { visibleLayers } from "@/lib/studio/image-edits";
import { repeatedLayers } from "@/lib/studio/repeat-edits";
import { blurredPlan } from "@/lib/studio/blurred-plan";
import { chartFrameLayers } from "@/lib/studio/chart-animation";
import type { VisualItem } from "@/lib/studio/playback";
import type { Renderer } from "@/lib/studio/render/renderer";
import { haloNodeOf, videoScene } from "@/lib/studio/scene/video-scene";

import { haloCanvas } from "../canvas/halo-canvas";
import { loadMediaFile } from "../canvas/media-files";
import { LutUnavailableError } from "../canvas/lut-files";
import { DecodedVideos } from "../media/decoded-videos";
import { openMediaWorker } from "../media/media-worker";
import { gpuRenderingWanted } from "../render/gpu-preference";
import { studioRenderSources } from "../render/studio-sources";
import { drawWhenReady, outputScale, Wake } from "../video/export/frame-loop";
import { reactLevels } from "../video/react-levels";
import type { FrameExtractor } from "../video/timeline/frame-extractor";

const RASTER_QUALITY = 0.92;
const FALLBACK_QUALITIES = [0.82, 0.68, 0.55, 0.42];
export const MAX_CAPTURE_URL_CHARS = 2_000_000;
const MAX_ARTBOARD_RASTER_PIXELS = 16_000_000;
const LOOK_STALL_MS = 8000;
const ARTBOARD_SHEET_GAP = 24;
const ARTBOARD_SHEET_FILL = "#1f2937";
const ARTBOARD_LABEL_PX = 20;
const MARK_FILL = "#ffd400";
const MARK_INK = "#000000";
const FULL_FRAME: RegionBox = { left: 0, top: 0, width: 1, height: 1 };
const THIRDS_INK = "rgba(255, 79, 216, 0.55)";
const CENTER_INK = "#00e5ff";
const ALIGN_INK = "#ff3b30";
const ANGLE_INK = "#ff9500";
const GUIDE_MARGIN = 0.06;
const WIREFRAME_GROUND = "#f4f4f5";
const WIREFRAME_FILL_ALPHA = 0.14;
const WIREFRAME_DEFAULT_INK = "#52525b";
const WIREFRAME_INKS: Record<string, string> = { text: "#2563eb", image: "#16a34a", video: "#16a34a", shape: "#ea580c", overlay: "#ea580c", icon: "#9333ea" };
const BACKDROP_LONG_EDGE = 480;

export interface LookOverlay {
  view: LookView;
  targets: readonly MarkTarget[];
  numbered: boolean;
  shapes?: readonly PerceptionShape[];
}

export const PLAIN_LOOK: LookOverlay = { view: "render", targets: [], numbered: false };

export interface CapturedFrame {
  canvas: HTMLCanvasElement;
  label: string;
}

export type FrameNote = SceneNote & { n: number; unreadable?: string[] };

function tracePolygon(context: CanvasRenderingContext2D, corners: readonly [number, number][]): void {
  context.beginPath();
  corners.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
  context.closePath();
}

function drawMarks(context: CanvasRenderingContext2D, targets: readonly MarkTarget[], outlined = true): void {
  const { width, height } = context.canvas;
  const radius = markRadius(width, height);
  const marks = placeMarks(targets, width, height, radius);
  context.save();
  context.lineWidth = Math.max(1, radius / 7);
  context.setLineDash([radius / 2, radius / 3]);
  context.strokeStyle = MARK_FILL;
  if (outlined) {
    for (const mark of marks) {
      tracePolygon(context, mark.corners);
      context.stroke();
    }
  }
  context.setLineDash([]);
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
}

function strokeLine(context: CanvasRenderingContext2D, from: [number, number], to: [number, number]): void {
  context.beginPath();
  context.moveTo(from[0], from[1]);
  context.lineTo(to[0], to[1]);
  context.stroke();
}

function drawCanvasGuides(context: CanvasRenderingContext2D, line: number): void {
  const { width, height } = context.canvas;
  context.lineWidth = line;
  context.strokeStyle = THIRDS_INK;
  for (const share of [1 / 3, 2 / 3]) {
    strokeLine(context, [width * share, 0], [width * share, height]);
    strokeLine(context, [0, height * share], [width, height * share]);
  }
  context.strokeStyle = CENTER_INK;
  context.setLineDash([line * 6, line * 4]);
  strokeLine(context, [width / 2, 0], [width / 2, height]);
  strokeLine(context, [0, height / 2], [width, height / 2]);
  context.setLineDash([line * 2, line * 3]);
  const inset = Math.min(width, height) * GUIDE_MARGIN;
  context.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
  context.setLineDash([]);
}

function drawGuides(context: CanvasRenderingContext2D, targets: readonly MarkTarget[], whole: boolean): void {
  const { width, height } = context.canvas;
  const line = Math.max(1, Math.round(Math.min(width, height) / 400));
  const report = guideReport(targets, { width, height });
  context.save();
  if (whole) drawCanvasGuides(context, line);
  context.lineWidth = line * 1.5;
  context.strokeStyle = ALIGN_INK;
  for (const guide of report.lines) {
    if (guide.axis === "x") strokeLine(context, [guide.at * width, 0], [guide.at * width, height]);
    else strokeLine(context, [0, guide.at * height], [width, guide.at * height]);
  }
  const reach = Math.hypot(width, height);
  context.strokeStyle = ANGLE_INK;
  for (const target of targets.filter((t) => !isUpright(t.transform))) {
    const radians = (target.transform.rotation * Math.PI) / 180;
    const [cx, cy] = [target.transform.x * width, target.transform.y * height];
    const [dx, dy] = [Math.cos(radians) * reach, Math.sin(radians) * reach];
    strokeLine(context, [cx - dx, cy - dy], [cx + dx, cy + dy]);
  }
  context.restore();
}

function drawWireframe(context: CanvasRenderingContext2D, targets: readonly MarkTarget[]): void {
  const { width, height } = context.canvas;
  context.save();
  context.fillStyle = WIREFRAME_GROUND;
  context.fillRect(0, 0, width, height);
  context.lineWidth = Math.max(1, Math.round(Math.min(width, height) / 300));
  for (const target of targets) {
    const ink = WIREFRAME_INKS[target.kind ?? ""] ?? WIREFRAME_DEFAULT_INK;
    tracePolygon(context, boxCorners(target.transform, { width, height }));
    context.globalAlpha = WIREFRAME_FILL_ALPHA;
    context.fillStyle = ink;
    context.fill();
    context.globalAlpha = 1;
    context.strokeStyle = ink;
    context.stroke();
  }
  context.restore();
}

function placed(point: UnitPoint, region: RegionBox, width: number, height: number): [number, number] {
  return [((point[0] - region.left) / region.width) * width, ((point[1] - region.top) / region.height) * height];
}

function drawArrowHead(context: CanvasRenderingContext2D, from: [number, number], to: [number, number], size: number): void {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  context.beginPath();
  context.moveTo(to[0], to[1]);
  context.lineTo(to[0] - size * Math.cos(angle - Math.PI / 6), to[1] - size * Math.sin(angle - Math.PI / 6));
  context.lineTo(to[0] - size * Math.cos(angle + Math.PI / 6), to[1] - size * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
}

function drawShapes(context: CanvasRenderingContext2D, shapes: readonly PerceptionShape[], region: RegionBox): void {
  const { width, height } = context.canvas;
  const line = Math.max(2, Math.round(Math.min(width, height) * PERCEPTION_LINE_SHARE));
  const at = (point: UnitPoint) => placed(point, region, width, height);
  context.save();
  context.lineCap = "round";
  for (const shape of shapes) {
    const ink = PERCEPTION_INKS[shape.tone];
    context.strokeStyle = ink;
    context.fillStyle = ink;
    context.lineWidth = line;
    context.setLineDash([]);
    if (shape.kind === "area") {
      tracePolygon(context, shape.points.map(at));
      context.globalAlpha = PERCEPTION_AREA_ALPHA;
      context.fill();
      context.globalAlpha = 1;
      context.setLineDash([line * 3, line * 2]);
      context.stroke();
    } else if (shape.kind === "ring") {
      const [x, y] = at(shape.at);
      context.beginPath();
      context.arc(x, y, line * 6, 0, Math.PI * 2);
      context.stroke();
    } else if (shape.kind === "guide") {
      const from = at(shape.from);
      const to = at(shape.to);
      const [dash, gap] = PERCEPTION_GUIDE_DASH;
      context.setLineDash([line * dash, line * gap]);
      strokeLine(context, from, to);
      context.setLineDash([]);
      for (const [start, end] of guideTicks(from, to, line * PERCEPTION_GUIDE_TICK)) strokeLine(context, start, end);
    } else {
      const from = at(shape.from);
      const to = at(shape.to);
      context.lineWidth = shape.kind === "segment" ? line * 1.5 : line;
      strokeLine(context, from, to);
      if (shape.kind === "arrow") drawArrowHead(context, from, to, line * 5);
    }
  }
  context.restore();
}

function paintOverlay(context: CanvasRenderingContext2D, overlay: Pick<LookOverlay, "view" | "numbered" | "shapes">, targets: readonly MarkTarget[], region: RegionBox | null): void {
  if (overlay.view === "wireframe") drawWireframe(context, targets);
  if (overlay.view === "guides") drawGuides(context, targets, region === null);
  if (overlay.shapes?.length) drawShapes(context, overlay.shapes, region ?? FULL_FRAME);
  if (overlay.numbered) drawMarks(context, targets, overlay.view !== "wireframe");
}

function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function drawRegion(target: HTMLCanvasElement, source: CanvasImageSource, size: CanvasSize, region: RegionBox): void {
  const context = target.getContext("2d")!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, region.left * size.width, region.top * size.height, region.width * size.width, region.height * size.height, 0, 0, target.width, target.height);
}

async function videoSource(frames: FrameExtractor, item: VisualItem, heightPx: number, signal: AbortSignal): Promise<CanvasImageSource | null> {
  if (!item.assetId) return null;
  const url = await frames.request(item.assetId, item.sourceMs, Math.max(32, Math.ceil(heightPx)), signal);
  return url ? loadUrlImage(url) : null;
}

async function overlaySource(item: VisualItem, width: number, height: number, fontBasePx: number): Promise<CanvasImageSource | null> {
  if (!item.layer) return null;
  const { rasterizeLayer, rasterizeLayers } = await import("@/components/studio/canvas/rasterize");
  const blob = item.chart ? await rasterizeLayers(chartFrameLayers(item.layer, item.chart, { width, height }), width, height, { fontBasePx: height }) : await rasterizeLayer(item.layer, width, height, { fontBasePx });
  return createImageBitmap(blob);
}

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  if (source instanceof HTMLImageElement) return { width: source.naturalWidth, height: source.naturalHeight };
  const sized = source as { width: number; height: number };
  return { width: sized.width, height: sized.height };
}

async function composeVideoFrame(doc: VideoDocument, atMs: number, widthPx: number, frames: FrameExtractor, signal: AbortSignal): Promise<{ canvas: HTMLCanvasElement; unreadable: string[] }> {
  const size = videoCanvasSize(doc);
  const scale = widthPx / size.width;
  const canvas = canvasOf(size.width * scale, size.height * scale);
  const { width, height } = canvas;
  const context = canvas.getContext("2d")!;
  context.fillStyle = doc.canvas.background;
  context.fillRect(0, 0, width, height);
  const unreadable: string[] = [];
  for (const item of visibleItems(doc, atMs)) {
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
      const halo = haloNodeOf(item, size.width, size.height);
      if (halo) {
        const drawn = await haloCanvas(halo, natural, scale);
        const across = boxW / halo.base.width;
        const down = boxH / halo.base.height;
        context.drawImage(drawn, -halo.padPx * across, -halo.padPx * down, (halo.base.width + 2 * halo.padPx) * across, (halo.base.height + 2 * halo.padPx) * down);
      }
      const r = fitRect(natural.width, natural.height, boxW, boxH, item.fit);
      context.drawImage(source, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    }
    context.restore();
  }
  return { canvas, unreadable };
}

async function exactFrames(doc: VideoDocument, times: readonly number[], draw: (index: number, frame: HTMLCanvasElement) => void): Promise<boolean> {
  if (!gpuRenderingWanted()) return false;
  const levels = await reactLevels.ready(doc);
  if (!levels) return false;
  const wake = new Wake();
  const videos = new DecodedVideos(openMediaWorker(), loadMediaFile, (assetId) => assetId, () => wake.notify());
  const size = videoCanvasSize(doc);
  const canvas = canvasOf(size.width, size.height);
  let renderer: Renderer | null = null;
  try {
    const { createPixiRenderer } = await import("../render/pixi-renderer");
    renderer = await createPixiRenderer(canvas, { width: size.width, height: size.height, resolution: 1 }, studioRenderSources(videos), () => wake.notify());
    for (const [index, atMs] of times.entries()) {
      const outcome = await drawWhenReady(videoScene(doc, blurredPlan(doc, atMs, outputScale(doc), levels)), { videos, renderer, wake, stallMs: LOOK_STALL_MS });
      if (outcome === "lut_unavailable") throw new LutUnavailableError([...renderer.missingLuts][0] ?? "", "missing");
      if (outcome !== "complete") return false;
      draw(index, canvas);
    }
    return true;
  } catch (error) {
    if (error instanceof LutUnavailableError) throw error;
    return false;
  } finally {
    renderer?.destroy();
    videos.dispose();
  }
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

function contactSheet(frames: readonly CapturedFrame[], layout: SheetLayout): string {
  const sheet = canvasOf(layout.width, layout.height);
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
  const half = canvasOf(canvas.width / 2, canvas.height / 2);
  half.getContext("2d")!.drawImage(canvas, 0, 0, half.width, half.height);
  return encodeWithin(half, maxChars);
}

export interface VideoLook {
  times: readonly number[];
  dense: boolean;
  region: RegionBox | null;
  marks: ReadonlyMap<string, number> | null;
  view: LookView;
  shapes?: readonly (readonly PerceptionShape[])[];
}

export interface VideoCapture {
  image: string;
  notes: FrameNote[];
  approximate: boolean;
}

function markTargets(doc: VideoDocument, atMs: number, marks: ReadonlyMap<string, number>): MarkTarget[] {
  return visibleItems(doc, atMs).flatMap((item) => (marks.has(item.clipId) ? [{ n: marks.get(item.clipId)!, id: item.clipId, transform: item.transform, kind: item.type }] : []));
}

export async function captureVideo(doc: VideoDocument, look: VideoLook, frames: FrameExtractor, signal: AbortSignal): Promise<VideoCapture> {
  const size = videoCanvasSize(doc);
  const region = look.region ?? FULL_FRAME;
  const layout = sheetLayout(look.times.length, (region.width * size.width) / (region.height * size.height));
  const cells = look.times.map(() => canvasOf(layout.cellWidth, layout.cellHeight));
  const wireframe = look.view === "wireframe";
  const exact = wireframe || (await exactFrames(doc, look.times, (index, frame) => drawRegion(cells[index], frame, size, region)));
  const unreadable = new Map<number, string[]>();
  if (!exact) {
    const widthPx = Math.min(size.width, Math.ceil(layout.cellWidth / region.width));
    for (const [index, atMs] of look.times.entries()) {
      const composed = await composeVideoFrame(doc, atMs, widthPx, frames, signal);
      drawRegion(cells[index], composed.canvas, { width: composed.canvas.width, height: composed.canvas.height }, region);
      if (composed.unreadable.length > 0) unreadable.set(index, composed.unreadable);
    }
  }
  const marks = look.marks;
  const numbers = marks ?? (look.view === "render" ? null : clipMarkNumbers(doc));
  const overlay = { view: look.view, numbered: marks !== null || wireframe };
  look.times.forEach((atMs, index) => {
    const shapes = look.shapes?.[index] ?? [];
    if (!numbers && shapes.length === 0) return;
    paintOverlay(cells[index].getContext("2d")!, { ...overlay, shapes }, numbers ? regionTargets(markTargets(doc, atMs, numbers), look.region) : [], look.region);
  });
  const notes = look.times.map((atMs, index): FrameNote => ({ n: index + 1, ...frameNote(doc, atMs, marks), ...(unreadable.has(index) ? { unreadable: unreadable.get(index) } : {}) }));
  const image = contactSheet(
    cells.map((canvas, index) => ({ canvas, label: frameLabel(index, look.times[index], look.dense) })),
    layout,
  );
  return { image, notes, approximate: !exact };
}

export async function captureMediaFrames(assetId: string, times: readonly number[], frames: FrameExtractor, signal: AbortSignal): Promise<string | null> {
  const tallest = sheetLayout(times.length, 9 / 16).cellHeight;
  const images: { image: HTMLImageElement; atMs: number }[] = [];
  for (const atMs of times) {
    const url = await frames.request(assetId, atMs, tallest, signal);
    if (url) images.push({ image: await loadUrlImage(url), atMs });
  }
  if (images.length === 0) return null;
  const aspect = images[0].image.naturalWidth / Math.max(1, images[0].image.naturalHeight);
  const layout = sheetLayout(images.length, aspect);
  const captured = images.map(({ image, atMs }, index): CapturedFrame => {
    const canvas = canvasOf(layout.cellWidth, layout.cellHeight);
    const r = fitRect(image.naturalWidth, image.naturalHeight, layout.cellWidth, layout.cellHeight, "contain");
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    return { canvas, label: `${index + 1} · ${timecode(atMs)}` };
  });
  return contactSheet(captured, layout);
}

export async function captureLibraryImage(assetId: string): Promise<string> {
  const image = await loadAssetImage(assetId);
  const fitted = visionSize(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, fitted.width / image.naturalWidth);
  const canvas = canvasOf(image.naturalWidth * scale, image.naturalHeight * scale);
  drawRegion(canvas, image, { width: image.naturalWidth, height: image.naturalHeight }, FULL_FRAME);
  return encodeWithin(canvas);
}

async function surfaceBitmap(doc: ImageSurface, pixelRatio: number, keep: (layer: Layer) => boolean = () => true): Promise<ImageBitmap> {
  const { rasterizeLayers } = await import("@/components/studio/canvas/rasterize");
  const { width, height, background, gradient, vfx } = doc.canvas;
  const ratio = Math.min(pixelRatio, MAX_LOOK_ZOOM, Math.sqrt(MAX_ARTBOARD_RASTER_PIXELS / (width * height)));
  const blob = await rasterizeLayers(visibleLayers(repeatedLayers(doc)).filter(keep), width, height, {
    background: gradient ? undefined : background || "#ffffff",
    backgroundGradient: gradient,
    vfx,
    mimeType: "image/jpeg",
    quality: RASTER_QUALITY,
    pixelRatio: ratio,
  });
  return createImageBitmap(blob);
}

export interface ArtboardShot {
  surface: ImageSurface;
  label: string;
  overlay: LookOverlay;
}

export async function captureArtboards(shots: readonly ArtboardShot[]): Promise<string> {
  const sheet = rowSheet(
    shots.map((shot) => shot.surface.canvas.width / shot.surface.canvas.height),
    VISION_BUDGET,
    ARTBOARD_SHEET_GAP,
  );
  const canvas = canvasOf(sheet.width, sheet.height);
  const context = canvas.getContext("2d")!;
  context.fillStyle = ARTBOARD_SHEET_FILL;
  context.fillRect(0, 0, sheet.width, sheet.height);
  for (const [index, shot] of shots.entries()) {
    const cell = sheet.cells[index];
    const bitmap = await surfaceBitmap(shot.surface, cell.width / shot.surface.canvas.width);
    const tile = canvasOf(cell.width, cell.height);
    drawRegion(tile, bitmap, { width: bitmap.width, height: bitmap.height }, FULL_FRAME);
    bitmap.close();
    paintOverlay(tile.getContext("2d")!, shot.overlay, shot.overlay.targets, null);
    context.drawImage(tile, cell.x, cell.y);
    drawLabel(context, shot.label, cell.x, cell.y + cell.height - labelHeight(ARTBOARD_LABEL_PX), ARTBOARD_LABEL_PX);
  }
  return encodeWithin(canvas);
}

export async function captureArtboard(doc: ImageSurface, overlay: LookOverlay = PLAIN_LOOK, region: RegionBox | null = null): Promise<string> {
  const { width, height } = doc.canvas;
  const box = region ?? FULL_FRAME;
  const target = visionSize(box.width * width, box.height * height);
  const bitmap = await surfaceBitmap(doc, target.width / (box.width * width));
  const canvas = canvasOf(target.width, target.height);
  drawRegion(canvas, bitmap, { width: bitmap.width, height: bitmap.height }, box);
  bitmap.close();
  paintOverlay(canvas.getContext("2d")!, overlay, regionTargets(overlay.targets, region), region);
  return encodeWithin(canvas);
}

export async function captureBackdrop(doc: ImageSurface): Promise<PixelGrid> {
  const { width, height } = doc.canvas;
  const scale = Math.min(1, BACKDROP_LONG_EDGE / Math.max(width, height));
  const bitmap = await surfaceBitmap(doc, scale, (layer) => layer.type !== "text");
  const canvas = canvasOf(width * scale, height * scale);
  drawRegion(canvas, bitmap, { width: bitmap.width, height: bitmap.height }, FULL_FRAME);
  bitmap.close();
  const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  return { data: pixels.data, width: canvas.width, height: canvas.height };
}
