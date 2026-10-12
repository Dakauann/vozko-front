"use client";

import { isActionError } from "@/app/actions/action-result";
import { saveStudioExportAction } from "@/app/actions/studio";
import { AssetUnavailableError } from "@/components/studio/canvas/asset-images";
import { FontUnavailableError } from "@/components/studio/canvas/ensure-font";
import { assertLutsReadable, LutBlockedError } from "@/components/studio/canvas/lut-files";
import type { UploadedMedia } from "@/components/studio/canvas/upload-media";
import type { Artboard, Layer } from "@/lib/studio/document";
import { surfaceLutUses } from "@/lib/studio/lut-uses";
import { exportScene, rasterLayerCount } from "@/lib/studio/export-scene";
import { DEFAULT_JPEG_QUALITY, exportFileName, isRasterFormat, rasterBackground, visibleLayers, type ExportFormat, type ExportScale } from "@/lib/studio/image-edits";
import { PDF_PRESETS, type PdfPreset } from "@/lib/studio/pdf-export";
import { repeatedLayers } from "@/lib/studio/repeat-edits";

import { renderPdf, renderSvg } from "./vector-export";

export type Raster = typeof import("@/components/studio/canvas/rasterize");

export interface ImageExportRequest {
  format: ExportFormat;
  scale: ExportScale;
  quality: number;
  transparent: boolean;
  preset: PdfPreset;
}

export interface RenderedArtboard {
  artboardId: string;
  artboardIds: readonly string[];
  format: ExportFormat;
  blob: Blob;
  fileName: string;
  title: string;
}

export type ExportFailureKey = "errors.font" | "errors.asset" | "errors.timeout" | "errors.render" | "errors.lut";

export type ExportFailure = { key: Exclude<ExportFailureKey, "errors.lut"> } | { key: "errors.lut"; layer: Layer };

export function loadRaster(): Promise<Raster> {
  return import("@/components/studio/canvas/rasterize");
}

export function exportFailure(error: unknown, raster: Raster): ExportFailure {
  if (error instanceof LutBlockedError && error.use.owner.kind === "layer") return { key: "errors.lut", layer: error.use.owner.layer };
  if (error instanceof FontUnavailableError) return { key: "errors.font" };
  if (error instanceof AssetUnavailableError) return { key: "errors.asset" };
  if (error instanceof raster.RasterTimeoutError) return { key: "errors.timeout" };
  return { key: "errors.render" };
}

function rendered(artboards: readonly Artboard[], request: ImageExportRequest, blob: Blob, title: string): RenderedArtboard {
  return { artboardId: artboards[0].id, artboardIds: artboards.map((a) => a.id), format: request.format, blob, title, fileName: exportFileName(title, request.format, request.scale) };
}

async function rasterBlob(raster: Raster, artboard: Artboard, request: ImageExportRequest): Promise<Blob> {
  return raster.rasterizeLayers(visibleLayers(repeatedLayers(artboard)), artboard.canvas.width, artboard.canvas.height, {
    background: artboard.canvas.gradient ? undefined : rasterBackground(artboard.canvas.background, request.format, request.transparent),
    backgroundGradient: artboard.canvas.gradient,
    vfx: artboard.canvas.vfx,
    mimeType: request.format === "png" ? "image/png" : "image/jpeg",
    quality: request.format === "jpeg" ? request.quality : undefined,
    pixelRatio: request.scale,
  });
}

export async function renderArtboard(raster: Raster, artboard: Artboard, request: ImageExportRequest, title: string): Promise<RenderedArtboard> {
  if (request.format === "pdf") return renderPdfArtboards(raster, [artboard], request, title);
  const blob = request.format === "svg" ? await renderSvg(raster, artboard, request) : await rasterBlob(raster, artboard, request);
  return rendered([artboard], request, blob, title);
}

export async function renderPdfArtboards(raster: Raster, artboards: readonly Artboard[], request: ImageExportRequest, title: string): Promise<RenderedArtboard> {
  return rendered(artboards, request, await renderPdf(raster, artboards, title, request), title);
}

export function pdfTitle(projectName: string, artboards: readonly Artboard[], titleOf: (artboard: Artboard) => string): string {
  return artboards.length === 1 ? titleOf(artboards[0]) : projectName;
}

export async function renderExport(raster: Raster, artboards: readonly Artboard[], request: ImageExportRequest, titleOf: (artboard: Artboard) => string, projectName: string): Promise<RenderedArtboard[]> {
  await assertLutsReadable(artboards.flatMap(surfaceLutUses));
  if (request.format === "pdf") return [await renderPdfArtboards(raster, artboards, request, pdfTitle(projectName, artboards, titleOf))];
  const files: RenderedArtboard[] = [];
  for (const artboard of artboards) files.push(await renderArtboard(raster, artboard, request, titleOf(artboard)));
  return files;
}

export function rasterizedLayers(artboards: readonly Artboard[], transparent: boolean): number {
  return artboards.reduce((sum, artboard) => sum + rasterLayerCount(exportScene(artboard, { transparent })), 0);
}

export type SavedMedia = UploadedMedia & { artboardId: string; artboardIds: readonly string[] };

export type SavedArtboards = { ok: true; saved: SavedMedia[] } | { ok: false; reason: string };

async function saveOne(raster: Raster, item: RenderedArtboard, projectId: string): Promise<{ data: UploadedMedia } | { error: string }> {
  const result = isRasterFormat(item.format) ? await raster.uploadRaster(item.blob, item.title, item.fileName) : await saveStudioExportAction(projectId, item.blob, item.title);
  return isActionError(result) ? { error: result.error } : { data: result.data };
}

export async function saveRendered(raster: Raster, items: readonly RenderedArtboard[], projectId: string): Promise<SavedArtboards> {
  const saved: SavedMedia[] = [];
  for (const item of items) {
    const result = await saveOne(raster, item, projectId);
    if ("error" in result) return { ok: false, reason: result.error };
    saved.push({ ...result.data, artboardId: item.artboardId, artboardIds: item.artboardIds });
  }
  return { ok: true, saved };
}

export type ExportScope = "active" | "all";

const FORMATS: readonly ExportFormat[] = ["png", "jpeg", "pdf", "svg"];
const SCALES: readonly ExportScale[] = [1, 2];
const MIN_QUALITY = 0.5;

export function exportRequestOf(args: { format?: unknown; scale?: unknown; quality?: unknown; transparent?: unknown; artboards?: unknown; preset?: unknown }): { request: ImageExportRequest; scope: ExportScope } | null {
  const format = args.format ?? "png";
  if (!FORMATS.includes(format as ExportFormat)) return null;
  const raster = isRasterFormat(format as ExportFormat);
  if (!raster && (args.scale !== undefined || args.quality !== undefined)) return null;
  if (format !== "pdf" && args.preset !== undefined) return null;
  const scale = args.scale ?? 1;
  const quality = args.quality ?? DEFAULT_JPEG_QUALITY;
  const preset = args.preset ?? "digital";
  const scope = args.artboards ?? "active";
  if (!SCALES.includes(scale as ExportScale) || !(PDF_PRESETS as readonly unknown[]).includes(preset)) return null;
  if (typeof quality !== "number" || quality < MIN_QUALITY || quality > 1 || (scope !== "active" && scope !== "all")) return null;
  return { request: { format: format as ExportFormat, scale: scale as ExportScale, quality, transparent: args.transparent !== false, preset: preset as PdfPreset }, scope };
}

export function artboardTitle(projectName: string, names: ReadonlyMap<string, string>, count: number, artboardId: string): string {
  return count > 1 ? `${projectName} ${names.get(artboardId) ?? ""}`.trim() : projectName;
}
