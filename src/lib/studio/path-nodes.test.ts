import { describe, expect, it } from "vitest";

import {
  deleteNode,
  fitToUnit,
  flattenSegment,
  insertNode,
  isSmooth,
  moveHandle,
  moveNode,
  nearestOnPath,
  pathBounds,
  pathToSubpaths,
  pointAt,
  subpathsToPath,
  toggleSmooth,
  type Subpath,
} from "./path-nodes";
import { isValidPath } from "./vector-path";

function close(a: number, b: number, digits = 6) {
  expect(a).toBeCloseTo(b, digits);
}

describe("pathToSubpaths", () => {
  it("reads lines, horizontals, verticals and closing, absolute or relative", () => {
    const square: Subpath[] = [{ closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] }];
    expect(pathToSubpaths("M0 0 L1 0 L1 1 L0 1 Z")).toEqual(square);
    expect(pathToSubpaths("m0 0 l1 0 l0 1 l-1 0 z")).toEqual(square);
    expect(pathToSubpaths("M0 0 H1 V1 H0 Z")).toEqual(square);
    expect(pathToSubpaths("M0 0 L1 0 L1 1 L0 1 L0 0 Z")).toEqual(square);
    expect(pathToSubpaths("M0 0 1 0 1 1")).toEqual([{ closed: false, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }]);
  });

  it("keeps cubic handles on the nodes and reflects smooth curves", () => {
    expect(pathToSubpaths("M0 0 C0.25 0 0.75 1 1 1")).toEqual([{ closed: false, nodes: [{ x: 0, y: 0, out: { x: 0.25, y: 0 } }, { x: 1, y: 1, in: { x: 0.75, y: 1 } }] }]);
    const [wave] = pathToSubpaths("M0 0 C0 0.5 0.5 0.5 0.5 0 S1 -0.5 1 0");
    expect(wave.nodes[1]).toEqual({ x: 0.5, y: 0, in: { x: 0.5, y: 0.5 }, out: { x: 0.5, y: -0.5 } });
  });

  it("turns quadratics into the same curve as cubics", () => {
    const [arc] = pathToSubpaths("M0 0 Q0.5 1 1 0");
    close(arc.nodes[0].out!.x, 1 / 3);
    close(arc.nodes[0].out!.y, 2 / 3);
    close(arc.nodes[1].in!.x, 2 / 3);
    close(arc.nodes[1].in!.y, 2 / 3);
    const [smooth] = pathToSubpaths("M0 0 Q0.25 1 0.5 0 T1 0");
    close(smooth.nodes[1].out!.y, -2 / 3);
  });

  it("turns arcs into cubics that pass through the arc", () => {
    const top = pathToSubpaths("M0 0.5 A0.5 0.5 0 0 1 1 0.5");
    const bounds = pathBounds(top);
    close(bounds.left, 0, 3);
    close(bounds.right, 1, 3);
    close(bounds.top, 0, 3);
    close(bounds.bottom, 0.5, 3);
    expect(pathToSubpaths("M0 0 a1 1 0 00 1 1")[0].nodes.at(-1)).toMatchObject({ x: 1, y: 1 });
  });

  it("reads several subpaths", () => {
    const ring = pathToSubpaths("M0 0 L1 0 L1 1 L0 1 Z M0.3 0.3 L0.7 0.3 L0.7 0.7 Z");
    expect(ring.map((s) => [s.closed, s.nodes.length])).toEqual([
      [true, 4],
      [true, 3],
    ]);
  });
});

describe("subpathsToPath", () => {
  it("writes strict path data that reads back the same", () => {
    for (const data of ["M0 0 L1 0 L1 1 Z", "M0 0 C0.25 0 0.75 1 1 1", "M0 0.5 A0.5 0.5 0 0 1 1 0.5 L1 1 L0 1 Z", "M0 0 Q0.5 1 1 0 M0.2 0.2 L0.8 0.8"]) {
      const subpaths = pathToSubpaths(data);
      const written = subpathsToPath(subpaths);
      expect(isValidPath(written), written).toBe(true);
      const again = pathToSubpaths(written);
      expect(again.length).toBe(subpaths.length);
      again.forEach((s, i) => s.nodes.forEach((n, j) => {
        close(n.x, subpaths[i].nodes[j].x, 4);
        close(n.y, subpaths[i].nodes[j].y, 4);
      }));
    }
  });

  it("closes a curved last segment with a curve before Z", () => {
    const written = subpathsToPath([{ closed: true, nodes: [{ x: 0, y: 0, in: { x: -0.5, y: 0.5 } }, { x: 1, y: 0 }] }]);
    expect(written).toBe("M0 0 L1 0 C1 0 -0.5 0.5 0 0 Z");
  });
});

describe("bounds and fitting", () => {
  it("finds the exact extremes of a curve, not its handles", () => {
    expect(pathBounds(pathToSubpaths("M0 0 C0 1 1 1 1 0"))).toEqual({ left: 0, top: 0, right: 1, bottom: 0.75 });
  });

  it("normalizes a path to its own bounds", () => {
    const { subpaths, bounds } = fitToUnit(pathToSubpaths("M2 3 L4 3 L4 7 Z"));
    expect(bounds).toEqual({ left: 2, top: 3, right: 4, bottom: 7 });
    expect(subpaths[0].nodes).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
  });

  it("centers a flat line instead of dividing by zero", () => {
    const { subpaths, bounds } = fitToUnit(pathToSubpaths("M0 5 L10 5"));
    expect(bounds.bottom - bounds.top).toBe(0);
    expect(subpaths[0].nodes).toEqual([{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }]);
  });
});

describe("editing points", () => {
  const curve = (): Subpath[] => pathToSubpaths("M0 0 C0 0.5 0.5 0.5 0.5 0 S1 -0.5 1 0");

  it("moves a node together with its handles", () => {
    const moved = moveNode(curve(), { path: 0, node: 1 }, { x: 0.1, y: 0.2 });
    expect(moved[0].nodes[1]).toEqual({ x: 0.6, y: 0.2, in: { x: 0.6, y: 0.7 }, out: { x: 0.6, y: -0.3 } });
  });

  it("keeps a smooth node smooth when one handle moves, unless the mirror is broken", () => {
    const mirrored = moveHandle(curve(), { path: 0, node: 1 }, "out", { x: 0.9, y: 0 }, true);
    expect(isSmooth(mirrored[0].nodes[1])).toBe(true);
    close(mirrored[0].nodes[1].in!.x, 0);
    close(mirrored[0].nodes[1].in!.y, 0);
    const broken = moveHandle(curve(), { path: 0, node: 1 }, "out", { x: 0.9, y: 0 }, false);
    expect(broken[0].nodes[1].in).toEqual({ x: 0.5, y: 0.5 });
  });

  it("turns a corner into a smooth node and back", () => {
    const corner = pathToSubpaths("M0 1 L0.5 0 L1 1");
    const smooth = toggleSmooth(corner, { path: 0, node: 1 });
    expect(isSmooth(smooth[0].nodes[1])).toBe(true);
    expect(toggleSmooth(smooth, { path: 0, node: 1 })[0].nodes[1]).toEqual({ x: 0.5, y: 0 });
  });

  it("deletes a node but keeps at least two in the shape", () => {
    const triangle = pathToSubpaths("M0 1 L0.5 0 L1 1 Z");
    expect(deleteNode(triangle, { path: 0, node: 1 })?.[0].nodes).toEqual([{ x: 0, y: 1 }, { x: 1, y: 1 }]);
    expect(deleteNode(pathToSubpaths("M0 0 L1 1"), { path: 0, node: 0 })).toBeNull();
  });

  it("adds a node on a segment without changing the shape", () => {
    const original = curve();
    const split = insertNode(original, { path: 0, segment: 0 }, 0.5);
    expect(split[0].nodes).toHaveLength(4);
    const before = pointAt(original[0], 0, 0.25);
    const after = pointAt(split[0], 0, 0.5);
    close(after.x, before.x);
    close(after.y, before.y);
  });

  it("finds the point of the path nearest to the pointer", () => {
    const line = pathToSubpaths("M0 0 L1 0 L1 1");
    const hit = nearestOnPath(line, { x: 0.4, y: 0.05 });
    expect(hit).toMatchObject({ path: 0, segment: 0 });
    close(hit!.t, 0.4, 2);
    close(hit!.distance, 0.05, 2);
  });
});

describe("flattenSegment", () => {
  it("samples a segment densely enough for the step and ends exactly on its end node", () => {
    const [curve] = pathToSubpaths("M0 0 C0 100 100 100 100 0");
    const points = flattenSegment(curve, 0, 10);
    expect(points.length).toBeGreaterThan(15);
    expect(points[points.length - 1]).toEqual({ x: 100, y: 0 });
    const [line] = pathToSubpaths("M0 0 L5 0");
    expect(flattenSegment(line, 0, 10)).toEqual([{ x: 5, y: 0 }]);
  });
});
