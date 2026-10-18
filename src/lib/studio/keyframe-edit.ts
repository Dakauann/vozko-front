import { dbToGain } from "./audio-gain";
import { STUDIO_LIMITS, type Clip, type Transform } from "./document";
import {
  animatedProperties,
  AXIS_SCALE_PROPERTIES,
  colorAt,
  colorFramesOf,
  COLOR_PROPERTIES,
  isColorProperty,
  isPathProperty,
  AUDIO_PROPERTIES,
  KEYFRAME_PROPERTIES,
  VISUAL_KEYFRAME_PROPERTIES,
  KEYFRAME_RANGES,
  morphFramesOf,
  PATH_PROPERTY,
  pathFramesOf,
  PLACEMENT_PROPERTIES,
  TRANSFORM_PROPERTIES,
  removeKeyframe,
  setColorKey,
  setKeyEasingAt,
  setKeyframe,
  setPropertyEasingAll,
  timedFramesOf,
  valueAt,
  withLane,
  withoutProperty,
  type AnimatedProperty,
  type ColorProperty,
  type Easing,
  type Keyframe,
  type KeyframeProperty,
  type Keyframes,
  type KeyRef,
  type TimedKey,
} from "./keyframes";
import { animatedTransform } from "./clip-placement";
import { positionAt, type PathPoint } from "./position-path";
import type { PositionKeyframe } from "./path-keys";
import { isMorphProperty, MORPH_PROPERTY } from "./morph-keys";
import { morphAt } from "./path-morph";
import { paintsProperty } from "./paint";
import { lineLaneProperties, lineStaticPatch, lineStaticValue } from "./line-animation";
import { isLineProperty } from "./line-properties";
import { isTextKeyProperty } from "./text-properties";
import { textLaneProperties, textStaticPatch, textStaticValue } from "./text-keys";
import { gradeLaneProperties, gradeStaticPatch, gradeStaticValue, isGradeProperty } from "./grade-keys";
import { GRADE_FIELDS } from "./color-grade";
import { isSpeedProperty, SPEED_PROPERTY } from "./speed-range";
import { adjustmentLaneProperties, cameraStaticPatch, cameraStaticValue } from "./adjustment";
import { CAMERA_PROPERTIES, isCameraProperty } from "./clip-camera";
import { isTiltProperty, TILT_PROPERTIES } from "./tilt-properties";
import { takesTilt, tiltStaticPatch, tiltStaticValue } from "./clip-tilt";
import type { ClipPatch } from "./timeline";

export const KEY_TOLERANCE_MS = 17;

const FALLBACK_PAINT = "#000000";

type KeyedClip = Pick<Clip, "transform" | "keyframes" | "durationMs" | "blur" | "layer"> & Partial<Pick<Clip, "type" | "volume" | "line" | "pan" | "counter" | "textPath" | "color" | "speed" | "camera" | "rotationX" | "rotationY">>;

export function framesOf(clip: Pick<Clip, "keyframes">, property: KeyframeProperty): readonly Keyframe[] {
  return clip.keyframes?.[property] ?? [];
}

export function keyTimesFor(clip: Pick<Clip, "keyframes">, property: AnimatedProperty): number[] {
  return timedFramesOf(clip.keyframes, property).map((frame) => frame.atMs);
}

export function isAnimated(clip: Pick<Clip, "keyframes">, property: AnimatedProperty): boolean {
  return timedFramesOf(clip.keyframes, property).length > 0;
}

export function axisScaled(clip: Pick<Clip, "keyframes">): boolean {
  return AXIS_SCALE_PROPERTIES.some((property) => isAnimated(clip, property));
}

export function onPath(clip: Pick<Clip, "keyframes">): boolean {
  return isAnimated(clip, PATH_PROPERTY);
}

function canonicalLanes(clip: Pick<Clip, "keyframes">, property: AnimatedProperty): AnimatedProperty[] {
  if (property === "x") return onPath(clip) ? [PATH_PROPERTY] : ["x"];
  if (property === "y") return onPath(clip) ? [] : ["y"];
  if (property === "scale") return axisScaled(clip) ? [...AXIS_SCALE_PROPERTIES] : ["scale"];
  return [property];
}

function morphable(layer: Clip["layer"]): boolean {
  return layer?.type === "shape" && layer.shape === "path";
}

function morphLane(clip: Clip): AnimatedProperty[] {
  return morphable(clip.layer) || isAnimated(clip, MORPH_PROPERTY) ? [MORPH_PROPERTY] : [];
}

function speedLane(clip: Clip): AnimatedProperty[] {
  return isAnimated(clip, SPEED_PROPERTY) ? [SPEED_PROPERTY] : [];
}

export function laneProperties(clip: Clip): AnimatedProperty[] {
  if (clip.type === "audio") return [...AUDIO_PROPERTIES, ...speedLane(clip)];
  if (clip.type === "effect") return adjustmentLaneProperties(clip);
  if (clip.type === "null") return VISUAL_KEYFRAME_PROPERTIES.flatMap((property) => canonicalLanes(clip, property)).filter((property) => PLACEMENT_PROPERTIES.includes(property));
  const layer = clip.layer;
  return [...VISUAL_KEYFRAME_PROPERTIES.flatMap((property) => canonicalLanes(clip, property)), ...COLOR_PROPERTIES.filter((property) => (layer !== undefined && paintsProperty(layer, property)) || isAnimated(clip, property)), ...morphLane(clip), ...lineLaneProperties(clip), ...textLaneProperties(clip), ...gradeLaneProperties(clip), ...speedLane(clip), ...TILT_PROPERTIES.filter((property) => isAnimated(clip, property))];
}

export function keyableProperties(clip: Clip): AnimatedProperty[] {
  const graded: readonly AnimatedProperty[] = clip.type === "video" || clip.type === "image" || clip.type === "group" || clip.type === "effect" ? GRADE_FIELDS : [];
  const paced: readonly AnimatedProperty[] = (clip.type === "video" || clip.type === "audio") && !clip.freeze ? [SPEED_PROPERTY] : [];
  const cammed: readonly AnimatedProperty[] = clip.type === "effect" ? CAMERA_PROPERTIES : [];
  const tilted: readonly AnimatedProperty[] = takesTilt(clip.type) ? TILT_PROPERTIES : [];
  return [...new Set([...laneProperties(clip), ...graded, ...paced, ...cammed, ...tilted])];
}

export function localTime(clip: Pick<Clip, "startMs" | "durationMs">, playheadMs: number): number | null {
  const local = Math.round(playheadMs - clip.startMs);
  return local >= 0 && local <= clip.durationMs ? local : null;
}

type StaticSource = Pick<Clip, "transform" | "blur"> & Partial<Pick<Clip, "line" | "pan" | "counter" | "textPath" | "color" | "speed" | "camera" | "rotationX" | "rotationY" | "keyframes">>;

function staticValue(clip: StaticSource, property: KeyframeProperty): number {
  if (isLineProperty(property)) return lineStaticValue(clip, property);
  if (isTextKeyProperty(property)) return textStaticValue(clip, property);
  if (isGradeProperty(property)) return gradeStaticValue(clip, property);
  if (isCameraProperty(property)) return cameraStaticValue(clip, property);
  if (isTiltProperty(property)) return tiltStaticValue(clip, property);
  if (isSpeedProperty(property)) return clip.speed ?? 1;
  if (property === "scale" || property === "scaleX" || property === "scaleY") return 1;
  if (property === "blur") return clip.blur ?? 0;
  if (property === "gainDb") return 0;
  if (property === "pan") return clip.pan ?? 0;
  return clip.transform[property];
}

export function propertyValue(clip: StaticSource & Pick<Clip, "keyframes">, property: KeyframeProperty, localMs: number): number {
  const frames = framesOf(clip, property);
  return frames.length === 0 ? staticValue(clip, property) : valueAt(frames, localMs);
}

export function morphValue(clip: Pick<Clip, "keyframes" | "layer">, localMs: number): string {
  const frames = morphFramesOf(clip.keyframes);
  return frames.length > 0 ? morphAt(frames, localMs) : (clip.layer?.path ?? "");
}

export function paintValue(clip: Pick<Clip, "keyframes" | "layer">, property: ColorProperty, localMs: number): string {
  const frames = colorFramesOf(clip.keyframes, property);
  return frames.length > 0 ? colorAt(frames, localMs) : clip.layer?.[property] || FALLBACK_PAINT;
}

function staticPatch(clip: KeyedClip, property: KeyframeProperty, value: number): ClipPatch {
  if (isLineProperty(property)) return lineStaticPatch(clip, property, value);
  if (isTextKeyProperty(property)) return textStaticPatch(clip, property, value);
  if (isGradeProperty(property)) return gradeStaticPatch(clip, property, value);
  if (isCameraProperty(property)) return cameraStaticPatch(clip, property, value);
  if (isTiltProperty(property)) return tiltStaticPatch(property, value);
  if (isSpeedProperty(property)) return { speed: value !== 1 ? value : undefined };
  if (property === "blur") return { blur: value > 0 ? value : undefined };
  if (property === "gainDb") return { volume: Math.min(STUDIO_LIMITS.maxVolume, (clip.volume ?? 1) * dbToGain(value)) };
  if (property === "pan") return { pan: value !== 0 ? value : undefined };
  if (property === "scale") return { transform: { ...clip.transform, w: clip.transform.w * value, h: clip.transform.h * value } };
  if (property === "scaleX") return { transform: { ...clip.transform, w: clip.transform.w * value } };
  if (property === "scaleY") return { transform: { ...clip.transform, h: clip.transform.h * value } };
  return { transform: { ...clip.transform, [property]: value } };
}

const STILL_RANGE = [0, 1] as const;

function still(value: number): number {
  return Math.min(STILL_RANGE[1], Math.max(STILL_RANGE[0], value));
}

export function pathPoint(clip: Pick<Clip, "transform" | "keyframes">, localMs: number, aspect: number): PathPoint {
  const frames = pathFramesOf(clip.keyframes);
  return frames.length === 0 ? { x: clip.transform.x, y: clip.transform.y } : positionAt(frames, localMs, aspect);
}

export function setPathKey(clip: Pick<Clip, "keyframes">, localMs: number, point: PathPoint): Keyframes | undefined {
  const frames = pathFramesOf(clip.keyframes);
  const existing = keyAt(frames, localMs);
  const [low, high] = KEYFRAME_RANGES.x;
  const placed = { x: Math.min(high, Math.max(low, point.x)), y: Math.min(high, Math.max(low, point.y)) };
  const key: PositionKeyframe = existing ? { ...existing, ...placed } : { atMs: Math.round(localMs), ...placed, easing: "linear" };
  return withLane(clip.keyframes, PATH_PROPERTY, [...frames.filter((frame) => frame.atMs !== key.atMs), key].sort((a, b) => a.atMs - b.atMs));
}

function pathStillPatch(clip: KeyedClip, point: PathPoint): ClipPatch {
  return { transform: { ...clip.transform, x: still(point.x), y: still(point.y) } };
}

function paintPatchOf(clip: KeyedClip, property: ColorProperty, color: string): ClipPatch {
  return clip.layer ? { layer: { ...clip.layer, [property]: color } } : {};
}

function morphPatchOf(clip: KeyedClip, path: string): ClipPatch {
  return clip.layer ? { layer: { ...clip.layer, path } } : {};
}

export function setMorphKey(clip: Pick<Clip, "keyframes">, localMs: number, path: string): Keyframes | undefined {
  const frames = morphFramesOf(clip.keyframes);
  const existing = keyAt(frames, localMs);
  const key = existing ? { ...existing, path } : { atMs: Math.round(localMs), path, easing: "linear" as const };
  return withLane(clip.keyframes, MORPH_PROPERTY, [...frames.filter((frame) => frame.atMs !== key.atMs), key].sort((a, b) => a.atMs - b.atMs));
}

export function keyAt<F extends { atMs: number }>(frames: readonly F[], localMs: number): F | null {
  return frames.find((f) => Math.abs(f.atMs - localMs) <= KEY_TOLERANCE_MS) ?? null;
}

export function keyTimes(clip: Pick<Clip, "keyframes">): number[] {
  return [...new Set(animatedProperties(clip.keyframes).flatMap((property) => keyTimesFor(clip, property)))].sort((a, b) => a - b);
}

export function adjacentKey(times: readonly number[], localMs: number, direction: 1 | -1): number | null {
  if (direction > 0) return times.find((t) => t > localMs + KEY_TOLERANCE_MS) ?? null;
  return [...times].reverse().find((t) => t < localMs - KEY_TOLERANCE_MS) ?? null;
}

function clampValue(property: KeyframeProperty, value: number): number {
  const [low, high] = KEYFRAME_RANGES[property];
  return Math.min(high, Math.max(low, value));
}

export function setPropertyKey(clip: KeyedClip, property: KeyframeProperty, localMs: number, value: number, easing?: Easing): Keyframes | undefined {
  const existing = keyAt(framesOf(clip, property), localMs);
  return setKeyframe(clip.keyframes, property, existing ? existing.atMs : localMs, clampValue(property, value), easing);
}

function setPaintKey(clip: KeyedClip, property: ColorProperty, localMs: number, color: string): Keyframes | undefined {
  const existing = keyAt(colorFramesOf(clip.keyframes, property), localMs);
  return setColorKey(clip.keyframes, property, existing ? existing.atMs : localMs, color);
}

function keyWithShownValue(clip: KeyedClip, shownFrom: KeyedClip, property: AnimatedProperty, localMs: number, aspect: number): Keyframes | undefined {
  if (isMorphProperty(property)) return setMorphKey(clip, localMs, morphValue(shownFrom, localMs));
  if (isPathProperty(property)) return setPathKey(clip, localMs, pathPoint(shownFrom, localMs, aspect));
  if (isColorProperty(property)) return setPaintKey(clip, property, localMs, paintValue(shownFrom, property, localMs));
  return setPropertyKey(clip, property, localMs, propertyValue(shownFrom, property, localMs));
}

export function toggleAnimation(clip: KeyedClip, property: AnimatedProperty, localMs: number, aspect: number): ClipPatch {
  if (!isAnimated(clip, property)) return { keyframes: keyWithShownValue(clip, clip, property, localMs, aspect) };
  const keyframes = withoutProperty(clip.keyframes, property);
  if (isMorphProperty(property)) return { keyframes, ...morphPatchOf(clip, morphValue(clip, localMs)) };
  if (isPathProperty(property)) return { keyframes, ...pathStillPatch(clip, pathPoint(clip, localMs, aspect)) };
  if (isColorProperty(property)) return { keyframes, ...paintPatchOf(clip, property, paintValue(clip, property, localMs)) };
  return { keyframes, ...staticPatch(clip, property, propertyValue(clip, property, localMs)) };
}

export function toggleKeyAt(clip: KeyedClip, property: AnimatedProperty, localMs: number, aspect: number): ClipPatch {
  const existing = keyAt(timedFramesOf(clip.keyframes, property), localMs);
  if (existing) return { keyframes: removeKeyframe(clip.keyframes, property, existing.atMs) };
  return { keyframes: keyWithShownValue(clip, clip, property, localMs, aspect) };
}

export function setKeyEasing(clip: KeyedClip, property: AnimatedProperty, localMs: number, easing: Easing): ClipPatch | null {
  const existing = keyAt(timedFramesOf(clip.keyframes, property), localMs);
  if (!existing) return null;
  return { keyframes: setKeyEasingAt(clip.keyframes, property, existing.atMs, easing) };
}

interface PropertyEasing {
  scope: "key" | "all";
  easing: Easing | null;
}

export function propertyEasing(clip: KeyedClip, property: AnimatedProperty, localMs: number | null): PropertyEasing {
  const frames = timedFramesOf(clip.keyframes, property);
  const key = localMs === null ? null : keyAt(frames, localMs);
  if (key) return { scope: "key", easing: key.easing };
  const easings = new Set(frames.map((frame) => frame.easing));
  return { scope: "all", easing: easings.size === 1 ? [...easings][0] : null };
}

export function setPropertyEasing(clip: KeyedClip, property: AnimatedProperty, localMs: number | null, easing: Easing): ClipPatch | null {
  const frames = timedFramesOf(clip.keyframes, property);
  const key = localMs === null ? null : keyAt(frames, localMs);
  if (key) return key.easing === easing ? null : setKeyEasing(clip, property, key.atMs, easing);
  if (frames.every((frame) => frame.easing === easing)) return null;
  return { keyframes: setPropertyEasingAll(clip.keyframes, property, easing) };
}

export interface TransformEdit {
  patch: ClipPatch;
  outside: boolean;
}

const EDIT_EPSILON = 1e-9;

export function editTransform(clip: KeyedClip, edited: Transform, localMs: number | null, aspect: number): TransformEdit {
  const shown = localMs === null ? clip.transform : animatedTransform(clip.transform, clip.keyframes, localMs, aspect);
  let keyframes = clip.keyframes;
  let transform = { ...clip.transform };
  let outside = false;
  let keyed = false;
  const changed = (value: number, previous: number) => Math.abs(value - previous) >= EDIT_EPSILON;
  const keyAtPlayhead = (write: (at: number) => Keyframes | undefined) => {
    if (localMs === null) {
      outside = true;
      return;
    }
    keyframes = write(localMs);
    keyed = true;
  };
  const apply = (property: KeyframeProperty, value: number, previous: number) => {
    if (!changed(value, previous)) return;
    if (!isAnimated(clip, property)) {
      if (property !== "scale" && property !== "scaleX" && property !== "scaleY") transform = { ...transform, [property]: value };
      return;
    }
    keyAtPlayhead((at) => setPropertyKey({ ...clip, keyframes }, property, at, value));
  };
  if (onPath(clip)) {
    if (changed(edited.x, shown.x) || changed(edited.y, shown.y)) keyAtPlayhead((at) => setPathKey({ keyframes }, at, { x: edited.x, y: edited.y }));
  } else {
    apply("x", edited.x, shown.x);
    apply("y", edited.y, shown.y);
  }
  apply("rotation", edited.rotation, shown.rotation);
  apply("opacity", edited.opacity, shown.opacity);
  if (isAnimated(clip, "scale")) {
    if (changed(edited.w, shown.w) || changed(edited.h, shown.h)) apply("scale", edited.w / clip.transform.w, shown.w / clip.transform.w);
  } else {
    if (changed(edited.w, shown.w)) {
      if (isAnimated(clip, "scaleX")) apply("scaleX", edited.w / clip.transform.w, shown.w / clip.transform.w);
      else transform = { ...transform, w: edited.w };
    }
    if (changed(edited.h, shown.h)) {
      if (isAnimated(clip, "scaleY")) apply("scaleY", edited.h / clip.transform.h, shown.h / clip.transform.h);
      else transform = { ...transform, h: edited.h };
    }
  }
  const patch: ClipPatch = { transform };
  if (keyed) patch.keyframes = keyframes;
  return { patch, outside };
}

export function editKeyed(clip: KeyedClip, property: KeyframeProperty, value: number, localMs: number | null): TransformEdit {
  if (!isAnimated(clip, property)) return { patch: staticPatch(clip, property, clampValue(property, value)), outside: false };
  if (localMs === null) return { patch: {}, outside: true };
  return { patch: { keyframes: setPropertyKey(clip, property, localMs, value) }, outside: false };
}

export function editBlur(clip: KeyedClip, value: number, localMs: number | null): TransformEdit {
  return editKeyed(clip, "blur", value, localMs);
}

export function editMorph(clip: KeyedClip, path: string, localMs: number | null): TransformEdit {
  if (!isAnimated(clip, MORPH_PROPERTY)) return { patch: morphPatchOf(clip, path), outside: false };
  if (localMs === null) return { patch: {}, outside: true };
  return { patch: { keyframes: setMorphKey(clip, localMs, path) }, outside: false };
}

export function editPaint(clip: KeyedClip, property: ColorProperty, color: string, localMs: number | null): TransformEdit {
  if (!isAnimated(clip, property)) return { patch: paintPatchOf(clip, property, color), outside: false };
  if (localMs === null) return { patch: {}, outside: true };
  return { patch: { keyframes: setPaintKey(clip, property, localMs, color) }, outside: false };
}

export type MomentState = "outside" | "none" | "key" | "between";

export type KeyState = "static" | "key" | "interpolated";

function keysAtMoment(clip: Pick<Clip, "keyframes">, localMs: number): { property: AnimatedProperty; frame: TimedKey }[] {
  return animatedProperties(clip.keyframes).flatMap((property) => {
    const frame = keyAt(timedFramesOf(clip.keyframes, property), localMs);
    return frame ? [{ property, frame }] : [];
  });
}

function momentProperties(clip: Pick<Clip, "keyframes"> & Partial<Pick<Clip, "type">>): AnimatedProperty[] {
  if (clip.type === "audio") return AUDIO_PROPERTIES.filter((property) => property === "gainDb" || isAnimated(clip, property));
  const transform = TRANSFORM_PROPERTIES.flatMap((property) => canonicalLanes(clip, property));
  const lanes = [...new Set([...transform, ...[...KEYFRAME_PROPERTIES, ...COLOR_PROPERTIES, MORPH_PROPERTY].filter((property) => isAnimated(clip, property))])];
  return clip.type === "null" ? lanes.filter((property) => PLACEMENT_PROPERTIES.includes(property)) : lanes;
}

export function recordMoment(clip: KeyedClip, localMs: number, aspect: number): ClipPatch {
  let keyframes = clip.keyframes;
  for (const property of momentProperties(clip)) keyframes = keyWithShownValue({ ...clip, keyframes }, clip, property, localMs, aspect);
  return { keyframes };
}

export function removeMoment(clip: KeyedClip, localMs: number): ClipPatch {
  const keyframes = keysAtMoment(clip, localMs).reduce<Keyframes | undefined>((current, { property, frame }) => removeKeyframe(current, property, frame.atMs), clip.keyframes);
  return { keyframes };
}

export function momentKeys(clip: Pick<Clip, "keyframes">, localMs: number): KeyRef[] {
  return keysAtMoment(clip, localMs).map(({ property, frame }) => ({ property, atMs: frame.atMs }));
}

export function momentState(clip: Pick<Clip, "keyframes">, localMs: number | null): MomentState {
  if (localMs === null) return "outside";
  if (keysAtMoment(clip, localMs).length > 0) return "key";
  return animatedProperties(clip.keyframes).length > 0 ? "between" : "none";
}

export function keyState(clip: Pick<Clip, "keyframes">, property: AnimatedProperty, localMs: number | null): KeyState {
  if (localMs === null || !isAnimated(clip, property)) return "static";
  return keyAt(timedFramesOf(clip.keyframes, property), localMs) ? "key" : "interpolated";
}

export function momentEasing(clip: Pick<Clip, "keyframes">, localMs: number): Easing | null {
  const easings = new Set(keysAtMoment(clip, localMs).map(({ frame }) => frame.easing));
  return easings.size === 1 ? [...easings][0] : null;
}

export function setMomentEasing(clip: KeyedClip, localMs: number, easing: Easing): ClipPatch | null {
  const keys = keysAtMoment(clip, localMs);
  if (keys.length === 0) return null;
  const keyframes = keys.reduce<Keyframes | undefined>((current, { property, frame }) => setKeyEasingAt(current, property, frame.atMs, easing), clip.keyframes);
  return { keyframes };
}

export function setAllEasing(clip: Pick<Clip, "keyframes">, easing: Easing): ClipPatch | null {
  const present = animatedProperties(clip.keyframes);
  if (present.length === 0) return null;
  return { keyframes: present.reduce<Keyframes | undefined>((current, property) => setPropertyEasingAll(current, property, easing), clip.keyframes) };
}
