import type { Clip, VideoCanvas, VideoDocument } from "../document";
import { acceptsMotionBlur, SHUTTER_ANGLE_RANGE, SHUTTER_PHASE_RANGE, shutterIssue, shutterOf } from "../motion-blur";
import type { ClipPatch } from "../timeline";

export interface AgentMotionBlurFields {
  motion_blur?: boolean;
  shutter_angle?: number;
  shutter_phase?: number;
}

export type MotionBlurPatch = { ok: true; patch: Pick<ClipPatch, "motionBlur"> } | { ok: false; reason: string };

export function motionBlurPatch(clip: Clip, op: AgentMotionBlurFields): MotionBlurPatch {
  if (op.motion_blur === undefined) return { ok: true, patch: {} };
  if (op.motion_blur && !acceptsMotionBlur(clip.type)) return { ok: false, reason: `motion_blur vale só para clipes de vídeo, imagem, texto, forma e ícone e para a câmera de um clipe de efeito; o clipe é ${clip.type}` };
  return { ok: true, patch: { motionBlur: op.motion_blur || undefined } };
}

export function closedShutterNotes(doc: VideoDocument, op: AgentMotionBlurFields): string[] {
  return op.motion_blur && !(shutterOf(doc.canvas).angle > 0) ? ["o obturador do projeto está fechado (0°), então o desfoque de movimento não aparece; abra com set_canvas shutter_angle, 180 é o padrão"] : [];
}

export function hasShutter(op: AgentMotionBlurFields): boolean {
  return op.shutter_angle !== undefined || op.shutter_phase !== undefined;
}

export function shutterRefusal(op: AgentMotionBlurFields): string | null {
  if (op.shutter_angle !== undefined && shutterIssue({ shutterAngle: op.shutter_angle })) return `shutter_angle vai de ${SHUTTER_ANGLE_RANGE[0]} a ${SHUTTER_ANGLE_RANGE[1]} graus`;
  if (op.shutter_phase !== undefined && shutterIssue({ shutterPhase: op.shutter_phase })) return `shutter_phase vai de ${SHUTTER_PHASE_RANGE[0]} a ${SHUTTER_PHASE_RANGE[1]} graus`;
  return null;
}

export function applyShutter(canvas: VideoCanvas, op: AgentMotionBlurFields): void {
  if (op.shutter_angle !== undefined) canvas.shutterAngle = op.shutter_angle;
  if (op.shutter_phase !== undefined) canvas.shutterPhase = op.shutter_phase;
}
