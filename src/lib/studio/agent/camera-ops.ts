import { CAMERA_PROPERTIES, CAMERA_RANGES, type CameraProperty } from "../clip-camera";
import type { Clip } from "../document";
import { clearCameraPatch } from "../adjustment";
import { isAnimated } from "../keyframe-edit";
import { keyedPatch } from "../selection-edit";
import type { ClipPatch } from "../timeline";

export interface AgentCameraFields {
  camera_pan_x?: number;
  camera_pan_y?: number;
  camera_zoom?: number;
  camera_rotation?: number;
  clear_camera?: boolean;
}

export const CAMERA_OPERATIONS = ["set_camera"] as const;

export const CAMERA_ARGS: Record<CameraProperty, keyof Omit<AgentCameraFields, "clear_camera">> = {
  cameraPanX: "camera_pan_x",
  cameraPanY: "camera_pan_y",
  cameraZoom: "camera_zoom",
  cameraRotation: "camera_rotation",
};

type CameraPatch = { ok: true; patch: Pick<ClipPatch, "camera" | "keyframes"> } | { ok: false; reason: string };

function rangeText(property: CameraProperty): string {
  const [low, high] = CAMERA_RANGES[property];
  return `${CAMERA_ARGS[property]} vai de ${low} a ${high}`;
}

export function cameraPatch(clip: Clip, op: AgentCameraFields, atMs: number | undefined): CameraPatch {
  if (clip.type !== "effect") return { ok: false, reason: `set_camera vale só para clipes de efeito, que movem tudo o que está abaixo; o clipe ${clip.id} é ${clip.type}; crie um com add_effect_clip` };
  const given = CAMERA_PROPERTIES.filter((property) => op[CAMERA_ARGS[property]] !== undefined);
  if (op.clear_camera) {
    if (given.length > 0) return { ok: false, reason: "clear_camera tira a câmera inteira; mande sem os campos camera_*" };
    return { ok: true, patch: clearCameraPatch(clip) };
  }
  if (given.length === 0) return { ok: false, reason: `set_camera precisa de ${Object.values(CAMERA_ARGS).join(", ")} ou clear_camera` };
  let current = clip;
  for (const property of given) {
    const value = op[CAMERA_ARGS[property]]!;
    const [low, high] = CAMERA_RANGES[property];
    if (!(Number.isFinite(value) && value >= low && value <= high)) return { ok: false, reason: rangeText(property) };
    if (isAnimated(current, property) && atMs === undefined) return { ok: false, reason: `${CAMERA_ARGS[property]} está animado neste clipe; mande at_ms para gravar uma chave nesse instante ou troque as chaves com animate property ${property}` };
    const patch = keyedPatch(current, property, () => value, atMs ?? clip.startMs);
    if (typeof patch === "string") return { ok: false, reason: `at_ms precisa cair dentro do clipe ${clip.id}, de ${clip.startMs} a ${clip.startMs + clip.durationMs} ms` };
    current = { ...current, ...patch };
  }
  return { ok: true, patch: { camera: current.camera, keyframes: current.keyframes } };
}
