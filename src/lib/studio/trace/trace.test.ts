import { describe, expect, it } from "vitest";

import { importSvg } from "../svg-import";
import { layerSubpaths } from "../vector-layer";
import { maskLoops } from "./contours";
import { quantize } from "./quantize";
import { traceRaster, type RasterImage } from "./trace";

function raster(width: number, height: number, paint: (x: number, y: number) => [number, number, number, number]): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 4);
  }
  return { width, height, data };
}

const WHITE: [number, number, number, number] = [255, 255, 255, 255];
const BLACK: [number, number, number, number] = [0, 0, 0, 255];
const RED: [number, number, number, number] = [220, 20, 20, 255];

function area(loop: { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

describe("maskLoops", () => {
  it("outlines a filled square along pixel edges", () => {
    const classes = Int16Array.from({ length: 36 }, (_, i) => (i % 6 >= 1 && i % 6 <= 3 && Math.floor(i / 6) >= 2 && Math.floor(i / 6) <= 4 ? 1 : 0));
    const loops = maskLoops(classes, 6, 6, 1);
    expect(loops).toHaveLength(1);
    expect(area(loops[0])).toBe(9);
  });

  it("returns the hole of a ring as its own loop", () => {
    const ring = Int16Array.from({ length: 25 }, (_, i) => {
      const x = i % 5;
      const y = Math.floor(i / 5);
      return x >= 1 && x <= 3 && y >= 1 && y <= 3 && !(x === 2 && y === 2) ? 1 : 0;
    });
    const loops = maskLoops(ring, 5, 5, 1);
    expect(loops.map(area).sort((a, b) => a - b)).toEqual([1, 9]);
  });

  it("keeps two squares that touch only at a corner apart", () => {
    const diagonal = Int16Array.from([1, 0, 0, 1]);
    expect(maskLoops(diagonal, 2, 2, 1)).toHaveLength(2);
  });
});

describe("quantize", () => {
  it("splits black and white with a threshold and two colors with k-means", () => {
    const image = raster(10, 10, (x) => (x < 5 ? BLACK : WHITE));
    const bw = quantize(image, { mode: "bw", colors: 2, threshold: 128 });
    expect(bw.palette).toEqual(["#000000", "#ffffff"]);
    expect(bw.classes[0]).toBe(0);
    expect(bw.classes[9]).toBe(1);
    const color = quantize(raster(10, 10, (x) => (x < 5 ? RED : WHITE)), { mode: "color", colors: 2, threshold: 128 });
    expect(color.palette).toHaveLength(2);
    expect(new Set(color.classes).size).toBe(2);
  });

  it("leaves transparent pixels out", () => {
    const image = raster(4, 4, (x) => (x < 2 ? [0, 0, 0, 0] : BLACK));
    expect(quantize(image, { mode: "bw", colors: 2, threshold: 128 }).classes[0]).toBe(-1);
  });
});

describe("traceRaster", () => {
  const logo = raster(40, 40, (x, y) => {
    const inSquare = x >= 10 && x < 30 && y >= 10 && y < 30;
    const inHole = x >= 17 && x < 23 && y >= 17 && y < 23;
    return inSquare && !inHole ? BLACK : WHITE;
  });

  it("turns a logo into svg shapes, dropping white when asked", () => {
    const traced = traceRaster(logo, { mode: "bw", colors: 2, threshold: 128, detail: 0.5, noise: 4, ignoreWhite: true });
    expect(traced.shapes).toBe(1);
    const imported = importSvg(traced.svg, { width: 1000, height: 1000 });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.layers).toHaveLength(1);
    expect(imported.value.layers[0]).toMatchObject({ fill: "#000000", fillRule: "evenodd" });
    expect(layerSubpaths(imported.value.layers[0])).toHaveLength(2);
  });

  it("keeps white as a shape when it is part of the art", () => {
    expect(traceRaster(logo, { mode: "bw", colors: 2, threshold: 128, detail: 0.5, noise: 4, ignoreWhite: false }).shapes).toBe(2);
  });

  it("drops specks smaller than the noise size", () => {
    const specks = raster(30, 30, (x, y) => ((x === 5 && y === 5) || (x >= 10 && x < 20 && y >= 10 && y < 20) ? BLACK : WHITE));
    const traced = traceRaster(specks, { mode: "bw", colors: 2, threshold: 128, detail: 0.5, noise: 4, ignoreWhite: true });
    const imported = importSvg(traced.svg, { width: 1000, height: 1000 });
    expect(imported.ok && layerSubpaths(imported.value.layers[0])).toHaveLength(1);
  });

  it("reports an image with nothing to trace", () => {
    expect(traceRaster(raster(10, 10, () => WHITE), { mode: "bw", colors: 2, threshold: 128, detail: 0.5, noise: 4, ignoreWhite: true }).shapes).toBe(0);
  });
});
