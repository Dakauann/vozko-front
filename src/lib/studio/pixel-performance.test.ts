import { describe, expect, it } from "vitest";

import { renderPixels } from "./pixel-raster";
import type { AreaOp, PixelSurface, StrokeOp } from "./pixel-surface";
import { SurfaceRaster } from "./surface-raster";

const SIDE = 2000;
const FRAME_BUDGET_MS = 8;
const REPLAY_BUDGET_MS = 4000;
const AREA_BUDGET_MS = 1500;

function wave(id: string, row: number, steps: number, size: number): StrokeOp {
  const points: number[] = [];
  for (let i = 0; i <= steps; i++) points.push(100 + (i * (SIDE - 200)) / steps, row + Math.sin(i / 9) * 60);
  return { kind: "stroke", id, mode: "paint", color: "#2244aa", size, hardness: 0.5, opacity: 0.9, points };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

describe("painting on a 2000 px surface", () => {
  it("keeps each pointer step of a live 80 px stroke inside a frame", () => {
    const raster = new SurfaceRaster({ width: SIDE, height: SIDE });
    const full = wave("live", 1000, 360, 80);
    const surface: PixelSurface = { width: SIDE, height: SIDE, ops: [] };
    raster.sync(surface, { ...full, points: full.points.slice(0, 2) });
    const steps: number[] = [];
    for (let n = 4; n <= full.points.length; n += 2) {
      const started = performance.now();
      raster.sync(surface, { ...full, points: full.points.slice(0, n) });
      steps.push(performance.now() - started);
    }
    console.info(`live step median ${median(steps).toFixed(2)} ms, worst ${Math.max(...steps).toFixed(2)} ms over ${steps.length} steps`);
    expect(median(steps)).toBeLessThan(FRAME_BUDGET_MS);
  });

  it("replays a hundred long strokes within budget", () => {
    const ops = Array.from({ length: 100 }, (_, i) => wave(`s${i}`, 60 + i * 19, 200, 40));
    const started = performance.now();
    renderPixels({ width: SIDE, height: SIDE, ops });
    const elapsed = performance.now() - started;
    console.info(`replay of 100 strokes ${elapsed.toFixed(0)} ms`);
    expect(elapsed).toBeLessThan(REPLAY_BUDGET_MS);
  });

  it("fills a feathered inverted area over the whole surface within budget", () => {
    const area: AreaOp = { kind: "area", id: "a", mode: "paint", color: "#000000", opacity: 1, feather: 60, invert: true, parts: [{ points: [400, 400, 1600, 400, 1600, 1600, 400, 1600] }] };
    const started = performance.now();
    renderPixels({ width: SIDE, height: SIDE, ops: [area] });
    const elapsed = performance.now() - started;
    console.info(`feathered area ${elapsed.toFixed(0)} ms`);
    expect(elapsed).toBeLessThan(AREA_BUDGET_MS);
  });
});
