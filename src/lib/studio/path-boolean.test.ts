import { describe, expect, it } from "vitest";

import { booleanSubpaths, reverseSubpaths } from "./path-boolean";
import { pathBounds, pathToSubpaths, type Subpath } from "./path-nodes";

function square(left: number, top: number, side: number): Subpath[] {
  return pathToSubpaths(`M${left} ${top} L${left + side} ${top} L${left + side} ${top + side} L${left} ${top + side} Z`);
}

function area(subpaths: readonly Subpath[]): number {
  return subpaths.reduce((sum, { nodes }) => {
    let twice = 0;
    nodes.forEach((a, i) => {
      const b = nodes[(i + 1) % nodes.length];
      twice += a.x * b.y - b.x * a.y;
    });
    return sum + Math.abs(twice) / 2;
  }, 0);
}

const a = { subpaths: square(0, 0, 100) };
const b = { subpaths: square(50, 50, 100) };

describe("booleanSubpaths", () => {
  it("unites overlapping shapes into one closed outline", () => {
    const united = booleanSubpaths([a, b], "union")!;
    expect(united).toHaveLength(1);
    expect(united[0].closed).toBe(true);
    expect(united[0].nodes).toHaveLength(8);
    expect(pathBounds(united)).toMatchObject({ left: 0, top: 0, right: 150, bottom: 150 });
    expect(area(united)).toBeCloseTo(17500, 6);
  });

  it("subtracts every shape above from the bottom one", () => {
    const cut = booleanSubpaths([a, b], "subtract")!;
    expect(area(cut)).toBeCloseTo(7500, 6);
    expect(pathBounds(cut)).toMatchObject({ left: 0, top: 0, right: 100, bottom: 100 });
  });

  it("keeps only the overlap on intersect and the rest on exclude", () => {
    const overlap = booleanSubpaths([a, b], "intersect")!;
    expect(pathBounds(overlap)).toMatchObject({ left: 50, top: 50, right: 100, bottom: 100 });
    expect(area(overlap)).toBeCloseTo(2500, 6);
    expect(area(booleanSubpaths([a, b], "exclude")!)).toBeCloseTo(15000, 6);
  });

  it("returns nothing when an intersection does not overlap", () => {
    expect(booleanSubpaths([a, { subpaths: square(500, 500, 10) }], "intersect")).toEqual([]);
  });

  it("keeps the holes of an even-odd input and the curves of a circle", () => {
    const ring = { subpaths: [...square(0, 0, 100), ...square(30, 30, 40)], fillRule: "evenodd" as const };
    expect(booleanSubpaths([ring, { subpaths: square(300, 0, 50) }], "union")).toHaveLength(3);
    const circle = { subpaths: pathToSubpaths("M100 50 C100 77.6 77.6 100 50 100 C22.4 100 0 77.6 0 50 C0 22.4 22.4 0 50 0 C77.6 0 100 22.4 100 50 Z") };
    const curved = booleanSubpaths([circle, { subpaths: square(50, 50, 100) }], "union")!;
    expect(curved).toHaveLength(1);
    expect(curved[0].nodes.some((node) => node.out || node.in)).toBe(true);
  });

  it("fills an open input as if it were closed", () => {
    const open = { subpaths: pathToSubpaths("M0 0 L100 0 L100 100") };
    expect(area(booleanSubpaths([open, { subpaths: square(500, 500, 10) }], "union")!)).toBeCloseTo(5000 + 100, 6);
  });
});

describe("reverseSubpaths", () => {
  it("walks every subpath the other way and swaps its handles", () => {
    const [reversed] = reverseSubpaths(pathToSubpaths("M0 0 C10 0 20 10 20 20 L0 20"));
    expect(reversed.nodes.map(({ x, y }) => [x, y])).toEqual([[0, 20], [20, 20], [0, 0]]);
    expect(reversed.nodes[1]).toMatchObject({ out: { x: 20, y: 10 } });
    expect(reversed.nodes[2]).toMatchObject({ in: { x: 10, y: 0 } });
  });
});
