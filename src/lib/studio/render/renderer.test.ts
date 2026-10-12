import { describe, expect, it } from "vitest";

import type { SceneNode } from "../scene/scene";
import { fitCamera, frameCamera, MAX_RASTER_SIDE, rasterRatio } from "./renderer";

const raster = (boxWidth: number, widthPx = 400): SceneNode => ({
  id: "t",
  source: { kind: "raster", key: "k", layer: { id: "l", type: "text", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } }, widthPx, heightPx: 100, fontBasePx: 1080 },
  box: { x: 0, y: 0, width: boxWidth, height: 100, rotation: 0 },
  fit: "fill",
  opacity: 1,
  visible: true,
});

describe("render sizing", () => {
  it("fits the scene into the viewport when there is no camera of its own", () => {
    expect(fitCamera({ width: 1080 }, { width: 540 })).toEqual({ scale: 0.5, x: 0, y: 0 });
  });

  it("draws a zoomed frame from the part of it the canvas covers", () => {
    const placement = { frame: { left: -300, top: 20, width: 2160, height: 1215 }, visible: { left: 300, top: 0, width: 800, height: 478 } };
    expect(frameCamera({ width: 1080 }, placement)).toEqual({ scale: 2, x: -300, y: -0 });
  });

  it("rasterizes at the pixels the screen shows, in quarter steps, sharper when the overlay is scaled up", () => {
    expect(rasterRatio(raster(400), 0.5, 2)).toBe(1);
    expect(rasterRatio(raster(800), 0.5, 2)).toBe(2);
    expect(rasterRatio(raster(400), 0.5, 1)).toBe(0.5);
  });

  it("stays sharp when zoomed in, without asking the GPU for textures larger than it can hold", () => {
    expect(rasterRatio(raster(400), 3, 1)).toBe(3);
    expect(rasterRatio(raster(4000, 4000), 3, 2)).toBeLessThanOrEqual(MAX_RASTER_SIDE / 4000);
  });
});
