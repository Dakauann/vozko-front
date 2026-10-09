import { IMAGE_ASPECTS, type ClipFit, type ImageAspect, type NormalizedTransform } from "@/lib/media-generation/types";

import type { Keyframes } from "./keyframes";

import { DEFAULT_FONT_ID, type FontId } from "./fonts";

export const IMAGE_SCHEMA = "studio.image";
export const VIDEO_SCHEMA = "studio.video";
export const DOCUMENT_VERSION = 1;
export const IMAGE_DOCUMENT_VERSION = 2;

export const STUDIO_LIMITS = {
  maxDocumentBytes: 2 * 1024 * 1024,
  minCanvasSide: 100,
  maxCanvasSide: 4096,
  maxVideoMs: 90_000,
  minClipMs: 100,
  maxVolume: 2,
  maxTextRunes: 2000,
  maxTokenRunes: 64,
  maxLayerNameRunes: 128,
  maxProjectNameRunes: 120,
  maxMarkers: 50,
  maxMarkerLabelRunes: 64,
  maxArtboardCoordinate: 100_000,
} as const;

export const FRAMES_PER_SECOND = 30;

export function frameOf(ms: number): number {
  return Math.round((ms * FRAMES_PER_SECOND) / 1000);
}

export function msOfFrame(frame: number): number {
  return Math.round((frame * 1000) / FRAMES_PER_SECOND);
}

export function quantizeMs(ms: number): number {
  return msOfFrame(frameOf(ms));
}

export type StudioKind = "image" | "video";

export type Transform = NormalizedTransform;

export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Filters {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
}

export interface Shadow {
  color: string;
  blur: number;
  x: number;
  y: number;
}

export const GRADIENT_KINDS = ["linear", "radial"] as const;

export type GradientKind = (typeof GRADIENT_KINDS)[number];

export interface Gradient {
  from: string;
  to: string;
  angle: number;
  kind?: GradientKind | "";
  via?: string;
  cx?: number;
  cy?: number;
  radius?: number;
}

export const RADIAL_RADIUS_RANGE = [0.05, 2] as const;

export const CENTERED_RADIAL = { cx: 0.5, cy: 0.5, radius: 1 } as const;

export interface Highlight {
  color: string;
  radius: number;
}

export const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
] as const;

export type BlendMode = (typeof BLEND_MODES)[number];

export const FRAME_KINDS = ["ellipse", "triangle", "star"] as const;

export type FrameKind = (typeof FRAME_KINDS)[number];

export interface StudioGroup {
  id: string;
  parentId?: string;
  name?: string;
  baseId?: string;
}

export type LayerType = "image" | "text" | "shape" | "icon";

export const SHAPE_KINDS = ["rect", "ellipse", "line", "arrow", "triangle", "star", "path"] as const;

export const STAR_DEFAULTS = { points: 5, inner: 0.45 } as const;

export const FILL_RULES = ["nonzero", "evenodd"] as const;

export const LINE_CAPS = ["butt", "round", "square"] as const;

export type LineCap = (typeof LINE_CAPS)[number];

export const LINE_JOINS = ["miter", "round", "bevel"] as const;

export type LineJoin = (typeof LINE_JOINS)[number];

export const MAX_DASH_VALUES = 8;

export type FillRule = (typeof FILL_RULES)[number];

export type ShapeKind = (typeof SHAPE_KINDS)[number];

export type TextAlign = "left" | "center" | "right";

export interface Layer {
  id: string;
  type: LayerType;
  name?: string;
  transform: Transform;
  hidden?: boolean;
  locked?: boolean;
  groupId?: string;
  assetId?: string;
  crop?: Crop;
  flipX?: boolean;
  flipY?: boolean;
  radius?: number;
  filters?: Filters;
  text?: string;
  fontId?: FontId;
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  align?: TextAlign;
  lineHeight?: number;
  letterSpacing?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: boolean;
  shadow?: Shadow;
  shape?: ShapeKind;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  iconId?: string;
  blendMode?: BlendMode;
  clip?: boolean;
  gradient?: Gradient;
  highlight?: Highlight;
  curve?: number;
  frame?: FrameKind;
  path?: string;
  fillRule?: FillRule;
  lineCap?: LineCap;
  lineJoin?: LineJoin;
  miterLimit?: number;
  dashArray?: number[];
  dashOffset?: number;
  points?: number;
  inner?: number;
}

export interface ImageCanvas {
  width: number;
  height: number;
  background: string;
  gradient?: Gradient;
}

export interface ImageSurface {
  canvas: ImageCanvas;
  layers: Layer[];
  groups?: StudioGroup[];
}

export interface Artboard extends ImageSurface {
  id: string;
  name?: string;
  x: number;
  y: number;
}

export interface ImageDocument {
  schema: typeof IMAGE_SCHEMA;
  version: typeof IMAGE_DOCUMENT_VERSION;
  artboards: Artboard[];
}

export interface LegacyImageDocument extends ImageSurface {
  schema: typeof IMAGE_SCHEMA;
  version: typeof DOCUMENT_VERSION;
}

export type TrackKind = "visual" | "audio";

export type ClipType = "video" | "image" | "overlay" | "audio";

export type VideoAspect = ImageAspect;

export type Fit = ClipFit;

export interface Clip {
  id: string;
  type: ClipType;
  assetId?: string;
  startMs: number;
  durationMs: number;
  trimInMs: number;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
  fit?: Fit;
  transform: Transform;
  layer?: Layer;
  linkId?: string;
  motionIn?: Motion;
  motionOut?: Motion;
  keyframes?: Keyframes;
  disabled?: boolean;
}

export const MOTION_EDGES = ["left", "right", "top", "bottom"] as const;

export type MotionEdge = (typeof MOTION_EDGES)[number];

export const MOTION_DISTANCE = 0.2;

export interface Motion {
  edge: MotionEdge;
  durationMs: number;
}

export interface Marker {
  id: string;
  atMs: number;
  label?: string;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  muted?: boolean;
  clips: Clip[];
}

export interface VideoCanvas {
  aspect: VideoAspect;
  background: string;
}

export interface VideoDocument {
  schema: typeof VIDEO_SCHEMA;
  version: typeof DOCUMENT_VERSION;
  canvas: VideoCanvas;
  durationMs: number;
  tracks: Track[];
  markers?: Marker[];
}

export type StudioDocument = ImageDocument | VideoDocument;

export type DocumentOf<K extends StudioKind> = K extends "image" ? ImageDocument : VideoDocument;

export interface CanvasSize {
  width: number;
  height: number;
}

export const IMAGE_PRESETS = [
  { id: "instagram_post", width: 1080, height: 1080 },
  { id: "instagram_portrait", width: 1080, height: 1350 },
  { id: "instagram_story", width: 1080, height: 1920 },
  { id: "facebook_link", width: 1200, height: 628 },
  { id: "youtube_thumbnail", width: 1280, height: 720 },
  { id: "presentation", width: 1920, height: 1080 },
  { id: "x_post", width: 1600, height: 900 },
  { id: "pinterest_pin", width: 1000, height: 1500 },
  { id: "facebook_cover", width: 1640, height: 624 },
  { id: "linkedin_banner", width: 1584, height: 396 },
  { id: "flyer_a4", width: 2480, height: 3508 },
] as const satisfies readonly (CanvasSize & { id: string })[];

export type ImagePresetId = (typeof IMAGE_PRESETS)[number]["id"];

export interface ImagePreset extends CanvasSize {
  id: ImagePresetId;
}

export const VIDEO_ASPECTS: readonly VideoAspect[] = IMAGE_ASPECTS;

export const VIDEO_ASPECT_SIZES: Record<VideoAspect, CanvasSize> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
};

export const DEFAULT_IMAGE_BACKGROUND = "#ffffff";
export const DEFAULT_VIDEO_BACKGROUND = "#000000";

export function newStudioId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function fullFrame(): Transform {
  return { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 };
}

export function emptyArtboard(size: CanvasSize, background: string = DEFAULT_IMAGE_BACKGROUND): Artboard {
  return { id: newStudioId("artboard"), x: 0, y: 0, canvas: { width: size.width, height: size.height, background }, layers: [] };
}

export function imageDocument(artboards: Artboard[]): ImageDocument {
  return { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards };
}

export function emptyImageDocument(size: CanvasSize, background: string = DEFAULT_IMAGE_BACKGROUND): ImageDocument {
  return imageDocument([emptyArtboard(size, background)]);
}

export function emptyVideoDocument(aspect: VideoAspect, background: string = DEFAULT_VIDEO_BACKGROUND): VideoDocument {
  return {
    schema: VIDEO_SCHEMA,
    version: DOCUMENT_VERSION,
    canvas: { aspect, background },
    durationMs: 0,
    tracks: [
      { id: newStudioId("t"), kind: "visual", clips: [] },
      { id: newStudioId("t"), kind: "visual", clips: [] },
      { id: newStudioId("t"), kind: "audio", clips: [] },
    ],
  };
}

export function videoCanvasSize(doc: VideoDocument): CanvasSize {
  return VIDEO_ASPECT_SIZES[doc.canvas.aspect];
}

function centered(w: number, h: number): Transform {
  return { x: 0.5, y: 0.5, w, h, rotation: 0, opacity: 1 };
}

export const TEXT_PRESETS = {
  heading: { fontSize: 0.08, fontWeight: 700 },
  subheading: { fontSize: 0.05, fontWeight: 600 },
  body: { fontSize: 0.032, fontWeight: 400 },
} as const;

export type TextPreset = keyof typeof TEXT_PRESETS;

export function newTextLayer(text: string, preset: TextPreset = "body", transform: Transform = centered(0.8, 0.12)): Layer {
  const style = TEXT_PRESETS[preset];
  return {
    id: newStudioId("l"),
    type: "text",
    transform,
    text,
    fontId: DEFAULT_FONT_ID,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    align: "center",
    lineHeight: 1.2,
    fill: "#111111",
  };
}

export function newShapeLayer(shape: Exclude<ShapeKind, "path">, transform: Transform = centered(0.3, 0.3)): Layer {
  const stroked = shape === "line" || shape === "arrow";
  return {
    id: newStudioId("l"),
    type: "shape",
    shape,
    transform: stroked ? { ...transform, h: Math.min(transform.h, 0.05) } : transform,
    ...(stroked ? { stroke: "#111111", strokeWidth: 8, arrowEnd: shape === "arrow" } : { fill: "#3b82f6" }),
  };
}

export function newPathLayer(path: string, transform: Transform = centered(0.3, 0.3), open = false): Layer {
  return { id: newStudioId("l"), type: "shape", shape: "path", path, transform, ...(open ? { stroke: "#111111", strokeWidth: 8 } : { fill: "#3b82f6" }) };
}

export function newImageLayer(assetId: string, transform: Transform = centered(0.6, 0.6)): Layer {
  return { id: newStudioId("l"), type: "image", assetId, transform };
}

export function newIconLayer(iconId: string, fill: string = "#111111", transform: Transform = centered(0.2, 0.2)): Layer {
  return { id: newStudioId("l"), type: "icon", iconId, fill, transform };
}

export function newMediaClip(type: "video" | "image" | "audio", assetId: string, startMs: number, durationMs: number): Clip {
  return {
    id: newStudioId("c"),
    type,
    assetId,
    startMs: Math.round(startMs),
    durationMs: Math.round(durationMs),
    trimInMs: 0,
    volume: 1,
    fadeInMs: 0,
    fadeOutMs: 0,
    ...(type === "audio" ? {} : { fit: "cover" as const }),
    transform: fullFrame(),
  };
}

export function newOverlayClip(layer: Layer, startMs: number, durationMs: number, transform: Transform = centered(0.8, 0.2)): Clip {
  return {
    id: newStudioId("c"),
    type: "overlay",
    startMs: Math.round(startMs),
    durationMs: Math.round(durationMs),
    trimInMs: 0,
    volume: 1,
    fadeInMs: 0,
    fadeOutMs: 0,
    transform,
    layer: { ...layer, transform: fullFrame() },
  };
}

export function documentBytes(doc: StudioDocument): number {
  return new TextEncoder().encode(JSON.stringify(doc)).length;
}
