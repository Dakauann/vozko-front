import { CAMERA_FIELD_OF, CAMERA_PROPERTIES, cameraContent, cameraFieldIssue, dosedCamera, isCameraProperty, NEUTRAL_CAMERA, storedCamera, type CameraProperty, type ClipCamera } from "./clip-camera";
import { fadeLevel } from "./clip-time";
import { GRADE_FIELDS, gradeIssue } from "./color-grade";
import { fullFrame, type CanvasSize, type Clip, type Transform } from "./document";
import { keyedGradeFields } from "./grade-keys";
import { gradientMapIssue } from "./gradient-map";
import { animatedProperties, keyframesIssue, valueAt, withoutProperty, type AnimatedProperty } from "./keyframes";
import { CLIP_TAG_FIELDS, GUIDE_FIELD } from "./labels";
import { maskIssue } from "./masks";
import { boxMap, type MotionTrail } from "./motion-blur";
import type { IssueCode } from "./validate";
import { carriesOnly, vfxIssue } from "./vfx";

const ADJUSTMENT_FIELDS: ReadonlySet<string> = new Set([
  ...CLIP_TAG_FIELDS,
  GUIDE_FIELD,
  "id",
  "type",
  "startMs",
  "durationMs",
  "trimInMs",
  "volume",
  "fadeInMs",
  "fadeOutMs",
  "transform",
  "vfx",
  "disabled",
  "color",
  "gradientMap",
  "blur",
  "keyframes",
  "masks",
  "camera",
  "motionBlur",
]);

const BLUR_RANGE = [0, 100] as const;

export const ADJUSTMENT_KEY_PROPERTIES: readonly AnimatedProperty[] = ["blur", ...GRADE_FIELDS, ...CAMERA_PROPERTIES];

export function takesAdjustmentKey(property: string): boolean {
  return (ADJUSTMENT_KEY_PROPERTIES as readonly string[]).includes(property);
}

function cameraIssue(camera: ClipCamera | undefined): IssueCode | null {
  return camera && cameraFieldIssue(camera) ? "out_of_range" : null;
}

export function adjustmentClipIssue(clip: Clip): IssueCode | null {
  if (!carriesOnly(clip, ADJUSTMENT_FIELDS)) return "invalid";
  const t = clip.transform;
  if (clip.trimInMs !== 0 || t.x !== 0.5 || t.y !== 0.5 || t.w !== 1 || t.h !== 1 || t.rotation !== 0) return "invalid";
  if (!(Number.isFinite(t.opacity) && t.opacity >= 0 && t.opacity <= 1)) return "out_of_range";
  if (clip.blur !== undefined && !(Number.isFinite(clip.blur) && clip.blur >= BLUR_RANGE[0] && clip.blur <= BLUR_RANGE[1])) return "out_of_range";
  if (animatedProperties(clip.keyframes).some((property) => !takesAdjustmentKey(property))) return "invalid";
  return (
    keyframesIssue(clip.keyframes, t) ??
    (clip.color ? gradeIssue(clip.color) : null) ??
    (clip.gradientMap ? gradientMapIssue(clip.gradientMap) : null) ??
    cameraIssue(clip.camera) ??
    maskIssue(clip.masks ?? []) ??
    vfxIssue(clip.vfx ?? [])
  );
}

export function cameraOutsideIssue(clip: Clip): IssueCode | null {
  if (clip.type === "effect") return null;
  return clip.camera || animatedProperties(clip.keyframes).some(isCameraProperty) ? "invalid" : null;
}

type Cammed = Pick<Clip, "camera" | "keyframes">;

export function keyedCameraProperties(clip: Cammed): CameraProperty[] {
  return CAMERA_PROPERTIES.filter((property) => (clip.keyframes?.[property]?.length ?? 0) > 0);
}

export function hasCamera(clip: Cammed): boolean {
  return clip.camera !== undefined || keyedCameraProperties(clip).length > 0;
}

export function cameraStaticValue(clip: Cammed, property: CameraProperty): number {
  return (clip.camera ?? NEUTRAL_CAMERA)[CAMERA_FIELD_OF[property]];
}

export function cameraAt(clip: Cammed, localMs: number): ClipCamera {
  const camera = { ...(clip.camera ?? NEUTRAL_CAMERA) };
  for (const property of keyedCameraProperties(clip)) camera[CAMERA_FIELD_OF[property]] = valueAt(clip.keyframes![property]!, localMs);
  return camera;
}

export function cameraStaticPatch(clip: Cammed, property: CameraProperty, value: number): Pick<Clip, "camera"> {
  return { camera: storedCamera({ ...(clip.camera ?? NEUTRAL_CAMERA), [CAMERA_FIELD_OF[property]]: value }) };
}

export function clearCameraPatch(clip: Cammed): Pick<Clip, "camera" | "keyframes"> {
  let keyframes = clip.keyframes;
  for (const property of CAMERA_PROPERTIES) keyframes = withoutProperty(keyframes, property);
  return { camera: undefined, keyframes };
}

export function cameraPose(clip: Clip, localMs: number, canvas: CanvasSize): Transform | null {
  if (!hasCamera(clip)) return null;
  return cameraContent(dosedCamera(cameraAt(clip, localMs), clip.transform.opacity * fadeLevel(clip, localMs)), canvas);
}

export function cameraView(clip: Clip, localMs: number, canvas: CanvasSize): MotionTrail | null {
  const pose = cameraPose(clip, localMs, canvas);
  const map = pose ? boxMap(fullFrame(), pose, canvas) : null;
  return map ? { maps: map } : null;
}

export function adjustmentLaneProperties(clip: Clip): AnimatedProperty[] {
  return ["blur", ...(hasCamera(clip) ? CAMERA_PROPERTIES : []), ...keyedGradeFields(clip)];
}
