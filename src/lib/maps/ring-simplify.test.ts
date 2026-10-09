import { describe, expect, it } from "vitest";

import { MAX_AREA_VERTICES, ringSelfCrosses, simplifyRing } from "./ring-simplify";
import type { LatLng } from "./types";

function wobblyCircle(vertices: number, center: LatLng = { lat: -23.55, lng: -46.63 }): LatLng[] {
  return Array.from({ length: vertices }, (_, i) => {
    const angle = (2 * Math.PI * i) / vertices;
    const radius = 0.5 + 0.02 * Math.sin(17 * angle);
    return { lat: center.lat + radius * Math.cos(angle), lng: center.lng + radius * Math.sin(angle) };
  });
}

function star(points: number): LatLng[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const angle = (Math.PI * i) / points;
    const radius = i % 2 === 0 ? 1 : 0.15;
    return { lat: -15 + radius * Math.cos(angle), lng: -47 + radius * Math.sin(angle) };
  });
}

function shoelace(ring: LatLng[]): number {
  let sum = 0;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    sum += a.lng * b.lat - b.lng * a.lat;
  });
  return Math.abs(sum / 2);
}

describe("simplifyRing", () => {
  it("matches the backend vertex limit", () => {
    expect(MAX_AREA_VERTICES).toBe(200);
  });

  it("returns a ring at or under the limit as it is", () => {
    const ring = wobblyCircle(MAX_AREA_VERTICES);
    expect(simplifyRing(ring)).toBe(ring);
  });

  it.each([201, 600, 2000])("brings a ring of %s vertices down to the limit", (vertices) => {
    const ring = wobblyCircle(vertices);
    const simplified = simplifyRing(ring);
    expect(simplified).toHaveLength(MAX_AREA_VERTICES);
    expect(Math.abs(shoelace(simplified) - shoelace(ring)) / shoelace(ring)).toBeLessThan(0.01);
  });

  it("keeps only drawn vertices, in the drawn order", () => {
    const ring = wobblyCircle(500);
    const simplified = simplifyRing(ring);
    const positions = simplified.map((vertex) => ring.indexOf(vertex));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("honours a smaller limit", () => {
    expect(simplifyRing(wobblyCircle(50), 12)).toHaveLength(12);
  });

  it("never makes a spiky ring cross itself", () => {
    const ring = star(150);
    expect(ringSelfCrosses(ring)).toBe(false);
    const simplified = simplifyRing(ring, 40);
    expect(simplified).toHaveLength(40);
    expect(ringSelfCrosses(simplified)).toBe(false);
  });
});

describe("ringSelfCrosses", () => {
  const square: LatLng[] = [
    { lat: -23.6, lng: -46.7 },
    { lat: -23.6, lng: -46.6 },
    { lat: -23.5, lng: -46.6 },
    { lat: -23.5, lng: -46.7 },
  ];

  it("is false for a simple ring", () => {
    expect(ringSelfCrosses(square)).toBe(false);
  });

  it("is true for a bowtie", () => {
    expect(ringSelfCrosses([square[0], square[2], square[1], square[3]])).toBe(true);
  });

  it("is true when an edge touches another one", () => {
    expect(ringSelfCrosses([square[0], square[1], { lat: -23.6, lng: -46.65 }, square[3]])).toBe(true);
  });
});
