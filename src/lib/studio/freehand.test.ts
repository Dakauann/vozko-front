import { describe, expect, it } from "vitest";

import { freehandSubpath, simplifyPoints } from "./freehand";
import { isSmooth } from "./path-nodes";

describe("simplifyPoints", () => {
  it("drops points that lie on the line between their neighbors", () => {
    const points = Array.from({ length: 21 }, (_, i) => ({ x: i, y: 0 }));
    expect(simplifyPoints(points, 0.5)).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }]);
  });

  it("keeps the corners of a shape", () => {
    const corner = [...Array.from({ length: 11 }, (_, i) => ({ x: i, y: 0 })), ...Array.from({ length: 10 }, (_, i) => ({ x: 10, y: i + 1 }))];
    expect(simplifyPoints(corner, 0.5)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
  });
});

describe("freehandSubpath", () => {
  it("turns a stroke into a smooth open curve that passes through the kept points", () => {
    const arc = Array.from({ length: 40 }, (_, i) => ({ x: i * 5, y: Math.sin(i / 6) * 40 }));
    const subpath = freehandSubpath(arc, { tolerance: 1, closeDistance: 4 })!;
    expect(subpath.closed).toBe(false);
    expect(subpath.nodes.length).toBeGreaterThan(2);
    expect(subpath.nodes.length).toBeLessThan(arc.length);
    expect(subpath.nodes.slice(1, -1).every(isSmooth)).toBe(true);
    expect(subpath.nodes[0]).toMatchObject(arc[0]);
    expect(subpath.nodes.at(-1)).toMatchObject(arc.at(-1)!);
  });

  it("closes a stroke that ends where it started", () => {
    const loop = Array.from({ length: 33 }, (_, i) => ({ x: 50 + Math.cos((i / 32) * Math.PI * 2) * 40, y: 50 + Math.sin((i / 32) * Math.PI * 2) * 40 }));
    expect(freehandSubpath(loop, { tolerance: 1, closeDistance: 4 })?.closed).toBe(true);
  });

  it("ignores a tap that never moved", () => {
    expect(freehandSubpath([{ x: 1, y: 1 }, { x: 1, y: 1 }], { tolerance: 1, closeDistance: 4 })).toBeNull();
  });
});
