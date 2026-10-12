import { describe, expect, it } from "vitest";

import type { MorphKeyframe } from "./morph-keys";
import { morphAt, morphPath, pathVertices } from "./path-morph";
import { flattenSegment, pathBounds, pathToSubpaths, segmentCount } from "./path-nodes";
import type { Point } from "./viewport";

const SQUARE = "M0.2 0.2 L0.8 0.2 L0.8 0.8 L0.2 0.8 Z";
const SQUARE_BACKWARDS = "M0.2 0.2 L0.2 0.8 L0.8 0.8 L0.8 0.2 Z";
const STAR = "M0.5 0 L0.62 0.35 L1 0.35 L0.69 0.57 L0.81 0.91 L0.5 0.7 L0.19 0.91 L0.31 0.57 L0 0.35 L0.38 0.35 Z";
const TRIANGLE = "M0.5 0.1 L0.9 0.9 L0.1 0.9 Z";

function outline(path: string): Point[] {
  return pathToSubpaths(path).flatMap((subpath) => {
    const points: Point[] = [];
    for (let s = 0; s < segmentCount(subpath); s++) points.push(...flattenSegment(subpath, s, 0.01));
    return points;
  });
}

function distanceToOutline(point: Point, path: string): number {
  const subpaths = pathToSubpaths(path);
  let best = Infinity;
  for (const subpath of subpaths) {
    const points = [subpath.nodes[0], ...Array.from({ length: segmentCount(subpath) }, (_, s) => flattenSegment(subpath, s, 0.002)).flat()];
    for (let i = 0; i < points.length - 1; i++) {
      const [a, b] = [points[i], points[i + 1]];
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * ex + (point.y - a.y) * ey) / (ex * ex + ey * ey || 1)));
      best = Math.min(best, Math.hypot(point.x - a.x - ex * t, point.y - a.y - ey * t));
    }
  }
  return best;
}

function area(path: string): number {
  const points = outline(path);
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += a.x * b.y - b.x * a.y;
  }
  return Math.abs(total / 2);
}

describe("path morph", () => {
  it("draws the start shape at weight 0 and the end shape at weight 1 even when the point counts differ", () => {
    const start = morphPath(SQUARE, STAR, 0);
    const end = morphPath(SQUARE, STAR, 1);
    for (const point of outline(start)) expect(distanceToOutline(point, SQUARE)).toBeLessThan(1e-4);
    for (const point of outline(end)) expect(distanceToOutline(point, STAR)).toBeLessThan(1e-4);
    expect(pathVertices(start)).toHaveLength(10);
    expect(pathVertices(end)).toHaveLength(10);
  });

  it("puts every vertex halfway between its matched vertices at the middle", () => {
    const start = pathVertices(morphPath(SQUARE, STAR, 0));
    const end = pathVertices(morphPath(SQUARE, STAR, 1));
    const middle = pathVertices(morphPath(SQUARE, STAR, 0.5));
    middle.forEach((point, i) => {
      expect(point.x).toBeCloseTo((start[i].x + end[i].x) / 2, 4);
      expect(point.y).toBeCloseTo((start[i].y + end[i].y) / 2, 4);
    });
  });

  it("matches the drawing direction, so a square drawn backwards does not fold through itself", () => {
    const middle = morphPath(SQUARE, SQUARE_BACKWARDS, 0.5);
    expect(area(middle)).toBeCloseTo(area(SQUARE), 3);
  });

  it("picks the start vertex that keeps the shapes closest when no first vertex is set", () => {
    const shifted = "M0.8 0.2 L0.8 0.8 L0.2 0.8 L0.2 0.2 Z";
    const middle = morphPath(SQUARE, shifted, 0.5);
    for (const point of outline(middle)) expect(distanceToOutline(point, SQUARE)).toBeLessThan(1e-4);
  });

  it("pairs the chosen first vertices, so the shape turns as it morphs", () => {
    const turned = morphPath(SQUARE, SQUARE, 0.5, { from: { x: 0.2, y: 0.2 }, to: { x: 0.8, y: 0.2 } });
    const vertices = pathVertices(turned);
    expect(vertices[0].x).toBeCloseTo(0.5, 4);
    expect(vertices[0].y).toBeCloseTo(0.2, 4);
    expect(area(turned)).toBeLessThan(area(SQUARE));
  });

  it("shrinks a subpath without a partner to its center", () => {
    const two = `${SQUARE} M0.4 0.4 L0.6 0.4 L0.6 0.6 L0.4 0.6 Z`;
    const end = morphPath(two, TRIANGLE, 1);
    const subpaths = pathToSubpaths(end);
    expect(subpaths).toHaveLength(2);
    const bounds = pathBounds([subpaths[1]]);
    expect(bounds.right - bounds.left).toBeCloseTo(0, 6);
    expect((bounds.left + bounds.right) / 2).toBeCloseTo(0.5, 6);
  });

  it("morphs an open line into a closed shape through matched ends", () => {
    const line = "M0.1 0.5 L0.9 0.5";
    const start = morphPath(line, TRIANGLE, 0);
    for (const point of outline(start)) expect(distanceToOutline(point, line)).toBeLessThan(1e-4);
    const end = morphPath(line, TRIANGLE, 1);
    for (const point of outline(end)) expect(distanceToOutline(point, TRIANGLE)).toBeLessThan(1e-4);
  });

  it("keeps curves exact while resampling", () => {
    const ellipse = "M0 0.5 A0.5 0.5 0 0 1 1 0.5 A0.5 0.5 0 0 1 0 0.5 Z";
    const start = morphPath(ellipse, STAR, 0);
    for (const point of outline(start)) expect(distanceToOutline(point, ellipse)).toBeLessThan(1e-3);
  });
});

describe("path keyframes", () => {
  const keys: MorphKeyframe[] = [
    { atMs: 0, path: SQUARE, easing: "linear" },
    { atMs: 1000, path: STAR, easing: "easeIn" },
    { atMs: 2000, path: TRIANGLE, easing: "hold" },
  ];

  it("shows each key path exactly at and beyond its key", () => {
    expect(morphAt(keys, -10)).toBe(SQUARE);
    expect(morphAt(keys, 0)).toBe(SQUARE);
    expect(morphAt(keys, 1000)).toBe(STAR);
    expect(morphAt(keys, 2500)).toBe(TRIANGLE);
  });

  it("eases the morph with the outgoing key curve", () => {
    expect(morphAt(keys, 500)).toBe(morphPath(SQUARE, STAR, 0.5));
    expect(morphAt(keys, 1500)).toBe(morphPath(STAR, TRIANGLE, 0.125));
  });

  it("holds the shape until the next key with a hold curve", () => {
    expect(morphAt([{ ...keys[0], easing: "hold" }, keys[1]], 900)).toBe(SQUARE);
  });

  it("carries the first vertex of both keys into the segment", () => {
    const pinned: MorphKeyframe[] = [
      { atMs: 0, path: SQUARE, easing: "linear", firstVertex: { x: 0.2, y: 0.2 } },
      { atMs: 1000, path: SQUARE, easing: "linear", firstVertex: { x: 0.8, y: 0.8 } },
    ];
    expect(morphAt(pinned, 500)).toBe(morphPath(SQUARE, SQUARE, 0.5, { from: { x: 0.2, y: 0.2 }, to: { x: 0.8, y: 0.8 } }));
  });
});
