"use client";

import type { Layer } from "@/lib/studio/document";
import { surfaceOf, type PixelSurface, type StrokeOp, type SurfaceKind } from "@/lib/studio/pixel-surface";
import { repeatSourceId } from "@/lib/studio/repeat-edits";
import { SurfaceRaster } from "@/lib/studio/surface-raster";

export interface SurfacePicture {
  canvas: HTMLCanvasElement;
  version: number;
}

interface Entry {
  raster: SurfaceRaster;
  canvas: HTMLCanvasElement;
  version: number;
  lastUsed: number;
}

const BUDGET_BYTES = 768 * 1024 * 1024;

const entries = new Map<string, Entry>();
let clock = 0;

export function surfaceKey(layerId: string, kind: SurfaceKind): string {
  return `${repeatSourceId(layerId)}:${kind}`;
}

function evict(keep: string): void {
  let total = [...entries.values()].reduce((sum, entry) => sum + entry.raster.bytes * 2, 0);
  if (total <= BUDGET_BYTES) return;
  const oldest = [...entries.entries()].filter(([key]) => key !== keep).sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
  for (const [key, entry] of oldest) {
    if (total <= BUDGET_BYTES) break;
    total -= entry.raster.bytes * 2;
    entries.delete(key);
  }
}

function fresh(surface: PixelSurface): Entry {
  const canvas = document.createElement("canvas");
  canvas.width = surface.width;
  canvas.height = surface.height;
  return { raster: new SurfaceRaster({ width: surface.width, height: surface.height }), canvas, version: 0, lastUsed: clock };
}

export function surfacePicture(key: string, surface: PixelSurface, live: StrokeOp | null = null): SurfacePicture {
  clock += 1;
  const known = entries.get(key);
  const entry = known && known.raster.fits(surface) ? known : fresh(surface);
  if (entry !== known) entries.set(key, entry);
  entry.lastUsed = clock;
  const dirty = entry.raster.sync(surface, live);
  if (dirty || entry !== known) {
    const { display } = entry.raster;
    const image = new ImageData(display.data, display.width, display.height);
    const region = entry !== known || !dirty ? { x: 0, y: 0, width: display.width, height: display.height } : dirty;
    entry.canvas.getContext("2d")!.putImageData(image, 0, 0, region.x, region.y, region.width, region.height);
    entry.version += 1;
  }
  evict(key);
  return { canvas: entry.canvas, version: entry.version };
}

export function layerSurfacePicture(layer: Layer, kind: SurfaceKind, live: StrokeOp | null = null): SurfacePicture | null {
  const surface = surfaceOf(layer, kind);
  return surface ? surfacePicture(surfaceKey(layer.id, kind), surface, live) : null;
}
