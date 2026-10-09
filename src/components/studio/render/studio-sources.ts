"use client";

import type { RenderSources } from "@/lib/studio/render/renderer";

import { loadAssetImage } from "../canvas/asset-images";
import { rasterizeLayerCanvas } from "../canvas/rasterize";
import type { VideoPictures } from "./video-feed";

const RASTER_CONCURRENCY = 3;

function limiter(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        active += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            waiting.shift()?.();
          });
      };
      if (active < limit) run();
      else waiting.push(run);
    });
}

export function studioRenderSources(videos: VideoPictures | null): RenderSources {
  const queue = limiter(RASTER_CONCURRENCY);
  return {
    image: (assetId) => loadAssetImage(assetId).catch(() => null),
    raster: (source, pixelRatio) =>
      queue(() => rasterizeLayerCanvas(source.layer, source.widthPx, source.heightPx, { fontBasePx: source.fontBasePx, pixelRatio })).catch(() => null),
    video: (source) => videos?.picture(source.clipId) ?? null,
  };
}
