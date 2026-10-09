import { describe, expect, it } from "vitest";

import { latToMercatorY, mercatorYToLat, MAX_TILE_ZOOM, snapViewport } from "./tiles";

const saoPaulo = { south: -23.7, west: -46.8, north: -23.4, east: -46.4 };

describe("snapViewport", () => {
  it("snaps a São Paulo viewport to the zoom 10 tiles that cover it", () => {
    const snapped = snapViewport({ bbox: saoPaulo, zoom: 10 });
    expect(snapped?.tiles).toEqual({ zoom: 10, minX: 378, maxX: 380, minY: 580, maxY: 581 });
    expect(snapped?.zoom).toBe(10);
    expect(snapped?.bbox.west).toBeCloseTo(-47.109375, 12);
    expect(snapped?.bbox.east).toBeCloseTo(-46.0546875, 12);
    expect(snapped?.bbox.north).toBeCloseTo(-23.241346102386135, 12);
    expect(snapped?.bbox.south).toBeCloseTo(-23.885837699861998, 12);
    expect(snapped?.key).toBe("10/378:380/580:581");
  });

  it("uses the integer zoom below a fractional one", () => {
    const snapped = snapViewport({ bbox: saoPaulo, zoom: 12.8 });
    expect(snapped?.tiles).toEqual({ zoom: 12, minX: 1515, maxX: 1520, minY: 2321, maxY: 2325 });
    expect(snapped?.zoom).toBe(12);
  });

  it("gives the same key to small pans inside the same tiles, so the cache is reused", () => {
    const a = snapViewport({ bbox: saoPaulo, zoom: 10 });
    const b = snapViewport({ bbox: { south: -23.8, west: -47.0, north: -23.3, east: -46.1 }, zoom: 10.4 });
    expect(b?.key).toBe(a?.key);
  });

  it("always covers the viewport it was given", () => {
    const snapped = snapViewport({ bbox: saoPaulo, zoom: 14 });
    expect(snapped!.bbox.west).toBeLessThanOrEqual(saoPaulo.west);
    expect(snapped!.bbox.east).toBeGreaterThanOrEqual(saoPaulo.east);
    expect(snapped!.bbox.north).toBeGreaterThanOrEqual(saoPaulo.north);
    expect(snapped!.bbox.south).toBeLessThanOrEqual(saoPaulo.south);
  });

  it("covers the whole world with one tile at zoom 0", () => {
    const snapped = snapViewport({ bbox: { south: -60, west: -170, north: 60, east: 170 }, zoom: 0 });
    expect(snapped?.tiles).toEqual({ zoom: 0, minX: 0, maxX: 0, minY: 0, maxY: 0 });
    expect(snapped?.bbox.west).toBe(-180);
    expect(snapped?.bbox.east).toBe(180);
    expect(snapped?.bbox.north).toBeCloseTo(85.0511287798, 8);
    expect(snapped?.bbox.south).toBeCloseTo(-85.0511287798, 8);
  });

  it("clamps a viewport past the poles and the antimeridian", () => {
    const snapped = snapViewport({ bbox: { south: -89, west: -200, north: 89, east: 200 }, zoom: 2 });
    expect(snapped?.tiles).toEqual({ zoom: 2, minX: 0, maxX: 3, minY: 0, maxY: 3 });
  });

  it("clamps a negative zoom to 0 and a deep zoom to the deepest level", () => {
    expect(snapViewport({ bbox: saoPaulo, zoom: -2 })?.zoom).toBe(0);
    expect(snapViewport({ bbox: { south: -23.5501, west: -46.6301, north: -23.55, east: -46.63 }, zoom: 40 })?.zoom).toBe(MAX_TILE_ZOOM);
  });

  it.each([
    ["NaN in the box", { bbox: { ...saoPaulo, west: Number.NaN }, zoom: 10 }],
    ["an infinite zoom", { bbox: saoPaulo, zoom: Number.POSITIVE_INFINITY }],
    ["south above north", { bbox: { ...saoPaulo, south: -23.3 }, zoom: 10 }],
    ["west above east", { bbox: { ...saoPaulo, west: -46.3 }, zoom: 10 }],
  ])("refuses %s", (_, viewport) => {
    expect(snapViewport(viewport)).toBeNull();
  });
});

describe("mercator helpers", () => {
  it.each([0, -23.55, 45, -80])("round-trips latitude %s", (lat) => {
    expect(mercatorYToLat(latToMercatorY(lat))).toBeCloseTo(lat, 10);
  });
});
