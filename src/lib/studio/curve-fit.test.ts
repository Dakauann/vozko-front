import { describe, expect, it } from "vitest";

import { fitCurve, type Cubic } from "./curve-fit";
import type { Point } from "./viewport";

function at([p0, c1, c2, p3]: Cubic, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
  };
}

function arc(count: number, radius: number, from: number, to: number): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = from + ((to - from) * i) / (count - 1);
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
}

function worstRadiusError(cubics: Cubic[], radius: number): number {
  let worst = 0;
  for (const cubic of cubics) for (let t = 0; t <= 1; t += 0.02) {
    const p = at(cubic, t);
    worst = Math.max(worst, Math.abs(Math.hypot(p.x, p.y) - radius));
  }
  return worst;
}

describe("fitCurve", () => {
  it("recovers a single cubic from points sampled on it, keeping the ends exact", () => {
    const source: Cubic = [{ x: 0, y: 0 }, { x: 30, y: 80 }, { x: 70, y: 80 }, { x: 100, y: 0 }];
    const points = Array.from({ length: 40 }, (_, i) => at(source, i / 39));
    const cubics = fitCurve(points, 0.5);
    expect(cubics).toHaveLength(1);
    expect(cubics[0][0]).toEqual(points[0]);
    expect(cubics[0][3]).toEqual(points[39]);
  });

  it("fits a quarter circle with few curves that stay within the tolerance", () => {
    const cubics = fitCurve(arc(60, 100, 0, Math.PI / 2), 0.5);
    expect(cubics.length).toBeLessThanOrEqual(2);
    expect(worstRadiusError(cubics, 100)).toBeLessThan(0.6);
  });

  it("splits where one curve cannot follow the points", () => {
    const wave = Array.from({ length: 80 }, (_, i) => ({ x: i * 5, y: 50 * Math.sin((i / 79) * Math.PI * 4) }));
    expect(fitCurve(wave, 1).length).toBeGreaterThan(2);
  });

  it("leaves and arrives along the given end tangents", () => {
    const dome = arc(40, 50, Math.PI, 0).map((p) => ({ x: p.x + 50, y: -p.y }));
    const cubics = fitCurve(dome, 0.5, { x: 0, y: -1 }, { x: 0, y: -1 });
    expect(cubics[0][1].x).toBeCloseTo(0, 9);
    expect(cubics[cubics.length - 1][2].x).toBeCloseTo(100, 9);
  });
});
