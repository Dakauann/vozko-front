import { describe, expect, it } from "vitest";

import { revealCoverage, revealValue, lumaOf, type RevealField } from "./reveal-field";

const square = (u: number, v: number) => ({ u, v, width: 100, height: 100 });
const gradient = (map: "linear" | "radial" | "diamond" | "clouds", extra: Partial<Extract<RevealField, { pattern: "gradient" }>> = {}): RevealField => ({ pattern: "gradient", map, angle: 0, originX: 0.5, originY: 0.5, reverse: false, ...extra });

describe("reveal fields", () => {
  it("ramps a linear map along its angle across the whole box", () => {
    expect(revealValue(gradient("linear"), square(0, 0.5))).toBeCloseTo(0);
    expect(revealValue(gradient("linear"), square(0.5, 0.2))).toBeCloseTo(0.5);
    expect(revealValue(gradient("linear"), square(1, 0.9))).toBeCloseTo(1);
    expect(revealValue(gradient("linear", { angle: 90 }), square(0.3, 0.25))).toBeCloseTo(0.25);
    expect(revealValue(gradient("linear", { reverse: true }), square(0.25, 0.5))).toBeCloseTo(0.75);
  });

  it("measures radial and diamond maps from the origin to the farthest corner", () => {
    expect(revealValue(gradient("radial"), square(0.5, 0.5))).toBeCloseTo(0);
    expect(revealValue(gradient("radial"), square(1, 1))).toBeCloseTo(1);
    expect(revealValue(gradient("radial", { originX: 0, originY: 0 }), square(1, 1))).toBeCloseTo(1);
    expect(revealValue(gradient("diamond"), square(1, 0.5))).toBeCloseTo(0.5);
    expect(revealValue(gradient("diamond"), square(0, 0))).toBeCloseTo(1);
  });

  it("draws clouds that stay inside the range, repeat for the same point and change across the box", () => {
    const values = Array.from({ length: 40 }, (_, i) => revealValue(gradient("clouds"), square((i % 8) / 8 + 0.03, Math.floor(i / 8) / 5 + 0.05)));
    expect(values.every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(new Set(values.map((value) => value.toFixed(3))).size).toBeGreaterThan(20);
    expect(revealValue(gradient("clouds"), square(0.31, 0.62))).toBe(revealValue(gradient("clouds"), square(0.31, 0.62)));
  });

  it("repeats a ramp inside every blind", () => {
    const blinds: RevealField = { pattern: "blinds", angle: 0, size: 0.25 };
    expect(revealValue(blinds, square(0.1, 0.5))).toBeCloseTo(0.4);
    expect(revealValue(blinds, square(0.35, 0.9))).toBeCloseTo(0.4);
    expect(revealValue(blinds, square(0.3, 0.1))).toBeCloseTo(0.2);
  });

  it("gives every block one value of its own", () => {
    const blocks: RevealField = { pattern: "blocks", size: 0.1 };
    expect(revealValue(blocks, square(0.01, 0.01))).toBe(revealValue(blocks, square(0.09, 0.09)));
    const values = new Set(Array.from({ length: 10 }, (_, i) => revealValue(blocks, square(i / 10 + 0.05, 0.05))));
    expect(values.size).toBeGreaterThan(5);
    for (const value of values) expect(value >= 0 && value < 1).toBe(true);
  });

  it("opens a fan both ways from its start angle", () => {
    const fan: RevealField = { pattern: "fan", angle: 0, originX: 0.5, originY: 0.5 };
    expect(revealValue(fan, square(0.5, 0.1))).toBeCloseTo(0);
    expect(revealValue(fan, square(0.9, 0.5))).toBeCloseTo(0.5);
    expect(revealValue(fan, square(0.1, 0.5))).toBeCloseTo(0.5);
    expect(revealValue(fan, square(0.5, 0.9))).toBeCloseTo(1);
  });

  it("reads an image map through its luma and hides everything when no picture is known", () => {
    const image: RevealField = { pattern: "image", assetId: "m-1", reverse: false };
    expect(revealValue(image, square(0.2, 0.2), (u) => u)).toBeCloseTo(0.2);
    expect(revealValue({ ...image, reverse: true }, square(0.2, 0.2), (u) => u)).toBeCloseTo(0.8);
    expect(revealValue(image, square(0.2, 0.2))).toBe(1);
    expect(lumaOf(255, 255, 255)).toBeCloseTo(1);
    expect(lumaOf(255, 0, 0)).toBeCloseTo(0.2126);
  });

  it("covers nothing at the start, everything at the end and ramps over the softness", () => {
    for (const value of [0, 0.3, 1]) {
      expect(revealCoverage(value, 0, 0)).toBe(0);
      expect(revealCoverage(value, 1, 0)).toBe(1);
      expect(revealCoverage(value, 0, 0.5)).toBe(0);
      expect(revealCoverage(value, 1, 0.5)).toBe(1);
    }
    expect(revealCoverage(0.4, 0.5, 0)).toBe(1);
    expect(revealCoverage(0.6, 0.5, 0)).toBe(0);
    expect(revealCoverage(0.5, 0.5, 0.5)).toBeCloseTo(0.5);
  });
});
