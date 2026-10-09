import type { Artboard, Clip, Crop, Filters, Gradient, Highlight, ImageDocument, Layer, Shadow, StudioDocument, Transform, VideoDocument } from "../document";
import { videoCanvasSize } from "../document";
import { KEYFRAME_PROPERTIES, type KeyframeProperty, type Keyframes } from "../keyframes";
import { clipEnd } from "../timeline";

export type OutlineDetail = "summary" | "full";

export interface OutlineAsset {
  name: string;
  type: string;
  durationMs?: number;
}

export interface OutlineJob {
  jobId: string;
  purpose: string;
  status: string;
  error?: string;
}

export interface OutlineLibraryItem {
  media_id: string;
  name: string;
  type: string;
}

export interface OutlineContext {
  detail: OutlineDetail;
  asset: (assetId: string) => OutlineAsset | undefined;
  playheadMs: number;
  selection: readonly string[];
  jobs: readonly OutlineJob[];
  library?: readonly OutlineLibraryItem[];
  icons?: readonly string[];
  changes?: DocumentChanges | null;
  activeArtboard?: string;
}

export interface DocumentChanges {
  added: string[];
  removed: string[];
  changed: string[];
}

interface OutlineBox {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  opacity?: number;
}

interface OutlineStyle {
  font_id?: string;
  font_size?: number;
  font_weight?: number;
  italic?: boolean;
  line_height?: number;
  letter_spacing?: number;
  fill?: string;
  gradient?: Gradient;
  stroke?: string;
  stroke_width?: number;
  dash?: boolean;
  align?: string;
  radius?: number;
  shadow?: Shadow;
  highlight?: Highlight;
  curve?: number;
  blend_mode?: string;
  frame?: string;
  clip?: boolean;
  flip_x?: boolean;
  flip_y?: boolean;
  filters?: Filters;
  crop?: Crop;
  icon_id?: string;
  path?: string;
  fill_rule?: string;
  line_cap?: string;
  line_join?: string;
  miter_limit?: number;
  dash_array?: number[];
  dash_offset?: number;
  points?: number;
  inner?: number;
  arrow_start?: boolean;
  arrow_end?: boolean;
}

export interface OutlineClip {
  id: string;
  type: Clip["type"];
  start_ms: number;
  duration_ms: number;
  end_ms: number;
  media?: string;
  media_id?: string;
  media_ms?: number;
  trim_in_ms?: number;
  text?: string;
  shape?: string;
  fit?: string;
  volume?: number;
  fade_in_ms?: number;
  fade_out_ms?: number;
  entrance?: string;
  exit?: string;
  animated?: string[];
  linked?: string;
  disabled?: boolean;
  blur?: number;
  box?: OutlineBox;
  style?: OutlineStyle;
  keyframes?: Record<string, { at_ms: number; value: number; easing: string }[]>;
}

export interface OutlineTrack {
  id: string;
  index: number;
  kind: "visual" | "audio";
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  muted?: boolean;
  clips: OutlineClip[];
}

export interface VideoOutline {
  kind: "video";
  aspect: string;
  size: string;
  background: string;
  duration_ms: number;
  playhead_ms: number;
  selection: string[];
  tracks: OutlineTrack[];
  markers: { id: string; at_ms: number; label?: string }[];
  icons?: readonly string[];
  jobs: readonly OutlineJob[];
  changes_by_user?: DocumentChanges;
  library?: readonly OutlineLibraryItem[];
}

export interface OutlineLayer {
  id: string;
  z: number;
  type: Layer["type"];
  name?: string;
  text?: string;
  shape?: string;
  media?: string;
  media_id?: string;
  group?: string;
  hidden?: boolean;
  locked?: boolean;
  box: OutlineBox;
  style?: OutlineStyle;
}

export interface OutlineArtboard {
  id: string;
  name?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  background: string;
  background_gradient?: Gradient;
  layers: OutlineLayer[];
  groups: { id: string; parent?: string; name?: string; base?: string }[];
}

export interface ImageOutline {
  kind: "image";
  active_artboard: string;
  selection: string[];
  artboards: OutlineArtboard[];
  icons?: readonly string[];
  jobs: readonly OutlineJob[];
  changes_by_user?: DocumentChanges;
  library?: readonly OutlineLibraryItem[];
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function boxOf(t: Transform): OutlineBox {
  return {
    x: round(t.x),
    y: round(t.y),
    w: round(t.w),
    h: round(t.h),
    ...(t.rotation ? { rotation: round(t.rotation) } : {}),
    ...(t.opacity !== 1 ? { opacity: round(t.opacity) } : {}),
  };
}

function styleOf(layer: Layer): OutlineStyle | undefined {
  const style: OutlineStyle = {
    ...(layer.fontId ? { font_id: layer.fontId } : {}),
    ...(layer.fontSize ? { font_size: round(layer.fontSize) } : {}),
    ...(layer.fontWeight ? { font_weight: layer.fontWeight } : {}),
    ...(layer.italic ? { italic: true } : {}),
    ...(layer.lineHeight ? { line_height: round(layer.lineHeight) } : {}),
    ...(layer.letterSpacing ? { letter_spacing: round(layer.letterSpacing) } : {}),
    ...(layer.fill ? { fill: layer.fill } : {}),
    ...(layer.gradient ? { gradient: layer.gradient } : {}),
    ...(layer.stroke && (layer.strokeWidth ?? 0) > 0 ? { stroke: layer.stroke, stroke_width: layer.strokeWidth } : {}),
    ...(layer.dash ? { dash: true } : {}),
    ...(layer.align ? { align: layer.align } : {}),
    ...(layer.radius ? { radius: round(layer.radius) } : {}),
    ...(layer.shadow ? { shadow: layer.shadow } : {}),
    ...(layer.highlight ? { highlight: layer.highlight } : {}),
    ...(layer.curve ? { curve: round(layer.curve) } : {}),
    ...(layer.blendMode ? { blend_mode: layer.blendMode } : {}),
    ...(layer.frame ? { frame: layer.frame } : {}),
    ...(layer.clip ? { clip: true } : {}),
    ...(layer.flipX ? { flip_x: true } : {}),
    ...(layer.flipY ? { flip_y: true } : {}),
    ...(layer.filters ? { filters: layer.filters } : {}),
    ...(layer.crop ? { crop: layer.crop } : {}),
    ...(layer.iconId ? { icon_id: layer.iconId } : {}),
    ...(layer.path ? { path: layer.path } : {}),
    ...(layer.fillRule ? { fill_rule: layer.fillRule } : {}),
    ...(layer.lineCap ? { line_cap: layer.lineCap } : {}),
    ...(layer.lineJoin ? { line_join: layer.lineJoin } : {}),
    ...(layer.miterLimit !== undefined ? { miter_limit: layer.miterLimit } : {}),
    ...(layer.dashArray && layer.dashArray.length > 0 ? { dash_array: layer.dashArray } : {}),
    ...(layer.dashOffset ? { dash_offset: layer.dashOffset } : {}),
    ...(layer.points !== undefined ? { points: layer.points } : {}),
    ...(layer.inner !== undefined ? { inner: round(layer.inner) } : {}),
    ...(layer.arrowStart ? { arrow_start: true } : {}),
    ...(layer.arrowEnd ? { arrow_end: true } : {}),
  };
  return Object.keys(style).length > 0 ? style : undefined;
}

function animatedProperties(k: Keyframes | undefined): KeyframeProperty[] | undefined {
  const present = KEYFRAME_PROPERTIES.filter((p) => (k?.[p] ?? []).length > 0);
  return present.length > 0 ? present : undefined;
}

function keyframesOf(k: Keyframes | undefined): OutlineClip["keyframes"] {
  const present = animatedProperties(k);
  if (!present) return undefined;
  return Object.fromEntries(present.map((p) => [p, k![p]!.map((f) => ({ at_ms: f.atMs, value: round(f.value), easing: f.easing }))]));
}

function motionName(motion: Clip["motionIn"], fadeMs: number): string | undefined {
  if (motion) return `slide ${motion.edge} ${motion.durationMs} ms`;
  return fadeMs > 0 ? `fade ${fadeMs} ms` : undefined;
}

export function outlineClip(clip: Clip, ctx: OutlineContext): OutlineClip {
  const asset = clip.assetId ? ctx.asset(clip.assetId) : undefined;
  const line: OutlineClip = {
    id: clip.id,
    type: clip.type,
    start_ms: clip.startMs,
    duration_ms: clip.durationMs,
    end_ms: clipEnd(clip),
    ...(clip.assetId ? { media_id: clip.assetId, media: asset?.name ?? "mídia" } : {}),
    ...(asset?.durationMs !== undefined && clip.type !== "image" ? { media_ms: asset.durationMs } : {}),
    ...(clip.trimInMs ? { trim_in_ms: clip.trimInMs } : {}),
    ...(clip.layer?.text ? { text: clip.layer.text } : {}),
    ...(clip.layer?.type === "shape" ? { shape: clip.layer.shape } : {}),
    ...(clip.type === "video" || clip.type === "image" ? { fit: clip.fit } : {}),
    ...(clip.volume !== 1 ? { volume: round(clip.volume) } : {}),
    ...(motionName(clip.motionIn, clip.fadeInMs) ? { entrance: motionName(clip.motionIn, clip.fadeInMs) } : {}),
    ...(motionName(clip.motionOut, clip.fadeOutMs) ? { exit: motionName(clip.motionOut, clip.fadeOutMs) } : {}),
    ...(animatedProperties(clip.keyframes) ? { animated: animatedProperties(clip.keyframes) } : {}),
    ...(clip.linkId ? { linked: clip.linkId } : {}),
    ...(clip.disabled ? { disabled: true } : {}),
    ...(clip.blur ? { blur: clip.blur } : {}),
  };
  if (ctx.detail === "full") {
    if (clip.type !== "audio") line.box = boxOf(clip.transform);
    if (clip.layer) line.style = styleOf(clip.layer);
    line.keyframes = keyframesOf(clip.keyframes);
  }
  return line;
}

export function videoOutline(doc: VideoDocument, ctx: OutlineContext): VideoOutline {
  const size = videoCanvasSize(doc);
  return {
    kind: "video",
    aspect: doc.canvas.aspect,
    size: `${size.width}x${size.height}`,
    background: doc.canvas.background,
    duration_ms: doc.durationMs,
    playhead_ms: Math.round(ctx.playheadMs),
    selection: [...ctx.selection],
    tracks: doc.tracks.map((track, index) => ({
      id: track.id,
      index,
      kind: track.kind,
      ...(track.name ? { name: track.name } : {}),
      ...(track.hidden ? { hidden: true } : {}),
      ...(track.locked ? { locked: true } : {}),
      ...(track.muted ? { muted: true } : {}),
      clips: track.clips.map((clip) => outlineClip(clip, ctx)),
    })),
    markers: (doc.markers ?? []).map((m) => ({ id: m.id, at_ms: m.atMs, ...(m.label ? { label: m.label } : {}) })),
    ...(ctx.detail === "full" && ctx.icons ? { icons: ctx.icons } : {}),
    jobs: ctx.jobs,
    ...(ctx.changes ? { changes_by_user: ctx.changes } : {}),
    ...(ctx.detail === "full" && ctx.library ? { library: ctx.library } : {}),
  };
}

export function outlineLayer(layer: Layer, z: number, ctx: OutlineContext): OutlineLayer {
  const asset = layer.assetId ? ctx.asset(layer.assetId) : undefined;
  return {
    id: layer.id,
    z,
    type: layer.type,
    ...(layer.name ? { name: layer.name } : {}),
    ...(layer.text ? { text: layer.text } : {}),
    ...(layer.type === "shape" ? { shape: layer.shape } : {}),
    ...(layer.assetId ? { media_id: layer.assetId, media: asset?.name ?? "imagem" } : {}),
    ...(layer.groupId ? { group: layer.groupId } : {}),
    ...(layer.hidden ? { hidden: true } : {}),
    ...(layer.locked ? { locked: true } : {}),
    box: boxOf(layer.transform),
    ...(ctx.detail === "full" && styleOf(layer) ? { style: styleOf(layer) } : {}),
  };
}

function outlineArtboard(a: Artboard, ctx: OutlineContext): OutlineArtboard {
  return {
    id: a.id,
    ...(a.name ? { name: a.name } : {}),
    width: a.canvas.width,
    height: a.canvas.height,
    x: a.x,
    y: a.y,
    background: a.canvas.background,
    ...(a.canvas.gradient ? { background_gradient: a.canvas.gradient } : {}),
    layers: a.layers.map((layer, z) => outlineLayer(layer, z, ctx)),
    groups: (a.groups ?? []).map((g) => ({ id: g.id, ...(g.parentId ? { parent: g.parentId } : {}), ...(g.name ? { name: g.name } : {}), ...(g.baseId ? { base: g.baseId } : {}) })),
  };
}

export function imageOutline(doc: ImageDocument, ctx: OutlineContext): ImageOutline {
  const active = doc.artboards.find((a) => a.id === ctx.activeArtboard) ?? doc.artboards[0];
  return {
    kind: "image",
    active_artboard: active.id,
    selection: [...ctx.selection],
    artboards: doc.artboards.map((a) => outlineArtboard(a, ctx)),
    ...(ctx.detail === "full" && ctx.icons ? { icons: ctx.icons } : {}),
    jobs: ctx.jobs,
    ...(ctx.changes ? { changes_by_user: ctx.changes } : {}),
    ...(ctx.detail === "full" && ctx.library ? { library: ctx.library } : {}),
  };
}

function artboardItems(a: Artboard): [string, string][] {
  const { layers, ...frame } = a;
  return [[a.id, JSON.stringify(frame)], ...layers.map((l): [string, string] => [l.id, JSON.stringify(l)])];
}

function items(doc: StudioDocument): Map<string, string> {
  const entries: [string, string][] = "tracks" in doc ? doc.tracks.flatMap((t) => t.clips.map((c): [string, string] => [c.id, JSON.stringify(c)])) : doc.artboards.flatMap(artboardItems);
  return new Map(entries);
}

export function documentChanges(before: StudioDocument, after: StudioDocument): DocumentChanges | null {
  const old = items(before);
  const current = items(after);
  const added = [...current.keys()].filter((id) => !old.has(id));
  const removed = [...old.keys()].filter((id) => !current.has(id));
  const changed = [...current.keys()].filter((id) => old.has(id) && old.get(id) !== current.get(id));
  return added.length + removed.length + changed.length === 0 ? null : { added, removed, changed };
}
