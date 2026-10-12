import { produce } from "immer";

import { captionsFromText, captionWindow } from "../captions";
import { ANCHOR_RANGE, canvasAspect, newIconLayer, STUDIO_LIMITS, VIDEO_ASPECT_SIZES, VIDEO_ASPECTS, type CanvasSize, type Clip, type Fit, type Layer, type TrackKind, type VideoAspect, type VideoDocument } from "../document";
import { duplicateGroup, linkClips, magnetize, moveGroup, onScreenFloor, placeStack, splitAt, trimLinked, unlinkClips, withLinked } from "../edits";
import { ANIMATED_PROPERTIES, AUDIO_PROPERTIES, droppedRivals, isAudioProperty, isColorProperty, isEasing, isPathProperty, isPositionKey, KEYFRAME_RANGES, keyframeFault, withLane, type AnimatedProperty, type Easing, type TimedKey } from "../keyframes";
import { ANCHOR_POINTS, anchorFits, anchorOf, isAnchorPoint, type AnchorPoint } from "../clip-placement";
import { anchorPatch } from "../placement-edit";
import { onPath } from "../keyframe-edit";
import { curvePath, fillHandles, linkScale, scaleAxesMatch, splitScale, straightenPath, type ScaleAxis } from "../motion-edit";
import type { SpatialMode, Tangent } from "../path-keys";
import { paintsProperty } from "../paint";
import {
  addTransition,
  cutsOf,
  findTransition,
  removeTransition,
  updateTransition,
  type IrisShape,
  type SlideMove,
  type SplitOrientation,
  type TransitionAlignment,
  type TransitionDirection,
  type TransitionKind,
  type TransitionPatch,
} from "../transitions";
import type { GradientWipeMap } from "../reveal-field";
import { edgeTransitionChange, mapMediaRefusal, transitionOptions, transitionRefusal } from "./transition-ops";
import { fadePatch } from "../edge-transitions";
import { KEYFRAME_PRESETS, withPreset, type KeyframePresetId } from "../keyframe-presets";
import { DEFAULT_OVERLAY_MS, overlayClip, sizedMediaClips, type MediaClipType } from "../media-clips";
import { DEFAULT_MOTION_MS, ENTRANCE_PRESETS, motionPresetPatch, type MotionPreset } from "../motion";
import { SPEED_LIMITS } from "../clip-time";
import { DEFAULT_FREEZE_MS, freezeFrame, rampSpeed, retimeClip, type RetimeRefusal } from "../retime";
import { smoothRamp } from "../speed-curve";
import { isSpeedProperty } from "../speed-range";
import { isGradeProperty } from "../grade-keys";
import { frameMixOperation, liftRefusal, RAMP_MODES, SPEED_CURVE_OPERATIONS, speedCurveOperation, type AgentSpeedFields, type SpeedOpResult } from "./speed-ops";
import { TEXT_STYLE_PRESETS, textPresetClips, type TextStylePreset } from "../text-presets";
import { animatesText, defaultTextAnimator, defaultUnitFor, TEXT_ANIMATION_LIMITS, TEXT_STYLES, TEXT_UNITS, textAnimationPatch, textAnimatorFault, type TextAnimator, type TextStyle, type TextUnit } from "../text-animation";
import {
  addTrack,
  clipEnd,
  deleteClips,
  edgeBlock,
  findClip,
  moveTrack,
  placeClips,
  removeTrack,
  rippleDeleteClips,
  setClipTrimIn,
  trackAccepts,
  updateClip,
  updateTrack,
  type ClipPatch,
  type EdgeBlock,
  type TrackPatch,
} from "../timeline";
import { setClipsDisabled } from "../tools";
import { rollCut, slideClip, type TrimBlock, type TrimEdge, type TrimEdit } from "../trim-edits";
import { clipIssue, isValidColor } from "../validate";
import { clipTime } from "../selection-edit";
import { missingTarget, type AgentFocus, type AgentOutcome } from "./batch";
import { gradeChangeOf, type AgentColorFields } from "./color-op";
import { chromaOperation, type AgentChromaFields } from "./chroma-ops";
import { LUMA_OPERATIONS, lumaOperation, type AgentLumaFields } from "./luma-ops";
import { mattePatchOf, mediaBlendOf } from "./compositing-ops";
import type { MatteChannel } from "../matte";
import { clipKeySample, keyMoment, type KeySample } from "../chroma-detect";
import { maskOperation, type AgentMaskFields } from "./mask-ops";
import { agentVfx, ECHO_ON_EFFECT_CLIP, vfxOperation, type AgentVfxFields } from "./vfx-ops";
import { DEFAULT_EFFECT_MS, newEffectClip, refusedOnEffectClips } from "../vfx";
import { CAMERA_OPERATIONS, cameraPatch, type AgentCameraFields } from "./camera-ops";
import { takesAdjustmentKey } from "../adjustment";
import { isCameraProperty } from "../clip-camera";
import { placeEffectClip, timelineOf } from "../vfx-edit";
import { lineGroupFor, lineOperation, type AgentLineFields } from "./line-ops";
import { TEXT_OPERATIONS, textGroupFor, textOperation, type AgentTextFields } from "./text-ops";
import { styledText, type AgentTextRunFields } from "./text-run-ops";
import { clipRunText } from "../text-runs";
import { TEXT_ANIMATOR_OPERATIONS, textAnimatorOperation, type AgentTextAnimatorFields } from "./text-animator-ops";
import { isTextKeyProperty } from "../text-properties";
import { KEY_EASE_OPERATIONS, keyEaseOperation, type AgentKeyEaseFields } from "./key-ease-ops";
import { LAYOUT_OPERATIONS, layoutOperation, type AgentLayoutFields } from "./layout-ops";
import { PARENT_OPERATIONS, parentOperation, type AgentParentFields } from "./parent-ops";
import { GROUP_OPERATIONS, groupOperation, operationScope, type AgentGroupFields } from "./group-ops";
import { nestedTracks, pathMsAt, rootMsAt, sourceLengthOf, withTimelineAt } from "../group-scope";
import { BEHAVIOR_OPERATIONS, behaviorOperation, type AgentBehaviorFields } from "./behavior-ops";
import type { TrackLevels } from "../behaviors";
import { TRACK_OPERATIONS, trackOperation, type AgentTrackFields, type TrackOutcomes } from "./track-ops";
import { markerOperation, organizeClipPatch, organizeTrackPatch, ORGANIZE_OPERATIONS, type AgentOrganizeFields } from "./organize-ops";
import { PRESET_OPERATIONS, presetOperation, type AgentPresetFields, type PresetLookup } from "./preset-ops";
import { PATH_OP_VIDEO_OPERATIONS, pathOpVideoOperation, type AgentPathOpFields } from "./path-op-ops";
import { CLIP_REPEAT_OPERATIONS, clipRepeatOperation, type AgentClipRepeatFields } from "./clip-repeat-ops";
import { applyShutter, closedShutterNotes, hasShutter, motionBlurPatch, shutterRefusal, type AgentMotionBlurFields } from "./motion-blur-ops";
import { applyPerspective, perspectiveRefusal, tiltPatch, tiltRefusal, type AgentTiltFields } from "./tilt-ops";
import { isLineProperty } from "../line-properties";
import { bakeDucking, DUCKING_RANGES, duckingIssue, TRACK_GAIN_RANGE, trackGainIssue, withDucking, type SpeechSource } from "../ducking";
import { keyframeFaultText, keyOutsideClipText } from "./keyframe-text";
import { clipAccessText, morphLaneFrames, PATH_KEYS_TEXT } from "./lane-keys";
import { animateEffect, CLIP_STYLE_OPERATIONS, clipStylePatch, hasClipStyle, type AgentClipStyleFields } from "./clip-style-ops";
import { isMorphProperty, MORPH_PROPERTY } from "../morph-keys";
import { setPathKeys, type MorphEdit } from "../morph-edit";
import { normalizeOperation, PAN_TEXT, type AgentAudioFields } from "./audio-ops";
import { panInRange, trackPanIssue } from "../audio-pan";
import type { LoudnessSource } from "../loudness";
import { fitsLayer, hasBox, hasStyle, issueText, LAYER_CLEARS, shapeLayerOf, stylePatch, withBox, type AgentBox, type AgentStyle } from "./layer-style";
import { elementPlan, iconPlan, unusedColorNotes, type AgentElementFields, type LibraryLookup } from "./element-ops";
import { LOTTIE_OPERATIONS, lottiePlan, type LottieLookup } from "./lottie-ops";
import { frameWithItem, framesItem, type FramingRefusal } from "../library/framing";
import { insertVideoClips, videoClips } from "../library/instantiate";
import { LIBRARY_INK, type LibraryItem } from "../library/model";
import { CHART_VIDEO_OPERATIONS, chartAnimatorFrom, chartChangeRequested, chartSpecFrom, type AgentChartFields, type ChartVideoOpName } from "./chart-ops";
import { chartTransform, newChartLayer } from "../chart-edits";
import { chartInPatch } from "../chart-animation";
import { isTableOperation, tableCellStyle, tableCellText, tableChangeRequested, tableSpecFrom, TABLE_OPERATIONS, type AgentTableFields, type TableOpName } from "./table-ops";
import { isQrOperation, qrChangeRequested, qrSpecFrom, QR_OPERATIONS, type AgentQrFields, type QrOpName } from "./qr-ops";
import { newQrLayer, newTableLayer, qrTransform, tableTransform } from "../generated-edits";

export const VIDEO_OPERATIONS = [
  "add_media",
  "add_text",
  "add_shape",
  "add_icon",
  "add_element",
  "add_captions",
  "move_clip",
  "trim_clip",
  "slip_clip",
  "roll_edit",
  "slide_clip",
  "split_clip",
  "delete_clips",
  "duplicate_clips",
  "update_clip",
  "animate",
  ...CLIP_STYLE_OPERATIONS,
  "motion_preset",
  "entrance",
  "exit",
  "animate_text",
  "set_speed",
  "freeze_frame",
  "speed_ramp",
  ...SPEED_CURVE_OPERATIONS,
  "set_color",
  "set_chroma_key",
  "animate_chroma",
  "remove_chroma_key",
  ...LUMA_OPERATIONS,
  "add_mask",
  "update_mask",
  "animate_mask",
  "move_mask",
  "remove_mask",
  "add_effect_clip",
  ...CAMERA_OPERATIONS,
  "add_vfx",
  "update_vfx",
  "animate_vfx",
  "move_vfx",
  "remove_vfx",
  "set_line",
  ...TEXT_OPERATIONS,
  "style_text",
  ...TEXT_ANIMATOR_OPERATIONS,
  "add_track",
  "move_track",
  "update_track",
  "remove_track",
  "add_marker",
  "update_marker",
  "remove_marker",
  "link_clips",
  "unlink_clips",
  "set_ducking",
  "clear_ducking",
  "bake_ducking",
  "normalize_loudness",
  "set_canvas",
  "seek",
  "select",
  "add_transition",
  "update_transition",
  "remove_transition",
  "set_anchor",
  "scale_axes",
  "set_path",
  ...KEY_EASE_OPERATIONS,
  ...LAYOUT_OPERATIONS,
  ...PARENT_OPERATIONS,
  ...GROUP_OPERATIONS,
  ...BEHAVIOR_OPERATIONS,
  ...TRACK_OPERATIONS,
  ...ORGANIZE_OPERATIONS,
  ...PRESET_OPERATIONS,
  ...PATH_OP_VIDEO_OPERATIONS,
  ...CLIP_REPEAT_OPERATIONS,
  ...CHART_VIDEO_OPERATIONS,
  ...TABLE_OPERATIONS,
  ...QR_OPERATIONS,
  ...LOTTIE_OPERATIONS,
] as const;

export type VideoOpName = (typeof VIDEO_OPERATIONS)[number];

export const VIDEO_ID_FIELDS = ["clip_id", "clip_ids", "track_id", "to_clip_id", "transition_id", "marker_id", "trigger_track_ids", "mask_id", "vfx_id", "parent_id", "behavior_id", "audio_track_id", "tracker_id", "second_tracker_id", "group_id", "vfx_track_id"] as const;

export interface AgentKey {
  at_ms: number;
  value?: number;
  color?: string;
  x?: number;
  y?: number;
  spatial?: SpatialMode;
  in?: Tangent;
  out?: Tangent;
  easing?: Easing;
  smooth?: boolean;
  path?: string;
  first_vertex?: number;
}

const DEFAULT_KEY_EASING: Easing = "easeInOut";

export interface VideoOperation extends AgentBox, AgentStyle, AgentColorFields, AgentChromaFields, AgentLumaFields, AgentMaskFields, AgentLineFields, AgentTextFields, AgentVfxFields, AgentAudioFields, AgentKeyEaseFields, AgentLayoutFields, AgentParentFields, AgentGroupFields, AgentBehaviorFields, AgentTrackFields, AgentMotionBlurFields, AgentTextAnimatorFields, AgentElementFields, AgentTextRunFields, AgentSpeedFields, AgentPathOpFields, AgentClipRepeatFields, AgentOrganizeFields, AgentPresetFields, AgentChartFields, AgentTableFields, AgentQrFields, AgentClipStyleFields, AgentCameraFields, AgentTiltFields {
  op: VideoOpName;
  ref?: string;
  clip_id?: string;
  clip_ids?: string[];
  track_id?: string;
  media_id?: string;
  at_ms?: number;
  start_ms?: number;
  end_ms?: number;
  duration_ms?: number;
  trim_in_ms?: number;
  to_index?: number;
  style?: TextStylePreset;
  preset?: KeyframePresetId;
  effect?: MotionPreset;
  side?: "in" | "out" | "both";
  text_style?: TextStyle | "none";
  unit?: TextUnit;
  stagger_ms?: number;
  speed?: number;
  keep_duration?: boolean;
  preserve_pitch?: boolean;
  stretch_keys?: boolean;
  protect_edges_ms?: number;
  ramp_ms?: number;
  ramp_steps?: number;
  property?: AnimatedProperty;
  keys?: AgentKey[];
  to_clip_id?: string;
  transition_id?: string;
  marker_id?: string;
  gain_db?: number;
  trigger_track_ids?: string[];
  reduce_db?: number;
  attack_ms?: number;
  release_ms?: number;
  hold_ms?: number;
  sensitivity?: number;
  transition_kind?: TransitionKind;
  alignment?: TransitionAlignment;
  easing?: Easing;
  direction?: TransitionDirection;
  moving?: SlideMove;
  color?: string;
  angle?: number;
  iris_shape?: IrisShape;
  origin_x?: number;
  origin_y?: number;
  clockwise?: boolean;
  orientation?: SplitOrientation;
  reverse?: boolean;
  amount?: number;
  softness?: number;
  piece_size?: number;
  wipe_map?: GradientWipeMap;
  wipe_map_media_id?: string;
  blur?: number;
  volume?: number;
  fade_in_ms?: number;
  fade_out_ms?: number;
  fit?: Fit;
  kind?: TrackKind;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  muted?: boolean;
  disabled?: boolean;
  matte?: boolean;
  matte_channel?: MatteChannel;
  matte_invert?: boolean;
  ripple?: boolean;
  edge?: TrimEdge;
  linked?: boolean;
  aspect?: VideoAspect;
  background?: string;
  icon_id?: string;
  anchor?: AnchorPoint;
  anchor_x?: number;
  anchor_y?: number;
  keep_visual?: boolean;
  flip_x?: boolean;
  flip_y?: boolean;
  auto_orient?: boolean;
  separate?: boolean;
  keep_axis?: ScaleAxis;
  curved?: boolean;
}

export interface VideoOpContext {
  playheadMs: number;
  magnetic: boolean;
  mediaType: (mediaId: string) => MediaClipType | null;
  sourceDuration: (assetId: string) => number | undefined;
  captions: (mediaId: string) => string | undefined;
  captionTrackName: string;
  icons: readonly string[];
  speech: SpeechSource;
  loudness: LoudnessSource;
  keyColor?: (sample: KeySample) => string | undefined;
  isLut?: (mediaId: string) => boolean;
  levels?: (doc: VideoDocument) => TrackLevels;
  library?: LibraryLookup;
  trackOutcome?: TrackOutcomes;
  presets?: PresetLookup;
  naturalSize?: (mediaId: string) => CanvasSize | undefined;
  shortLinkUrl?: (id: string) => string | undefined;
  lottie?: LottieLookup;
}

type Outcome = AgentOutcome<VideoDocument>;

const READ_AGAIN = "leia o projeto de novo com studio_read";

function refuse(reason: string): Outcome {
  return { ok: false, reason };
}

function missingClip(id: string | undefined): Outcome {
  return id === undefined ? missingTarget("clip_id", `o clipe (sem id) não existe; ${READ_AGAIN}`) : refuse(`o clipe ${id} não existe; ${READ_AGAIN}`);
}

function missingTrack(id: string | undefined): Outcome {
  return refuse(`a faixa ${id ?? "(sem id)"} não existe; ${READ_AGAIN}`);
}

type TrackIssue = { kind: "missing" } | { kind: "locked" } | { kind: "wrong"; trackKind: TrackKind } | { kind: "busy"; clip: Clip };

function trackIssue(doc: VideoDocument, trackId: string, clip: Clip): TrackIssue | null {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track) return { kind: "missing" };
  if (track.locked) return { kind: "locked" };
  if (!trackAccepts(track.kind, clip.type)) return { kind: "wrong", trackKind: track.kind };
  const busy = track.clips.find((c) => c.startMs < clip.startMs + clip.durationMs && clipEnd(c) > clip.startMs);
  return busy ? { kind: "busy", clip: busy } : null;
}

function trackNote(trackId: string, issue: Exclude<TrackIssue, { kind: "missing" }>, placement: string): string {
  switch (issue.kind) {
    case "locked":
      return `a faixa ${trackId} está travada; ${placement}`;
    case "wrong":
      return `a faixa ${trackId} é de ${issue.trackKind === "audio" ? "áudio" : "vídeo"} e não recebe esse clipe; ${placement}`;
    case "busy":
      return `a faixa ${trackId} já tem o clipe ${issue.clip.id} de ${issue.clip.startMs} a ${clipEnd(issue.clip)} ms nesse trecho; ${placement}`;
  }
}

function noRoom(clips: readonly Clip[]): Outcome {
  const first = clips[0];
  return refuse(`o clipe em ${first.startMs} ms precisa de pelo menos ${STUDIO_LIMITS.minClipMs} ms antes do fim do vídeo, que vai até ${STUDIO_LIMITS.maxVideoMs} ms; use um at_ms menor`);
}

type Placed = { document: VideoDocument; ids: string[]; notes: string[] };

function placedWith(result: { document: VideoDocument; ids: string[] } | null, clips: readonly Clip[], notes: string[]): Outcome | Placed {
  return result ? { ...result, notes } : noRoom(clips);
}

function placeOn(doc: VideoDocument, clips: readonly Clip[], trackId: string | undefined): Outcome | Placed {
  const issue = trackId ? trackIssue(doc, trackId, clips[0]) : null;
  if (!trackId || !issue) return placedWith(placeClips(doc, clips, trackId), clips, []);
  if (issue.kind === "missing") return missingTrack(trackId);
  if (issue.kind === "wrong") return placedWith(placeClips(doc, clips), clips, [trackNote(trackId, issue, "coloquei numa faixa livre do tipo certo")]);
  const index = doc.tracks.findIndex((t) => t.id === trackId);
  const added = addTrack(doc, doc.tracks[index].kind, index + 1);
  return placedWith(placeClips(added.document, clips, added.trackId), clips, [trackNote(trackId, issue, `coloquei numa faixa nova logo acima dela (${added.trackId})`)]);
}

function done(document: VideoDocument, focus: AgentFocus, label: string, extra: Partial<Extract<Outcome, { ok: true }>> = {}): Outcome {
  return { ok: true, document, focus, label, ...extra };
}

function targets(op: VideoOperation): string[] {
  if (op.clip_ids && op.clip_ids.length > 0) return op.clip_ids;
  return op.clip_id ? [op.clip_id] : [];
}

function sourceOf(doc: VideoDocument, ctx: VideoOpContext) {
  return (clipId: string) => {
    const clip = findClip(doc, clipId)?.clip;
    return clip ? sourceLengthOf(clip, ctx.sourceDuration) : undefined;
  };
}

function lockedClip(doc: VideoDocument, ids: readonly string[]): Outcome | null {
  const held = ids.find((id) => findClip(doc, id)?.track.locked);
  return held ? refuse(`o clipe ${held} está numa faixa travada; destrave com update_track antes`) : null;
}

function checkedClips(before: VideoDocument, after: VideoDocument, ids: readonly string[], unchanged: string | null): Outcome | null {
  if (after === before && unchanged !== null) return refuse(unchanged);
  for (const id of ids) {
    const found = findClip(after, id);
    if (!found) continue;
    const fault = keyframeFault(found.clip.keyframes, found.clip.transform);
    if (fault) return refuse(`o clipe ${id} ficaria inválido: ${keyframeFaultText(fault)}`);
    const code = clipIssue(found.clip, found.track.kind, after.durationMs);
    if (code) return refuse(`o clipe ${id} ficaria inválido: ${issueText(code)}`);
  }
  return null;
}

function newIds(before: VideoDocument, after: VideoDocument): string[] {
  const known = new Set(before.tracks.flatMap((t) => t.clips.map((c) => c.id)));
  return after.tracks.flatMap((t) => t.clips.map((c) => c.id)).filter((id) => !known.has(id));
}

function timed(clip: Clip, atMs: number, durationMs: number | undefined): Clip {
  return { ...clip, startMs: Math.round(atMs), durationMs: Math.round(durationMs ?? clip.durationMs) };
}

function addMedia(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const mediaId = op.media_id ?? "";
  const type = mediaId ? ctx.mediaType(mediaId) : null;
  if (!type) return refuse(`a mídia ${mediaId || "(sem media_id)"} não está na biblioteca ou não é vídeo, imagem ou áudio`);
  const at = op.at_ms ?? ctx.playheadMs;
  const source = type === "image" ? undefined : ctx.sourceDuration(mediaId);
  const clips = sizedMediaClips(type, mediaId, at, source, op.duration_ms);
  const placed = placeOn(doc, clips, op.track_id);
  if ("ok" in placed) return placed;
  return done(placed.document, { kind: "clip", clipId: placed.ids[0] }, "add_media", { created: placed.ids, notes: placed.notes });
}

function styled(clip: Clip, op: VideoOperation): { ok: true; clip: Clip } | { ok: false; reason: string } {
  const style = stylePatch(op, LAYER_CLEARS);
  if (!style.ok) return style;
  const layer = { ...clip.layer!, ...style.value };
  return { ok: true, clip: { ...clip, layer, transform: withBox(clip.transform, op) } };
}

function addText(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (!op.text || op.text.trim() === "") return refuse("add_text precisa de text");
  const preset = op.style ?? "headline";
  if (!(TEXT_STYLE_PRESETS as readonly string[]).includes(preset)) return refuse(`o estilo ${preset} não existe`);
  const at = op.at_ms ?? ctx.playheadMs;
  const clips = textPresetClips(preset, op.text, at).map((c) => timed(c, at, op.duration_ms ?? DEFAULT_OVERLAY_MS));
  const textIndex = clips.findIndex((c) => c.layer?.type === "text");
  const text = clips[textIndex];
  const restyled = styled(text, op);
  if (!restyled.ok) return refuse(restyled.reason);
  const dx = restyled.clip.transform.x - text.transform.x;
  const dy = restyled.clip.transform.y - text.transform.y;
  const shifted = clips.map((c, i) => (i === textIndex ? restyled.clip : { ...c, transform: { ...c.transform, x: c.transform.x + dx, y: c.transform.y + dy } }));
  const issue = op.track_id ? trackIssue(doc, op.track_id, shifted[0]) : null;
  if (op.track_id && issue?.kind === "missing") return missingTrack(op.track_id);
  const requested = op.track_id ? doc.tracks.findIndex((t) => t.id === op.track_id) : -1;
  const onScreen = onScreenFloor(doc, shifted[0].startMs, shifted[0].durationMs);
  const floor = !op.track_id || issue?.kind === "wrong" ? onScreen : issue ? requested : requested - 1;
  const notes = op.track_id && issue && issue.kind !== "missing" ? [trackNote(op.track_id, issue, issue.kind === "wrong" ? "coloquei acima do que está na tela" : "coloquei numa faixa acima dela")] : [];
  const placed = placeStack(doc, shifted, floor);
  if (!placed) return noRoom(shifted);
  const textId = placed.ids[textIndex];
  const created = [textId, ...placed.ids.filter((id) => id !== textId)];
  return checkedClips(doc, placed.document, created, "o texto não pôde ser criado") ?? done(placed.document, { kind: "clip", clipId: textId }, "add_text", { created, notes });
}

function addShape(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const shape = shapeLayerOf(op, VIDEO_ASPECT_SIZES[doc.canvas.aspect]);
  if (!shape.ok) return refuse(shape.reason);
  const base = shape.value;
  return placeOverlay(doc, op, ctx, base, shape.ignored, "add_shape", "a forma não pôde ser criada");
}

function addIcon(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const plan = iconPlan(op.icon_id, ctx.icons, "video", ctx.library, op.fill);
  if (!plan.ok) return refuse(plan.reason);
  if (plan.kind === "catalog") return placeOverlay(doc, op, ctx, newIconLayer(plan.iconId), [], "add_icon", "o ícone não pôde ser colocado");
  return addElement(doc, { ...op, ...plan.element, fill: undefined }, ctx);
}

const FRAMING_REFUSALS: Record<FramingRefusal, string> = {
  noClips: "molduras e grades recortam clipes que já estão na linha do tempo: informe clip_id ou clip_ids dos clipes de vídeo ou imagem",
  notMedia: "molduras e grades só recortam clipes de vídeo ou de imagem",
  locked: "um dos clipes está numa faixa travada; destrave com update_track antes",
  tooMany: "há mais clipes que espaços nesta grade",
};

function frameElement(doc: VideoDocument, op: VideoOperation, item: LibraryItem): Outcome {
  const framed = frameWithItem(doc, item, targets(op));
  if (!framed) return refuse(`o item ${item.id} não é moldura nem grade`);
  if (!framed.ok) return refuse(framed.reason === "tooMany" ? `${FRAMING_REFUSALS.tooMany} (${framed.count}); escolha uma grade com mais espaços ou mande menos clipes` : FRAMING_REFUSALS[framed.reason]);
  const notes = item.template.kind === "frame" ? [] : ["os clipes ocupam os espaços na ordem de clip_ids, da esquerda para a direita e de cima para baixo"];
  return checkedClips(doc, framed.document, framed.ids, "a moldura não pôde ser aplicada") ?? done(framed.document, { kind: "clip", clipId: framed.ids[0] }, "add_element", { changed: framed.ids, notes });
}

function importLottie(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const plan = lottiePlan(op, ctx.lottie, VIDEO_ASPECT_SIZES[doc.canvas.aspect], ctx.playheadMs);
  if (!plan.ok) return refuse(plan.reason);
  const placed = placeOn(doc, [plan.clip], op.track_id);
  if ("ok" in placed) return placed;
  return checkedClips(doc, placed.document, placed.ids, "a animação não pôde ser colocada") ?? done(placed.document, { kind: "clip", clipId: placed.ids[0] }, "import_lottie", { created: placed.ids, notes: [...plan.notes, ...placed.notes] });
}

function addElement(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const plan = elementPlan(op, "video", ctx.library);
  if (!plan.ok) return refuse(plan.reason);
  if (framesItem(plan.item)) return frameElement(doc, op, plan.item);
  const at = op.at_ms ?? ctx.playheadMs;
  const sticker = plan.item.template.kind === "sticker";
  const request = { canvas: VIDEO_ASPECT_SIZES[doc.canvas.aspect], locale: plan.locale, text: plan.text, box: plan.box, atMs: at, documentMs: doc.durationMs, ...(sticker && op.duration_ms !== undefined ? { durationMs: op.duration_ms } : {}) };
  const built = videoClips(plan.item, { ...request, colors: plan.colors });
  if (!built || built.length === 0) return refuse(`o item ${plan.item.id} não entra no editor de vídeo`);
  const clips = op.duration_ms === undefined || sticker ? built : built.map((clip) => timed(clip, clip.startMs, op.duration_ms));
  const notes = [...plan.notes, ...unusedColorNotes(plan.colors, (videoClips(plan.item, request) ?? []).flatMap((clip) => (clip.layer ? [clip.layer] : [])))];
  const focus = (ids: readonly string[]): AgentFocus => ({ kind: "clip", clipId: ids[0] });
  if (clips.length === 1) {
    const placed = placeOn(doc, clips, op.track_id);
    if ("ok" in placed) return placed;
    return checkedClips(doc, placed.document, placed.ids, "o elemento não pôde ser colocado") ?? done(placed.document, focus(placed.ids), "add_element", { created: placed.ids, notes: [...notes, ...placed.notes] });
  }
  if (op.track_id && !doc.tracks.some((track) => track.id === op.track_id)) return missingTrack(op.track_id);
  const placed = insertVideoClips(doc, clips, op.track_id);
  if (!placed) return noRoom(clips);
  return checkedClips(doc, placed.document, placed.ids, "o elemento não pôde ser colocado") ?? done(placed.document, focus(placed.ids), "add_element", { created: placed.ids, notes });
}

function placeOverlay(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext, base: Layer, earlier: readonly string[], label: string, failure: string): Outcome {
  const patch = stylePatch(op, LAYER_CLEARS);
  const style = patch.ok ? fitsLayer(base, patch.value) : patch;
  if (!style.ok) return refuse(style.reason);
  const notes = [...earlier, ...style.ignored];
  const at = op.at_ms ?? ctx.playheadMs;
  const clip = timed(overlayClip({ ...base, ...style.value }, at, withBox(base.transform, op)), at, op.duration_ms ?? DEFAULT_OVERLAY_MS);
  const placed = placeOn(doc, [clip], op.track_id);
  if ("ok" in placed) return placed;
  return checkedClips(doc, placed.document, placed.ids, failure) ?? done(placed.document, { kind: "clip", clipId: placed.ids[0] }, label, { created: placed.ids, notes: [...notes, ...placed.notes] });
}

function addCaptions(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const source = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!source) return missingClip(op.clip_id);
  const text = op.media_id ? ctx.captions(op.media_id) : undefined;
  if (text === undefined) return refuse("o arquivo de legendas não pôde ser lido; confira o media_id em studio_jobs");
  const outcome = captionsFromText(doc, text, captionWindow(source.clip), ctx.captionTrackName);
  if (outcome.status === "unreadable") return refuse("o arquivo não tem nenhuma legenda em WebVTT ou SRT; se veio de studio_jobs, a fala não foi encontrada");
  if (outcome.status === "empty") return refuse("as legendas não têm fala dentro desse clipe");
  if (outcome.status === "invalid") return refuse("as legendas deixariam o projeto inválido: alguma legenda passa do tamanho de texto permitido ou o projeto ficaria grande demais");
  const created = outcome.document.tracks.find((t) => t.id === outcome.trackId)!.clips.map((c) => c.id);
  return done(outcome.document, { kind: "track", trackId: outcome.trackId, atMs: source.clip.startMs }, "add_captions", { created, changed: [outcome.trackId] });
}

function blockText(block: EdgeBlock, edge: "start" | "end"): string {
  switch (block.kind) {
    case "neighbour":
      return edge === "end" ? `o clipe ${block.clipId} começa em ${block.ms} ms na mesma faixa` : `o clipe ${block.clipId} termina em ${block.ms} ms na mesma faixa`;
    case "source":
      return `o arquivo de origem só alcança ${block.ms} ms da linha do tempo`;
    case "video":
      return `o vídeo vai de 0 a ${STUDIO_LIMITS.maxVideoMs} ms`;
    case "minimum":
      return `o clipe precisa de pelo menos ${STUDIO_LIMITS.minClipMs} ms`;
    case "locked":
      return `a faixa ${block.trackId} está travada`;
  }
}

function tightest(doc: VideoDocument, ids: readonly string[], edge: "start" | "end", requested: number, ctx: VideoOpContext): EdgeBlock | null {
  const blocks = ids.flatMap((id) => {
    const clip = findClip(doc, id)?.clip;
    const block = clip ? edgeBlock(doc, id, edge, requested, sourceLengthOf(clip, ctx.sourceDuration)) : null;
    return block ? [block] : [];
  });
  const locked = blocks.find((b) => b.kind === "locked");
  if (locked) return locked;
  const timed = blocks.filter((b): b is Exclude<EdgeBlock, { kind: "locked" }> => b.kind !== "locked");
  if (timed.length === 0) return null;
  return timed.reduce((best, b) => (edge === "end" ? (b.ms < best.ms ? b : best) : b.ms > best.ms ? b : best));
}

function busyOn(doc: VideoDocument, trackId: string, startMs: number, durationMs: number, except: ReadonlySet<string>): string | null {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track) return null;
  if (track.locked) return `a faixa ${trackId} está travada`;
  const hit = track.clips.find((c) => !except.has(c.id) && c.startMs < startMs + durationMs && clipEnd(c) > startMs);
  return hit ? `a faixa ${trackId} já tem o clipe ${hit.id} de ${hit.startMs} a ${clipEnd(hit)} ms nesse trecho` : null;
}

function moveBlocks(doc: VideoDocument, primaryId: string, group: readonly string[], trackId: string | undefined, start: number): string[] {
  const primary = findClip(doc, primaryId)!;
  const except = new Set(group);
  return group.flatMap((id) => {
    const { clip, track } = findClip(doc, id)!;
    const target = id === primaryId ? (trackId ?? track.id) : track.id;
    const reason = busyOn(doc, target, start + (clip.startMs - primary.clip.startMs), clip.durationMs, except);
    return reason ? [reason] : [];
  });
}

function moveOne(doc: VideoDocument, op: VideoOperation): Outcome {
  if (!op.clip_id || !findClip(doc, op.clip_id)) return missingClip(op.clip_id);
  const start = op.start_ms ?? op.at_ms;
  if (start === undefined) return refuse("move_clip precisa de start_ms");
  if (op.track_id && !doc.tracks.some((t) => t.id === op.track_id)) return missingTrack(op.track_id);
  const group = withLinked(doc, [op.clip_id]);
  const exactly = (result: VideoDocument, trackId: string | undefined) => {
    const moved = findClip(result, op.clip_id!);
    return result !== doc && moved !== null && moved.clip.startMs === Math.max(0, Math.round(start)) && (!trackId || moved.track.id === trackId);
  };
  const next = moveGroup(doc, op.clip_id, group, op.track_id ?? null, start);
  if (exactly(next, op.track_id)) return done(next, { kind: "clip", clipId: op.clip_id }, "move_clip", { changed: group });
  const blocks = moveBlocks(doc, op.clip_id, group, op.track_id, start);
  const home = findClip(doc, op.clip_id)!;
  const targetId = op.track_id ?? home.track.id;
  const target = doc.tracks.find((t) => t.id === targetId)!;
  if (group.length === 1 && blocks.length > 0 && trackAccepts(target.kind, home.clip.type)) {
    const added = addTrack(doc, target.kind, doc.tracks.indexOf(target) + 1);
    const placed = moveGroup(added.document, op.clip_id, group, added.trackId, start);
    if (exactly(placed, added.trackId)) return done(placed, { kind: "clip", clipId: op.clip_id }, "move_clip", { changed: group, notes: [`${blocks[0]}; coloquei numa faixa nova logo acima dela (${added.trackId})`] });
  }
  const reason = blocks.length > 0 ? blocks.join("; ") : `a faixa ${targetId} não recebe esse clipe ou o tempo ${start} ms fica fora do vídeo`;
  return refuse(`o clipe não pôde ir para ${start} ms: ${reason}; mova ou apague o que está no caminho antes, ou use outra faixa`);
}

function trim(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (!op.clip_id || !findClip(doc, op.clip_id)) return missingClip(op.clip_id);
  if (op.start_ms === undefined && op.end_ms === undefined && op.duration_ms === undefined) return refuse("trim_clip precisa de start_ms, end_ms ou duration_ms");
  const group = withLinked(doc, [op.clip_id]);
  const notes: string[] = [];
  const problems: string[] = [];
  let moved = false;
  let next = doc;
  const edgeTo = (edge: "start" | "end", requested: number) => {
    const block = tightest(next, group, edge, requested, ctx);
    if (block?.kind !== "locked") next = trimLinked(next, op.clip_id!, edge, block ? block.ms : requested, sourceOf(next, ctx));
    const clip = findClip(next, op.clip_id!)!.clip;
    const reached = edge === "start" ? clip.startMs : clipEnd(clip);
    const before = findClip(doc, op.clip_id!)!.clip;
    const unchanged = reached === (edge === "start" ? before.startMs : clipEnd(before));
    if (!unchanged) moved = true;
    if (reached === Math.round(requested) || !block) return;
    const label = edge === "start" ? "o início" : "o fim";
    (unchanged ? problems : notes).push(unchanged ? `${label} não mudou: ${blockText(block, edge)}` : `${label} ficou em ${reached} ms porque ${blockText(block, edge)}`);
  };
  if (op.start_ms !== undefined) edgeTo("start", op.start_ms);
  const end = op.end_ms ?? (op.duration_ms !== undefined ? findClip(next, op.clip_id)!.clip.startMs + op.duration_ms : undefined);
  if (end !== undefined) edgeTo("end", end);
  if (!moved) return refuse(problems.length > 0 ? `${problems.join("; ")}; mova ou apague esse clipe antes, ou corte só até lá` : "o clipe já tem esse início e esse fim");
  return checkedClips(doc, next, [op.clip_id], null) ?? done(next, { kind: "clip", clipId: op.clip_id }, "trim_clip", { changed: withLinked(next, [op.clip_id]), notes: [...notes, ...problems] });
}

function slip(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return missingClip(op.clip_id);
  if (op.trim_in_ms === undefined) return refuse("slip_clip precisa de trim_in_ms");
  const next = setClipTrimIn(doc, found.clip.id, op.trim_in_ms, sourceLengthOf(found.clip, ctx.sourceDuration));
  if (next === doc) return refuse("o ponto de entrada não mudou: só vídeo e áudio têm origem, a faixa pode estar travada ou o valor já é esse");
  return done(next, { kind: "clip", clipId: found.clip.id }, "slip_clip", { changed: [found.clip.id] });
}

function trimBlockText(block: TrimBlock): string {
  switch (block.limit) {
    case "source":
      return `a mídia do clipe ${block.clipId} acaba aí`;
    case "minimum":
      return `o clipe ${block.clipId} ficaria com menos de ${STUDIO_LIMITS.minClipMs} ms`;
    case "video":
      return `o vídeo vai de 0 a ${STUDIO_LIMITS.maxVideoMs} ms`;
    case "neighbour":
      return `o clipe ${block.clipId} está no caminho`;
  }
}

function transitionNotes(before: VideoDocument, after: VideoDocument): string[] {
  return before.tracks.flatMap((track) =>
    (track.transitions ?? []).flatMap((transition) => {
      const now = findTransition(after, transition.id)?.transition;
      if (!now) return [`a transição ${transition.id} saiu porque um dos clipes ficou curto demais para ela`];
      return now.durationMs < transition.durationMs ? [`a transição ${transition.id} ficou com ${now.durationMs} ms, a metade do clipe mais curto`] : [];
    }),
  );
}

function trimOutcome(doc: VideoDocument, op: VideoOperation, result: TrimEdit, subject: string, currentMs: number): Outcome {
  const home = findClip(doc, op.clip_id!)!.track.id;
  const hint = (trackId: string | undefined) => (op.linked !== false && trackId !== undefined && trackId !== home ? "; com linked false só este clipe muda e o clipe ligado fica onde está" : "");
  if (!result.ok) {
    switch (result.reason) {
      case "missing":
        return missingClip(op.clip_id);
      case "locked":
        return refuse(`a faixa ${result.trackId} está travada; destrave com update_track antes${hint(result.trackId)}`);
      case "unchanged":
        return refuse(`${subject} já está em ${currentMs} ms`);
      case "invalid":
        return refuse(`a edição deixaria o projeto inválido; ${READ_AGAIN}`);
      case "blocked":
        return refuse(`${subject} não mudou: ${trimBlockText(result.block)}${hint(result.block.clipId ? findClip(doc, result.block.clipId)?.track.id : undefined)}`);
    }
  }
  const notes = [...(result.block ? [`${subject} ficou em ${result.atMs} ms porque ${trimBlockText(result.block)}`] : []), ...transitionNotes(doc, result.document)];
  return checkedClips(doc, result.document, result.changed, null) ?? done(result.document, { kind: "clip", clipId: op.clip_id! }, op.op, { changed: result.changed, notes });
}

function roll(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return missingClip(op.clip_id);
  if (op.edge !== "start" && op.edge !== "end") return refuse("roll_edit precisa de edge: end move o corte depois do clipe, start o corte antes dele");
  if (op.at_ms === undefined) return refuse("roll_edit precisa de at_ms, o novo tempo do corte na linha do tempo");
  const cutMs = op.edge === "end" ? clipEnd(found.clip) : found.clip.startMs;
  return trimOutcome(doc, op, rollCut(doc, found.clip.id, op.edge, op.at_ms, sourceOf(doc, ctx), { linked: op.linked !== false }), "o corte", cutMs);
}

function slide(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return missingClip(op.clip_id);
  if (op.start_ms === undefined) return refuse("slide_clip precisa de start_ms, o novo início do clipe na linha do tempo");
  return trimOutcome(doc, op, slideClip(doc, found.clip.id, op.start_ms, sourceOf(doc, ctx), { linked: op.linked !== false }), "o início do clipe", found.clip.startMs);
}

function split(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (!op.clip_id || !findClip(doc, op.clip_id)) return missingClip(op.clip_id);
  const at = op.at_ms ?? ctx.playheadMs;
  const next = splitAt(doc, at, withLinked(doc, [op.clip_id]));
  if (next === doc) return refuse("o corte precisa cair dentro do clipe, a pelo menos 100 ms das pontas, numa faixa destravada");
  const created = newIds(doc, next);
  const right = created.find((id) => findClip(next, id)?.track.id === findClip(doc, op.clip_id!)!.track.id);
  return done(next, { kind: "clip", clipId: op.clip_id }, "split_clip", { created: right ? [right, ...created.filter((id) => id !== right)] : created });
}

function remove(doc: VideoDocument, op: VideoOperation): Outcome {
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const group = withLinked(doc, ids);
  const next = op.ripple ? rippleDeleteClips(doc, group) : deleteClips(doc, group);
  if (group.some((id) => findClip(next, id))) return refuse("nada foi apagado: algum clipe está numa faixa travada");
  const anchor = findClip(doc, ids[0])!;
  return done(next, { kind: "track", trackId: anchor.track.id, atMs: anchor.clip.startMs }, "delete_clips", { changed: group });
}

function duplicate(doc: VideoDocument, op: VideoOperation): Outcome {
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const result = duplicateGroup(doc, withLinked(doc, ids));
  if (result.clipIds.length === 0) return refuse(`a cópia não cabe antes do fim do vídeo, que vai até ${STUDIO_LIMITS.maxVideoMs} ms, ou a faixa está travada`);
  return done(result.document, { kind: "clip", clipId: result.clipIds[0] }, "duplicate_clips", { created: result.clipIds });
}

const PLACEMENT_SWITCHES = [
  ["flip_x", "flipX"],
  ["flip_y", "flipY"],
  ["auto_orient", "autoOrient"],
] as const;

function orientNote(clip: Clip, op: VideoOperation): string[] {
  return op.auto_orient && !onPath(clip) ? ["auto_orient só gira o clipe enquanto ele anda por position (trajeto curvo); use set_path com curved true ou animate com property position"] : [];
}

function clipPatch(clip: Clip, op: VideoOperation, ctx: VideoOpContext): { ok: true; patch: ClipPatch; ignored: string[] } | { ok: false; reason: string } {
  const patch: ClipPatch = {};
  if (op.volume !== undefined) patch.volume = op.volume;
  if (op.pan !== undefined) {
    if (clip.type !== "audio") return { ok: false, reason: `pan vale só para clipes de áudio; o clipe é ${clip.type}` };
    if (!panInRange(op.pan)) return { ok: false, reason: PAN_TEXT };
    if (clip.keyframes?.pan) return { ok: false, reason: "o pan deste clipe está animado; mude as chaves com animate property pan" };
    patch.pan = op.pan === 0 ? undefined : op.pan;
  }
  if (op.fade_in_ms !== undefined) Object.assign(patch, fadePatch("in", op.fade_in_ms));
  if (op.fade_out_ms !== undefined) Object.assign(patch, fadePatch("out", op.fade_out_ms));
  if (op.fit !== undefined) {
    if (clip.type !== "video" && clip.type !== "image") return { ok: false, reason: "fit só vale para vídeos e imagens" };
    patch.fit = op.fit;
  }
  if (op.blur !== undefined) {
    const [low, high] = KEYFRAME_RANGES.blur;
    if (clip.type === "audio") return { ok: false, reason: "um áudio não tem imagem para desfocar" };
    if (op.blur < low || op.blur > high) return { ok: false, reason: `blur vai de ${low} a ${high} px` };
    if (clip.keyframes?.blur) return { ok: false, reason: "o desfoque deste clipe está animado; mude as chaves com animate property blur" };
    patch.blur = op.blur > 0 ? op.blur : undefined;
  }
  const matte = mattePatchOf(clip, op);
  if (typeof matte === "string") return { ok: false, reason: matte };
  Object.assign(patch, matte);
  for (const [field, key] of PLACEMENT_SWITCHES) {
    if (op[field] === undefined) continue;
    if (clip.type === "audio") return { ok: false, reason: `um áudio não tem imagem para ${field}` };
    patch[key] = op[field] || undefined;
  }
  const organized = organizeClipPatch(clip, op);
  if (!organized.ok) return organized;
  Object.assign(patch, organized.patch);
  const blurred = motionBlurPatch(clip, op);
  if (!blurred.ok) return blurred;
  Object.assign(patch, blurred.patch);
  const tilted = tiltPatch(clip, op);
  if (!tilted.ok) return tilted;
  Object.assign(patch, tilted.patch);
  if (hasBox(op)) {
    if (clip.type === "audio") return { ok: false, reason: "um áudio não tem posição na tela" };
    patch.transform = withBox(clip.transform, op);
  }
  const blended = mediaBlendOf(clip, op);
  if (typeof blended === "string") return { ok: false, reason: blended };
  Object.assign(patch, blended.patch);
  const listed = hasClipStyle(op) ? clipStylePatch(clip, op, (mediaId) => ctx.mediaType(mediaId) === "image") : null;
  if (listed && !listed.ok) return listed;
  const listNotes = listed?.ok ? listed.ignored : [];
  if (listed?.ok) Object.assign(patch, listed.patch);
  if (hasStyle(blended.rest)) {
    const style = stylePatch(blended.rest, LAYER_CLEARS);
    if (!style.ok) return style;
    const allowed = fitsLayer(clip.layer, style.value);
    if (!allowed.ok) return allowed;
    if (Object.keys(allowed.value).length > 0) patch.layer = { ...(patch.layer ?? clip.layer!), ...allowed.value };
    return { ok: true, patch, ignored: [...orientNote(clip, op), ...allowed.ignored, ...listNotes] };
  }
  return { ok: true, patch, ignored: [...orientNote(clip, op), ...listNotes] };
}

function animateEffectOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return missingClip(op.clip_id);
  const held = lockedClip(doc, [found.clip.id]);
  if (held) return held;
  const result = animateEffect(doc, op, found.clip);
  if (!result.ok) return refuse(result.reason);
  const t = found.clip.transform;
  return done(result.document, { kind: "frame", x: t.x, y: t.y, w: t.w, h: t.h }, "animate_effect", { changed: [found.clip.id] });
}

function update(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const held = lockedClip(doc, ids);
  if (held) return held;
  let next = doc;
  const notes: string[] = [];
  for (const id of ids) {
    const clip = findClip(next, id)!.clip;
    const built = clipPatch(clip, op, ctx);
    if (!built.ok) return refuse(`clipe ${id}: ${built.reason}`);
    notes.push(...built.ignored.map((note) => `clipe ${id}: ${note}`));
    if (Object.keys(built.patch).length > 0) next = updateClip(next, id, built.patch);
    if (op.duration_ms !== undefined) next = trimLinked(next, id, "end", clip.startMs + op.duration_ms, sourceOf(next, ctx));
  }
  if (op.disabled !== undefined) next = setClipsDisabled(next, ids, op.disabled);
  if (next === doc && notes.length > 0) return refuse(`nada foi aplicado: ${notes.join("; ")}`);
  return checkedClips(doc, next, ids, null) ?? done(next, focusOf(next, ids[0], op), "update_clip", { changed: ids, notes: [...notes, ...closedShutterNotes(next, op)] });
}

function focusOf(doc: VideoDocument, clipId: string, op: VideoOperation): AgentFocus {
  const clip = findClip(doc, clipId)?.clip;
  if (clip && clip.type !== "audio" && (hasBox(op) || hasStyle(op))) return { kind: "frame", x: clip.transform.x, y: clip.transform.y, w: clip.transform.w, h: clip.transform.h };
  return { kind: "clip", clipId };
}

function agentFrame(property: AnimatedProperty, k: AgentKey): TimedKey | null {
  const base = { atMs: Math.round(k.at_ms), easing: k.easing ?? DEFAULT_KEY_EASING };
  if (isPathProperty(property)) {
    if (typeof k.x !== "number" || typeof k.y !== "number") return null;
    return { ...base, x: k.x, y: k.y, ...(k.spatial ? { spatial: k.spatial } : {}), ...(k.in ? { in: k.in } : {}), ...(k.out ? { out: k.out } : {}) };
  }
  if (isColorProperty(property)) return typeof k.color === "string" ? { ...base, color: k.color } : null;
  return typeof k.value === "number" ? { ...base, value: k.value, ...(k.smooth ? { smooth: true } : {}) } : null;
}

function keysNeedText(property: AnimatedProperty): string {
  if (isPathProperty(property)) return "as chaves de position precisam de x e y; spatial, in e out são opcionais";
  return isColorProperty(property) ? `as chaves de ${property} precisam de color (#rrggbb ou #rrggbbaa)` : `as chaves de ${property} precisam de value`;
}

function morphRefusalText(reason: Extract<MorphEdit, { ok: false }>["reason"], clip: Clip): string {
  switch (reason) {
    case "missing":
    case "locked":
      return clipAccessText(reason, clip.id);
    case "notVisual":
    case "notShape":
      return `path anima o caminho de formas (rect, ellipse, triangle, star e path); o clipe ${clip.id} é ${clip.layer?.shape ?? clip.type}`;
    case "outside":
      return `as chaves de ${MORPH_PROPERTY} vão de 0 a ${clip.durationMs} ms, o tempo dentro do clipe ${clip.id}`;
    case "badPath":
    case "invalid":
      return PATH_KEYS_TEXT;
    case "noKey":
    case "animated":
      return `o caminho do clipe ${clip.id} tem chaves; mande todas as chaves de path de novo`;
  }
}

function animatePath(doc: VideoDocument, clip: Clip, op: VideoOperation): Outcome {
  const held = lockedClip(doc, [clip.id]);
  if (held) return held;
  const frames = morphLaneFrames(doc, clip.id, [...(op.keys ?? [])].sort((a, b) => a.at_ms - b.at_ms));
  if (typeof frames === "string") return refuse(frames);
  const result = setPathKeys(doc, clip.id, frames);
  if (!result.ok) return refuse(morphRefusalText(result.reason, clip));
  const converted = clip.layer?.shape !== "path" ? [`o ${clip.layer?.shape} virou uma forma path para o caminho poder mudar de forma`] : [];
  return done(result.document, { kind: "frame", x: clip.transform.x, y: clip.transform.y, w: clip.transform.w, h: clip.transform.h }, "animate", { changed: [clip.id], notes: converted });
}

function animate(doc: VideoDocument, op: VideoOperation): Outcome {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return missingClip(op.clip_id);
  const property = op.property;
  if (!property || !(ANIMATED_PROPERTIES as readonly string[]).includes(property)) return refuse(`animate precisa de property: ${ANIMATED_PROPERTIES.join(", ")}`);
  if (isMorphProperty(property)) return animatePath(doc, found.clip, op);
  if (isSpeedProperty(property) && found.clip.type !== "video" && found.clip.type !== "audio") return refuse(`speed anima a velocidade só de clipes de vídeo e áudio; o clipe ${found.clip.id} é ${found.clip.type}`);
  if (isSpeedProperty(property) && found.clip.freeze) return refuse(`o clipe ${found.clip.id} é um quadro congelado e não tem velocidade`);
  const tiltReason = tiltRefusal(found.clip, property);
  if (tiltReason) return refuse(tiltReason);
  if (isGradeProperty(property) && found.clip.type !== "video" && found.clip.type !== "image" && found.clip.type !== "effect") return refuse(`${property} anima a correção de cor só de clipes de vídeo, imagem e efeito; o clipe ${found.clip.id} é ${found.clip.type}`);
  if (isCameraProperty(property) && found.clip.type !== "effect") return refuse(`${property} anima a câmera de um clipe de efeito; o clipe ${found.clip.id} é ${found.clip.type}`);
  if (found.clip.type === "effect" && !takesAdjustmentKey(property)) return refuse(`um clipe de efeito anima só blur, a correção de cor (exposure, contrast, highlights, shadows, whites, blacks, temperature, tint, saturation, vibrance) e a câmera (cameraPanX, cameraPanY, cameraZoom, cameraRotation); a força vem de update_clip opacity e dos fades`);
  if (found.clip.type === "audio" && !isAudioProperty(property) && !isSpeedProperty(property)) return refuse(`um clipe de áudio só anima ${AUDIO_PROPERTIES.join(" e ")}: gainDb é o volume em dB e pan vai de -1 (esquerda) a 1 (direita); para entrada e saída use fade_in_ms e fade_out_ms`);
  if (found.clip.type !== "audio" && isAudioProperty(property)) return refuse(`${property} anima só clipes de áudio; o clipe ${found.clip.id} é ${found.clip.type}`);
  if (isColorProperty(property) && !(found.clip.layer && paintsProperty(found.clip.layer, property))) {
    return refuse(`o clipe ${found.clip.id} não tem ${property} para animar; fill vale para textos, ícones e formas fechadas sem degradê, stroke para linhas, setas e textos ou formas com contorno`);
  }
  const lineGroup = isLineProperty(property) ? lineGroupFor(found.clip, property) : isTextKeyProperty(property) ? textGroupFor(found.clip, property) : {};
  if (typeof lineGroup === "string") return refuse(lineGroup);
  const held = lockedClip(doc, [found.clip.id]);
  if (held) return held;
  const keys = [...(op.keys ?? [])].sort((a, b) => a.at_ms - b.at_ms);
  const outside = keys.find((k) => k.at_ms < 0 || k.at_ms > found.clip.durationMs);
  if (outside) return refuse(keyOutsideClipText(property, Math.round(outside.at_ms), found.clip.durationMs));
  const frames = keys.map((k) => agentFrame(property, k));
  if (frames.some((frame) => frame === null)) return refuse(keysNeedText(property));
  const present = frames.filter((frame): frame is TimedKey => frame !== null);
  const placed = isPathProperty(property) ? fillHandles(present.filter(isPositionKey), canvasAspect(doc)) : present;
  const replaced = placed.length > 0 ? droppedRivals(found.clip.keyframes, property) : [];
  const next = withLane(found.clip.keyframes, property, placed);
  const fault = keyframeFault(next, found.clip.transform);
  if (fault) return refuse(keyframeFaultText(fault));
  const after = updateClip(doc, found.clip.id, { ...lineGroup, keyframes: next, ...(isSpeedProperty(property) && placed.length > 0 ? { speed: undefined } : {}) });
  const notes = replaced.length > 0 ? [`${property} substituiu as chaves de ${replaced.join(" e ")}, que não animam junto com ${property}`] : [];
  return done(after, { kind: "frame", x: found.clip.transform.x, y: found.clip.transform.y, w: found.clip.transform.w, h: found.clip.transform.h }, "animate", { changed: [found.clip.id], notes });
}

const ANCHOR_TEXT = `anchor_x e anchor_y vão de ${ANCHOR_RANGE[0]} a ${ANCHOR_RANGE[1]}: 0 é a borda esquerda ou de cima do clipe, 0.5 o centro e 1 a borda direita ou de baixo`;

function visualTargets(doc: VideoDocument, op: VideoOperation, name: string): string[] | Outcome {
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const held = lockedClip(doc, ids);
  if (held) return held;
  const sound = ids.find((id) => findClip(doc, id)!.clip.type === "audio");
  return sound ? refuse(`o clipe ${sound} é áudio; ${name} vale só para clipes com imagem`) : ids;
}

function setAnchorOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (op.anchor !== undefined && !isAnchorPoint(op.anchor)) return refuse(`anchor precisa ser um de: ${Object.keys(ANCHOR_POINTS).join(", ")}`);
  if (op.anchor === undefined && op.anchor_x === undefined && op.anchor_y === undefined) return refuse("set_anchor precisa de anchor ou de anchor_x e anchor_y");
  const picked = visualTargets(doc, op, "set_anchor");
  if (!Array.isArray(picked)) return picked;
  const aspect = canvasAspect(doc);
  const notes: string[] = [];
  let next = doc;
  for (const id of picked) {
    const clip = findClip(next, id)!.clip;
    const base = op.anchor ? ANCHOR_POINTS[op.anchor] : anchorOf(clip);
    const anchor = { x: op.anchor_x ?? base.x, y: op.anchor_y ?? base.y };
    if (!anchorFits(anchor)) return refuse(ANCHOR_TEXT);
    const moment = clipTime(clip, ctx.playheadMs);
    const change = anchorPatch(clip, anchor, op.keep_visual ?? true, moment, aspect);
    if (change.kept === "moment") notes.push(`clipe ${id}: a imagem ficou no lugar em ${Math.round(moment)} ms; como a rotação ou a escala animam, nos outros instantes o clipe gira e cresce em volta da âncora nova`);
    if (change.kept === "keys") notes.push(`clipe ${id}: as chaves de posição foram corrigidas para a imagem ficar no lugar em cada uma`);
    next = updateClip(next, id, change.patch);
  }
  return checkedClips(doc, next, picked, null) ?? done(next, { kind: "clip", clipId: picked[0] }, "set_anchor", { changed: picked, notes });
}

function scaleAxesOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (op.separate === undefined) return refuse("scale_axes precisa de separate: true separa scale em scaleX e scaleY, false junta scaleX e scaleY em scale");
  const picked = visualTargets(doc, op, "scale_axes");
  if (!Array.isArray(picked)) return picked;
  const notes: string[] = [];
  let next = doc;
  for (const id of picked) {
    const clip = findClip(next, id)!.clip;
    if (!op.separate && !op.keep_axis && !scaleAxesMatch(clip)) return refuse(`no clipe ${id} scaleX e scaleY têm chaves diferentes; diga keep_axis x ou y para escolher qual vira scale`);
    const result = op.separate ? splitScale(clip, clipTime(clip, ctx.playheadMs)) : linkScale(clip, op.keep_axis ?? "x");
    if (result.ok) next = updateClip(next, id, result.patch);
    else notes.push(`clipe ${id}: a escala já estava ${op.separate ? "separada" : "junta"}`);
  }
  return checkedClips(doc, next, picked, notes.join("; ") || null) ?? done(next, { kind: "clip", clipId: picked[0] }, "scale_axes", { changed: picked, notes });
}

function setPathOp(doc: VideoDocument, op: VideoOperation): Outcome {
  if (op.curved === undefined) return refuse("set_path precisa de curved: true junta x e y num trajeto curvo (position), false volta para x e y separados");
  const picked = visualTargets(doc, op, "set_path");
  if (!Array.isArray(picked)) return picked;
  const aspect = canvasAspect(doc);
  const notes: string[] = [];
  let next = doc;
  for (const id of picked) {
    const clip = findClip(next, id)!.clip;
    const result = op.curved ? curvePath(clip, "auto") : straightenPath(clip, aspect);
    if (!result.ok) {
      notes.push(op.curved && !onPath(clip) ? `clipe ${id}: não anima x nem y; anime position direto com animate` : `clipe ${id}: o trajeto já estava ${op.curved ? "curvo" : "separado em x e y"}`);
      continue;
    }
    next = updateClip(next, id, result.patch);
  }
  return checkedClips(doc, next, picked, notes.join("; ") || null) ?? done(next, { kind: "clip", clipId: picked[0] }, "set_path", { changed: picked, notes });
}

function preset(doc: VideoDocument, op: VideoOperation): Outcome {
  if (!op.preset || !(KEYFRAME_PRESETS as readonly string[]).includes(op.preset)) return refuse(`motion_preset precisa de preset: ${KEYFRAME_PRESETS.join(", ")}`);
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const held = lockedClip(doc, ids);
  if (held) return held;
  let next = doc;
  for (const id of ids) {
    const clip = findClip(next, id)!.clip;
    if (clip.type === "audio") return refuse(`o clipe ${id} é áudio e não tem animação`);
    const keyframes = withPreset(clip, op.preset);
    const fault = keyframeFault(keyframes, clip.transform);
    if (fault) return refuse(`o clipe ${id} não aceita ${op.preset}: ${keyframeFaultText(fault)}`);
    next = updateClip(next, id, { keyframes });
  }
  return checkedClips(doc, next, ids, null) ?? done(next, { kind: "clip", clipId: ids[0] }, "motion_preset", { changed: ids });
}

function edge(doc: VideoDocument, op: VideoOperation, side: "in" | "out", ctx: VideoOpContext): Outcome {
  const transition = op.transition_kind !== undefined;
  if (transition && op.effect !== undefined) return refuse("mande effect (fade, deslizes ou none) ou transition_kind, não os dois");
  const effect = op.effect ?? "fade";
  if (!transition && !(ENTRANCE_PRESETS as readonly string[]).includes(effect)) return refuse(`effect precisa ser um de: ${ENTRANCE_PRESETS.join(", ")}`);
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const held = lockedClip(doc, ids);
  if (held) return held;
  let next = doc;
  const notes: string[] = [];
  for (const id of ids) {
    const { track, clip } = findClip(next, id)!;
    if (transition) {
      const change = edgeTransitionChange(track, clip, side, op, ctx);
      if (typeof change === "string") return refuse(change);
      notes.push(...change.notes);
      next = updateClip(next, id, change.patch);
      continue;
    }
    if (clip.type === "audio" && effect !== "fade" && effect !== "none") return refuse(`o clipe ${id} é áudio: só fade ou none`);
    next = updateClip(next, id, motionPresetPatch(side, effect, op.duration_ms ?? DEFAULT_MOTION_MS));
  }
  return checkedClips(doc, next, ids, null) ?? done(next, { kind: "clip", clipId: ids[0] }, side === "in" ? "entrance" : "exit", { changed: ids, notes });
}

const TEXT_ANIMATOR_FIELDS: Record<keyof TextAnimator, string> = {
  unit: `unit (${TEXT_UNITS.join(", ")})`,
  style: `text_style (${TEXT_STYLES.join(", ")} ou none)`,
  easing: "easing (uma das curvas das chaves ou cubic-bezier)",
  durationMs: `duration_ms (${TEXT_ANIMATION_LIMITS.durationMs.join(" a ")})`,
  staggerMs: `stagger_ms (${TEXT_ANIMATION_LIMITS.staggerMs.join(" a ")})`,
};

function textAnimatorOf(op: VideoOperation, style: TextStyle): TextAnimator {
  const base = defaultTextAnimator(op.unit ?? defaultUnitFor(style), style);
  return { ...base, ...(op.duration_ms !== undefined ? { durationMs: op.duration_ms } : {}), ...(op.stagger_ms !== undefined ? { staggerMs: op.stagger_ms } : {}), ...(op.easing !== undefined ? { easing: op.easing } : {}) };
}

function animateText(doc: VideoDocument, op: VideoOperation): Outcome {
  if (op.side !== "in" && op.side !== "out") return refuse("animate_text precisa de side: in ou out");
  const side = op.side;
  const style = op.text_style;
  if (style !== "none" && !(TEXT_STYLES as readonly string[]).includes(style ?? "")) return refuse(`animate_text precisa de ${TEXT_ANIMATOR_FIELDS.style}`);
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const notText = ids.find((id) => !animatesText(findClip(doc, id)!.clip));
  if (notText) return refuse(`o clipe ${notText} não é um texto; animate_text só anima textos`);
  const held = lockedClip(doc, ids);
  if (held) return held;
  const animator = style === "none" ? null : textAnimatorOf(op, style!);
  const fault = animator ? textAnimatorFault(animator) : null;
  if (fault) return refuse(`animate_text: confira ${TEXT_ANIMATOR_FIELDS[fault.field]}`);
  const next = ids.reduce((current, id) => updateClip(current, id, textAnimationPatch(side, animator)), doc);
  return checkedClips(doc, next, ids, null) ?? done(next, { kind: "clip", clipId: ids[0] }, "animate_text", { changed: ids });
}

function retimeRefusal(reason: RetimeRefusal, clipId: string, doc: VideoDocument): Outcome {
  switch (reason) {
    case "missing":
      return missingClip(clipId);
    case "locked":
      return lockedClip(doc, [clipId]) ?? refuse(`o clipe ${clipId} está numa faixa travada`);
    case "notSourced":
      return refuse(`o clipe ${clipId} não é vídeo nem áudio; só vídeo e áudio mudam de velocidade`);
    case "notVideo":
      return refuse(`freeze_frame congela só clipes de vídeo, e ${clipId} não é um`);
    case "frozen":
      return refuse(`o clipe ${clipId} é um quadro congelado; mude a duração dele com trim_clip`);
    case "range":
      return refuse(`speed vai de ${SPEED_LIMITS[0]} a ${SPEED_LIMITS[1]} e o clipe precisa de pelo menos ${STUDIO_LIMITS.minClipMs} ms; confira speed ou duration_ms`);
    case "source":
      return refuse(`com keep_duration a mídia do clipe ${clipId} acaba antes do fim; reduza speed ou tire keep_duration`);
    case "noRoom":
      return refuse(`não há espaço na linha do tempo para o clipe ${clipId} com essa duração; deixe ripple ligado ou abra espaço antes`);
  }
}

function speedOutcome(doc: VideoDocument, result: SpeedOpResult, clipId: string, label: string): Outcome {
  if (!result.ok) return "refusal" in result ? retimeRefusal(result.refusal, clipId, doc) : refuse(result.reason);
  return checkedClips(doc, result.document, [clipId], null) ?? done(result.document, { kind: "clip", clipId }, label, { changed: [clipId] });
}

function setSpeed(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (!op.clip_id) return missingClip(undefined);
  const retiming = op.speed !== undefined || op.duration_ms !== undefined || op.reverse !== undefined || op.preserve_pitch !== undefined;
  if (!retiming && op.frame_mix === undefined) return refuse("set_speed precisa de speed, duration_ms, reverse, preserve_pitch ou frame_mix");
  if (!retiming) return speedOutcome(doc, frameMixOperation(doc, op.clip_id, op.frame_mix!), op.clip_id, "set_speed");
  if (op.protect_edges_ms !== undefined && op.stretch_keys === false) return refuse("protect_edges_ms vale quando as chaves acompanham a nova duração; tire stretch_keys false");
  if (op.protect_edges_ms !== undefined && !(op.protect_edges_ms >= 0)) return refuse("protect_edges_ms é quanto tempo do começo e do fim do clipe guarda as chaves no lugar, em ms, de 0 para cima");
  const result = retimeClip(
    doc,
    op.clip_id,
    {
      speed: op.speed,
      durationMs: op.duration_ms,
      keep: op.keep_duration ? "duration" : "source",
      reverse: op.reverse,
      preservePitch: op.preserve_pitch,
      ripple: op.ripple,
      keyframes: op.stretch_keys === false ? "keep" : "stretch",
      protectEdgesMs: op.protect_edges_ms,
    },
    sourceOf(doc, ctx),
  );
  if (!result.ok) return retimeRefusal(result.reason, op.clip_id, doc);
  const mixed = op.frame_mix === undefined ? result : frameMixOperation(result.document, op.clip_id, op.frame_mix);
  return speedOutcome(doc, mixed, op.clip_id, "set_speed");
}

function speedCurveOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (!op.clip_id) return missingClip(undefined);
  return speedOutcome(doc, speedCurveOperation(doc, op, sourceOf(doc, ctx)), op.clip_id, "set_speed_curve");
}

function freeze(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (!op.clip_id) return missingClip(undefined);
  const result = freezeFrame(doc, op.clip_id, op.at_ms ?? ctx.playheadMs, op.duration_ms ?? DEFAULT_FREEZE_MS);
  if (!result.ok) return retimeRefusal(result.reason, op.clip_id, doc);
  return checkedClips(doc, result.document, [result.clipId], null) ?? done(result.document, { kind: "clip", clipId: result.clipId }, "freeze_frame", { created: [result.clipId] });
}

function colorClips(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const change = gradeChangeOf(op, ctx.isLut);
  if (!change.ok) return refuse(change.reason);
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const held = lockedClip(doc, ids);
  if (held) return held;
  const flat = ids.find((id) => {
    const type = findClip(doc, id)!.clip.type;
    return type !== "video" && type !== "image" && type !== "effect";
  });
  if (flat) return refuse(`o clipe ${flat} não é vídeo, imagem nem efeito; a correção de cor vale para clipes de vídeo e imagem e, num clipe de efeito, para tudo o que está abaixo dele`);
  let next = doc;
  for (const id of ids) {
    const clip = findClip(next, id)!.clip;
    const applied = change.apply({ color: clip.color, gradientMap: clip.gradientMap });
    if (typeof applied === "string") return refuse(applied);
    next = updateClip(next, id, { color: applied.color, gradientMap: applied.gradientMap });
  }
  return checkedClips(doc, next, ids, null) ?? done(next, { kind: "clip", clipId: ids[0] }, "set_color", { changed: ids });
}

function ramp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (!op.clip_id) return missingClip(undefined);
  if (op.speed === undefined || op.ramp_ms === undefined) return refuse("speed_ramp precisa de speed (a velocidade de chegada) e ramp_ms (quanto tempo a rampa leva)");
  if (op.easing !== undefined && !isEasing(op.easing)) return refuse(`speed_ramp: a curva ${op.easing} não existe`);
  if (op.ramp_mode !== undefined && !(RAMP_MODES as readonly string[]).includes(op.ramp_mode)) return refuse(`ramp_mode precisa ser um de: ${RAMP_MODES.join(", ")}`);
  if ((op.ramp_mode ?? "smooth") === "smooth") {
    if (op.ramp_steps !== undefined) return refuse("ramp_steps vale só com ramp_mode steps; a rampa suave não tem degraus");
    return speedOutcome(doc, liftRefusal(smoothRamp(doc, op.clip_id, { atMs: op.at_ms ?? ctx.playheadMs, rampMs: op.ramp_ms, toSpeed: op.speed, easing: op.easing, ripple: op.ripple })), op.clip_id, "speed_ramp");
  }
  const result = rampSpeed(doc, op.clip_id, { atMs: op.at_ms ?? ctx.playheadMs, rampMs: op.ramp_ms, toSpeed: op.speed, steps: op.ramp_steps, easing: op.easing }, sourceOf(doc, ctx));
  if (!result.ok) return retimeRefusal(result.reason, op.clip_id, doc);
  const changed = result.document.tracks.flatMap((track) => track.clips.filter((clip) => clip.assetId === findClip(doc, op.clip_id!)?.clip.assetId).map((clip) => clip.id));
  return done(result.document, { kind: "clip", clipId: op.clip_id }, "speed_ramp", { changed });
}

function chromaOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const result = chromaOperation(doc, op, (clip, atMs) => {
    const sample = clipKeySample(clip, keyMoment(clip, atMs, ctx.playheadMs));
    return sample ? ctx.keyColor?.(sample) : undefined;
  })!;
  if (!result.ok) return refuse(result.reason);
  return done(result.document, { kind: "clip", clipId: op.clip_id! }, op.op, { changed: [op.clip_id!] });
}

function lumaOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const result = lumaOperation(doc, op)!;
  if (!result.ok) return refuse(result.reason);
  return done(result.document, { kind: "clip", clipId: op.clip_id! }, op.op, { changed: [op.clip_id!] });
}

function layoutOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const result = layoutOperation(doc, op, ctx.playheadMs)!;
  if (!result.ok) return refuse(result.reason);
  return done(result.document, { kind: "clip", clipId: result.clipId }, op.op, { changed: result.changed, created: result.created, notes: result.notes });
}

function behaviorOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const result = behaviorOperation(doc, op, ctx.levels?.(doc))!;
  if (!result.ok) return refuse(result.reason);
  const focus: AgentFocus = { kind: "clip", clipId: op.clip_id! };
  return op.op === "add_behavior" ? done(result.document, focus, op.op, { created: [result.behaviorId], notes: result.notes }) : done(result.document, focus, op.op, { changed: [op.clip_id!], notes: result.notes });
}

function groupOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const result = groupOperation(doc, op)!;
  if (!result.ok) return refuse(result.reason);
  return done(result.document, { kind: "clip", clipId: result.clipId }, op.op, { changed: result.changed, created: result.created, notes: result.notes, select: result.created.length > 0 && op.op === "group_clips" ? result.created : result.changed });
}

function parentOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const result = parentOperation(doc, op, ctx.playheadMs)!;
  if (!result.ok) return refuse(result.reason);
  return done(result.document, { kind: "clip", clipId: result.clipId }, op.op, { changed: result.changed, created: result.created });
}

function pathOpOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const result = pathOpVideoOperation(doc, op)!;
  if (!result.ok) return refuse(result.reason);
  return done(result.document, { kind: "clip", clipId: result.clipId }, op.op, { changed: [result.clipId], ...(result.created.length > 0 ? { created: result.created } : {}) });
}

function clipRepeatOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const result = clipRepeatOperation(doc, op)!;
  if (!result.ok) return refuse(result.reason);
  return done(result.document, { kind: "clip", clipId: result.clipIds[0] }, op.op, { changed: result.clipIds });
}

function trackOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const result = trackOperation(doc, op, ctx.playheadMs, ctx.trackOutcome ?? (() => undefined))!;
  if (!result.ok) return refuse(result.reason);
  return done(result.document, { kind: "clip", clipId: result.clipId }, op.op, { changed: result.changed, created: result.created, notes: result.notes });
}

function keyEaseOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const result = keyEaseOperation(doc, op, canvasAspect(doc))!;
  if (!result.ok) return refuse(result.reason);
  return done(result.document, { kind: "clip", clipId: result.clipId }, op.op, { changed: [result.clipId] });
}

function styleTextOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return refuse(`o clipe ${op.clip_id ?? "(sem clip_id)"} não existe; leia o projeto de novo com studio_read`);
  const { clip } = found;
  if (found.track.locked) return refuse(`a faixa ${found.track.id} está travada`);
  if (clip.layer?.type === "table" && clip.layer.table) {
    const table = tableCellStyle(clip.layer.table, op);
    if (!table.ok) return refuse(table.reason);
    return done(updateClip(doc, clip.id, { layer: { ...clip.layer, table: table.value } }), { kind: "clip", clipId: clip.id }, op.op, { changed: [clip.id] });
  }
  if (!animatesText(clip) || !clip.layer) return refuse(`o clipe ${clip.id} não é um texto; style_text vale para clipes de texto (add_text) e para células de tabela (com table_row e table_column)`);
  const styled = styledText(clip.layer, clipRunText(clip), op);
  if (!styled.ok) return refuse(styled.reason);
  return done(updateClip(doc, clip.id, { layer: { ...clip.layer, ...styled.value.patch } }), { kind: "clip", clipId: clip.id }, op.op, { changed: [clip.id] });
}

function textOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const result = textOperation(doc, op)!;
  if (!result.ok) return refuse(result.reason);
  return done(result.document, { kind: "clip", clipId: op.clip_id! }, op.op, { changed: [op.clip_id!] });
}

function textAnimatorOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const result = textAnimatorOperation(doc, op)!;
  if (!result.ok) return refuse(result.reason);
  const focus = { kind: "clip" as const, clipId: op.clip_id! };
  return op.op === "add_text_animator" ? done(result.document, focus, op.op, { created: [result.animatorId], changed: [op.clip_id!] }) : done(result.document, focus, op.op, { changed: [op.clip_id!] });
}

function lineOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const result = lineOperation(doc, op)!;
  if (!result.ok) return refuse(result.reason);
  return done(result.document, { kind: "clip", clipId: op.clip_id! }, op.op, { changed: [op.clip_id!] });
}

function maskOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const result = maskOperation(doc, op)!;
  if (!result.ok) return refuse(result.reason);
  const focus: AgentFocus = { kind: "clip", clipId: op.clip_id! };
  return op.op === "add_mask" ? done(result.document, focus, op.op, { created: [result.maskId] }) : done(result.document, focus, op.op, { changed: [op.clip_id!] });
}

function vfxOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const result = vfxOperation(doc, op)!;
  if (!result.ok) return refuse(result.reason);
  const focus: AgentFocus = { kind: "clip", clipId: op.clip_id! };
  return op.op === "add_vfx" ? done(result.document, focus, op.op, { created: [result.vfxId] }) : done(result.document, focus, op.op, { changed: [op.clip_id!] });
}

function setCameraOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return missingClip(op.clip_id);
  const held = lockedClip(doc, [found.clip.id]);
  if (held) return held;
  const result = cameraPatch(found.clip, op, op.at_ms);
  if (!result.ok) return refuse(result.reason);
  return done(updateClip(doc, found.clip.id, result.patch), { kind: "clip", clipId: found.clip.id }, "set_camera", { changed: [found.clip.id] });
}

function addEffectClipOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const vfx = op.vfx_kind === undefined ? null : agentVfx(op, "add_effect_clip", op.track_id ? timelineOf(doc, op.track_id) : doc);
  if (typeof vfx === "string") return refuse(vfx);
  if (vfx && refusedOnEffectClips(vfx.kind)) return refuse(ECHO_ON_EFFECT_CLIP);
  const clip = newEffectClip(vfx ? [vfx] : [], op.at_ms ?? ctx.playheadMs, op.duration_ms ?? DEFAULT_EFFECT_MS);
  if (clip.startMs < 0 || clip.durationMs < STUDIO_LIMITS.minClipMs || clip.startMs + clip.durationMs > STUDIO_LIMITS.maxVideoMs) return noRoom([clip]);
  if (op.track_id) {
    const placed = placeOn(doc, [clip], op.track_id);
    if ("ok" in placed) return placed;
    return done(placed.document, { kind: "clip", clipId: placed.ids[0] }, "add_effect_clip", { created: placed.ids, notes: placed.notes });
  }
  const placed = placeEffectClip(doc, clip);
  return placed ? done(placed.document, { kind: "clip", clipId: placed.clipId }, "add_effect_clip", { created: [placed.clipId] }) : noRoom([clip]);
}

function addTrackOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const kind = op.kind ?? "visual";
  const added = addTrack(doc, kind, op.to_index ?? doc.tracks.length);
  const named = op.name ? updateTrack(added.document, added.trackId, { name: op.name.slice(0, 64) }) : added.document;
  return done(named, { kind: "track", trackId: added.trackId }, "add_track", { created: [added.trackId] });
}

function moveTrackOp(doc: VideoDocument, op: VideoOperation): Outcome {
  if (!op.track_id || !doc.tracks.some((t) => t.id === op.track_id)) return missingTrack(op.track_id);
  if (op.to_index === undefined) return refuse("move_track precisa de to_index");
  const next = moveTrack(doc, op.track_id, op.to_index);
  return done(next, { kind: "track", trackId: op.track_id }, "move_track", { changed: [op.track_id] });
}

function updateTrackOp(doc: VideoDocument, op: VideoOperation): Outcome {
  if (!op.track_id || !doc.tracks.some((t) => t.id === op.track_id)) return missingTrack(op.track_id);
  const patch: TrackPatch = {};
  if (op.name !== undefined) patch.name = op.name.slice(0, 64);
  if (op.hidden !== undefined) patch.hidden = op.hidden;
  if (op.locked !== undefined) patch.locked = op.locked;
  if (op.muted !== undefined) patch.muted = op.muted;
  if (op.gain_db !== undefined) patch.gainDb = op.gain_db === 0 ? undefined : op.gain_db;
  if (op.pan !== undefined) patch.pan = op.pan === 0 ? undefined : op.pan;
  Object.assign(patch, organizeTrackPatch(op));
  if (Object.keys(patch).length === 0) return refuse("update_track precisa de name, hidden, locked, muted, gain_db, pan, label_color ou shy");
  const next = updateTrack(doc, op.track_id, patch);
  const track = next.tracks.find((t) => t.id === op.track_id)!;
  if (trackGainIssue(track)) return refuse(`gain_db vale só em faixas de áudio e vai de ${TRACK_GAIN_RANGE[0]} a ${TRACK_GAIN_RANGE[1]} dB`);
  if (op.pan !== undefined && (track.kind !== "audio" || !panInRange(op.pan))) return refuse(`pan vale só em faixas de áudio; ${PAN_TEXT}`);
  if (trackPanIssue(track)) return refuse(`pan vale só em faixas de áudio; ${PAN_TEXT}`);
  return done(next, { kind: "track", trackId: op.track_id }, "update_track", { changed: [op.track_id] });
}

const DUCKING_FIELDS = `reduce_db de ${DUCKING_RANGES.reduceDb.join(" a ")}, attack_ms de ${DUCKING_RANGES.attackMs.join(" a ")}, release_ms de ${DUCKING_RANGES.releaseMs.join(" a ")}, hold_ms de ${DUCKING_RANGES.holdMs.join(" a ")} e sensitivity de 0 a 1`;

function setDuckingOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const track = doc.tracks.find((t) => t.id === op.track_id);
  if (!track) return missingTrack(op.track_id);
  const rule = withDucking(track.ducking, { triggerTrackIds: op.trigger_track_ids, reduceDb: op.reduce_db, attackMs: op.attack_ms, releaseMs: op.release_ms, holdMs: op.hold_ms, sensitivity: op.sensitivity });
  const next = updateTrack(doc, track.id, { ducking: rule });
  const code = duckingIssue(next.tracks.find((t) => t.id === track.id)!, next);
  if (code === "out_of_range") return refuse(`set_ducking: ${DUCKING_FIELDS}`);
  if (code) return refuse("set_ducking vale em faixas de áudio e precisa de trigger_track_ids com outras faixas de áudio, sem repetir e sem uma faixa abaixar a outra em círculo");
  return done(next, { kind: "track", trackId: track.id }, "set_ducking", { changed: [track.id] });
}

function clearDuckingOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const track = doc.tracks.find((t) => t.id === op.track_id);
  if (!track) return missingTrack(op.track_id);
  if (!track.ducking) return refuse(`a faixa ${track.id} não tem ducking`);
  return done(updateTrack(doc, track.id, { ducking: undefined }), { kind: "track", trackId: track.id }, "clear_ducking", { changed: [track.id] });
}

function bakeDuckingOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const track = doc.tracks.find((t) => t.id === op.track_id);
  if (!track) return missingTrack(op.track_id);
  const held = track.locked ? refuse(`a faixa ${track.id} está travada; destrave com update_track antes`) : null;
  if (held) return held;
  const result = bakeDucking(doc, track.id, ctx.speech);
  if (!result.ok) return refuse(`a faixa ${track.id} não tem ducking para fixar`);
  const changed = track.clips.map((clip) => clip.id);
  return checkedClips(doc, result.document, changed, null) ?? done(result.document, { kind: "track", trackId: track.id }, "bake_ducking", { changed, notes: [`${result.keys} chaves de gainDb escritas`] });
}

function normalizeLoudnessOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const result = normalizeOperation(doc, op, ctx.loudness, ctx.speech);
  if (!result.ok) return refuse(result.reason);
  const focus: AgentFocus = op.track_id ? { kind: "track", trackId: op.track_id } : { kind: "clip", clipId: result.changed[0] };
  return done(result.document, focus, "normalize_loudness", { changed: result.changed, notes: result.notes });
}

function removeTrackOp(doc: VideoDocument, op: VideoOperation): Outcome {
  if (!op.track_id || !doc.tracks.some((t) => t.id === op.track_id)) return missingTrack(op.track_id);
  const next = removeTrack(doc, op.track_id);
  if (next === doc) return refuse("a faixa está travada; destrave antes de remover");
  return done(next, { kind: "time", atMs: 0 }, "remove_track", { changed: [op.track_id] });
}

function presetOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const result = presetOperation(doc, op, ctx.presets)!;
  if (!result.ok) return refuse(result.reason);
  return done(result.document, result.focus, op.op, { changed: result.changed, notes: result.notes });
}

function markerOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const result = markerOperation(doc, op, ctx.playheadMs, ctx.loudness)!;
  if (!result.ok) return refuse(result.reason);
  return done(result.document, result.focus, op.op, { created: result.created, changed: result.changed, notes: result.notes });
}

function linkOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (missing) return missingClip(missing);
  if (ids.length < 2) return refuse("link_clips precisa de pelo menos dois clipes em clip_ids");
  const held = lockedClip(doc, ids);
  if (held) return held;
  return done(linkClips(doc, ids), { kind: "clip", clipId: ids[0] }, "link_clips", { changed: ids });
}

function unlinkOp(doc: VideoDocument, op: VideoOperation): Outcome {
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (ids.length === 0 || missing) return missingClip(missing);
  const held = lockedClip(doc, ids);
  if (held) return held;
  const changed = withLinked(doc, ids);
  return done(unlinkClips(doc, ids), { kind: "clip", clipId: ids[0] }, "unlink_clips", { changed });
}

function canvas(doc: VideoDocument, op: VideoOperation): Outcome {
  if (op.aspect === undefined && op.background === undefined && !hasShutter(op) && op.perspective === undefined) return refuse("set_canvas precisa de aspect, background, shutter_angle, shutter_phase ou perspective");
  const shutter = shutterRefusal(op) ?? perspectiveRefusal(op);
  if (shutter) return refuse(shutter);
  if (op.aspect !== undefined && !VIDEO_ASPECTS.includes(op.aspect)) return refuse(`aspect precisa ser um de: ${VIDEO_ASPECTS.join(", ")}`);
  if (op.background !== undefined && (!isValidColor(op.background, true) || op.background.length !== 7)) return refuse("background precisa ser uma cor #rrggbb");
  const next = produce(doc, (draft) => {
    if (op.aspect) draft.canvas.aspect = op.aspect;
    if (op.background) draft.canvas.background = op.background;
    applyShutter(draft.canvas, op);
    applyPerspective(draft.canvas, op);
  });
  return done(next, { kind: "frame", x: 0.5, y: 0.5 }, "set_canvas");
}

function select(doc: VideoDocument, op: VideoOperation): Outcome {
  const ids = targets(op);
  const missing = ids.find((id) => !findClip(doc, id));
  if (missing) return missingClip(missing);
  return done(doc, ids[0] ? { kind: "clip", clipId: ids[0] } : { kind: "time", atMs: 0 }, "select", { select: ids });
}

function seek(doc: VideoDocument, op: VideoOperation): Outcome {
  if (op.at_ms === undefined) return refuse("seek precisa de at_ms");
  const at = Math.max(0, Math.min(Math.round(op.at_ms), doc.durationMs));
  return done(doc, { kind: "time", atMs: at }, "seek", { seekMs: at });
}

const LAYOUT_OPS: ReadonlySet<VideoOpName> = new Set(["add_media", "add_text", "add_shape", "move_clip", "trim_clip", "roll_edit", "slide_clip", "split_clip", "delete_clips", "duplicate_clips", "update_clip", "sequence_clips", "stagger_clips"]);

function addTransitionOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return missingClip(op.clip_id);
  if (!op.transition_kind) return refuse(transitionRefusal("kind", undefined));
  const map = mapMediaRefusal(op, ctx);
  if (map) return refuse(map);
  const next = op.to_clip_id ?? cutsOf(found.track).find((cut) => cut.fromClipId === found.clip.id)?.toClipId;
  if (!next) return refuse(transitionRefusal("apart", op.transition_kind));
  const result = addTransition(doc, { fromClipId: found.clip.id, toClipId: next, kind: op.transition_kind, durationMs: op.duration_ms, alignment: op.alignment, easing: op.easing, ...transitionOptions(op) });
  if (!result.ok) return refuse(transitionRefusal(result.reason, op.transition_kind, op));
  const placed = findTransition(result.document, result.transitionId)!.transition;
  const notes = op.duration_ms !== undefined && placed.durationMs < Math.round(op.duration_ms) ? [`duration_ms ficou em ${placed.durationMs} ms, a metade do clipe mais curto`] : [];
  return done(result.document, { kind: "clip", clipId: next }, "add_transition", { created: [result.transitionId], notes });
}

function transitionPatch(op: VideoOperation): TransitionPatch {
  return {
    ...(op.transition_kind !== undefined ? { kind: op.transition_kind } : {}),
    ...(op.duration_ms !== undefined ? { durationMs: op.duration_ms } : {}),
    ...(op.alignment !== undefined ? { alignment: op.alignment } : {}),
    ...(op.easing !== undefined ? { easing: op.easing } : {}),
    ...transitionOptions(op),
  };
}

function updateTransitionOp(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  if (!op.transition_id) return refuse(transitionRefusal("missing", undefined));
  const map = mapMediaRefusal(op, ctx);
  if (map) return refuse(map);
  const current = findTransition(doc, op.transition_id);
  const result = updateTransition(doc, op.transition_id, transitionPatch(op));
  if (!result.ok) return refuse(transitionRefusal(result.reason, op.transition_kind ?? current?.transition.kind, op));
  return done(result.document, { kind: "clip", clipId: current!.transition.toClipId }, "update_transition", { changed: [result.transitionId] });
}

function chartVideoOp(doc: VideoDocument, op: VideoOperation & { op: ChartVideoOpName }, ctx: VideoOpContext): Outcome {
  const defaults = { locale: ctx.library?.locale ?? "pt", ink: LIBRARY_INK.video };
  if (op.op === "add_chart") {
    const spec = chartSpecFrom(op, null, defaults);
    if (!spec.ok) return refuse(spec.reason);
    return placeOverlay(doc, op, ctx, newChartLayer(spec.value, chartTransform(VIDEO_ASPECT_SIZES[doc.canvas.aspect], spec.value.kind)), [], "add_chart", "o gráfico não pôde ser criado");
  }
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return missingClip(op.clip_id);
  const { clip } = found;
  const chart = clip.layer?.type === "chart" ? clip.layer.chart : undefined;
  if (!clip.layer || !chart) return refuse(`o clipe ${clip.id} não é um gráfico; crie um com add_chart`);
  const held = lockedClip(doc, [clip.id]);
  if (held) return held;
  if (op.op === "animate_chart") {
    const animator = chartAnimatorFrom(op, clip.chartIn, chart.kind);
    if (!animator.ok) return refuse(animator.reason);
    const next = updateClip(doc, clip.id, chartInPatch(animator.value));
    return checkedClips(doc, next, [clip.id], null) ?? done(next, { kind: "clip", clipId: clip.id }, "animate_chart", { changed: [clip.id] });
  }
  if (!chartChangeRequested(op)) return refuse("update_chart_data precisa de chart_labels, chart_series, chart_kind, chart_style ou chart_format");
  const spec = chartSpecFrom(op, chart, defaults);
  if (!spec.ok) return refuse(spec.reason);
  const next = updateClip(doc, clip.id, { layer: { ...clip.layer, chart: spec.value } });
  return checkedClips(doc, next, [clip.id], null) ?? done(next, { kind: "clip", clipId: clip.id }, "update_chart_data", { changed: [clip.id] });
}

function generatedVideoOp(doc: VideoDocument, op: VideoOperation & { op: TableOpName | QrOpName }, ctx: VideoOpContext): Outcome {
  const canvas = VIDEO_ASPECT_SIZES[doc.canvas.aspect];
  const qrContext = { shortLinkUrl: ctx.shortLinkUrl ?? (() => undefined), naturalSize: ctx.naturalSize ?? (() => undefined) };
  if (op.op === "add_table") {
    const spec = tableSpecFrom(op, null, LIBRARY_INK.video);
    if (!spec.ok) return refuse(spec.reason);
    return placeOverlay(doc, op, ctx, newTableLayer(spec.value, tableTransform(canvas, spec.value)), [], "add_table", "a tabela não pôde ser criada");
  }
  if (op.op === "add_qr_code") {
    const spec = qrSpecFrom(op, null, qrContext);
    if (!spec.ok) return refuse(spec.reason);
    return placeOverlay(doc, op, ctx, newQrLayer(spec.value, qrTransform(canvas)), [], "add_qr_code", "o QR Code não pôde ser criado");
  }
  const found = op.clip_id ? findClip(doc, op.clip_id) : null;
  if (!found) return missingClip(op.clip_id);
  const { clip } = found;
  const held = lockedClip(doc, [clip.id]);
  if (held) return held;
  if (op.op === "update_table") {
    const table = clip.layer?.type === "table" ? clip.layer.table : undefined;
    if (!clip.layer || !table) return refuse(`o clipe ${clip.id} não é uma tabela; crie uma com add_table`);
    const cellEdit = op.text !== undefined && (op.table_row !== undefined || op.table_column !== undefined);
    if (!cellEdit && !tableChangeRequested(op)) return refuse("update_table precisa de table_rows, table_header, table_columns, table_style ou de table_row, table_column e text para uma célula");
    const spec = cellEdit ? tableCellText(table, op, op.text ?? "") : tableSpecFrom(op, table, LIBRARY_INK.video);
    if (!spec.ok) return refuse(spec.reason);
    const next = updateClip(doc, clip.id, { layer: { ...clip.layer, table: spec.value } });
    return checkedClips(doc, next, [clip.id], null) ?? done(next, { kind: "clip", clipId: clip.id }, "update_table", { changed: [clip.id] });
  }
  const qr = clip.layer?.type === "qr" ? clip.layer.qr : undefined;
  if (!clip.layer || !qr) return refuse(`o clipe ${clip.id} não é um QR Code; crie um com add_qr_code`);
  if (!qrChangeRequested(op)) return refuse("update_qr_code precisa de algum campo do QR Code para mudar");
  const spec = qrSpecFrom(op, qr, qrContext);
  if (!spec.ok) return refuse(spec.reason);
  const next = updateClip(doc, clip.id, { layer: { ...clip.layer, qr: spec.value } });
  return checkedClips(doc, next, [clip.id], null) ?? done(next, { kind: "clip", clipId: clip.id }, "update_qr_code", { changed: [clip.id] });
}

function removeTransitionOp(doc: VideoDocument, op: VideoOperation): Outcome {
  if (!op.transition_id) return refuse(transitionRefusal("missing", undefined));
  const current = findTransition(doc, op.transition_id);
  const result = removeTransition(doc, op.transition_id);
  if (!result.ok) return refuse(transitionRefusal(result.reason, undefined));
  return done(result.document, { kind: "clip", clipId: current!.transition.toClipId }, "remove_transition", { changed: [result.transitionId] });
}

function dispatch(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): Outcome {
  switch (op.op) {
    case "add_media":
      return addMedia(doc, op, ctx);
    case "add_text":
      return addText(doc, op, ctx);
    case "add_icon":
      return addIcon(doc, op, ctx);
    case "add_element":
      return addElement(doc, op, ctx);
    case "import_lottie":
      return importLottie(doc, op, ctx);
    case "add_shape":
      return addShape(doc, op, ctx);
    case "add_captions":
      return addCaptions(doc, op, ctx);
    case "move_clip":
      return moveOne(doc, op);
    case "trim_clip":
      return trim(doc, op, ctx);
    case "slip_clip":
      return slip(doc, op, ctx);
    case "roll_edit":
      return roll(doc, op, ctx);
    case "slide_clip":
      return slide(doc, op, ctx);
    case "split_clip":
      return split(doc, op, ctx);
    case "delete_clips":
      return remove(doc, op);
    case "duplicate_clips":
      return duplicate(doc, op);
    case "update_clip":
      return update(doc, op, ctx);
    case "animate":
      return animate(doc, op);
    case "animate_effect":
      return animateEffectOp(doc, op);
    case "motion_preset":
      return preset(doc, op);
    case "entrance":
      return edge(doc, op, "in", ctx);
    case "exit":
      return edge(doc, op, "out", ctx);
    case "animate_text":
      return animateText(doc, op);
    case "set_speed":
      return setSpeed(doc, op, ctx);
    case "freeze_frame":
      return freeze(doc, op, ctx);
    case "speed_ramp":
      return ramp(doc, op, ctx);
    case "set_speed_curve":
      return speedCurveOp(doc, op, ctx);
    case "set_color":
      return colorClips(doc, op, ctx);
    case "set_chroma_key":
    case "animate_chroma":
    case "remove_chroma_key":
      return chromaOp(doc, op, ctx);
    case "set_luma_key":
    case "animate_luma":
    case "remove_luma_key":
      return lumaOp(doc, op);
    case "add_mask":
    case "update_mask":
    case "animate_mask":
    case "move_mask":
    case "remove_mask":
      return maskOp(doc, op);
    case "add_effect_clip":
      return addEffectClipOp(doc, op, ctx);
    case "set_camera":
      return setCameraOp(doc, op);
    case "add_vfx":
    case "update_vfx":
    case "animate_vfx":
    case "move_vfx":
    case "remove_vfx":
      return vfxOp(doc, op);
    case "set_line":
      return lineOp(doc, op);
    case "set_counter":
    case "remove_counter":
    case "set_text_path":
    case "remove_text_path":
      return textOp(doc, op);
    case "style_text":
      return styleTextOp(doc, op);
    case "add_text_animator":
    case "update_text_animator":
    case "animate_text_animator":
    case "move_text_animator":
    case "remove_text_animator":
      return textAnimatorOp(doc, op);
    case "add_track":
      return addTrackOp(doc, op);
    case "move_track":
      return moveTrackOp(doc, op);
    case "update_track":
      return updateTrackOp(doc, op);
    case "remove_track":
      return removeTrackOp(doc, op);
    case "add_marker":
    case "update_marker":
    case "remove_marker":
    case "mark_beats":
      return markerOp(doc, op, ctx);
    case "apply_animation_preset":
      return presetOp(doc, op, ctx);
    case "link_clips":
      return linkOp(doc, op);
    case "unlink_clips":
      return unlinkOp(doc, op);
    case "set_ducking":
      return setDuckingOp(doc, op);
    case "clear_ducking":
      return clearDuckingOp(doc, op);
    case "bake_ducking":
      return bakeDuckingOp(doc, op, ctx);
    case "normalize_loudness":
      return normalizeLoudnessOp(doc, op, ctx);
    case "set_canvas":
      return canvas(doc, op);
    case "seek":
      return seek(doc, op);
    case "select":
      return select(doc, op);
    case "add_transition":
      return addTransitionOp(doc, op, ctx);
    case "update_transition":
      return updateTransitionOp(doc, op, ctx);
    case "set_anchor":
      return setAnchorOp(doc, op, ctx);
    case "scale_axes":
      return scaleAxesOp(doc, op, ctx);
    case "set_path":
      return setPathOp(doc, op);
    case "ease_keys":
    case "smooth_keys":
    case "reverse_keys":
    case "time_stretch_keys":
    case "rove_keys":
      return keyEaseOp(doc, op);
    case "align_clips":
    case "distribute_clips":
    case "sequence_clips":
    case "stagger_clips":
      return layoutOp(doc, op, ctx);
    case "remove_transition":
      return removeTransitionOp(doc, op);
    case "parent_clip":
    case "add_null":
      return parentOp(doc, op, ctx);
    case "group_clips":
    case "ungroup_clips":
      return groupOp(doc, op);
    case "add_behavior":
    case "update_behavior":
    case "remove_behavior":
    case "bake_behavior":
      return behaviorOp(doc, op, ctx);
    case "track_point":
    case "attach_to_track":
    case "stabilize_clip":
    case "remove_tracker":
      return trackOp(doc, op, ctx);
    case "set_path_ops":
    case "animate_path_op":
      return pathOpOp(doc, op);
    case "set_repeat":
    case "clear_repeat":
    case "animate_repeat":
      return clipRepeatOp(doc, op);
    case "add_chart":
    case "update_chart_data":
    case "animate_chart":
      return chartVideoOp(doc, { ...op, op: op.op }, ctx);
  }
  if (isTableOperation(op.op) || isQrOperation(op.op)) return generatedVideoOp(doc, { ...op, op: op.op }, ctx);
  return refuse(`a operação ${String((op as { op: unknown }).op)} não existe`);
}

function applyHere(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): AgentOutcome<VideoDocument> {
  const outcome = dispatch(doc, op, ctx);
  if (!outcome.ok || !ctx.magnetic || !LAYOUT_OPS.has(op.op)) return outcome;
  return { ...outcome, document: magnetize(outcome.document, true) };
}

export function applyVideoOperation(doc: VideoDocument, op: VideoOperation, ctx: VideoOpContext): AgentOutcome<VideoDocument> {
  const scope = operationScope(doc, op as VideoOperation & Record<string, unknown>);
  if (typeof scope === "string") return refuse(scope);
  if (scope.length === 0) return applyHere(doc, op, ctx);
  let outcome: AgentOutcome<VideoDocument> = refuse(`o grupo ${scope.at(-1)} não existe; ${READ_AGAIN}`);
  const document = withTimelineAt(doc, scope, (inner) => {
    outcome = applyHere(inner, op, { ...ctx, playheadMs: Math.max(0, Math.round(pathMsAt(doc, scope, ctx.playheadMs))) });
    return outcome.ok ? outcome.document : inner;
  });
  const settled: AgentOutcome<VideoDocument> = outcome;
  if (!settled.ok) return settled;
  const outer = (ms: number) => Math.max(0, Math.round(rootMsAt(doc, scope, ms)));
  const focus: AgentFocus = settled.focus.kind === "time" ? { kind: "time", atMs: outer(settled.focus.atMs) } : settled.focus.kind === "track" && settled.focus.atMs !== undefined ? { ...settled.focus, atMs: outer(settled.focus.atMs) } : settled.focus;
  return { ...settled, document, focus, ...(settled.seekMs !== undefined ? { seekMs: outer(settled.seekMs) } : {}) };
}

export function videoIds(doc: VideoDocument): string[] {
  return [...nestedTracks(doc.tracks)].map(({ track }) => track).flatMap((track) => [track.id, ...track.clips.flatMap((c) => [c.id, ...(c.masks ?? []).map((m) => m.id), ...(c.vfx ?? []).map((v) => v.id), ...(c.behaviors ?? []).map((b) => b.id), ...(c.trackers ?? []).map((t) => t.id)]), ...(track.transitions ?? []).map((t) => t.id)]);
}
