import { describe, expect, it } from "vitest";

import { BRAZIL_BOUNDS, bboxCentre } from "./geometry";
import { COUNTRY_ZOOM, pinStart } from "./placement";

describe("bboxCentre", () => {
  it("finds the middle of a box", () => {
    expect(bboxCentre({ south: -23.7, west: -46.8, north: -23.5, east: -46.6 })).toEqual({ lat: -23.6, lng: -46.7 });
  });
});

describe("pinStart", () => {
  it("starts a pin at city zoom in the middle of where the workspace leads are", () => {
    expect(pinStart({ bbox: { south: -23.7, west: -46.8, north: -23.5, east: -46.6 }, basis: "located", view: "positions" })).toEqual({
      position: { lat: -23.6, lng: -46.7 },
      zoom: 11,
    });
  });

  it("shows the whole country when the workspace has no located leads", () => {
    expect(pinStart({ bbox: BRAZIL_BOUNDS, basis: "country", view: "districts" }).zoom).toBe(COUNTRY_ZOOM);
  });

  it("falls back to Brazil when nothing is known", () => {
    const start = pinStart(null);
    expect(start.position.lat).toBeCloseTo(-14.25);
    expect(start.position.lng).toBeCloseTo(-51.45);
    expect(start.zoom).toBe(COUNTRY_ZOOM);
  });

  it("starts at the CEP reference point, framed by its precision, before the workspace middle", () => {
    const reference = { position: { lat: -23.5614, lng: -46.6559 }, precision: "street" as const, attribution: "IBGE, CNEFE 2022" };
    expect(pinStart({ bbox: BRAZIL_BOUNDS, basis: "country", view: "districts" }, reference)).toEqual({
      position: { lat: -23.5614, lng: -46.6559 },
      zoom: 15,
    });
    expect(pinStart(null, reference).zoom).toBe(15);
  });

  it("keeps the workspace start when there is no reference point", () => {
    expect(pinStart(null, null).zoom).toBe(COUNTRY_ZOOM);
  });
});
