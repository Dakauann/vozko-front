import type { SceneBox } from "../scene/scene";
import type { Camera } from "./renderer";

export const VIEW_MARGIN_PX = 128;

export function outsideView(box: SceneBox, origin: { x: number; y: number }, camera: Camera, view: { width: number; height: number }, margin: number = VIEW_MARGIN_PX): boolean {
  const reach = (Math.hypot(box.width, box.height) / 2) * camera.scale + margin;
  const x = camera.x + (origin.x + box.x) * camera.scale;
  const y = camera.y + (origin.y + box.y) * camera.scale;
  return x + reach < 0 || y + reach < 0 || x - reach > view.width || y - reach > view.height;
}
