import { cachePixelRatioFor } from "../paint";
import type { RasterSource, Scene, SceneNode, VideoSource } from "../scene/scene";

export const MAX_RASTER_RATIO = 4;
export const MAX_RASTER_SIDE = 4096;

export interface Viewport {
  width: number;
  height: number;
  resolution: number;
}

export interface Camera {
  scale: number;
  x: number;
  y: number;
}

export interface Renderer {
  readonly backend: string;
  readonly busy: boolean;
  resize(viewport: Viewport): void;
  render(scenes: readonly Scene[], camera: Camera): void;
  destroy(): void;
}

export type VideoPicture = HTMLVideoElement | VideoFrame;

export interface RenderSources {
  image(assetId: string): Promise<CanvasImageSource | null>;
  raster(source: RasterSource, pixelRatio: number): Promise<CanvasImageSource | null>;
  video(source: VideoSource): VideoPicture | null;
}

export function fitCamera(scene: Pick<Scene, "width">, viewport: Pick<Viewport, "width">): Camera {
  return { scale: scene.width > 0 ? viewport.width / scene.width : 1, x: 0, y: 0 };
}

export function rasterRatio(node: SceneNode, cameraScale: number, resolution: number): number {
  if (node.source.kind !== "raster") return 1;
  const stretch = node.source.widthPx > 0 ? node.box.width / node.source.widthPx : 1;
  const wanted = cachePixelRatioFor(cameraScale * Math.max(1, stretch), resolution, MAX_RASTER_RATIO);
  const side = Math.max(node.source.widthPx, node.source.heightPx);
  const fits = Math.max(0.25, Math.floor((MAX_RASTER_SIDE / side) * 4) / 4);
  return Math.min(wanted, fits);
}
