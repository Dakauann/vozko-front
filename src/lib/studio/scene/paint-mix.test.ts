import { describe, expect, it } from "vitest";

import { newTextLayer, type Layer } from "../document";
import { mixedParts, pieceWeights } from "./paint-mix";

const layer: Layer = { ...newTextLayer("Oi"), fill: "#ffffff", stroke: "#000000", strokeWidth: 2 };
const sourceOf = (painted: Layer) => ({ key: `${painted.fill}/${painted.stroke}`, layer: painted });

describe("paint mixes", () => {
  it("keeps a single part when nothing changes color", () => {
    const { parts, plan } = mixedParts(layer, undefined, [{ properties: { opacity: 0 } }], sourceOf);
    expect(parts).toEqual([{ source: sourceOf(layer), weight: 1 }]);
    expect(plan).toBeUndefined();
  });

  it("blends two color keys like before", () => {
    const { parts, plan } = mixedParts(layer, { fill: { from: "#ff0000", to: "#0000ff", weight: 0.25 } }, [], sourceOf);
    expect(parts.map((part) => [part.source.key, part.weight])).toEqual([
      ["#ff0000/#000000", 0.75],
      ["#0000ff/#000000", 0.25],
    ]);
    expect(plan).toBeUndefined();
  });

  it("adds a raster per animator color and weighs each piece by its share", () => {
    const { parts, plan } = mixedParts(layer, undefined, [{ properties: { fill: "#ffcc00" } }, { properties: { x: 4 } }, { properties: { fill: "#00ff00", stroke: "#ff0000" } }], sourceOf);
    expect(parts.map((part) => part.source.key)).toEqual(["#ffffff/#000000", "#ffffff/#ff0000", "#ffcc00/#000000", "#ffcc00/#ff0000", "#00ff00/#000000", "#00ff00/#ff0000"]);
    expect(parts.map((part) => part.weight)).toEqual([1, 0, 0, 0, 0, 0]);
    expect(pieceWeights(plan!, [0, 0, 0], parts.length)).toEqual([1, 0, 0, 0, 0, 0]);
    expect(pieceWeights(plan!, [1, 0, 0], parts.length)).toEqual([0, 0, 1, 0, 0, 0]);
    const half = pieceWeights(plan!, [0.5, 0, 0.5], parts.length);
    expect(half.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1);
    expect(half[0]).toBeCloseTo(0.125);
    expect(half[5]).toBeCloseTo(0.25);
  });
});
