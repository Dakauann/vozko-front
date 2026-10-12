import { describe, expect, it } from "vitest";

import { convexArea, convexIntersection, insideConvex, type Point } from "./convex";

const square = (x: number, y: number, side: number): Point[] => [
  [x, y],
  [x + side, y],
  [x + side, y + side],
  [x, y + side],
];

describe("convex polygons", () => {
  it("measures the area of a polygon whichever way it winds", () => {
    expect(convexArea(square(0, 0, 10))).toBe(100);
    expect(convexArea([...square(0, 0, 10)].reverse())).toBe(100);
  });

  it("intersects two overlapping squares into their shared rectangle", () => {
    expect(convexArea(convexIntersection(square(0, 0, 10), square(5, 5, 10)))).toBeCloseTo(25, 6);
  });

  it("finds nothing shared between polygons that do not touch", () => {
    expect(convexIntersection(square(0, 0, 10), square(20, 20, 5))).toEqual([]);
  });

  it("tells whether a point sits inside a polygon of either winding", () => {
    expect(insideConvex([5, 5], square(0, 0, 10))).toBe(true);
    expect(insideConvex([5, 5], [...square(0, 0, 10)].reverse())).toBe(true);
    expect(insideConvex([15, 5], square(0, 0, 10))).toBe(false);
  });

  it("cuts a diamond out of a square by the real tilted outline, not its upright bounds", () => {
    const diamond: Point[] = [
      [5, 0],
      [10, 5],
      [5, 10],
      [0, 5],
    ];
    expect(convexArea(convexIntersection(square(0, 0, 10), diamond))).toBeCloseTo(50, 6);
    expect(convexArea(convexIntersection(square(5, 0, 10), diamond))).toBeCloseTo(25, 6);
  });
});
