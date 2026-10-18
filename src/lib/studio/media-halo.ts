import type { Fit } from "./document";
import { fitRect } from "./fit";
import type { EffectPlan } from "./layer-paint";
import { prepareMasks, preparedCoverage, type Mask } from "./masks";

export type HaloPicture = { kind: "rect"; fit: Fit } | { kind: "image"; assetId: string; fit: Fit; flipX: boolean; flipY: boolean };

export interface HaloNode {
  key: string;
  plan: EffectPlan;
  masks?: readonly Mask[];
  base: { width: number; height: number };
  padPx: number;
  picture: HaloPicture;
  live?: boolean;
}

export interface SourceSize {
  width: number;
  height: number;
}

export interface HaloLayout {
  width: number;
  height: number;
  pad: number;
  boxWidth: number;
  boxHeight: number;
  scale: number;
}

interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SAFETY_PX = 2;

export function haloPad(reachPx: number): number {
  return Math.ceil(reachPx + SAFETY_PX);
}

export function haloLayout(halo: Pick<HaloNode, "base" | "padPx">, ratio: number): HaloLayout {
  const boxWidth = halo.base.width * ratio;
  const boxHeight = halo.base.height * ratio;
  const pad = halo.padPx * ratio;
  return { width: Math.max(1, Math.round(boxWidth + 2 * pad)), height: Math.max(1, Math.round(boxHeight + 2 * pad)), pad, boxWidth, boxHeight, scale: ratio };
}

export function pictureRect(fit: Fit, source: SourceSize | null, layout: HaloLayout): PixelRect {
  if (fit === "cover" || !source || source.width <= 0 || source.height <= 0) return { x: layout.pad, y: layout.pad, width: layout.boxWidth, height: layout.boxHeight };
  const placed = fitRect(source.width, source.height, layout.boxWidth, layout.boxHeight, "contain");
  return { x: layout.pad + placed.dx, y: layout.pad + placed.dy, width: placed.dw, height: placed.dh };
}

function overlap(start: number, length: number, at: number): number {
  return Math.max(0, Math.min(at + 1, start + length) - Math.max(at, start));
}

export function rectAlpha(layout: HaloLayout, rect: PixelRect): Float32Array {
  const alpha = new Float32Array(layout.width * layout.height);
  for (let y = 0; y < layout.height; y++) {
    const cover = overlap(rect.y, rect.height, y);
    if (cover === 0) continue;
    for (let x = 0; x < layout.width; x++) alpha[y * layout.width + x] = cover * overlap(rect.x, rect.width, x);
  }
  return alpha;
}

export function maskedAlpha(alpha: Float32Array, layout: HaloLayout, masks: readonly Mask[] | undefined): Float32Array {
  if (!masks || masks.length === 0) return alpha;
  const prepared = prepareMasks(masks, layout.boxWidth, layout.boxHeight);
  const out = new Float32Array(alpha.length);
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      const i = y * layout.width + x;
      if (alpha[i] === 0) continue;
      out[i] = alpha[i] * preparedCoverage(prepared, x + 0.5 - layout.pad, y + 0.5 - layout.pad);
    }
  }
  return out;
}

export function haloSourceKey(halo: HaloNode, source: SourceSize | null): string {
  return halo.picture.fit === "contain" && source ? `${halo.key}|${source.width}x${source.height}` : halo.key;
}
