import { describe, expect, it } from "vitest";

import { stillLook, type StillVfxKind } from "./still-vfx";
import { newVfx, type VfxParam } from "./vfx";
import { applyVfxPixels, type VfxFrame } from "./vfx-pixels";

const SIZE = 20;

function frame(): VfxFrame {
  return { left: 0, top: 0, width: SIZE, height: SIZE, unitsWide: SIZE, unitsHigh: SIZE };
}

function halves(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const left = x < SIZE / 2;
      data.set(left ? [255, 0, 0, 255] : [0, 0, 255, 255], i);
    }
  }
  return data;
}

function run(kind: StillVfxKind, params: Partial<Record<VfxParam, number>>, data = halves()): Uint8ClampedArray {
  applyVfxPixels(data, SIZE, SIZE, [stillLook({ ...newVfx(kind, "fx", 3), params })], frame());
  return data;
}

function at(data: Uint8ClampedArray, x: number, y: number): number[] {
  const i = (y * SIZE + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

describe("the CPU fallback of the effects packs", () => {
  it("leaves the picture untouched at zero amount", () => {
    for (const kind of ["mosaic", "mirror", "offset", "directionalBlur", "twirl", "cornerPin", "fractalNoise", "gradientRamp"] as const) {
      expect(Array.from(run(kind, { amount: 0 }))).toEqual(Array.from(halves()));
    }
  });

  it("offsets with wrap: half a frame swaps the two halves", () => {
    const out = run("offset", { shiftX: 0.5 });
    expect(at(out, 2, 5)).toEqual([0, 0, 255, 255]);
    expect(at(out, 17, 5)).toEqual([255, 0, 0, 255]);
  });

  it("mirrors the left half onto the right", () => {
    const out = run("mirror", { x: 0.5, angle: 0 });
    expect(at(out, 15, 5)).toEqual([255, 0, 0, 255]);
    expect(at(out, 3, 5)).toEqual([255, 0, 0, 255]);
  });

  it("posterizes a mid grey into the nearest step", () => {
    const data = new Uint8ClampedArray(SIZE * SIZE * 4).fill(255);
    for (let i = 0; i < data.length; i += 4) data.set([100, 100, 100], i);
    expect(at(run("posterize", { levels: 2 }, data), 1, 1)).toEqual([0, 0, 0, 255]);
  });

  it("keeps a corner pin at its default square identical and empties outside a moved one", () => {
    expect(Array.from(run("cornerPin", {}))).toEqual(Array.from(halves()));
    const out = run("cornerPin", { topLeftX: 0.5, topLeftY: 0.5 });
    expect(at(out, 1, 1)[3]).toBe(0);
  });

  it("blurs across the edge between the halves and not far from it", () => {
    const out = run("directionalBlur", { length: 8, angle: 0 });
    expect(at(out, 10, 5)[0]).toBeGreaterThan(40);
    expect(at(out, 10, 5)[2]).toBeGreaterThan(40);
    expect(at(out, 1, 5)).toEqual([255, 0, 0, 255]);
  });

  it("fills a ramp from its first color to its second", () => {
    const out = run("gradientRamp", { x: 0, y: 0.5, toX: 1, toY: 0.5 });
    expect(at(out, 0, 5)[0]).toBeLessThan(20);
    expect(at(out, 19, 5)[0]).toBeGreaterThan(235);
  });

  it("lights the surroundings of bright pixels with a glow", () => {
    const data = new Uint8ClampedArray(SIZE * SIZE * 4);
    for (let i = 0; i < data.length; i += 4) data.set([0, 0, 0, 255], i);
    data.set([255, 255, 255, 255], (10 * SIZE + 10) * 4);
    const out = run("glow", { threshold: 0.5, size: 6, amount: 1 }, data);
    expect(at(out, 12, 10)[0]).toBeGreaterThan(0);
    expect(at(out, 0, 0)[0]).toBe(0);
  });
});
