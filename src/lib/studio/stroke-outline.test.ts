import { describe, expect, it } from "vitest";

import { pathBounds, pathToSubpaths, type Subpath } from "./path-nodes";
import { outlineStroke, type StrokeOutlineSpec } from "./stroke-outline";

const butt: StrokeOutlineSpec = { width: 10, cap: "butt", join: "miter", miterLimit: 10 };

function expectBounds(subpaths: readonly Subpath[], expected: Partial<Record<"left" | "top" | "right" | "bottom", number>>) {
  const bounds = pathBounds(subpaths);
  for (const [key, value] of Object.entries(expected)) expect(bounds[key as keyof typeof bounds], key).toBeCloseTo(value, 6);
}

function area(subpaths: readonly Subpath[], steps = 64): number {
  let total = 0;
  for (const { nodes } of subpaths) {
    const points: { x: number; y: number }[] = [];
    nodes.forEach((from, i) => {
      const to = nodes[(i + 1) % nodes.length];
      const c1 = from.out ?? from;
      const c2 = to.in ?? to;
      const count = from.out || to.in ? steps : 1;
      for (let k = 0; k < count; k++) {
        const t = k / count;
        const u = 1 - t;
        points.push({ x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x, y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y });
      }
    });
    let twice = 0;
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length];
      twice += a.x * b.y - b.x * a.y;
    });
    total += twice / 2;
  }
  return Math.abs(total);
}

const line = pathToSubpaths("M0 0 L100 0");

describe("outlineStroke", () => {
  it("turns a straight stroke with butt caps into its rectangle", () => {
    const outline = outlineStroke(line, butt)!;
    expect(outline).toHaveLength(1);
    expectBounds(outline, { left: 0, top: -5, right: 100, bottom: 5 });
    expect(area(outline)).toBeCloseTo(1000, 3);
  });

  it("extends square caps and rounds round caps by half the width", () => {
    expectBounds(outlineStroke(line, { ...butt, cap: "square" })!, { left: -5, right: 105 });
    const round = outlineStroke(line, { ...butt, cap: "round" })!;
    const bounds = pathBounds(round);
    expect(Math.abs(bounds.left + 5)).toBeLessThan(0.25);
    expect(Math.abs(bounds.right - 105)).toBeLessThan(0.25);
    expect(area(round) / (1000 + Math.PI * 25)).toBeCloseTo(1, 2);
    expect(round[0].nodes.some((node) => node.in || node.out)).toBe(true);
  });

  it("outlines a closed square as an outer and an inner ring", () => {
    const outline = outlineStroke(pathToSubpaths("M0 0 L100 0 L100 100 L0 100 Z"), butt)!;
    expect(outline).toHaveLength(2);
    expectBounds(outline, { left: -5, top: -5, right: 105, bottom: 105 });
    expect(Math.abs(area([outline[0]]) - area([outline[1]]))).toBeCloseTo(110 * 110 - 90 * 90, 3);
  });

  it("bevels a corner past the miter limit and keeps the inside of the corner clean", () => {
    const corner = pathToSubpaths("M0 0 L100 0 L100 100");
    const mitered = area(outlineStroke(corner, butt)!);
    const beveled = area(outlineStroke(corner, { ...butt, miterLimit: 1 })!);
    expect(mitered).toBeCloseTo(2000, 3);
    expect(mitered - beveled).toBeCloseTo(12.5, 3);
  });

  it("cuts dashes into separate pieces and draws zero length dashes as dots", () => {
    expect(outlineStroke(line, { ...butt, dash: [20, 10] })).toHaveLength(4);
    const dots = outlineStroke(line, { ...butt, cap: "round", dash: [0, 20] })!;
    expect(dots).toHaveLength(6);
    expect(area(dots) / (6 * Math.PI * 25)).toBeCloseTo(1, 2);
  });

  it("follows curves smoothly", () => {
    const outline = outlineStroke(pathToSubpaths("M0 0 C30 60 70 60 100 0"), butt)!;
    expect(outline).toHaveLength(1);
    expect(outline[0].nodes.some((node) => node.in || node.out)).toBe(true);
    expect(outline[0].nodes.length).toBeLessThan(20);
  });
});
