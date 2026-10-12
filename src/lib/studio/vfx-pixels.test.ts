import { describe, expect, it } from "vitest";

import { stillLook, type StillLook, type StillVfxKind } from "./still-vfx";
import { applyVfxPixels, type VfxFrame } from "./vfx-pixels";
import { newVfx, vignetteWeight, type Vfx, type VfxColor, type VfxParam } from "./vfx";

const SIZE = 32;

function look(kind: StillVfxKind, params: Partial<Record<VfxParam, number>> = {}, seed = 7, colors: Partial<Record<VfxColor, string>> = {}): StillLook {
  const vfx: Vfx & { kind: StillVfxKind } = { ...newVfx(kind, "fx", seed), kind, params, colors };
  return stillLook(vfx);
}

function picture(fill: (x: number, y: number) => [number, number, number, number], width = SIZE, height = SIZE): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4);
  }
  return data;
}

const GRAY = () => [128, 128, 128, 255] as [number, number, number, number];
const SPLIT = (x: number) => (x < SIZE / 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]) as [number, number, number, number];

function whole(width = SIZE, height = SIZE): VfxFrame {
  return { left: 0, top: 0, width, height, unitsWide: width, unitsHigh: height };
}

function run(data: Uint8ClampedArray, looks: StillLook[], frame: VfxFrame = whole(), width = SIZE, height = SIZE): Uint8ClampedArray {
  const copy = new Uint8ClampedArray(data);
  applyVfxPixels(copy, width, height, looks, frame);
  return copy;
}

function at(data: Uint8ClampedArray, x: number, y: number, width = SIZE): number[] {
  return Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 4));
}

describe("the CPU effect pixels", () => {
  it("darkens toward the vignette color by the shared vignette weight", () => {
    const vignette = look("vignette", { amount: 1, size: 0.2, softness: 0.5 });
    const out = run(picture(() => [200, 100, 50, 255]), [vignette]);
    for (const [x, y] of [[0, 0], [16, 16], [5, 20], [31, 31]]) {
      const weight = vignetteWeight(vignette, (x + 0.5) / SIZE, (y + 0.5) / SIZE, SIZE, SIZE);
      expect(at(out, x, y)[0]).toBeCloseTo(200 * (1 - weight), -0.5);
      expect(at(out, x, y)[3]).toBe(255);
    }
  });

  it("leaves transparent pixels alone where the shader skips them", () => {
    const empty = picture(() => [0, 0, 0, 0]);
    for (const kind of ["grain", "lightLeak", "vignette", "lensFlare"] as const) expect(run(empty, [look(kind)])).toEqual(empty);
  });

  it("adds seeded grain that holds its pattern and does nothing at zero", () => {
    const base = picture(GRAY);
    expect(run(base, [look("grain", { amount: 0 })])).toEqual(base);
    const once = run(base, [look("grain", { amount: 1, size: 1 })]);
    expect(run(base, [look("grain", { amount: 1, size: 1 })])).toEqual(once);
    expect(once).not.toEqual(base);
    expect(run(base, [look("grain", { amount: 1, size: 1 }, 8)])).not.toEqual(once);
    const colored = run(base, [look("grain", { amount: 1, size: 1, chroma: 1 })]);
    const pixel = at(colored, 9, 9);
    expect(new Set(pixel.slice(0, 3)).size).toBeGreaterThan(1);
  });

  it("draws the grain on the frame, wherever the frame sits in the pixels", () => {
    const wide = 48;
    const grain = look("grain", { amount: 1, size: 2 });
    const alone = run(picture(GRAY), [grain]);
    const shifted = run(picture(GRAY, wide, SIZE), [grain], { left: 16, top: 0, width: SIZE, height: SIZE, unitsWide: SIZE, unitsHigh: SIZE }, wide, SIZE);
    expect(at(shifted, 16 + 10, 12, wide)).toEqual(at(alone, 10, 12));
  });

  it("keeps the same grain at a higher pixel ratio, sampled at the same frame points", () => {
    const grain = look("grain", { amount: 1, size: 4 });
    const single = run(picture(GRAY), [grain]);
    const doubled = run(picture(GRAY, SIZE * 2, SIZE * 2), [grain], { left: 0, top: 0, width: SIZE * 2, height: SIZE * 2, unitsWide: SIZE, unitsHigh: SIZE }, SIZE * 2, SIZE * 2);
    const spread = Math.max(...[3, 11, 20].map((x) => Math.abs(at(single, x, 7)[0] - at(doubled, 2 * x, 14, SIZE * 2)[0])));
    expect(spread).toBeLessThanOrEqual(12);
  });

  it("splits red and blue across an edge in opposite directions", () => {
    const base = picture(SPLIT);
    expect(run(base, [look("chromaticAberration", { amount: 0 })])).toEqual(base);
    const out = run(base, [look("chromaticAberration", { amount: 0.1, radial: 0, angle: 0 })]);
    const left = at(out, 13, 16);
    const right = at(out, 18, 16);
    expect(left[0]).toBeGreaterThan(left[2]);
    expect(right[2]).toBeLessThan(right[0] + 1);
    expect(right[2]).toBeLessThan(255);
  });

  it("only moves color when a glitch has amount or split", () => {
    const base = picture(SPLIT);
    expect(run(base, [look("glitch", { amount: 0, split: 0, scanlines: 0 })])).toEqual(base);
    expect(run(base, [look("glitch", { amount: 1, split: 20 })])).not.toEqual(base);
  });

  it("brightens most near the flare source and tints by the leak colors", () => {
    const dark = picture(() => [20, 20, 20, 255]);
    const flare = run(dark, [look("lensFlare", { amount: 1, x: 0.25, y: 0.25 })]);
    expect(at(flare, 8, 8)[0]).toBeGreaterThan(at(flare, 28, 4)[0]);
    const leak = run(dark, [look("lightLeak", { amount: 1, x: 0.5, y: 0.5, size: 1 }, 7, { color: "#ff0000", color2: "#ff0000" })]);
    const pixel = at(leak, 16, 16);
    expect(pixel[0]).toBeGreaterThan(pixel[1] + 40);
  });

  it("stacks effects in list order", () => {
    const base = picture(GRAY);
    const grain = look("grain", { amount: 1 });
    const vignette = look("vignette", { amount: 1, size: 0 });
    expect(run(base, [grain, vignette])).not.toEqual(run(base, [vignette, grain]));
  });
});
