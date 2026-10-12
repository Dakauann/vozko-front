import type { CanvasSize, Transform } from "./document";

export interface ClipCamera {
  panX: number;
  panY: number;
  zoom: number;
  rotation: number;
}

export const CAMERA_FIELDS = ["panX", "panY", "zoom", "rotation"] as const;

export type CameraField = (typeof CAMERA_FIELDS)[number];

export const CAMERA_PROPERTIES = ["cameraPanX", "cameraPanY", "cameraZoom", "cameraRotation"] as const;

export type CameraProperty = (typeof CAMERA_PROPERTIES)[number];

export const CAMERA_FIELD_OF: Record<CameraProperty, CameraField> = { cameraPanX: "panX", cameraPanY: "panY", cameraZoom: "zoom", cameraRotation: "rotation" };

export const CAMERA_RANGES: Record<CameraProperty, readonly [number, number]> = {
  cameraPanX: [-2, 2],
  cameraPanY: [-2, 2],
  cameraZoom: [0.1, 10],
  cameraRotation: [-3600, 3600],
};

export const NEUTRAL_CAMERA: ClipCamera = { panX: 0, panY: 0, zoom: 1, rotation: 0 };

const EPSILON = 1e-9;

export function isCameraProperty(property: string): property is CameraProperty {
  return (CAMERA_PROPERTIES as readonly string[]).includes(property);
}

export function isNeutralCamera(camera: ClipCamera | undefined): boolean {
  return !camera || CAMERA_FIELDS.every((field) => Math.abs(camera[field] - NEUTRAL_CAMERA[field]) < EPSILON);
}

export function cameraFieldIssue(camera: ClipCamera): CameraProperty | null {
  return CAMERA_PROPERTIES.find((property) => {
    const value = camera[CAMERA_FIELD_OF[property]];
    const [low, high] = CAMERA_RANGES[property];
    return !(Number.isFinite(value) && value >= low && value <= high);
  }) ?? null;
}

export function storedCamera(camera: ClipCamera | undefined): ClipCamera | undefined {
  return isNeutralCamera(camera) ? undefined : camera;
}

export function dosedCamera(camera: ClipCamera, amount: number): ClipCamera {
  return { panX: camera.panX * amount, panY: camera.panY * amount, zoom: 1 + (camera.zoom - 1) * amount, rotation: camera.rotation * amount };
}

export function cameraContent(camera: ClipCamera, canvas: CanvasSize): Transform {
  const turn = (camera.rotation * Math.PI) / 180;
  const panX = camera.panX * canvas.width * camera.zoom;
  const panY = camera.panY * canvas.height * camera.zoom;
  const dx = -(panX * Math.cos(turn) - panY * Math.sin(turn));
  const dy = -(panX * Math.sin(turn) + panY * Math.cos(turn));
  return { x: 0.5 + dx / canvas.width, y: 0.5 + dy / canvas.height, w: camera.zoom, h: camera.zoom, rotation: camera.rotation, opacity: 1 };
}

export function cameraSourcePoint(camera: ClipCamera, canvas: CanvasSize, x: number, y: number): { x: number; y: number } {
  const turn = (-camera.rotation * Math.PI) / 180;
  const ox = (x - 0.5) * canvas.width;
  const oy = (y - 0.5) * canvas.height;
  const rx = (ox * Math.cos(turn) - oy * Math.sin(turn)) / camera.zoom;
  const ry = (ox * Math.sin(turn) + oy * Math.cos(turn)) / camera.zoom;
  return { x: 0.5 + camera.panX + rx / canvas.width, y: 0.5 + camera.panY + ry / canvas.height };
}
