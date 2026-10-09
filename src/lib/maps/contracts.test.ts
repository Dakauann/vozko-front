import { describe, expect, it } from "vitest";

import {
  MapContractError,
  parseDistrictCounts,
  parseDrawnArea,
  parseDrawnAreas,
  parseGeoSummary,
  parseMapLayer,
  parseMapViewport,
} from "./contracts";

const point = {
  id: "p1",
  lat: -23.55,
  lng: -46.63,
  precision: "street",
  placement: "on_map",
  tone: "chart-2",
  count: 3,
  leadIds: ["l1", "l2", "l3"],
};

const cell = { ix: 10, iy: -4, placement: "on_map", count: 12, lat: -23.5, lng: -46.6 };

const summary = {
  total: 1200,
  onMap: 800,
  approximate: 200,
  withoutAddress: 150,
  notFound: 30,
  pending: 15,
  quotaExceeded: 5,
  refused: 3,
};

const district = {
  pair: "3550308/jardim paulista",
  cityKey: "3550308",
  districtKey: "jardim paulista",
  name: "Jardim Paulista",
  lat: -23.57,
  lng: -46.66,
  count: 42,
};

describe("parseGeoSummary", () => {
  it("accepts every count", () => {
    expect(parseGeoSummary(summary)).toEqual(summary);
  });

  it.each([
    ["a missing count", { ...summary, pending: undefined }],
    ["a missing refused count", { ...summary, refused: undefined }],
    ["a negative count", { ...summary, onMap: -1 }],
    ["a fractional count", { ...summary, total: 1.5 }],
    ["a string count", { ...summary, total: "1200" }],
    ["null", null],
    ["an array", []],
  ])("refuses %s", (_, raw) => {
    expect(() => parseGeoSummary(raw)).toThrow(MapContractError);
  });
});

describe("parseMapLayer", () => {
  it("accepts points", () => {
    expect(parseMapLayer({ kind: "points", points: [point] })).toEqual({ kind: "points", points: [point] });
  });

  it("accepts cells with their size", () => {
    const raw = { kind: "cells", cellSizeDegrees: 0.01, cells: [cell] };
    expect(parseMapLayer(raw)).toEqual(raw);
  });

  it("reads approximate points and cells apart from the precise ones", () => {
    const near = { ...point, id: "approximate:-23.55,-46.63", precision: "district", placement: "approximate", tone: "neutral" };
    expect(parseMapLayer({ kind: "points", points: [point, near] })).toEqual({ kind: "points", points: [point, near] });
    const cells = { kind: "cells", cellSizeDegrees: 0.01, cells: [cell, { ...cell, placement: "approximate", count: 3 }] };
    expect(parseMapLayer(cells)).toEqual(cells);
  });

  it("accepts an empty layer", () => {
    expect(parseMapLayer({ kind: "points", points: [] })).toEqual({ kind: "points", points: [] });
  });

  it("drops fields the contract does not name", () => {
    const parsed = parseMapLayer({ kind: "points", points: [{ ...point, phone: "5511999999999" }] });
    expect(parsed).toEqual({ kind: "points", points: [point] });
  });

  it.each([
    ["an unknown kind", { kind: "hexagons", points: [point] }],
    ["an unknown tone", { kind: "points", points: [{ ...point, tone: "chart-9" }] }],
    ["an unknown precision", { kind: "points", points: [{ ...point, precision: "rooftop" }] }],
    ["a point without position", { kind: "points", points: [{ ...point, lat: undefined }] }],
    ["a point at null island", { kind: "points", points: [{ ...point, lat: 0, lng: 0 }] }],
    ["a point out of range", { kind: "points", points: [{ ...point, lat: 91 }] }],
    ["a point with NaN", { kind: "points", points: [{ ...point, lng: Number.NaN }] }],
    ["a point with zero people", { kind: "points", points: [{ ...point, count: 0 }] }],
    ["a point with more than 5 lead ids", { kind: "points", points: [{ ...point, count: 6, leadIds: ["1", "2", "3", "4", "5", "6"] }] }],
    ["a point with more ids than people", { kind: "points", points: [{ ...point, count: 1, leadIds: ["1", "2"] }] }],
    ["a point with a blank lead id", { kind: "points", points: [{ ...point, leadIds: [""] }] }],
    ["a point without an id", { kind: "points", points: [{ ...point, id: "" }] }],
    ["a point without a placement", { kind: "points", points: [{ ...point, placement: undefined }] }],
    ["a point in no map placement", { kind: "points", points: [{ ...point, placement: "pending" }] }],
    ["a cell without a placement", { kind: "cells", cellSizeDegrees: 0.01, cells: [{ ...cell, placement: undefined }] }],
    ["points that are not a list", { kind: "points", points: {} }],
    ["cells without size", { kind: "cells", cells: [cell] }],
    ["cells with a zero size", { kind: "cells", cellSizeDegrees: 0, cells: [cell] }],
    ["a cell with a fractional index", { kind: "cells", cellSizeDegrees: 0.01, cells: [{ ...cell, ix: 1.5 }] }],
    ["a cell with zero people", { kind: "cells", cellSizeDegrees: 0.01, cells: [{ ...cell, count: 0 }] }],
    ["a body that is not an object", "points"],
  ])("refuses %s", (_, raw) => {
    expect(() => parseMapLayer(raw)).toThrow(MapContractError);
  });
});

describe("parseDistrictCounts", () => {
  it("accepts a list of bairros", () => {
    expect(parseDistrictCounts([district])).toEqual([district]);
  });

  it.each([
    ["a missing name", [{ ...district, name: "" }]],
    ["a missing city key", [{ ...district, cityKey: undefined }]],
    ["a missing pair", [{ ...district, pair: undefined }]],
    ["a blank pair", [{ ...district, pair: " " }]],
    ["a negative count", [{ ...district, count: -2 }]],
    ["an invalid position", [{ ...district, lat: 0, lng: 0 }]],
    ["an object instead of a list", { items: [district] }],
  ])("refuses %s", (_, raw) => {
    expect(() => parseDistrictCounts(raw)).toThrow(MapContractError);
  });
});

const viewport = {
  bbox: { south: -23.7, west: -46.8, north: -23.4, east: -46.4 },
  basis: "located",
  view: "positions",
};

describe("parseMapViewport", () => {
  it("accepts a located viewport", () => {
    expect(parseMapViewport(viewport)).toEqual(viewport);
  });

  it("keeps the most common city when the server names one", () => {
    const city = { cityKey: "3550308", name: "São Paulo", state: "SP", count: 70 };
    expect(parseMapViewport({ ...viewport, basis: "country", view: "districts", city })).toEqual({
      ...viewport,
      basis: "country",
      view: "districts",
      city,
    });
  });

  it("opens on the drawn areas when the server frames them", () => {
    expect(parseMapViewport({ ...viewport, basis: "area" }).basis).toBe("area");
  });

  it("keeps a city whose commonest spelling has no state, and names a nameless one by its key", () => {
    const city = { cityKey: "3550308", name: "", state: "", count: 4 };
    expect(parseMapViewport({ ...viewport, city }).city).toEqual({ cityKey: "3550308", name: "3550308", state: "", count: 4 });
  });

  it.each([
    ["without a key", { name: "São Paulo", state: "SP", count: 1 }],
    ["without a count", { cityKey: "3550308", name: "São Paulo", state: "SP" }],
    ["that is not an object", "São Paulo"],
  ])("drops a city %s and keeps the viewport", (_, city) => {
    expect(parseMapViewport({ ...viewport, city })).toEqual(viewport);
  });

  it.each([
    ["an unknown basis", { ...viewport, basis: "guess" }],
    ["an unknown view", { ...viewport, view: "heat" }],
    ["an inverted box", { ...viewport, bbox: { south: -23.4, west: -46.8, north: -23.7, east: -46.4 } }],
    ["a box without a side", { ...viewport, bbox: { south: -23.7, west: -46.8, north: -23.4 } }],
    ["a box out of range", { ...viewport, bbox: { south: -95, west: -46.8, north: -23.4, east: -46.4 } }],
    ["a list", [viewport]],
  ])("refuses %s", (_, raw) => {
    expect(() => parseMapViewport(raw)).toThrow(MapContractError);
  });
});

const ring = [
  { lat: -23.55, lng: -46.64 },
  { lat: -23.55, lng: -46.62 },
  { lat: -23.53, lng: -46.62 },
];

const drawnArea = {
  id: "a1",
  name: "Área desenhada em 08/10/2026 14:05",
  visibility: "private",
  ownerId: "u1",
  canEdit: true,
  shape: { kind: "polygon", ring },
  createdAt: "2026-10-08T17:05:00Z",
  updatedAt: "2026-10-08T17:05:00Z",
};

describe("parseDrawnArea", () => {
  it("accepts a polygon", () => {
    expect(parseDrawnArea(drawnArea)).toEqual(drawnArea);
  });

  it("accepts a circle by its center and radius", () => {
    const shape = { kind: "circle", center: { lat: -23.55, lng: -46.63 }, radiusM: 1500 };
    expect(parseDrawnArea({ ...drawnArea, visibility: "shared", canEdit: false, shape })).toEqual({
      ...drawnArea,
      visibility: "shared",
      canEdit: false,
      shape,
    });
  });

  it("reads the list of areas", () => {
    expect(parseDrawnAreas({ items: [drawnArea] })).toEqual([drawnArea]);
  });

  it.each([
    ["a blank id", { ...drawnArea, id: "" }],
    ["a blank name", { ...drawnArea, name: " " }],
    ["an unknown visibility", { ...drawnArea, visibility: "public" }],
    ["a missing edit flag", { ...drawnArea, canEdit: undefined }],
    ["an unknown shape", { ...drawnArea, shape: { kind: "hexagon", ring } }],
    ["a ring of two points", { ...drawnArea, shape: { kind: "polygon", ring: ring.slice(0, 2) } }],
    ["a ring with an invalid point", { ...drawnArea, shape: { kind: "rectangle", ring: [...ring.slice(0, 2), { lat: 0, lng: 0 }] } }],
    ["a circle without radius", { ...drawnArea, shape: { kind: "circle", center: { lat: -23.55, lng: -46.63 } } }],
    ["a circle without center", { ...drawnArea, shape: { kind: "circle", radiusM: 100 } }],
  ])("refuses %s", (_, raw) => {
    expect(() => parseDrawnArea(raw)).toThrow(MapContractError);
  });

  it("refuses a list that is not wrapped in items", () => {
    expect(() => parseDrawnAreas([drawnArea])).toThrow(MapContractError);
  });
});
