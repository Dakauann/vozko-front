import { describe, expect, it } from "vitest";

import { HEAT_POINT_RADIUS, heatFeatureCollection, heatLegendRamp, heatRadius, heatRamp, heatWeight } from "./heat";
import type { MapLayerResponse } from "./types";

const cells: MapLayerResponse = {
  kind: "cells",
  cellSizeDegrees: 0.5,
  cells: [
    { ix: -94, iy: -48, placement: "on_map", count: 9, lat: -23.8, lng: -46.7 },
    { ix: -93, iy: -48, placement: "on_map", count: 3, lat: -23.7, lng: -46.2 },
    { ix: -94, iy: -48, placement: "approximate", count: 400, lat: -23.75, lng: -46.72 },
  ],
};

const points: MapLayerResponse = {
  kind: "points",
  points: [
    { id: "p1", lat: -23.55, lng: -46.63, precision: "street", placement: "on_map", tone: "neutral", count: 2, leadIds: ["a", "b"] },
    { id: "approximate:-23.5,-46.6", lat: -23.5, lng: -46.6, precision: "district", placement: "approximate", tone: "neutral", count: 50, leadIds: [] },
  ],
};

describe("heatRamp", () => {
  it("runs the light theme from lightness 80 to 40 of chart-2 with alpha 0.08 to 0.58, exactly the artifact ramp", () => {
    expect(heatRamp("231 60% 56%", "light")).toEqual([
      { at: 0, color: "rgba(0, 0, 0, 0)" },
      { at: 0.04, color: "rgba(167, 177, 233, 0.1008)" },
      { at: 0.75, color: "rgba(51, 74, 204, 0.47)" },
      { at: 0.9615, color: "rgba(42, 61, 169, 0.58)" },
      { at: 1, color: "rgba(41, 59, 163, 0.58)" },
    ]);
  });

  it("runs the dark theme from lightness 36 to 66, brightening where the light theme darkens", () => {
    expect(heatRamp("229 75% 60%", "dark")).toEqual([
      { at: 0, color: "rgba(0, 0, 0, 0)" },
      { at: 0.04, color: "rgba(24, 50, 166, 0.1008)" },
      { at: 0.4667, color: "rgba(32, 67, 223, 0.3227)" },
      { at: 0.9615, color: "rgba(98, 123, 233, 0.58)" },
      { at: 1, color: "rgba(103, 127, 233, 0.58)" },
    ]);
  });

  it("keeps the hue of chart-2 at every stop, never the brand green", () => {
    for (const stop of heatRamp("231 60% 56%", "light")?.slice(1) ?? []) {
      const [r, g, b] = stop.color.match(/\d+/g)!.map(Number);
      expect(b).toBeGreaterThan(r);
      expect(b).toBeGreaterThan(g);
    }
  });

  it("refuses a token that is not a colour triple", () => {
    expect(heatRamp("", "light")).toBeNull();
    expect(heatRamp("indigo", "dark")).toBeNull();
  });
});

describe("heatLegendRamp", () => {
  it("draws the legend ramp from faint to strong chart-2, as the artifact legend does", () => {
    expect(heatLegendRamp("231 60% 56%", "light")).toEqual({ from: "hsla(231, 60%, 76%, 0.35)", to: "hsla(231, 60%, 32%, 0.85)" });
    expect(heatLegendRamp("229 75% 60%", "dark")).toEqual({ from: "hsla(229, 75%, 40%, 0.35)", to: "hsla(229, 75%, 72%, 0.85)" });
    expect(heatLegendRamp("nope", "dark")).toBeNull();
  });
});

describe("heatFeatureCollection", () => {
  it("feeds the heat only with leads whose position pins a house, cells at their centre", () => {
    expect(heatFeatureCollection(cells).features).toEqual([
      { type: "Feature", geometry: { type: "Point", coordinates: [-46.7, -23.8] }, properties: { count: 9 } },
      { type: "Feature", geometry: { type: "Point", coordinates: [-46.2, -23.7] }, properties: { count: 3 } },
    ]);
  });

  it("feeds the heat with precise points when the server answers points", () => {
    expect(heatFeatureCollection(points).features).toEqual([
      { type: "Feature", geometry: { type: "Point", coordinates: [-46.63, -23.55] }, properties: { count: 2 } },
    ]);
  });

  it("has no heat without a layer", () => {
    expect(heatFeatureCollection(null).features).toEqual([]);
  });
});

describe("heatWeight", () => {
  it("weighs cells by the square root of their share of the busiest precise cell, so smaller towns stay visible", () => {
    expect(heatWeight(cells)).toEqual(["interpolate", ["linear"], ["sqrt", ["get", "count"]], 0, 0, 3, 1]);
  });

  it("weighs a lone lead at a twelfth, so only a real crowd reaches the strongest colour", () => {
    expect(heatWeight(points)).toEqual(["interpolate", ["linear"], ["get", "count"], 0, 0, 12, 1]);
  });

  it("weighs evenly when there is nothing to compare", () => {
    expect(heatWeight(null)).toBe(1);
    expect(heatWeight({ kind: "cells", cellSizeDegrees: 0.5, cells: [] })).toBe(1);
  });
});

describe("heatRadius", () => {
  it("spreads each cell over its own size on screen, never narrower than the artifact radius", () => {
    const atZero = 0.5 * (512 / 360) * 1.25;
    const floorZoom = Math.log2(26 / atZero);
    expect(heatRadius(cells)).toEqual(["interpolate", ["exponential", 2], ["zoom"], 0, 26, floorZoom, 26, 22, atZero * 2 ** 22]);
  });

  it("spreads cells wider than the artifact radius from the first zoom", () => {
    const wide: MapLayerResponse = { kind: "cells", cellSizeDegrees: 20, cells: [] };
    const atZero = 20 * (512 / 360) * 1.25;
    expect(heatRadius(wide)).toEqual(["interpolate", ["exponential", 2], ["zoom"], 0, atZero, 22, atZero * 2 ** 22]);
  });

  it("uses the artifact radius around points", () => {
    expect(heatRadius(points)).toBe(HEAT_POINT_RADIUS);
    expect(HEAT_POINT_RADIUS).toBe(26);
    expect(heatRadius(null)).toBe(HEAT_POINT_RADIUS);
  });
});
