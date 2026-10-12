import { describe, expect, it } from "vitest";

import { emptyArtboard, newImageLayer, newShapeLayer, type Layer } from "../document";
import { newEffect } from "../layer-paint";
import { artboardScenes, imageScene } from "./image-scene";
import { paintedContent, rasterPlan } from "./raster";

const MAP = { stops: [{ at: 0, color: "#000000" }, { at: 1, color: "#ffffff" }], intensity: 0.7 };

describe("rasters of painted layers", () => {
  it("pads the raster for outer effects and outside strokes but not for inner ones", () => {
    const base: Layer = { ...newShapeLayer("rect"), id: "s" };
    const glow: Layer = { ...base, effects: [{ ...newEffect("outer-glow", "g"), blur: 20, spread: 6 }], strokes: [{ type: "solid", color: "#000000", opacity: 1, width: 10, align: "outside" }] };
    expect(rasterPlan(glow, 200, 100, 1080).padPx).toBe(Math.ceil(10 + 30 + 6 + 2));
    const inner: Layer = { ...base, effects: [{ ...newEffect("inner-shadow", "i"), blur: 80 }] };
    expect(rasterPlan(inner, 200, 100, 1080).padPx).toBe(2);
  });

  it("keeps the gradient map out of the raster and hands it to the renderer", () => {
    const photo: Layer = { ...newImageLayer("m"), id: "p", gradientMap: MAP };
    expect(paintedContent(photo).gradientMap).toBeUndefined();
    const board = { ...emptyArtboard({ width: 100, height: 100 }), layers: [photo] };
    const scene = imageScene(board, { hidden: new Set(), overrides: new Map() });
    expect(scene.nodes[0].gradientMap).toEqual(MAP);
    expect(artboardScenes({ schema: "studio.image", version: 2, artboards: [board] }, { hidden: new Set(), overrides: new Map() })[0].nodes[0].gradientMap).toEqual(MAP);
  });
});
