import type { BlendMode, Fit, Gradient, Layer } from "../document";
import type { ColorGrade } from "../color-grade";
import type { ChromaKey } from "../chroma-key";
import type { LumaKey } from "../luma-key";
import type { Matte } from "../matte";
import type { Mask } from "../masks";
import type { GradientMap } from "../gradient-map";
import type { PixelSurface, StrokeOp } from "../pixel-surface";
import type { ResolvedLine } from "../line-animation";
import type { RevealField } from "../reveal-field";
import type { TextMotion } from "../text-animation";
import type { VfxLook } from "../vfx";
import type { GlyphRun } from "../glyph-layout";
import type { RunStyle } from "../text-runs";
import type { ColorMatrix } from "./color-matrix";
import type { FrameWindow } from "../point-track";
import type { PaintPlan } from "./paint-mix";
import type { HaloNode } from "../media-halo";
import type { Homography, Lens } from "../perspective";

export interface SceneBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface SceneField {
  field: RevealField;
  progress: number;
  softness: number;
}

export interface SceneReveal {
  box: SceneBox;
  polygon?: readonly number[];
  field?: SceneField;
  inverse: boolean;
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
  speed: number;
  backward: boolean;
  window?: FrameWindow;
  frameMix?: boolean;
}

export interface RasterSource {
  kind: "raster";
  key: string;
  layer: Layer;
  widthPx: number;
  heightPx: number;
  fontBasePx: number;
}

export interface EffectSource {
  kind: "effect";
}

export interface GroupSource {
  kind: "group";
  scene: Scene;
}

export interface GlyphsSource {
  kind: "glyphs";
  key: string;
  layer: Layer;
  cells: readonly string[];
  styles?: readonly RunStyle[];
  fontBasePx: number;
  padPx: number;
  backdrop?: { width: number; height: number };
}

export interface GlyphPart {
  source: GlyphsSource;
  weight: number;
}

export interface GlyphNode {
  parts: readonly GlyphPart[];
  run: GlyphRun;
  plan?: PaintPlan;
  frame: { width: number; height: number };
}

export interface PixelsSource {
  kind: "pixels";
  key: string;
  surface: PixelSurface;
  live: StrokeOp | null;
}

export interface SceneTrail {
  box: SceneBox;
  maps: readonly number[];
}

export interface SceneTilt {
  matrix: Homography;
  width: number;
  height: number;
}

export interface PixelMaskNode {
  source: PixelsSource;
  rect: { x: number; y: number; width: number; height: number };
  flipX: boolean;
  flipY: boolean;
}

export type SceneSource = ImageSource | VideoSource | RasterSource | EffectSource | PixelsSource | GlyphsSource | GroupSource;

export interface MixPart {
  source: RasterSource;
  weight: number;
}

export type SceneFit = Fit | "fill";

export interface LineNode {
  key: string;
  layer: Layer;
  resolved: ResolvedLine;
  color: string;
  step: number;
  fill: boolean;
}

export interface SceneNode {
  id: string;
  live?: boolean;
  source: SceneSource;
  box: SceneBox;
  fit: SceneFit;
  opacity: number;
  visible: boolean;
  blend?: BlendMode;
  colorMatrix?: ColorMatrix;
  blurPx?: number;
  clipOf?: string;
  clipMatte?: Matte;
  mix?: readonly MixPart[];
  textPaint?: PaintPlan;
  reveal?: SceneReveal;
  text?: TextMotion;
  grade?: ColorGrade;
  chroma?: ChromaKey;
  lumaKey?: LumaKey;
  keyMatte?: boolean;
  clipMasks?: readonly Mask[];
  gradientMap?: GradientMap;
  vfx?: readonly VfxLook[];
  vfxFrame?: SceneBox;
  line?: LineNode;
  fitBox?: { width: number; height: number };
  flipX?: boolean;
  flipY?: boolean;
  pixelMask?: PixelMaskNode;
  glyphs?: GlyphNode;
  trail?: SceneTrail;
  camera?: SceneTrail;
  halo?: HaloNode;
  tilt?: SceneTilt;
  lens?: Lens;
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
  return scene.nodes.flatMap((node): SceneVideo[] => {
    if (node.source.kind === "group") return videoSources(node.source.scene).map((video) => ({ ...video, visible: video.visible && node.visible && node.opacity > 0 }));
    return node.source.kind === "video" ? [{ source: node.source, visible: node.visible }] : [];
  });
}
