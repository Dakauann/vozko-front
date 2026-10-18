"use client";

import { detectKeyColor } from "@/lib/studio/chroma-detect";
import type { Crop } from "@/lib/studio/document";

import { loadAssetImage, loadUrlImage } from "./asset-images";

const SAMPLE_SIDE = 256;

interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperApi {
  open: () => Promise<EyeDropperResult>;
}

export function eyeDropper(): EyeDropperApi | null {
  const ctor = (globalThis as { EyeDropper?: new () => EyeDropperApi }).EyeDropper;
  return ctor ? new ctor() : null;
}

function keyColorOfImage(image: HTMLImageElement, crop?: Crop): string | null {
  const sx = (crop?.x ?? 0) * image.naturalWidth;
  const sy = (crop?.y ?? 0) * image.naturalHeight;
  const sw = (crop?.w ?? 1) * image.naturalWidth;
  const sh = (crop?.h ?? 1) * image.naturalHeight;
  if (sw < 1 || sh < 1) return null;
  const scale = Math.min(1, SAMPLE_SIDE / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  try {
    context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return detectKeyColor(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  } catch {
    return null;
  }
}

export async function assetKeyColor(assetId: string, crop?: Crop): Promise<string | null> {
  const image = await loadAssetImage(assetId).catch(() => null);
  return image ? keyColorOfImage(image, crop) : null;
}

export async function urlKeyColor(url: string): Promise<string | null> {
  const image = await loadUrlImage(url).catch(() => null);
  return image ? keyColorOfImage(image) : null;
}
