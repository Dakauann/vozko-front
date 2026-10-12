import { describe, expect, it } from "vitest";

import { applyPixelOp, areaCoverage, createPixels, LiveStroke, polygonCoverage, renderPixels, strokeCoverage } from "./pixel-raster";
import type { AreaOp, PixelSurface, StrokeOp } from "./pixel-surface";

const SIZE = { width: 40, height: 20 };

function stroke(patch: Partial<StrokeOp> = {}): StrokeOp {
  return { kind: "stroke", id: "s", mode: "paint", color: "#ff0000", size: 10, hardness: 1, opacity: 1, points: [5, 10, 35, 10], ...patch };
}

function area(patch: Partial<AreaOp> = {}): AreaOp {
  return { kind: "area", id: "a", mode: "paint", color: "#0000ff", opacity: 1, feather: 0, parts: [{ points: [10, 5, 30, 5, 30, 15, 10, 15] }], ...patch };
}

function surface(ops: PixelSurface["ops"], size = SIZE): PixelSurface {
  return { ...size, ops };
}

function pixel(buffer: { width: number; data: Uint8ClampedArray }, x: number, y: number): number[] {
  const i = (y * buffer.width + x) * 4;
  return Array.from(buffer.data.slice(i, i + 4));
}

describe("polygon coverage", () => {
  it("covers exactly the area of the polygon", () => {
    const coverage = polygonCoverage([2, 2, 12.5, 2, 2, 9.5], { x: 0, y: 0, width: 16, height: 12 });
    const total = coverage.reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo((10.5 * 7.5) / 2, 3);
  });

  it("anti aliases a half covered column", () => {
    const coverage = polygonCoverage([0, 0, 2.5, 0, 2.5, 1, 0, 1], { x: 0, y: 0, width: 4, height: 1 });
    expect(Array.from(coverage)).toEqual([1, 1, 0.5, 0]);
  });

  it("clips polygons that leave the rectangle", () => {
    const coverage = polygonCoverage([-5, -5, 50, -5, 50, 50, -5, 50], { x: 0, y: 0, width: 3, height: 2 });
    expect(Array.from(coverage)).toEqual([1, 1, 1, 1, 1, 1]);
  });
});

describe("strokes", () => {
  it("paints the color inside a hard stroke and nothing outside", () => {
    const pixels = renderPixels(surface([stroke()]));
    expect(pixel(pixels, 20, 10)).toEqual([255, 0, 0, 255]);
    expect(pixel(pixels, 20, 2)[3]).toBe(0);
  });

  it("never passes the stroke opacity where the stroke crosses itself", () => {
    const pixels = renderPixels(surface([stroke({ opacity: 0.5, points: [5, 10, 35, 10, 5, 10, 35, 10] })]));
    expect(pixel(pixels, 20, 10)[3]).toBe(128);
  });

  it("fades a soft stroke toward its edge", () => {
    const pixels = renderPixels(surface([stroke({ hardness: 0, size: 16 })]));
    const alphas = [10, 12, 14, 18].map((y) => pixel(pixels, 20, y)[3]);
    expect(alphas[0]).toBeGreaterThan(alphas[1]);
    expect(alphas[1]).toBeGreaterThan(alphas[2]);
    expect(alphas[3]).toBe(0);
  });

  it("thins a pressure stroke where the pressure is low", () => {
    const pixels = renderPixels(surface([stroke({ size: 16, pressure: true, points: [5, 10, 0.2, 35, 10, 1] })]));
    expect(pixel(pixels, 8, 13)[3]).toBe(0);
    expect(pixel(pixels, 32, 13)[3]).toBe(255);
  });

  it("erases by the stroke opacity", () => {
    const pixels = renderPixels(surface([area({ parts: [{ points: [0, 0, 40, 0, 40, 20, 0, 20] }] }), stroke({ mode: "erase", color: undefined, opacity: 0.5 })]));
    expect(pixel(pixels, 20, 10)).toEqual([0, 0, 255, 128]);
    expect(pixel(pixels, 20, 1)).toEqual([0, 0, 255, 255]);
  });

  it("grows a live stroke into the same coverage as its replay", () => {
    const op = stroke({ hardness: 0.6, size: 7, points: [3, 4, 9, 7, 15, 3, 22, 16, 31, 9, 38, 12] });
    const live = new LiveStroke({ ...op, points: op.points.slice(0, 4) }, SIZE);
    live.extend({ ...op, points: op.points.slice(0, 8) });
    live.extend(op);
    const replay = strokeCoverage(op, SIZE)!;
    for (let y = 0; y < replay.height; y++) {
      for (let x = 0; x < replay.width; x++) {
        expect(live.coverage.data[(y + replay.y) * SIZE.width + x + replay.x]).toBeCloseTo(replay.data[y * replay.width + x], 6);
      }
    }
  });

  it("reports where a live stroke changed", () => {
    const live = new LiveStroke(stroke({ points: [5, 10] }), SIZE);
    expect(live.extend(stroke({ points: [5, 10, 15, 10] }))).toEqual({ x: 0, y: 4, width: 21, height: 12 });
  });
});

describe("areas", () => {
  it("fills a rectangle with crisp edges", () => {
    const pixels = renderPixels(surface([area()]));
    expect(pixel(pixels, 10, 5)).toEqual([0, 0, 255, 255]);
    expect(pixel(pixels, 29, 14)).toEqual([0, 0, 255, 255]);
    expect(pixel(pixels, 9, 5)[3]).toBe(0);
    expect(pixel(pixels, 30, 5)[3]).toBe(0);
  });

  it("subtracts later parts and inverts the result", () => {
    const parts = [{ points: [10, 5, 30, 5, 30, 15, 10, 15] }, { mode: "subtract" as const, points: [15, 5, 25, 5, 25, 15, 15, 15] }];
    const cut = renderPixels(surface([area({ parts })]));
    expect(pixel(cut, 12, 10)[3]).toBe(255);
    expect(pixel(cut, 20, 10)[3]).toBe(0);
    const inverted = renderPixels(surface([area({ parts, invert: true })]));
    expect(pixel(inverted, 12, 10)[3]).toBe(0);
    expect(pixel(inverted, 20, 10)[3]).toBe(255);
    expect(pixel(inverted, 2, 2)[3]).toBe(255);
  });

  it("feathers the edge into a soft ramp", () => {
    const coverage = areaCoverage(area({ feather: 6 }), SIZE)!;
    const at = (x: number, y: number) => coverage.data[(y - coverage.y) * coverage.width + (x - coverage.x)];
    expect(at(20, 10)).toBeGreaterThan(0.85);
    expect(at(10, 10)).toBeGreaterThan(0.35);
    expect(at(10, 10)).toBeLessThan(0.65);
    expect(at(5, 10)).toBeLessThan(at(10, 10));
  });

  it("paints black for hide and removes it for reveal on masks", () => {
    const pixels = renderPixels(surface([area({ mode: "hide", color: undefined }), stroke({ mode: "reveal", color: undefined, size: 4 })]));
    expect(pixel(pixels, 12, 7)).toEqual([0, 0, 0, 255]);
    expect(pixel(pixels, 20, 10)[3]).toBe(0);
  });
});

describe("replay", () => {
  it("draws the same pixels every time and op by op", () => {
    const ops = [area({ feather: 3 }), stroke({ hardness: 0.3 }), stroke({ id: "e", mode: "erase", color: undefined, opacity: 0.7, points: [20, 0, 20, 20] })];
    const whole = renderPixels(surface(ops));
    const stepwise = createPixels(SIZE.width, SIZE.height);
    for (const op of ops) applyPixelOp(stepwise, op);
    expect(stepwise.data).toEqual(whole.data);
    expect(renderPixels(surface(ops)).data).toEqual(whole.data);
  });

  it("ignores ink that lands outside the surface", () => {
    const pixels = renderPixels(surface([stroke({ points: [-500, -500, -400, -450] }), area({ parts: [{ points: [100, 100, 200, 100, 200, 200] }] })]));
    expect(pixels.data.every((value) => value === 0)).toBe(true);
  });
});
