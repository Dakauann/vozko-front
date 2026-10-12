import type { LumaImage } from "./luma";

export interface DotPlacement {
  x: number;
  y: number;
}

export interface SyntheticScene {
  width: number;
  height: number;
  seed: number;
  radius?: number;
  covered?: { left: number; top: number; width: number; height: number } | null;
  flat?: boolean;
}

function backdrop(seed: number, x: number, y: number): number {
  return 70 + 8 * Math.sin(0.11 * x + seed) + 8 * Math.cos(0.07 * y - seed * 0.5);
}

function texture(u: number, v: number): number {
  return 40 * Math.sin(0.7 * u + 0.3 * v) + 35 * Math.cos(0.45 * u - 0.8 * v) + 25 * Math.sin(0.23 * u * 1.3 + 0.9 * v);
}

export function syntheticFrame(scene: SyntheticScene, dot: DotPlacement): LumaImage {
  const { width, height, seed } = scene;
  const radius = scene.radius ?? 14;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x + 0.5 - dot.x;
      const v = y + 0.5 - dot.y;
      const edge = Math.max(0, Math.min(1, radius - Math.hypot(u, v)));
      const ground = scene.flat ? 90 : backdrop(seed, x, y);
      let value = ground * (1 - edge) + (140 + texture(u, v)) * edge;
      const covered = scene.covered;
      if (covered && x >= covered.left && x < covered.left + covered.width && y >= covered.top && y < covered.top + covered.height) value = 128;
      if (scene.flat) value = 90;
      data[y * width + x] = Math.max(0, Math.min(255, Math.round(value)));
    }
  }
  return { width, height, data };
}

export function flatFrame(width: number, height: number, value: number): LumaImage {
  return { width, height, data: new Uint8Array(width * height).fill(value) };
}
