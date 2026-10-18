import { perspectiveIssue, takesTilt, tiltStaticPatch } from "../clip-tilt";
import type { Clip, VideoCanvas } from "../document";
import { PERSPECTIVE_RANGE } from "../perspective";
import { isTiltProperty, TILT_RANGE, type TiltProperty } from "../tilt-properties";
import type { ClipPatch } from "../timeline";

export interface AgentTiltFields {
  rotation_x?: number;
  rotation_y?: number;
  perspective?: number;
}

const FIELDS: readonly (readonly ["rotation_x" | "rotation_y", TiltProperty])[] = [
  ["rotation_x", "rotationX"],
  ["rotation_y", "rotationY"],
];

type TiltPatch = { ok: true; patch: Pick<ClipPatch, TiltProperty> } | { ok: false; reason: string };

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

export function tiltPatch(clip: Clip, op: AgentTiltFields): TiltPatch {
  const patch: Pick<ClipPatch, TiltProperty> = {};
  for (const [field, property] of FIELDS) {
    const value = op[field];
    if (value === undefined) continue;
    if (!takesTilt(clip.type)) return { ok: false, reason: `${field} vale só para clipes de vídeo, imagem, texto, forma, ícone e grupo; o clipe é ${clip.type}` };
    if (!within(value, TILT_RANGE)) return { ok: false, reason: `${field} vai de ${TILT_RANGE[0]} a ${TILT_RANGE[1]} graus` };
    if ((clip.keyframes?.[property]?.length ?? 0) > 0) return { ok: false, reason: `${property} deste clipe está animado; mude as chaves com animate property ${property}` };
    Object.assign(patch, tiltStaticPatch(property, value));
  }
  return { ok: true, patch };
}

export function tiltRefusal(clip: Pick<Clip, "id" | "type">, property: string): string | null {
  return isTiltProperty(property) ? (takesTilt(clip.type) ? null : `${property} gira em profundidade só clipes de vídeo, imagem, texto, forma, ícone e grupo; o clipe ${clip.id} é ${clip.type}`) : null;
}

export function perspectiveRefusal(op: AgentTiltFields): string | null {
  return op.perspective !== undefined && perspectiveIssue({ perspective: op.perspective }) ? `perspective vai de ${PERSPECTIVE_RANGE[0]} a ${PERSPECTIVE_RANGE[1]} graus` : null;
}

export function applyPerspective(canvas: VideoCanvas, op: AgentTiltFields): void {
  if (op.perspective !== undefined) canvas.perspective = op.perspective;
}
