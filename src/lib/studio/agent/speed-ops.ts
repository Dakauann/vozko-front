import type { VideoDocument } from "../document";
import type { ClipSource } from "../edits";
import type { RetimeRefusal, RetimeResult } from "../retime";
import { clearSpeedCurve, isSpeedCurvePreset, MIN_CURVE_GAP, presetPoints, setSpeedCurve, SPEED_CURVE_PRESET_IDS, speedCurvePointsIssue, type SpeedCurvePoint } from "../speed-curve";
import { SPEED_LIMITS } from "../speed-range";
import { findClip, updateClip } from "../timeline";

export const SPEED_CURVE_OPERATIONS = ["set_speed_curve"] as const;

export const RAMP_MODES = ["smooth", "steps"] as const;

export type RampMode = (typeof RAMP_MODES)[number];

export interface AgentSpeedFields {
  ramp_mode?: RampMode;
  speed_points?: SpeedCurvePoint[];
  speed_curve_preset?: string;
  clear_speed_curve?: boolean;
  frame_mix?: boolean;
}

export interface SpeedCurveInput extends AgentSpeedFields {
  clip_id?: string;
  smooth?: boolean;
  keep_duration?: boolean;
  ripple?: boolean;
}

export type SpeedOpResult = { ok: true; document: VideoDocument } | { ok: false; reason: string } | { ok: false; refusal: RetimeRefusal };

export const SPEED_POINTS_TEXT = `speed_points vai do início (at 0) ao fim (at 1) do clipe, com at crescente e pelo menos ${MIN_CURVE_GAP} entre dois pontos, e speed de ${SPEED_LIMITS[0]} a ${SPEED_LIMITS[1]}`;

export function liftRefusal(result: RetimeResult): SpeedOpResult {
  return result.ok ? result : { ok: false, refusal: result.reason };
}

export function speedCurveOperation(doc: VideoDocument, op: SpeedCurveInput, source: ClipSource): SpeedOpResult {
  const clipId = op.clip_id;
  if (!clipId) return { ok: false, refusal: "missing" };
  if (op.clear_speed_curve) {
    if (op.speed_points || op.speed_curve_preset) return { ok: false, reason: "clear_speed_curve tira a curva; não mande speed_points nem speed_curve_preset junto" };
    return liftRefusal(clearSpeedCurve(doc, clipId));
  }
  if (op.speed_curve_preset !== undefined && !isSpeedCurvePreset(op.speed_curve_preset)) return { ok: false, reason: `speed_curve_preset precisa ser um de: ${SPEED_CURVE_PRESET_IDS.join(", ")}` };
  if (Boolean(op.speed_points) === Boolean(op.speed_curve_preset)) return { ok: false, reason: "set_speed_curve precisa de speed_points ou de speed_curve_preset (só um dos dois), ou de clear_speed_curve" };
  const points = op.speed_curve_preset ? presetPoints(op.speed_curve_preset as Parameters<typeof presetPoints>[0]) : [...op.speed_points!].sort((a, b) => a.at - b.at);
  if (speedCurvePointsIssue(points)) return { ok: false, reason: SPEED_POINTS_TEXT };
  return liftRefusal(setSpeedCurve(doc, clipId, { points, smooth: op.smooth ?? true, keep: op.keep_duration ? "duration" : "source", ripple: op.ripple }, source));
}

export function frameMixOperation(doc: VideoDocument, clipId: string, on: boolean): SpeedOpResult {
  const found = findClip(doc, clipId);
  if (!found) return { ok: false, refusal: "missing" };
  if (found.track.locked) return { ok: false, refusal: "locked" };
  if (found.clip.type !== "video" || found.clip.freeze) return { ok: false, reason: `frame_mix mistura quadros vizinhos só em clipes de vídeo que tocam, e ${clipId} não é um` };
  return { ok: true, document: updateClip(doc, clipId, { frameMix: on ? true : undefined }) };
}
