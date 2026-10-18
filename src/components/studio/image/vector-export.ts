"use client";

import type { Artboard } from "@/lib/studio/document";
import { repeatedLayers } from "@/lib/studio/repeat-edits";
import { alphaBounds, exportScene, isOpaque, patchRatio, withoutRaster, type ExportScene, type RasterItem } from "@/lib/studio/export-scene";
import type { Box } from "@/lib/studio/paint";
import { PDF_PATCH_RATIOS, rgbAndAlpha, writePdf, type PdfImage, type PdfPreset, type PlacedPdfImage } from "@/lib/studio/pdf-export";
import { SVG_PATCH_RATIO, sceneToSvg, type SvgImage } from "@/lib/studio/svg-export";

type RegionRaster = Pick<typeof import("@/components/studio/canvas/rasterize"), "rasterizeRegion">;

const PDF_TYPE = "application/pdf";
const SVG_TYPE = "image/svg+xml";

const PATCH_JPEG_QUALITY = 0.92;

interface VectorExportOptions {
  transparent: boolean;
  preset: PdfPreset;
}

interface Patch {
  bounds: Box;
  canvas: HTMLCanvasElement;
  pixels: Uint8ClampedArray;
  opaque: boolean;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("studio export could not read the patch pixels");
  return context;
}

function cropped(source: HTMLCanvasElement, trim: Box): { canvas: HTMLCanvasElement; pixels: Uint8ClampedArray } {
  const canvas = window.document.createElement("canvas");
  canvas.width = trim.width;
  canvas.height = trim.height;
  const context = context2d(canvas);
  context.drawImage(source, trim.x, trim.y, trim.width, trim.height, 0, 0, trim.width, trim.height);
  return { canvas, pixels: context.getImageData(0, 0, trim.width, trim.height).data };
}

async function renderPatch(raster: RegionRaster, artboard: Artboard, item: RasterItem, wanted: number): Promise<Patch | null> {
  const drawn = repeatedLayers(artboard);
  const layers = item.layerIds.map((id) => {
    const layer = drawn.find((l) => l.id === id);
    if (!layer) throw new Error(`studio export lost the layer ${id}`);
    return layer;
  });
  const source = await raster.rasterizeRegion(layers, artboard.canvas.width, artboard.canvas.height, item.bounds, { pixelRatio: patchRatio(item.bounds, wanted), background: item.backdrop?.background, backgroundGradient: item.backdrop?.gradient, vfx: item.vfx });
  const trim = alphaBounds(context2d(source).getImageData(0, 0, source.width, source.height).data, source.width, source.height);
  if (!trim) return null;
  const { canvas, pixels } = cropped(source, trim);
  const sx = item.bounds.width / source.width;
  const sy = item.bounds.height / source.height;
  const bounds = { x: item.bounds.x + trim.x * sx, y: item.bounds.y + trim.y * sy, width: trim.width * sx, height: trim.height * sy };
  return { bounds, canvas, pixels, opaque: isOpaque(pixels) };
}

async function scenePatches(raster: RegionRaster, artboard: Artboard, transparent: boolean, wanted: number): Promise<{ scene: ExportScene; patches: Map<string, Patch> }> {
  let scene = exportScene(artboard, { transparent });
  const patches = new Map<string, Patch>();
  for (const item of scene.items) {
    if (item.kind !== "raster") continue;
    const patch = await renderPatch(raster, artboard, item, wanted);
    if (patch) patches.set(item.id, patch);
    else scene = withoutRaster(scene, item.id);
  }
  return { scene, patches };
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("studio export produced no patch image"))), type, quality));
}

async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function pdfImage(patch: Patch): Promise<PdfImage> {
  const { width, height } = patch.canvas;
  if (patch.opaque) return { kind: "jpeg", width, height, data: new Uint8Array(await (await canvasBlob(patch.canvas, "image/jpeg", PATCH_JPEG_QUALITY)).arrayBuffer()) };
  const { rgb, alpha } = rgbAndAlpha(patch.pixels);
  return { kind: "flate", width, height, rgb: await deflate(rgb), alpha: await deflate(alpha) };
}

function svgImage(patch: Patch): SvgImage {
  return { bounds: patch.bounds, href: patch.opaque ? patch.canvas.toDataURL("image/jpeg", PATCH_JPEG_QUALITY) : patch.canvas.toDataURL("image/png") };
}

export async function renderPdf(raster: RegionRaster, artboards: readonly Artboard[], title: string, options: VectorExportOptions): Promise<Blob> {
  const pages = [];
  for (const artboard of artboards) {
    const { scene, patches } = await scenePatches(raster, artboard, options.transparent, PDF_PATCH_RATIOS[options.preset]);
    const images = new Map<string, PlacedPdfImage>();
    for (const [id, patch] of patches) images.set(id, { bounds: patch.bounds, image: await pdfImage(patch) });
    pages.push({ scene, images });
  }
  return new Blob([writePdf({ title, created: new Date(), pages })], { type: PDF_TYPE });
}

export async function renderSvg(raster: RegionRaster, artboard: Artboard, options: Pick<VectorExportOptions, "transparent">): Promise<Blob> {
  const { scene, patches } = await scenePatches(raster, artboard, options.transparent, SVG_PATCH_RATIO);
  const images = new Map([...patches].map(([id, patch]) => [id, svgImage(patch)] as const));
  return new Blob([sceneToSvg(scene, images)], { type: SVG_TYPE });
}
