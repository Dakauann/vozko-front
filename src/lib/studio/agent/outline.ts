import { clipOrganizeOutline, markerOutline, trackOrganizeOutline, type OutlineMarker } from "./organize-ops";
import type { LabelColor } from "../labels";
import type { Artboard, Clip, Crop, Filters, Gradient, Highlight, ImageDocument, ImageSurface, Layer, Shadow, StudioDocument, Track, Transform, VideoDocument } from "../document";
import { videoCanvasSize } from "../document";
import { imageSourcesOf, soleSource } from "../image-sources";
import { animatedProperties, colorFramesOf, isColorProperty, isPathProperty, morphFramesOf, pathFramesOf, timedFramesOf, type AnimatedProperty, type Keyframe, type Keyframes } from "../keyframes";
import { peakSpeed } from "../graph-editor";
import { keyVelocity, type SideVelocity } from "../keyframe-ease";
import type { SpatialMode } from "../path-keys";
import { isMorphProperty, type MorphKeyframe } from "../morph-keys";
import { vertexIndex } from "../path-morph";
import { clipStyleOutline } from "./clip-style-ops";
import { clipEnd } from "../timeline";
import { clipEdgesPx, hasFrame } from "../frame-layout";
import { clipLookup, type ClipLookup } from "../parenting";
import { groupContentMs, groupTimeline, isGroupClip, nestedClips, type GroupClip } from "../group-scope";
import { shutterOf } from "../motion-blur";
import { carriesTilt, perspectiveOf } from "../clip-tilt";
import { turnsInDepth } from "../text-selectors";
import { transitionWindow } from "../transitions";
import { edgeOptionsOf, type ClipTransition } from "../edge-transitions";
import { agentOptions } from "./transition-ops";
import { agentGrade, type AgentGradeOutline } from "./color-op";
import { hasSpeedCurve, sourceSpanMs } from "../clip-time";
import { isSmoothCurve, speedCurvePoints } from "../speed-curve";
import type { ChromaKey } from "../chroma-key";
import type { LumaKey } from "../luma-key";
import type { Mask } from "../masks";
import { paramSpec, vfxColor, vfxColors, vfxParams, type Vfx, type VfxParam } from "../vfx";
import { stillParams } from "../still-vfx";
import type { TextAnimator } from "../text-animation";
import { agentGradientMap, agentPaintOf, type AgentPaintOutline } from "./paint-ops";
import { agentRepeat, type AgentRepeat } from "./repeat-ops";
import { outlinePixels, type OutlinePixels } from "./pixel-ops";
import { lineOutline, type OutlineLine } from "./line-ops";
import { agentPathOp, type AgentPathOp } from "./path-op-ops";
import { agentClipRepeat, type AgentClipRepeat } from "./clip-repeat-ops";
import type { PathOp } from "../path-ops";
import type { ClipRepeat } from "../clip-repeat";
import { counterOutline, textPathOutline, type OutlineCounter, type OutlineTextPath } from "./text-ops";
import { chartAnimationOutline, chartOutline, type OutlineChart, type OutlineChartAnimation } from "./chart-ops";
import { tableOutline, type OutlineTable } from "./table-ops";
import { qrOutline, type OutlineQr } from "./qr-ops";
import { textAnimatorOutline, type OutlineTextAnimator } from "./text-animator-ops";
import { agentOverrides, componentUses, outlineParts, type AgentOverride, type OutlinePart } from "./component-ops";
import { layerStyleLinks, outlineStyles, type OutlineStyleEntry } from "./style-ops";
import { outlineLayout, type OutlineLayout } from "./auto-layout-ops";
import type { LayoutItem } from "../auto-layout";
import type { LayerSlot } from "../shared-styles";
import { clipRunText } from "../text-runs";
import { runsOutline, type OutlineRun } from "./text-run-ops";
import { stabilizeOutline, trackersOutline, type OutlineStabilize, type OutlineTracker } from "./track-ops";
import { behaviorOutline, type OutlineBehavior } from "./behavior-ops";

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
  trackLoudness?: (trackId: string) => number | null;
  frame?: { width: number; height: number };
  parents?: ClipLookup;
  timeline?: VideoDocument;
}

interface OutlineGroup {
  name?: string;
  content_ms: number;
  tracks: OutlineTrack[];
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

interface OutlineStyle extends AgentPaintOutline {
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
  color_grade?: AgentGradeOutline;
  chroma_key?: OutlineChroma;
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
  arrow_start_kind?: string;
  arrow_end_kind?: string;
}

interface OutlineClip {
  id: string;
  type: Clip["type"];
  name?: string;
  label_color?: LabelColor;
  guide?: boolean;
  markers?: OutlineMarker[];
  start_ms: number;
  duration_ms: number;
  end_ms: number;
  media?: string;
  media_id?: string;
  media_ms?: number;
  trim_in_ms?: number;
  runs?: OutlineRun[];
  text?: string;
  shape?: string;
  fit?: string;
  volume?: number;
  pan?: number;
  fade_in_ms?: number;
  fade_out_ms?: number;
  entrance?: string;
  exit?: string;
  transition_in?: OutlineEdgeTransition;
  transition_out?: OutlineEdgeTransition;
  animated?: string[];
  linked?: string;
  disabled?: boolean;
  blur?: number;
  speed?: number;
  speed_curve?: OutlineSpeedCurve;
  frame_mix?: boolean;
  color_grade?: AgentGradeOutline;
  gradient_map?: AgentPaintOutline["gradient_map"];
  reverse?: boolean;
  freeze?: boolean;
  preserve_pitch?: boolean;
  text_in?: OutlineTextAnimation;
  text_out?: OutlineTextAnimation;
  text_animators?: OutlineTextAnimator[];
  box?: OutlineBox;
  edges_px?: { left: number; top: number; right: number; bottom: number };
  style?: OutlineStyle;
  keyframes?: Record<string, OutlineKey[]>;
  masks?: OutlineMask[];
  effects?: ReturnType<typeof clipStyleOutline>["effects"];
  strokes?: ReturnType<typeof clipStyleOutline>["strokes"];
  matte?: boolean;
  matte_channel?: "luma";
  matte_invert?: boolean;
  blend_mode?: string;
  line?: OutlineLine;
  path_ops?: OutlinePathOp[];
  repeat?: OutlineClipRepeat;
  counter?: OutlineCounter;
  text_path?: OutlineTextPath;
  anchor?: { x: number; y: number };
  flip_x?: boolean;
  flip_y?: boolean;
  auto_orient?: boolean;
  motion_blur?: boolean;
  rotation_x?: number;
  rotation_y?: number;
  camera?: { pan_x: number; pan_y: number; zoom: number; rotation: number };
  chroma_key?: OutlineChroma;
  luma_key?: OutlineLuma;
  vfx?: OutlineVfx[];
  strength?: number;
  parent?: string;
  behaviors?: OutlineBehavior[];
  parent_tracker?: string;
  trackers?: OutlineTracker[];
  stabilize?: OutlineStabilize;
  group?: OutlineGroup;
  chart?: OutlineChart;
  chart_animation?: OutlineChartAnimation;
  table?: OutlineTable;
  qr?: OutlineQr;
}

interface OutlineVfx {
  id: string;
  kind: Vfx["kind"];
  seed: number;
  hidden?: boolean;
  offset_ms?: number;
  track_id?: string;
  params: Record<string, number>;
  colors?: Record<string, string>;
  animated?: string[];
  keyframes?: Record<string, { at_ms: number; value: number; easing: string }[]>;
}

interface OutlineChroma {
  color: string;
  similarity: number;
  smoothness: number;
  spill: number;
  animated?: string[];
  keyframes?: Record<string, { at_ms: number; value: number; easing: string }[]>;
}

interface OutlineLuma {
  mode: LumaKey["mode"];
  threshold: number;
  softness: number;
  animated?: string[];
  keyframes?: Record<string, { at_ms: number; value: number; easing: string }[]>;
}

interface OutlineMask {
  id: string;
  shape: Mask["shape"];
  mode: Mask["mode"];
  invert?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  feather: number;
  expansion: number;
  opacity: number;
  roundness?: number;
  points?: number;
  inner?: number;
  path?: string;
  animated?: string[];
  keyframes?: Record<string, ({ at_ms: number; value: number; easing: string } | OutlineMorphFrame)[]>;
}

type OutlineMorphFrame = { at_ms: number; easing: string } & OutlineMorphKey;

interface OutlineTextAnimation {
  unit: TextAnimator["unit"];
  text_style: TextAnimator["style"];
  duration_ms: number;
  stagger_ms: number;
  easing: string;
}

function textAnimationOf(animator: TextAnimator): OutlineTextAnimation {
  return { unit: animator.unit, text_style: animator.style, duration_ms: animator.durationMs, stagger_ms: animator.staggerMs, easing: animator.easing };
}

interface OutlineTrack {
  id: string;
  index: number;
  kind: "visual" | "audio";
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  muted?: boolean;
  gain_db?: number;
  pan?: number;
  loudness_lufs?: number;
  ducking?: OutlineDucking;
  label_color?: LabelColor;
  shy?: boolean;
  clips: OutlineClip[];
  transitions?: OutlineTransition[];
}

interface OutlineDucking {
  trigger_track_ids: string[];
  reduce_db: number;
  attack_ms: number;
  release_ms: number;
  hold_ms: number;
  sensitivity: number;
}

interface OutlineTransition {
  id: string;
  from: string;
  to: string;
  kind: string;
  duration_ms: number;
  window_ms: [number, number];
  alignment: string;
  easing: string;
  options?: Record<string, string | number | boolean>;
}

interface OutlineEdgeTransition {
  kind: string;
  duration_ms: number;
  easing: string;
  options?: Record<string, string | number | boolean>;
}

function outlineEdge(transition: ClipTransition): OutlineEdgeTransition {
  const options = agentOptions(transition, edgeOptionsOf(transition.kind));
  return { kind: transition.kind, duration_ms: transition.durationMs, easing: transition.easing, ...(Object.keys(options).length > 0 ? { options } : {}) };
}

function outlineTransitions(track: Track): OutlineTransition[] | undefined {
  const transitions = (track.transitions ?? []).flatMap((transition): OutlineTransition[] => {
    const window = transitionWindow(transition, track);
    if (!window) return [];
    const options = agentOptions(transition);
    return [
      {
        id: transition.id,
        from: transition.fromClipId,
        to: transition.toClipId,
        kind: transition.kind,
        duration_ms: transition.durationMs,
        window_ms: [window.startMs, window.endMs],
        alignment: transition.alignment,
        easing: transition.easing,
        ...(Object.keys(options).length > 0 ? { options } : {}),
      },
    ];
  });
  return transitions.length > 0 ? transitions : undefined;
}

interface VideoOutline {
  kind: "video";
  aspect: string;
  size: string;
  background: string;
  shutter_angle?: number;
  shutter_phase?: number;
  perspective?: number;
  duration_ms: number;
  playhead_ms: number;
  selection: string[];
  tracks: OutlineTrack[];
  markers: OutlineMarker[];
  icons?: readonly string[];
  jobs: readonly OutlineJob[];
  changes_by_user?: DocumentChanges;
  library?: readonly OutlineLibraryItem[];
}

interface OutlineLayer {
  id: string;
  z: number;
  type: Layer["type"];
  name?: string;
  text?: string;
  runs?: OutlineRun[];
  shape?: string;
  media?: string;
  media_id?: string;
  shows?: { layer_id?: string; media_id: string };
  group?: string;
  hidden?: boolean;
  locked?: boolean;
  box: OutlineBox;
  style?: OutlineStyle;
  component?: string;
  overrides?: AgentOverride[];
  parts?: OutlinePart[];
  styles?: Partial<Record<LayerSlot, string>>;
  item?: LayoutItem;
  pixels?: OutlinePixels;
  mask?: Pick<OutlinePixels, "strokes" | "areas">;
  vfx?: OutlineVfx[];
  path_ops?: OutlinePathOp[];
  chart?: OutlineChart;
  table?: OutlineTable;
  qr?: OutlineQr;
}

interface OutlineArtboard {
  id: string;
  name?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  background: string;
  background_gradient?: Gradient;
  component?: true;
  instances?: number;
  background_style?: string;
  vfx?: OutlineVfx[];
  layers: OutlineLayer[];
  groups: { id: string; parent?: string; name?: string; base?: string; repeat?: AgentRepeat; layout?: OutlineLayout; item?: LayoutItem }[];
}

interface ImageOutline {
  kind: "image";
  active_artboard: string;
  selection: string[];
  artboards: OutlineArtboard[];
  styles?: OutlineStyleEntry[];
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
    ...(layer.color ? { color_grade: agentGrade(layer.color) } : {}),
    ...(layer.chromaKey ? { chroma_key: chromaOutline(layer.chromaKey, false) } : {}),
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
    ...(layer.arrowStart && layer.arrowStartKind ? { arrow_start_kind: layer.arrowStartKind } : {}),
    ...(layer.arrowEnd && layer.arrowEndKind ? { arrow_end_kind: layer.arrowEndKind } : {}),
    ...agentPaintOf(layer),
  };
  return Object.keys(style).length > 0 ? style : undefined;
}

function presentProperties(k: Keyframes | undefined): AnimatedProperty[] | undefined {
  const present = animatedProperties(k);
  return present.length > 0 ? present : undefined;
}

interface OutlineEase {
  influence: number;
  speed?: number;
}

type OutlineKey = { at_ms: number; easing: string; ease_in?: OutlineEase; ease_out?: OutlineEase; peak_speed?: number; smooth?: true } & ({ value: number } | { color: string } | OutlinePathKey | OutlineMorphKey);

interface OutlineMorphKey {
  path: string;
  first_vertex?: number;
}

const PERCENT = 100;

function outlineEase(side: SideVelocity | null): OutlineEase | undefined {
  if (!side) return undefined;
  return { influence: Math.round(side.influence * PERCENT * 10) / 10, ...(side.speed !== null ? { speed: round(side.speed) } : {}) };
}

function keySides(k: Keyframes, property: AnimatedProperty, atMs: number, aspect?: number): Pick<OutlineKey, "ease_in" | "ease_out" | "peak_speed" | "smooth"> {
  const velocity = keyVelocity(k, property, atMs, aspect);
  const easeIn = outlineEase(velocity?.in ?? null);
  const easeOut = outlineEase(velocity?.out ?? null);
  const frames = timedFramesOf(k, property);
  const index = frames.findIndex((frame) => frame.atMs === atMs);
  const peak = index >= 0 && index < frames.length - 1 ? peakSpeed(property, frames, index, aspect) : null;
  return { ...(easeIn ? { ease_in: easeIn } : {}), ...(easeOut ? { ease_out: easeOut } : {}), ...(peak !== null ? { peak_speed: round(peak) } : {}), ...(velocity?.smooth ? { smooth: true as const } : {}) };
}

interface OutlinePathKey {
  x: number;
  y: number;
  spatial?: SpatialMode;
  in?: { x: number; y: number };
  out?: { x: number; y: number };
}

function vector(handle: { x: number; y: number }): { x: number; y: number } {
  return { x: round(handle.x), y: round(handle.y) };
}

function morphFrameOutline(f: MorphKeyframe): OutlineMorphFrame {
  return { at_ms: f.atMs, path: f.path, easing: f.easing, ...(f.firstVertex ? { first_vertex: vertexIndex(f.path, f.firstVertex) } : {}) };
}

function outlineKeys(k: Keyframes, property: AnimatedProperty, aspect?: number): OutlineKey[] {
  if (isPathProperty(property)) return pathFramesOf(k).map((f) => ({ at_ms: f.atMs, x: round(f.x), y: round(f.y), easing: f.easing, ...keySides(k, property, f.atMs, aspect), ...(f.spatial ? { spatial: f.spatial } : {}), ...(f.in ? { in: vector(f.in) } : {}), ...(f.out ? { out: vector(f.out) } : {}) }));
  if (isColorProperty(property)) return colorFramesOf(k, property).map((f) => ({ at_ms: f.atMs, color: f.color, easing: f.easing, ...keySides(k, property, f.atMs) }));
  if (isMorphProperty(property)) return morphFramesOf(k).map((f) => ({ ...morphFrameOutline(f), ...keySides(k, property, f.atMs) }));
  return (k[property] ?? []).map((f) => ({ at_ms: f.atMs, value: round(f.value), easing: f.easing, ...keySides(k, property, f.atMs, aspect) }));
}

function keyframesOf(k: Keyframes | undefined, aspect?: number): OutlineClip["keyframes"] {
  const present = presentProperties(k);
  if (!k || !present) return undefined;
  return Object.fromEntries(present.map((p) => [p, outlineKeys(k, p, aspect)]));
}

interface OutlineSpeedCurve {
  points: { at: number; speed: number }[];
  smooth: boolean;
  source_ms: number;
}

function speedCurveOutline(clip: Clip): OutlineSpeedCurve {
  return { points: speedCurvePoints(clip).map((point) => ({ at: round(point.at), speed: round(point.speed) })), smooth: isSmoothCurve(clip), source_ms: sourceSpanMs(clip) };
}

function maskOutline(mask: Mask, full: boolean): OutlineMask {
  return {
    id: mask.id,
    shape: mask.shape,
    mode: mask.mode,
    ...(mask.invert ? { invert: true } : {}),
    x: round(mask.x),
    y: round(mask.y),
    w: round(mask.w),
    h: round(mask.h),
    rotation: round(mask.rotation),
    feather: round(mask.feather),
    expansion: round(mask.expansion),
    opacity: round(mask.opacity),
    ...(mask.roundness ? { roundness: round(mask.roundness) } : {}),
    ...(mask.points ? { points: mask.points } : {}),
    ...(mask.inner ? { inner: round(mask.inner) } : {}),
    ...(mask.path ? { path: mask.path } : {}),
    ...maskLanes(mask, full),
  };
}

function maskLanes(mask: Mask, full: boolean): Pick<OutlineMask, "animated" | "keyframes"> {
  const { path: morph = [], ...lanes } = mask.keyframes ?? {};
  const numeric = lanesOutline(lanes, full);
  if (morph.length === 0) return numeric;
  return { animated: [...(numeric.animated ?? []), "path"], ...(full ? { keyframes: { ...numeric.keyframes, path: morph.map(morphFrameOutline) } } : {}) };
}

function lanesOutline(lanes: Readonly<Record<string, readonly Keyframe[] | undefined>> | undefined, full: boolean): Pick<OutlineChroma, "animated" | "keyframes"> {
  const present = Object.entries(lanes ?? {}).filter(([, frames]) => frames && frames.length > 0) as [string, readonly Keyframe[]][];
  if (present.length === 0) return {};
  return {
    animated: present.map(([property]) => property),
    ...(full ? { keyframes: Object.fromEntries(present.map(([property, frames]) => [property, frames.map((f) => ({ at_ms: f.atMs, value: round(f.value), easing: f.easing }))])) } : {}),
  };
}

function vfxOutline(vfx: Vfx, full: boolean, params: readonly VfxParam[] = vfxParams(vfx.kind)): OutlineVfx {
  const colors = vfxColors(vfx.kind);
  return {
    id: vfx.id,
    kind: vfx.kind,
    seed: vfx.seed,
    ...(vfx.hidden ? { hidden: true } : {}),
    ...(vfx.offsetMs ? { offset_ms: vfx.offsetMs } : {}),
    ...(vfx.trackId ? { track_id: vfx.trackId } : {}),
    params: Object.fromEntries(params.map((name) => [name, round(vfx.params?.[name] ?? paramSpec(vfx.kind, name)!.fallback)])),
    ...(colors.length > 0 ? { colors: Object.fromEntries(colors.map((name) => [name, vfxColor(vfx, name)])) } : {}),
    ...lanesOutline(vfx.keyframes, full),
  };
}

type OutlinePathOp = AgentPathOp & Pick<OutlineChroma, "animated" | "keyframes">;

type OutlineClipRepeat = AgentClipRepeat & Pick<OutlineChroma, "animated" | "keyframes">;

function pathOpOutline(op: PathOp, full: boolean): OutlinePathOp {
  return { ...agentPathOp(op), ...lanesOutline(op.keyframes, full) };
}

function clipRepeatOutline(repeat: ClipRepeat, full: boolean): OutlineClipRepeat {
  return { ...agentClipRepeat(repeat), ...lanesOutline(repeat.keyframes, full) };
}

function stillVfxOutline(vfx: Vfx): OutlineVfx {
  return vfxOutline(vfx, false, stillParams(vfx.kind));
}

function chromaOutline(key: ChromaKey, full: boolean): OutlineChroma {
  return { color: key.color, similarity: round(key.similarity), smoothness: round(key.smoothness), spill: round(key.spill), ...lanesOutline(key.keyframes, full) };
}

function lumaOutline(key: LumaKey, full: boolean): OutlineLuma {
  return { mode: key.mode, threshold: round(key.threshold), softness: round(key.softness), ...lanesOutline(key.keyframes, full) };
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
    ...clipOrganizeOutline(clip),
    ...(clip.assetId ? { media_id: clip.assetId, media: asset?.name ?? "mídia" } : {}),
    ...(asset?.durationMs !== undefined && clip.type !== "image" ? { media_ms: asset.durationMs } : {}),
    ...(clip.trimInMs ? { trim_in_ms: clip.trimInMs } : {}),
    ...(clip.layer?.text ? { text: clip.layer.text } : {}),
    ...(clip.layer?.runs?.length ? { runs: runsOutline(clip.layer, clipRunText(clip)) } : {}),
    ...(clip.layer?.type === "shape" ? { shape: clip.layer.shape } : {}),
    ...(clip.type === "video" || clip.type === "image" ? { fit: clip.fit } : {}),
    ...(clip.volume !== 1 ? { volume: round(clip.volume) } : {}),
    ...(clip.pan ? { pan: round(clip.pan) } : {}),
    ...(motionName(clip.motionIn, clip.fadeInMs) ? { entrance: motionName(clip.motionIn, clip.fadeInMs) } : {}),
    ...(motionName(clip.motionOut, clip.fadeOutMs) ? { exit: motionName(clip.motionOut, clip.fadeOutMs) } : {}),
    ...(clip.transitionIn ? { transition_in: outlineEdge(clip.transitionIn) } : {}),
    ...(clip.transitionOut ? { transition_out: outlineEdge(clip.transitionOut) } : {}),
    ...(animatedProperties(clip.keyframes) ? { animated: animatedProperties(clip.keyframes) } : {}),
    ...(clip.linkId ? { linked: clip.linkId } : {}),
    ...(clip.disabled ? { disabled: true } : {}),
    ...(clip.blur ? { blur: clip.blur } : {}),
    ...(clip.speed !== undefined ? { speed: round(clip.speed) } : {}),
    ...(hasSpeedCurve(clip) ? { speed_curve: speedCurveOutline(clip) } : {}),
    ...(clip.frameMix ? { frame_mix: true } : {}),
    ...(clip.color ? { color_grade: agentGrade(clip.color) } : {}),
    ...(clip.gradientMap ? { gradient_map: agentGradientMap(clip.gradientMap) } : {}),
    ...(clip.reverse ? { reverse: true } : {}),
    ...(clip.freeze ? { freeze: true } : {}),
    ...(clip.preservePitch === false ? { preserve_pitch: false } : {}),
    ...(clip.textIn ? { text_in: textAnimationOf(clip.textIn) } : {}),
    ...(clip.textOut ? { text_out: textAnimationOf(clip.textOut) } : {}),
    ...(clip.textAnimators?.length ? { text_animators: clip.textAnimators.map(textAnimatorOutline) } : {}),
    ...(clip.masks?.length ? { masks: clip.masks.map((mask) => maskOutline(mask, ctx.detail === "full")) } : {}),
    ...clipStyleOutline(clip),
    ...(clip.matte ? { matte: true } : {}),
    ...(clip.matte && clip.matteChannel === "luma" ? { matte_channel: "luma" as const } : {}),
    ...(clip.matte && clip.matteInvert ? { matte_invert: true } : {}),
    ...(clip.blendMode ? { blend_mode: clip.blendMode } : {}),
    ...(clip.line ? { line: lineOutline(clip.line) } : {}),
    ...(clip.layer?.pathOps?.length ? { path_ops: clip.layer.pathOps.map((op) => pathOpOutline(op, ctx.detail === "full")) } : {}),
    ...(clip.repeat ? { repeat: clipRepeatOutline(clip.repeat, ctx.detail === "full") } : {}),
    ...(clip.counter ? { counter: counterOutline(clip) } : {}),
    ...(clip.textPath ? { text_path: textPathOutline(clip.textPath) } : {}),
    ...(clip.anchor ? { anchor: { x: round(clip.anchor.x), y: round(clip.anchor.y) } } : {}),
    ...(clip.flipX ? { flip_x: true } : {}),
    ...(clip.flipY ? { flip_y: true } : {}),
    ...(clip.autoOrient ? { auto_orient: true } : {}),
    ...(clip.motionBlur ? { motion_blur: true } : {}),
    ...(clip.rotationX ? { rotation_x: round(clip.rotationX) } : {}),
    ...(clip.rotationY ? { rotation_y: round(clip.rotationY) } : {}),
    ...(clip.camera ? { camera: { pan_x: round(clip.camera.panX), pan_y: round(clip.camera.panY), zoom: round(clip.camera.zoom), rotation: round(clip.camera.rotation) } } : {}),
    ...(clip.chromaKey ? { chroma_key: chromaOutline(clip.chromaKey, ctx.detail === "full") } : {}),
    ...(clip.lumaKey ? { luma_key: lumaOutline(clip.lumaKey, ctx.detail === "full") } : {}),
    ...(clip.vfx?.length ? { vfx: clip.vfx.map((vfx) => vfxOutline(vfx, ctx.detail === "full")) } : {}),
    ...(clip.type === "effect" ? { strength: round(clip.transform.opacity) } : {}),
    ...(clip.parentId ? { parent: clip.parentId } : {}),
    ...(clip.behaviors?.length ? { behaviors: clip.behaviors.map(behaviorOutline) } : {}),
    ...(clip.parentTracker ? { parent_tracker: clip.parentTracker } : {}),
    ...(clip.trackers?.length ? { trackers: trackersOutline(clip) } : {}),
    ...(clip.stabilize ? { stabilize: stabilizeOutline(clip) } : {}),
    ...(isGroupClip(clip) && ctx.timeline ? { group: groupOutline(ctx.timeline, clip, ctx) } : {}),
    ...(clip.layer?.chart ? { chart: chartOutline(clip.layer.chart) } : {}),
    ...(clip.chartIn ? { chart_animation: chartAnimationOutline(clip.chartIn) } : {}),
    ...(clip.layer?.table ? { table: tableOutline(clip.layer.table) } : {}),
    ...(clip.layer?.qr ? { qr: qrOutline(clip.layer.qr) } : {}),
  };
  if (ctx.detail === "full") {
    if (clip.type !== "audio" && clip.type !== "effect") line.box = boxOf(clip.transform);
    if (ctx.frame && ctx.parents && hasFrame(clip.type) && clip.startMs <= ctx.playheadMs && ctx.playheadMs < clipEnd(clip)) {
      const edges = clipEdgesPx(ctx.parents, clip, ctx.playheadMs, ctx.frame);
      line.edges_px = { left: Math.round(edges.left), top: Math.round(edges.top), right: Math.round(edges.right), bottom: Math.round(edges.bottom) };
    }
    if (clip.layer) line.style = styleOf(clip.layer);
    line.keyframes = keyframesOf(clip.keyframes, ctx.frame ? ctx.frame.width / ctx.frame.height : undefined);
  }
  return line;
}

function heardLoudness(track: Track, ctx: OutlineContext): { loudness_lufs?: number } {
  const measured = track.kind === "audio" ? ctx.trackLoudness?.(track.id) : null;
  return measured === null || measured === undefined ? {} : { loudness_lufs: Math.round((measured + (track.gainDb ?? 0)) * 10) / 10 };
}

function shutterOutline(doc: VideoDocument): Pick<VideoOutline, "shutter_angle" | "shutter_phase"> {
  const used = doc.canvas.shutterAngle !== undefined || doc.canvas.shutterPhase !== undefined || doc.tracks.some((track) => track.clips.some((clip) => clip.motionBlur));
  if (!used) return {};
  const shutter = shutterOf(doc.canvas);
  return { shutter_angle: shutter.angle, shutter_phase: shutter.phase };
}

function perspectiveOutline(doc: VideoDocument): Pick<VideoOutline, "perspective"> {
  const used = doc.canvas.perspective !== undefined || [...nestedClips(doc.tracks)].some(({ clip }) => carriesTilt(clip) || (clip.textAnimators ?? []).some((animator) => turnsInDepth(animator.properties)));
  return used ? { perspective: perspectiveOf(doc.canvas) } : {};
}

function outlineTracks(doc: VideoDocument, ctx: OutlineContext, frame: { width: number; height: number } | undefined): OutlineTrack[] {
  const parents = clipLookup(doc);
  return doc.tracks.map((track, index) => ({
    id: track.id,
    index,
    kind: track.kind,
    ...(track.name ? { name: track.name } : {}),
    ...(track.hidden ? { hidden: true } : {}),
    ...(track.locked ? { locked: true } : {}),
    ...(track.muted ? { muted: true } : {}),
    ...trackOrganizeOutline(track),
    ...(track.gainDb !== undefined ? { gain_db: round(track.gainDb) } : {}),
    ...(track.pan ? { pan: round(track.pan) } : {}),
    ...heardLoudness(track, ctx),
    ...(track.ducking
      ? { ducking: { trigger_track_ids: track.ducking.triggerTrackIds, reduce_db: track.ducking.reduceDb, attack_ms: track.ducking.attackMs, release_ms: track.ducking.releaseMs, hold_ms: track.ducking.holdMs, sensitivity: track.ducking.sensitivity } }
      : {}),
    clips: track.clips.map((clip) => outlineClip(clip, { ...ctx, frame, parents, timeline: doc })),
    ...(outlineTransitions(track) ? { transitions: outlineTransitions(track) } : {}),
  }));
}

function groupOutline(doc: VideoDocument, group: GroupClip, ctx: OutlineContext): OutlineGroup {
  return { ...(group.name ? { name: group.name } : {}), content_ms: groupContentMs(group), tracks: outlineTracks(groupTimeline(doc, group), ctx, undefined) };
}

export function videoOutline(doc: VideoDocument, ctx: OutlineContext): VideoOutline {
  const size = videoCanvasSize(doc);
  return {
    kind: "video",
    aspect: doc.canvas.aspect,
    size: `${size.width}x${size.height}`,
    background: doc.canvas.background,
    ...shutterOutline(doc),
    ...perspectiveOutline(doc),
    duration_ms: doc.durationMs,
    playhead_ms: Math.round(ctx.playheadMs),
    selection: [...ctx.selection],
    tracks: outlineTracks(doc, ctx, size),
    markers: (doc.markers ?? []).map((marker) => markerOutline(marker)),
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
    ...(layer.runs?.length ? { runs: runsOutline(layer, layer.text ?? "") } : {}),
    ...(layer.type === "shape" ? { shape: layer.shape } : {}),
    ...(layer.assetId ? { media_id: layer.assetId, media: asset?.name ?? "imagem" } : {}),
    ...(layer.groupId ? { group: layer.groupId } : {}),
    ...(layer.hidden ? { hidden: true } : {}),
    ...(layer.locked ? { locked: true } : {}),
    box: boxOf(layer.transform),
    ...outlinePixels(layer),
    ...(ctx.detail === "full" && styleOf(layer) ? { style: styleOf(layer) } : {}),
    ...(layer.componentId ? { component: layer.componentId } : {}),
    ...(layer.overrides && layer.overrides.length > 0 ? { overrides: agentOverrides(layer.overrides) } : {}),
    ...(layerStyleLinks(layer) ? { styles: layerStyleLinks(layer) } : {}),
    ...(layer.layoutItem ? { item: layer.layoutItem } : {}),
    ...(layer.chart ? { chart: chartOutline(layer.chart) } : {}),
    ...(layer.table ? { table: tableOutline(layer.table) } : {}),
    ...(layer.qr ? { qr: qrOutline(layer.qr) } : {}),
    ...(layer.vfx?.length ? { vfx: layer.vfx.map(stillVfxOutline) } : {}),
    ...(layer.pathOps?.length ? { path_ops: layer.pathOps.map((op) => pathOpOutline(op, false)) } : {}),
  };
}

function shownPicture(surface: ImageSurface, layer: Layer): Pick<OutlineLayer, "shows"> {
  if (layer.type === "image") return {};
  const source = soleSource(imageSourcesOf(surface, [layer.id]));
  if (!source?.assetId) return {};
  return { shows: { ...(source.layerId !== layer.id ? { layer_id: source.layerId } : {}), media_id: source.assetId } };
}

function outlineArtboard(doc: ImageDocument, a: Artboard, ctx: OutlineContext): OutlineArtboard {
  return {
    id: a.id,
    ...(a.name ? { name: a.name } : {}),
    width: a.canvas.width,
    height: a.canvas.height,
    x: a.x,
    y: a.y,
    background: a.canvas.background,
    ...(a.canvas.gradient ? { background_gradient: a.canvas.gradient } : {}),
    ...componentUses(doc, a),
    ...(a.canvas.backgroundStyleId ? { background_style: a.canvas.backgroundStyleId } : {}),
    ...(a.canvas.vfx?.length ? { vfx: a.canvas.vfx.map(stillVfxOutline) } : {}),
    layers: a.layers.map((layer, z) => (layer.type === "instance" ? { ...outlineLayer(layer, z, ctx), parts: outlineParts(doc, a, layer) } : { ...outlineLayer(layer, z, ctx), ...shownPicture(a, layer) })),
    groups: (a.groups ?? []).map((g) => ({ id: g.id, ...(g.parentId ? { parent: g.parentId } : {}), ...(g.name ? { name: g.name } : {}), ...(g.baseId ? { base: g.baseId } : {}), ...(g.repeat ? { repeat: agentRepeat(g.repeat) } : {}), ...outlineLayout(g) })),
  };
}

export function imageOutline(doc: ImageDocument, ctx: OutlineContext): ImageOutline {
  const active = doc.artboards.find((a) => a.id === ctx.activeArtboard) ?? doc.artboards[0];
  return {
    kind: "image",
    active_artboard: active.id,
    selection: [...ctx.selection],
    artboards: doc.artboards.map((a) => outlineArtboard(doc, a, ctx)),
    ...(doc.styles && doc.styles.length > 0 ? { styles: outlineStyles(doc) } : {}),
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
