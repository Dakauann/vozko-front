import { describe, expect, it } from "vitest";

import { areaOutline, drawnFeatureToArea, type DrawnFeature } from "./area";
import { CIRCLE_VERTICES } from "./geometry";

const MERCATOR_RADIUS = 6378137;

function mercatorCircle(center: { lat: number; lng: number }, radiusM: number, steps = 64): number[][] {
  const scale = 1 / Math.cos((center.lat * Math.PI) / 180);
  const cx = (MERCATOR_RADIUS * center.lng * Math.PI) / 180;
  const cy = MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + (center.lat * Math.PI) / 360));
  const ring: number[][] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    const x = cx + radiusM * scale * Math.cos(angle);
    const y = cy + radiusM * scale * Math.sin(angle);
    const lng = (x / MERCATOR_RADIUS) * (180 / Math.PI);
    const lat = (2 * Math.atan(Math.exp(y / MERCATOR_RADIUS)) - Math.PI / 2) * (180 / Math.PI);
    ring.push([Number(lng.toFixed(9)), Number(lat.toFixed(9))]);
  }
  ring.push(ring[0]);
  return ring;
}

function feature(mode: unknown, coordinates: number[][], extra: Record<string, unknown> = {}): DrawnFeature {
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coordinates] },
    properties: { mode, ...extra },
  } as DrawnFeature;
}

const square = [
  [-46.7, -23.6],
  [-46.6, -23.6],
  [-46.6, -23.5],
  [-46.7, -23.5],
  [-46.7, -23.6],
];

describe("drawnFeatureToArea", () => {
  it("turns a drawn polygon into an open ring of positions", () => {
    expect(drawnFeatureToArea(feature("polygon", square))).toEqual({
      kind: "polygon",
      ring: [
        { lat: -23.6, lng: -46.7 },
        { lat: -23.6, lng: -46.6 },
        { lat: -23.5, lng: -46.6 },
        { lat: -23.5, lng: -46.7 },
      ],
    });
  });

  it("keeps an already open polygon ring", () => {
    const area = drawnFeatureToArea(feature("polygon", square.slice(0, 4)));
    expect(area?.kind).toBe("polygon");
    expect(area && "ring" in area ? area.ring : []).toHaveLength(4);
  });

  it("squares a rectangle to four exact axis-aligned corners", () => {
    const skewed = [
      [-46.7, -23.6],
      [-46.6000000001, -23.6],
      [-46.6, -23.4999999999],
      [-46.7, -23.5],
      [-46.7, -23.6],
    ];
    expect(drawnFeatureToArea(feature("rectangle", skewed))).toEqual({
      kind: "rectangle",
      ring: [
        { lat: -23.6, lng: -46.7 },
        { lat: -23.6, lng: -46.6 },
        { lat: -23.4999999999, lng: -46.6 },
        { lat: -23.4999999999, lng: -46.7 },
      ],
    });
  });

  it("recovers the exact center and the radius of a drawn circle", () => {
    const center = { lat: -23.55, lng: -46.65 };
    const area = drawnFeatureToArea(feature("circle", mercatorCircle(center, 2000), { radiusKilometers: 2 }));
    expect(area?.kind).toBe("circle");
    if (area?.kind !== "circle") return;
    expect(area.center.lat).toBeCloseTo(center.lat, 7);
    expect(area.center.lng).toBeCloseTo(center.lng, 7);
    expect(area.radiusM).toBe(2000);
  });

  it("measures the radius when the drawing tool did not record it", () => {
    const center = { lat: -23.55, lng: -46.65 };
    const area = drawnFeatureToArea(feature("circle", mercatorCircle(center, 1500)));
    if (area?.kind !== "circle") throw new Error("expected a circle");
    expect(Math.abs(area.radiusM - 1500) / 1500).toBeLessThan(0.01);
  });

  it.each([
    ["an unknown mode", feature("freehand", square)],
    ["a missing mode", feature(undefined, square)],
    ["a line instead of a polygon", { type: "Feature", geometry: { type: "LineString", coordinates: square }, properties: { mode: "polygon" } }],
    ["fewer than three vertices", feature("polygon", [[-46.7, -23.6], [-46.6, -23.6], [-46.7, -23.6]])],
    ["a vertex with NaN", feature("polygon", [[-46.7, Number.NaN], [-46.6, -23.6], [-46.6, -23.5], [-46.7, -23.6]])],
    ["a vertex out of range", feature("polygon", [[-46.7, -95], [-46.6, -23.6], [-46.6, -23.5], [-46.7, -95]])],
    ["a rectangle with no area", feature("rectangle", [[-46.7, -23.6], [-46.7, -23.6], [-46.7, -23.5], [-46.7, -23.5], [-46.7, -23.6]])],
    ["a circle with a zero radius", feature("circle", mercatorCircle({ lat: -23.55, lng: -46.65 }, 1000), { radiusKilometers: 0 })],
    ["a circle with a negative radius", feature("circle", mercatorCircle({ lat: -23.55, lng: -46.65 }, 1000), { radiusKilometers: -1 })],
    ["nothing", undefined],
  ])("refuses %s", (_, drawn) => {
    expect(drawnFeatureToArea(drawn as DrawnFeature | undefined)).toBeNull();
  });
});

describe("areaOutline", () => {
  it("closes a polygon ring in GeoJSON order", () => {
    const outline = areaOutline({
      kind: "polygon",
      ring: [
        { lat: -23.6, lng: -46.7 },
        { lat: -23.6, lng: -46.6 },
        { lat: -23.5, lng: -46.6 },
      ],
    });
    expect(outline).toEqual([
      [-46.7, -23.6],
      [-46.6, -23.6],
      [-46.6, -23.5],
      [-46.7, -23.6],
    ]);
  });

  it("draws a circle as the same 64-vertex ring the backend filters by", () => {
    const outline = areaOutline({ kind: "circle", center: { lat: -23.55, lng: -46.65 }, radiusM: 1000 });
    expect(outline).toHaveLength(CIRCLE_VERTICES + 1);
    expect(outline[0]).toEqual(outline[CIRCLE_VERTICES]);
  });
});
