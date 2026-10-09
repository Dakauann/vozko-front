import { describe, expect, it } from "vitest";

import { pathToSubpaths, type Subpath } from "./path-nodes";
import { simplifySubpaths } from "./path-simplify";

function polygon(count: number, radius: number): Subpath {
  return {
    closed: true,
    nodes: Array.from({ length: count }, (_, i) => {
      const angle = (2 * Math.PI * i) / count;
      return { x: 100 + radius * Math.cos(angle), y: 100 + radius * Math.sin(angle) };
    }),
  };
}

function area(subpath: Subpath, steps = 400): number {
  const { nodes } = subpath;
  const points: { x: number; y: number }[] = [];
  nodes.forEach((from, i) => {
    const to = nodes[(i + 1) % nodes.length];
    const c1 = from.out ?? from;
    const c2 = to.in ?? to;
    for (let k = 0; k < steps / nodes.length; k++) {
      const t = k / (steps / nodes.length);
      const u = 1 - t;
      points.push({
        x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
        y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y,
      });
    }
  });
  let twice = 0;
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    twice += a.x * b.y - b.x * a.y;
  });
  return Math.abs(twice) / 2;
}

describe("simplifySubpaths", () => {
  it("turns a many-sided polygon that reads as a circle into a few smooth curves", () => {
    const [circle] = simplifySubpaths([polygon(120, 80)], 0.5);
    expect(circle.closed).toBe(true);
    expect(circle.nodes.length).toBeLessThanOrEqual(8);
    expect(circle.nodes.every((node) => node.in && node.out)).toBe(true);
    expect(area(circle) / (Math.PI * 80 * 80)).toBeCloseTo(1, 2);
  });

  it("keeps sharp corners sharp and straight sides straight", () => {
    const [square] = simplifySubpaths(pathToSubpaths("M0 0 L50 0 L100 0 L100 100 L0 100 Z"), 0.5);
    expect(square.nodes.map(({ x, y }) => [x, y])).toEqual([[0, 0], [100, 0], [100, 100], [0, 100]]);
    expect(square.nodes.every((node) => !node.in && !node.out)).toBe(true);
  });

  it("keeps the ends of an open stroke exactly where they were", () => {
    const wobble: Subpath = { closed: false, nodes: Array.from({ length: 60 }, (_, i) => ({ x: i * 4, y: 30 * Math.sin(i / 10) })) };
    const [simple] = simplifySubpaths([wobble], 0.5);
    expect(simple.nodes.length).toBeLessThan(15);
    expect(simple.nodes[0]).toMatchObject({ x: 0, y: 0 });
    expect(simple.nodes[simple.nodes.length - 1]).toMatchObject({ x: 236, y: 30 * Math.sin(5.9) });
  });

  it("never adds points", () => {
    const tight = pathToSubpaths("M0 0 C10 40 30 40 40 0 C50 -40 70 -40 80 0");
    expect(simplifySubpaths(tight, 0.01)[0].nodes.length).toBeLessThanOrEqual(3);
  });
});
