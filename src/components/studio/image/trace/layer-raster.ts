import { loadAssetImage } from "@/components/studio/canvas/asset-images";
import type { Layer } from "@/lib/studio/document";
import type { RasterImage } from "@/lib/studio/trace/trace";

export const TRACE_MAX_SIDE = 1024;

export async function layerRaster(layer: Layer, maxSide: number = TRACE_MAX_SIDE): Promise<RasterImage | null> {
  if (layer.type !== "image" || !layer.assetId) return null;
  try {
    const image = await loadAssetImage(layer.assetId);
    const crop = layer.crop ?? { x: 0, y: 0, w: 1, h: 1 };
    const sourceWidth = crop.w * image.naturalWidth;
    const sourceHeight = crop.h * image.naturalHeight;
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    const context = surface.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.translate(layer.flipX ? width : 0, layer.flipY ? height : 0);
    context.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
    context.drawImage(image, crop.x * image.naturalWidth, crop.y * image.naturalHeight, sourceWidth, sourceHeight, 0, 0, width, height);
    return { width, height, data: context.getImageData(0, 0, width, height).data };
  } catch {
    return null;
  }
}
