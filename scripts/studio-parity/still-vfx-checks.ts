import { rasterizeRegion } from "@/components/studio/canvas/rasterize";
import { emptyArtboard, newImageLayer, type Artboard, type Layer } from "@/lib/studio/document";
import { STILL_VFX_KINDS, type StillVfxKind } from "@/lib/studio/still-vfx";
import { newVfx, type Vfx, type VfxParam } from "@/lib/studio/vfx";

type Report = Record<string, number | string | boolean | null>;

export interface StillVfxTools {
  boardPixels: (board: Artboard) => Promise<Uint8ClampedArray>;
  sampled: (data: Uint8ClampedArray, width: number, height: number) => Uint8Array;
  psnr: (a: Uint8Array, b: Uint8Array) => number;
}

const SIZE = 400;
const BACKDROP = "#203040";
const MIN_PSNR_DB = 35;
const MIN_CHANGE = 32;
const SEED = 4242;

const STRONG: Record<StillVfxKind, Partial<Record<VfxParam, number>>> = {
  grain: { amount: 1, size: 2, chroma: 0.5 },
  lightLeak: { amount: 1, size: 0.8, x: 0.2, y: 0.25 },
  vignette: { amount: 1, size: 0.15, softness: 0.6 },
  chromaticAberration: { amount: 0.5 },
  glitch: { amount: 1, split: 30, scanlines: 0.5 },
  lensFlare: { amount: 1, x: 0.3, y: 0.3, ghosts: 1, streak: 1 },
  glow: { amount: 1, threshold: 0.3, size: 20 },
  mosaic: { size: 24 },
  posterize: { levels: 3 },
  mirror: { x: 0.4, angle: 30 },
  offset: { shiftX: 0.3, shiftY: 0.2 },
  directionalBlur: { length: 40, angle: 30 },
  zoomBlur: { length: 0.3, x: 0.4, y: 0.45 },
  spinBlur: { angle: 30, x: 0.5, y: 0.5 },
  waveWarp: { height: 14, length: 90, angle: 20, phase: 45 },
  ripple: { height: 10, length: 40, size: 1, x: 0.5, y: 0.5, phase: 30 },
  twirl: { angle: 240, size: 0.6 },
  bulge: { height: 0.9, size: 0.5 },
  cornerPin: { topLeftX: 0.1, topLeftY: 0.05, topRightX: 0.95, topRightY: 0.15, bottomRightX: 0.85, bottomRightY: 0.9, bottomLeftX: 0.05, bottomLeftY: 0.95 },
  fractalNoise: { amount: 0.8, size: 60, complexity: 4 },
  gradientRamp: { amount: 0.7, radial: 0.4 },
  fourColorGradient: { amount: 0.7 },
};

function effect(kind: StillVfxKind): Vfx {
  return { ...newVfx(kind, `still-${kind}`, SEED), params: STRONG[kind] };
}

function photo(vfx?: Vfx[]): Layer {
  return { ...newImageLayer("quad.png", { x: 0.5, y: 0.5, w: 0.7, h: 0.7, rotation: 0, opacity: 1 }), id: "photo", ...(vfx ? { vfx } : {}) };
}

function board(layer: Layer, canvasVfx?: Vfx[]): Artboard {
  const base = emptyArtboard({ width: SIZE, height: SIZE }, BACKDROP);
  return { ...base, id: "still", canvas: { ...base.canvas, ...(canvasVfx ? { vfx: canvasVfx } : {}) }, layers: [layer] };
}

async function exported(target: Artboard): Promise<Uint8ClampedArray> {
  const canvas = await rasterizeRegion(target.layers, SIZE, SIZE, { x: 0, y: 0, width: SIZE, height: SIZE }, { background: target.canvas.background, vfx: target.canvas.vfx });
  return canvas.getContext("2d")!.getImageData(0, 0, SIZE, SIZE).data;
}

function largestChange(a: Uint8Array, b: Uint8Array): number {
  let most = 0;
  for (let i = 0; i < a.length; i++) most = Math.max(most, Math.abs(a[i] - b[i]));
  return most;
}

export async function stillVfxParity(tools: StillVfxTools): Promise<Report> {
  const plain = tools.sampled(await tools.boardPixels(board(photo())), SIZE, SIZE);
  const rows: string[] = [];
  let worst = Infinity;
  let changed = true;
  let repeatOk = true;
  for (const kind of STILL_VFX_KINDS) {
    let kindChange = 0;
    for (const [where, target] of [
      ["layer", board(photo([effect(kind)]))],
      ["artboard", board(photo(), [effect(kind)])],
    ] as const) {
      const gpu = tools.sampled(await tools.boardPixels(target), SIZE, SIZE);
      const cpu = tools.sampled(await exported(target), SIZE, SIZE);
      const again = tools.sampled(await exported(target), SIZE, SIZE);
      const db = tools.psnr(gpu, cpu);
      const change = largestChange(gpu, plain);
      worst = Math.min(worst, db);
      kindChange = Math.max(kindChange, change);
      repeatOk &&= tools.psnr(cpu, again) === 99;
      rows.push(`${kind}/${where} ${db.toFixed(1)}dB change ${change}`);
    }
    changed &&= kindChange > MIN_CHANGE;
  }
  return { results: rows.join("; "), worstDb: Number(worst.toFixed(2)), changed, repeatOk, stillVfxOk: worst >= MIN_PSNR_DB && changed && repeatOk };
}
