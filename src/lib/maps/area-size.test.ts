import { describe, expect, it } from "vitest";

import { areaSize, distanceValue } from "./area-size";

describe("areaSize", () => {
  it("measures a box by the width and height of its bounds", () => {
    const size = areaSize({
      kind: "rectangle",
      ring: [
        { lat: -24, lng: -48 },
        { lat: -24, lng: -45 },
        { lat: -22, lng: -45 },
        { lat: -22, lng: -48 },
      ],
    });
    expect(size?.kind).toBe("box");
    if (size?.kind !== "box") return;
    expect(Math.abs(size.heightM - 222390)).toBeLessThan(100);
    expect(Math.abs(size.widthM - 333585 * Math.cos((23 * Math.PI) / 180))).toBeLessThan(500);
  });

  it("measures a polygon by its bounds too", () => {
    const size = areaSize({
      kind: "polygon",
      ring: [
        { lat: -23.6, lng: -46.7 },
        { lat: -23.6, lng: -46.6 },
        { lat: -23.5, lng: -46.65 },
      ],
    });
    expect(size?.kind).toBe("box");
    if (size?.kind !== "box") return;
    expect(Math.abs(size.heightM - 11119)).toBeLessThan(5);
    expect(size.widthM).toBeGreaterThan(10000);
  });

  it("measures a circle by its radius", () => {
    expect(areaSize({ kind: "circle", center: { lat: -23.55, lng: -46.63 }, radiusM: 45000 })).toEqual({ kind: "radius", radiusM: 45000 });
  });

  it.each([
    ["no shape", null],
    ["a ring with no extent", { kind: "polygon" as const, ring: [{ lat: -23.5, lng: -46.6 }, { lat: -23.5, lng: -46.6 }, { lat: -23.5, lng: -46.6 }] }],
    ["a circle with no radius", { kind: "circle" as const, center: { lat: -23.55, lng: -46.63 }, radiusM: 0 }],
  ])("has no size for %s", (_name, shape) => {
    expect(areaSize(shape)).toBeNull();
  });
});

describe("distanceValue", () => {
  it.each([
    [0.4, { unit: "meters", value: 0 }],
    [420.6, { unit: "meters", value: 421 }],
    [999.4, { unit: "meters", value: 999 }],
    [999.6, { unit: "kilometers", value: 1 }],
    [1500, { unit: "kilometers", value: 1.5 }],
    [9949, { unit: "kilometers", value: 9.9 }],
    [9960, { unit: "kilometers", value: 10 }],
    [45200, { unit: "kilometers", value: 45 }],
    [320499, { unit: "kilometers", value: 320 }],
  ])("reads %s m as %o", (meters, expected) => {
    expect(distanceValue(meters)).toEqual(expected);
  });
});
