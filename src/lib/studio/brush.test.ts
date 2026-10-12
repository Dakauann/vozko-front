import { describe, expect, it } from "vitest";

import { BRUSH_SPACING, committedPoints, dabDiameter, MIN_DAB_STEP, smoothSegment, tipAlpha, walkDabs, type Dab } from "./brush";

function dabs(points: number[], stride: 2 | 3, size: number): Dab[] {
  const out: Dab[] = [];
  walkDabs(points, stride, size, null, (dab) => out.push(dab));
  return out;
}

describe("brush tip", () => {
  it("is solid inside the hard core and fades to nothing at the rim", () => {
    expect(tipAlpha(0, 10, 0.5)).toBe(1);
    expect(tipAlpha(5, 10, 0.5)).toBe(1);
    expect(tipAlpha(7.5, 10, 0.5)).toBeCloseTo(0.5, 5);
    expect(tipAlpha(10, 10, 0.5)).toBe(0);
    expect(tipAlpha(11, 10, 0.5)).toBe(0);
  });

  it("anti aliases the rim of a hard tip over one pixel", () => {
    expect(tipAlpha(9, 10, 1)).toBe(1);
    expect(tipAlpha(10, 10, 1)).toBeCloseTo(0.5, 5);
    expect(tipAlpha(10.5, 10, 1)).toBe(0);
  });

  it("scales the diameter with pressure but never below one pixel", () => {
    expect(dabDiameter(40, 1)).toBe(40);
    expect(dabDiameter(40, 0.5)).toBe(20);
    expect(dabDiameter(4, 0)).toBe(1);
  });
});

describe("dab placement", () => {
  it("stamps a single dab for a single point", () => {
    expect(dabs([5, 6], 2, 10)).toEqual([{ x: 5, y: 6, radius: 5 }]);
  });

  it("spaces dabs at a tenth of the diameter", () => {
    const placed = dabs([0, 0, 100, 0], 2, 20);
    expect(placed.length).toBe(51);
    for (let i = 1; i < placed.length; i++) expect(placed[i].x - placed[i - 1].x).toBeCloseTo(BRUSH_SPACING * 20, 6);
  });

  it("carries the leftover distance across segments", () => {
    const together = dabs([0, 0, 3, 0, 7, 0, 10, 0], 2, 10).map((d) => d.x);
    expect(together).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((x) => expect.closeTo(x, 6)));
  });

  it("keeps a minimum step for tiny brushes", () => {
    const placed = dabs([0, 0, 2, 0], 2, 1);
    expect(placed.length).toBe(2 / MIN_DAB_STEP + 1);
  });

  it("follows pressure along a segment", () => {
    const placed = dabs([0, 0, 0, 100, 0, 1], 3, 20);
    expect(placed[0].radius).toBe(0.5);
    expect(placed.at(-1)!.radius).toBeGreaterThan(9.5);
    for (let i = 1; i < placed.length; i++) expect(placed[i].radius).toBeGreaterThanOrEqual(placed[i - 1].radius);
  });

  it("continues from a cursor exactly as a single walk", () => {
    const points = [0, 0, 13, 4, 30, 9, 41, 30, 70, 31];
    const whole = dabs(points, 2, 12);
    const parts: Dab[] = [];
    const cursor = walkDabs(points.slice(0, 6), 2, 12, null, (d) => parts.push(d));
    walkDabs(points, 2, 12, cursor, (d) => parts.push(d));
    expect(parts).toEqual(whole);
  });
});

describe("stroke input", () => {
  it("smooths a segment of the pointer path through Catmull-Rom points", () => {
    const tail = smoothSegment([0, 0, 10, 0, 20, 10, 30, 10], 2, 1, 4);
    expect(tail.slice(0, 2)).toEqual([10, 0]);
    expect(tail.slice(-2)).toEqual([20, 10]);
    expect(tail.length).toBe(2 * 5);
  });

  it("simplifies, snaps to quarter pixels and clamps into reach when committing", () => {
    const raw: number[] = [];
    for (let i = 0; i <= 100; i++) raw.push(i * 1.003, 0.001 * i);
    expect(committedPoints(raw, 2, { width: 100, height: 100 })).toEqual([0, 0, 100.25, 0]);
    expect(committedPoints([1.13, 2.62, -9000, 3], 2, { width: 100, height: 100 })).toEqual([1.25, 2.5, -4096, 3]);
    expect(committedPoints([1, 1, 0.333, 50, 1, 0.666], 3, { width: 100, height: 100 })).toEqual([1, 1, 0.33, 50, 1, 0.67]);
  });
});
