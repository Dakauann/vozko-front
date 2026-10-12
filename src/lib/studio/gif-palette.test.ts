import { describe, expect, it } from "vitest";

import { createNearestIndex, indexPixels, type Palette } from "./gif-palette";

const blackWhite: Palette = [
  [0, 0, 0],
  [255, 255, 255],
];

function flat(width: number, height: number, rgb: [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...rgb, 255], i * 4);
  return data;
}

function whiteShare(indices: Uint8Array): number {
  return indices.reduce((sum, index) => sum + index, 0) / indices.length;
}

describe("nearest palette colour", () => {
  it("finds the closest colour and remembers it", () => {
    const nearest = createNearestIndex([
      [0, 0, 0],
      [255, 0, 0],
      [0, 0, 255],
    ]);
    expect(nearest(250, 10, 10)).toBe(1);
    expect(nearest(5, 5, 240)).toBe(2);
    expect(nearest(20, 20, 20)).toBe(0);
    expect(nearest(250, 10, 10)).toBe(1);
  });
});

describe("indexing a frame", () => {
  it("maps every pixel to its nearest colour without dither", () => {
    const pixels = new Uint8ClampedArray([100, 100, 100, 255, 200, 200, 200, 255]);
    expect(Array.from(indexPixels(pixels, 2, 1, blackWhite, "none"))).toEqual([0, 1]);
  });

  it("keeps exact palette colours exact with error diffusion", () => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255]);
    expect(Array.from(indexPixels(pixels, 2, 2, blackWhite, "diffusion"))).toEqual([0, 1, 0, 1]);
  });

  it("renders a mid grey as a mix of black and white with both dithers", () => {
    const grey = flat(16, 16, [128, 128, 128]);
    expect(whiteShare(indexPixels(grey, 16, 16, blackWhite, "none"))).toBe(1);
    for (const dither of ["diffusion", "ordered"] as const) {
      const share = whiteShare(indexPixels(grey, 16, 16, blackWhite, dither));
      expect(share, dither).toBeGreaterThan(0.35);
      expect(share, dither).toBeLessThan(0.65);
    }
  });

  it("gives the same indices for the same frame, so still frames merge", () => {
    const grey = flat(8, 8, [90, 90, 90]);
    expect(indexPixels(grey, 8, 8, blackWhite, "ordered")).toEqual(indexPixels(grey, 8, 8, blackWhite, "ordered"));
    expect(indexPixels(grey, 8, 8, blackWhite, "diffusion")).toEqual(indexPixels(grey, 8, 8, blackWhite, "diffusion"));
  });
});
