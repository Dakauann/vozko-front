import { cachePixelRatioFor } from "../paint";
import type { FramePlacement } from "../viewport";
import type { GlyphsSource, PixelsSource, RasterSource, Scene, SceneNode, VideoSource } from "../scene/scene";
import type { GlyphSheet } from "../glyph-layout";
import type { LaidLine } from "../text-animation";
import type { LutAtlas } from "../cube-lut";
import type { HaloNode, SourceSize } from "../media-halo";

const MAX_RASTER_RATIO = 4;
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
  readonly missingLuts: ReadonlySet<string>;
  resize(viewport: Viewport): void;
  render(scenes: readonly Scene[], camera: Camera): void;
  destroy(): void;
}

export type VideoPicture = HTMLVideoElement | VideoFrame;

export interface VideoBlend {
  picture: VideoPicture;
  weight: number;
}

export interface RenderSources {
  image(assetId: string): Promise<CanvasImageSource | null>;
  releaseImage(assetId: string): void;
  raster(source: RasterSource, pixelRatio: number, signal: AbortSignal): Promise<CanvasImageSource | null>;
  textLayout(source: RasterSource): Promise<LaidLine[] | null>;
  glyphs(source: GlyphsSource, pixelRatio: number, signal: AbortSignal): Promise<GlyphSheetPicture | null>;
  video(source: VideoSource): VideoPicture | null;
  videoBlend(source: VideoSource): VideoBlend | null;
  lut(assetId: string): Promise<LutAtlas | null>;
  pixels(source: PixelsSource): PixelsPicture | null;
  halo(halo: HaloNode, source: SourceSize | null, pixelRatio: number, signal: AbortSignal): Promise<CanvasImageSource | null>;
}

export interface GlyphSheetPicture {
  image: CanvasImageSource;
  sheet: GlyphSheet;
}

export interface PixelsPicture {
  canvas: HTMLCanvasElement;
  version: number;
}

export function frameCamera(scene: Pick<Scene, "width">, placement: FramePlacement): Camera {
  return { scale: scene.width > 0 ? placement.frame.width / scene.width : 1, x: -placement.visible.left, y: -placement.visible.top };
}

export function fitCamera(scene: Pick<Scene, "width">, viewport: Pick<Viewport, "width">): Camera {
  return { scale: scene.width > 0 ? viewport.width / scene.width : 1, x: 0, y: 0 };
}

export function rasterRatio(node: SceneNode, cameraScale: number, resolution: number): number {
  if (node.glyphs) {
    const stretch = node.glyphs.frame.width > 0 ? node.box.width / node.glyphs.frame.width : 1;
    return cachePixelRatioFor(cameraScale * Math.max(1, stretch), resolution, MAX_RASTER_RATIO);
  }
  if (node.source.kind !== "raster") return 1;
  const stretch = node.source.widthPx > 0 ? node.box.width / node.source.widthPx : 1;
  const wanted = cachePixelRatioFor(cameraScale * Math.max(1, stretch), resolution, MAX_RASTER_RATIO);
  return fittedRatio({ width: node.source.widthPx, height: node.source.heightPx }, wanted);
}

export function haloRatio(node: SceneNode, halo: HaloNode, cameraScale: number, resolution: number): number {
  const stretch = halo.base.width > 0 ? node.box.width / halo.base.width : 1;
  const wanted = cachePixelRatioFor(cameraScale * Math.max(1, stretch), resolution, MAX_RASTER_RATIO);
  return fittedRatio({ width: halo.base.width + 2 * halo.padPx, height: halo.base.height + 2 * halo.padPx }, wanted);
}

export function fittedRatio(size: { width: number; height: number }, wanted: number): number {
  const side = Math.max(size.width, size.height, 1);
  return Math.min(wanted, Math.max(0.25, Math.floor((MAX_RASTER_SIDE / side) * 4) / 4));
}
