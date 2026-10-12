import { describe, expect, it } from "vitest";

import { renderPixels } from "./pixel-raster";
import type { PixelSurface, StrokeOp } from "./pixel-surface";
import { SurfaceRaster } from "./surface-raster";

const SIZE = { width: 30, height: 20 };

function stroke(id: string, points: number[], patch: Partial<StrokeOp> = {}): StrokeOp {
  return { kind: "stroke", id, mode: "paint", color: "#00ff00", size: 6, hardness: 0.7, opacity: 0.8, points, ...patch };
}

function surface(ops: PixelSurface["ops"]): PixelSurface {
  return { ...SIZE, ops };
}

describe("surface raster", () => {
  it("draws only the operations that extend what it already drew", () => {
    const first = stroke("a", [2, 2, 20, 10]);
    const raster = new SurfaceRaster(SIZE);
    expect(raster.sync(surface([first]), null)).toEqual({ x: 0, y: 0, width: 24, height: 14 });
    const second = stroke("b", [5, 15, 25, 15]);
    const dirty = raster.sync(surface([first, second]), null);
    expect(dirty).not.toBeNull();
    expect(dirty!.y).toBeGreaterThan(5);
    expect(raster.display.data).toEqual(renderPixels(surface([first, second])).data);
    expect(raster.sync(surface([first, second]), null)).toBeNull();
  });

  it("starts over when the operations no longer extend the drawn ones", () => {
    const first = stroke("a", [2, 2, 20, 10]);
    const raster = new SurfaceRaster(SIZE);
    raster.sync(surface([first, stroke("b", [5, 15, 25, 15])]), null);
    expect(raster.sync(surface([first]), null)).toEqual({ x: 0, y: 0, width: 30, height: 20 });
    expect(raster.display.data).toEqual(renderPixels(surface([first])).data);
  });

  it("shows a live stroke on top of the committed pixels without touching them", () => {
    const base = stroke("a", [2, 2, 20, 10]);
    const raster = new SurfaceRaster(SIZE);
    raster.sync(surface([base]), null);
    const committed = Uint8ClampedArray.from(raster.pixels.data);
    const live = stroke("live", [3, 12, 12, 12], { mode: "erase", color: undefined });
    raster.sync(surface([base]), live);
    const grown = { ...live, points: [3, 12, 12, 12, 28, 4] };
    const dirty = raster.sync(surface([base]), grown);
    expect(dirty).not.toBeNull();
    expect(raster.pixels.data).toEqual(committed);
    expect(raster.display.data).toEqual(renderPixels(surface([base, grown])).data);
  });

  it("falls back to the committed pixels when the live stroke ends", () => {
    const base = stroke("a", [2, 2, 20, 10]);
    const raster = new SurfaceRaster(SIZE);
    raster.sync(surface([base]), stroke("live", [3, 12, 12, 12]));
    expect(raster.sync(surface([base]), null)).toEqual({ x: 0, y: 0, width: 30, height: 20 });
    expect(raster.display).toBe(raster.pixels);
    const committed = stroke("live", [3, 12, 12, 12]);
    raster.sync(surface([base]), committed);
    raster.sync(surface([base, committed]), null);
    expect(raster.display.data).toEqual(renderPixels(surface([base, committed])).data);
  });

  it("undoes from a checkpoint instead of replaying everything", () => {
    const ops = Array.from({ length: 19 }, (_, i) => stroke(`s${i}`, [1 + i, 2, 3 + i, 18], { color: i % 2 ? "#ff0000" : "#0000ff" }));
    const raster = new SurfaceRaster(SIZE);
    raster.sync(surface(ops), null);
    expect(raster.bytes).toBe(30 * 20 * 4 * 3);
    for (const count of [17, 12, 3]) {
      expect(raster.sync(surface(ops.slice(0, count)), null)).toEqual({ x: 0, y: 0, width: 30, height: 20 });
      expect(raster.display.data).toEqual(renderPixels(surface(ops.slice(0, count))).data);
    }
    raster.sync(surface(ops), null);
    expect(raster.display.data).toEqual(renderPixels(surface(ops)).data);
    const branch = [...ops.slice(0, 10), stroke("other", [0, 0, 29, 19])];
    raster.sync(surface(branch), null);
    expect(raster.display.data).toEqual(renderPixels(surface(branch)).data);
  });

  it("counts the bytes it holds", () => {
    const raster = new SurfaceRaster(SIZE);
    expect(raster.bytes).toBe(30 * 20 * 4);
    raster.sync(surface([]), stroke("live", [3, 12]));
    expect(raster.bytes).toBe(30 * 20 * 4 * 2 + 30 * 20 * 4);
  });
});
