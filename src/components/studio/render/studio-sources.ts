"use client";

import type { RenderSources } from "@/lib/studio/render/renderer";

import { acquireAssetPicture, releaseAssetPicture } from "../canvas/asset-images";
import { loadLutAtlas } from "../canvas/lut-files";
import { surfacePicture } from "../canvas/surface-canvas";
import { rasterizeLayerCanvas } from "../canvas/rasterize";
import { measureTextLayout } from "../canvas/text-layout";
import { rasterizeGlyphSheet } from "../canvas/glyph-sheet";
import { haloCanvas } from "../canvas/halo-canvas";
import { limiter } from "./limiter";
import type { VideoPictures } from "./video-feed";

const RASTER_CONCURRENCY = 3;

export function studioRenderSources(videos: VideoPictures | null): RenderSources {
  const queue = limiter(RASTER_CONCURRENCY);
  return {
    image: (assetId) => acquireAssetPicture(assetId).catch(() => null),
    releaseImage: releaseAssetPicture,
    raster: (source, pixelRatio, signal) =>
      queue(() => rasterizeLayerCanvas(source.layer, source.widthPx, source.heightPx, { fontBasePx: source.fontBasePx, pixelRatio }), signal).catch(() => null),
    textLayout: (source) => measureTextLayout(source.layer, source.widthPx, source.heightPx, source.fontBasePx).catch(() => null),
    glyphs: (source, pixelRatio, signal) => queue(() => rasterizeGlyphSheet(source, pixelRatio), signal).catch(() => null),
    video: (source) => videos?.picture(source.clipId) ?? null,
    videoBlend: (source) => (source.frameMix && !source.backward ? (videos?.blend(source.clipId, source.sourceMs) ?? null) : null),
    lut: (assetId) => loadLutAtlas(assetId).catch(() => null),
    pixels: (source) => surfacePicture(source.key, source.surface, source.live),
    halo: (halo, source, pixelRatio, signal) => queue(() => haloCanvas(halo, source, pixelRatio), signal).catch(() => null),
  };
}
