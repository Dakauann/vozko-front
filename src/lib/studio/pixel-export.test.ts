import { describe, expect, it } from "vitest";

import { emptyArtboard, newImageLayer, type Layer } from "./document";
import { exportScene, type RasterItem } from "./export-scene";
import { newPaintLayer } from "./pixel-surface";

const CANVAS = { width: 1000, height: 500 };
const box = { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 };

describe("pixels in PDF and SVG export", () => {
  it("turns a paint layer and a masked photo into their own patches", () => {
    const paint: Layer = { ...newPaintLayer(CANVAS, box), id: "ink" };
    const photo: Layer = { ...newImageLayer("asset", { ...box, x: 0.2 }), id: "photo", mask: { width: 200, height: 100, ops: [] } };
    const items = exportScene({ ...emptyArtboard(CANVAS), layers: [photo, paint] }, { transparent: true }).items as RasterItem[];
    expect(items.map((item) => [item.kind, item.layerIds])).toEqual([
      ["raster", ["photo"]],
      ["raster", ["ink"]],
    ]);
    expect(items.every((item) => item.bounds.width < CANVAS.width)).toBe(true);
  });
});
