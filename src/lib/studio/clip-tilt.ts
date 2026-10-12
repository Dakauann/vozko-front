import { anchorOf } from "./clip-placement";
import type { Anchor, CanvasSize, Clip, ClipType, VideoCanvas } from "./document";
import { valueAt } from "./keyframes";
import { DEFAULT_PERSPECTIVE, lensOf, PERSPECTIVE_RANGE, tiltHomography, type Homography, type Lens, type Point, type Tilt } from "./perspective";
import { TILT_PROPERTIES, TILT_RANGE, type TiltProperty } from "./tilt-properties";
import type { IssueCode } from "./validate";

export interface ClipTilt extends Tilt {
  anchor: Anchor;
}

type TiltedClip = Pick<Clip, TiltProperty | "keyframes">;

const TILTED_TYPES: ReadonlySet<ClipType> = new Set(["video", "image", "overlay", "group"]);
const FULL_TURN = 360;

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

export function takesTilt(type: ClipType): boolean {
  return TILTED_TYPES.has(type);
}

export function tiltStaticValue(clip: Pick<Clip, TiltProperty>, property: TiltProperty): number {
  return clip[property] ?? 0;
}

export function tiltStaticPatch(property: TiltProperty, value: number): Partial<Pick<Clip, TiltProperty>> {
  return { [property]: value !== 0 ? value : undefined };
}

export function tiltAt(clip: TiltedClip, localMs: number): Tilt {
  const at = (property: TiltProperty) => {
    const frames = clip.keyframes?.[property] ?? [];
    return frames.length > 0 ? valueAt(frames, localMs) : tiltStaticValue(clip, property);
  };
  return { x: at("rotationX"), y: at("rotationY") };
}

export function carriesTilt(clip: TiltedClip): boolean {
  return TILT_PROPERTIES.some((property) => (clip[property] ?? 0) !== 0 || (clip.keyframes?.[property]?.length ?? 0) > 0);
}

export function isLevel(tilt: Tilt): boolean {
  return tilt.x % FULL_TURN === 0 && tilt.y % FULL_TURN === 0;
}

export function clipTiltAt(clip: TiltedClip & Pick<Clip, "type" | "anchor">, localMs: number): ClipTilt | null {
  if (!takesTilt(clip.type) || !carriesTilt(clip)) return null;
  const tilt = tiltAt(clip, localMs);
  return isLevel(tilt) ? null : { ...tilt, anchor: anchorOf(clip) };
}

export function tiltIssue(clip: TiltedClip & Pick<Clip, "type">): IssueCode | null {
  if (!carriesTilt(clip)) return null;
  if (!takesTilt(clip.type)) return "invalid";
  return TILT_PROPERTIES.every((property) => clip[property] === undefined || within(clip[property], TILT_RANGE)) ? null : "out_of_range";
}

export function perspectiveOf(canvas: Pick<VideoCanvas, "perspective">): number {
  return canvas.perspective ?? DEFAULT_PERSPECTIVE;
}

export function perspectiveIssue(canvas: Pick<VideoCanvas, "perspective">): IssueCode | null {
  return canvas.perspective === undefined || within(canvas.perspective, PERSPECTIVE_RANGE) ? null : "out_of_range";
}

export function perspectiveChange(canvas: Pick<VideoCanvas, "perspective">, perspective: number): number | null {
  if (perspectiveIssue({ perspective }) || perspectiveOf(canvas) === perspective) return null;
  return perspective;
}

export function sceneLens(canvas: Pick<VideoCanvas, "perspective">, size: CanvasSize): Lens {
  return lensOf(perspectiveOf(canvas), size.width, size.height);
}

export function tiltPivot(box: { x: number; y: number; width: number; height: number; rotation: number }, anchor: Anchor): Point {
  const turn = (box.rotation * Math.PI) / 180;
  const ox = (anchor.x - 0.5) * box.width;
  const oy = (anchor.y - 0.5) * box.height;
  return { x: box.x + ox * Math.cos(turn) - oy * Math.sin(turn), y: box.y + ox * Math.sin(turn) + oy * Math.cos(turn) };
}

export function tiltMatrix(lens: Lens, box: { x: number; y: number; width: number; height: number; rotation: number }, tilt: ClipTilt): Homography {
  return tiltHomography(lens, tiltPivot(box, tilt.anchor), tilt);
}
