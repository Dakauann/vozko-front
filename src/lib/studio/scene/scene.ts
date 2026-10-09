import type { BlendMode, Fit, Gradient, Layer } from "../document";
import type { ColorMatrix } from "./color-matrix";

export interface SceneBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface ImageSource {
  kind: "image";
  assetId: string;
}

export interface VideoSource {
  kind: "video";
  clipId: string;
  assetId: string;
  sourceMs: number;
}

export interface RasterSource {
  kind: "raster";
  key: string;
  layer: Layer;
  widthPx: number;
  heightPx: number;
  fontBasePx: number;
}

export type SceneSource = ImageSource | VideoSource | RasterSource;

export type SceneFit = Fit | "fill";

export interface SceneNode {
  id: string;
  source: SceneSource;
  box: SceneBox;
  fit: SceneFit;
  opacity: number;
  visible: boolean;
  blend?: BlendMode;
  colorMatrix?: ColorMatrix;
  blurPx?: number;
  clipOf?: string;
}

export interface Scene {
  width: number;
  height: number;
  background: string;
  gradient?: Gradient;
  artboard?: boolean;
  key?: string;
  origin?: { x: number; y: number };
  nodes: SceneNode[];
}

export interface SceneVideo {
  source: VideoSource;
  visible: boolean;
}

export function videoSources(scene: Scene): SceneVideo[] {
  return scene.nodes.flatMap((node) => (node.source.kind === "video" ? [{ source: node.source, visible: node.visible }] : []));
}
