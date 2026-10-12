import { describe, expect, it } from "vitest";

import { arrowheadSize, endKind, hasOpenEnds, layerArrowheads, pathArrowheads, strokedArrowEnds, takesArrowheads } from "./arrowheads";

function close(actual: number[][], expected: number[][]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((polygon, i) => polygon.forEach((value, j) => expect(value).toBeCloseTo(expected[i][j], 6)));
}

describe("arrowheadSize", () => {
  it("grows with the stroke and never vanishes on hairlines", () => {
    expect(arrowheadSize(4)).toBe(12);
    expect(arrowheadSize(1)).toBe(6);
  });
});

describe("hasOpenEnds", () => {
  it("is true only when some subpath is open", () => {
    expect(hasOpenEnds("M0 0 L1 1")).toBe(true);
    expect(hasOpenEnds("M0 0 L1 0 L1 1 Z")).toBe(false);
    expect(hasOpenEnds("M0 0 L1 0 L1 1 Z M0 1 L1 1")).toBe(true);
    expect(hasOpenEnds("")).toBe(false);
  });
});

describe("pathArrowheads", () => {
  const base = { strokeWidth: 4 };

  it("extends the tip beyond the end of a straight path, along its direction", () => {
    close(pathArrowheads({ ...base, path: "M0 0.5 L1 0.5", arrowEnd: true }, 100, 50), [[100, 31, 112, 25, 100, 19]]);
  });

  it("follows the tangent of a curve at its start", () => {
    close(pathArrowheads({ ...base, path: "M0 0 C0 1 1 1 1 0", arrowStart: true }, 100, 50), [[6, 0, 0, -12, -6, 0]]);
  });

  it("puts heads on both ends of every open subpath", () => {
    expect(pathArrowheads({ ...base, path: "M0 0 L1 0 M0 1 L1 1", arrowStart: true, arrowEnd: true }, 100, 100)).toHaveLength(4);
  });

  it("draws nothing on closed paths, unstroked paths or a path that never moves", () => {
    expect(pathArrowheads({ ...base, path: "M0 0 L1 0 L1 1 Z", arrowEnd: true }, 100, 100)).toEqual([]);
    expect(pathArrowheads({ strokeWidth: 0, path: "M0 0 L1 1", arrowEnd: true }, 100, 100)).toEqual([]);
    expect(pathArrowheads({ ...base, path: "M0.5 0.5 L0.5 0.5", arrowEnd: true }, 100, 100)).toEqual([]);
    expect(pathArrowheads({ ...base, path: "M0 0 L1 1" }, 100, 100)).toEqual([]);
  });
});

describe("takesArrowheads", () => {
  it("accepts lines, arrows and open paths only", () => {
    expect(takesArrowheads({ type: "shape", shape: "line" })).toBe(true);
    expect(takesArrowheads({ type: "shape", shape: "path", path: "M0 0 L1 1" })).toBe(true);
    expect(takesArrowheads({ type: "shape", shape: "path", path: "M0 0 L1 0 L1 1 Z" })).toBe(false);
    expect(takesArrowheads({ type: "shape", shape: "rect" })).toBe(false);
    expect(takesArrowheads({ type: "text" })).toBe(false);
  });
});

describe("layerArrowheads", () => {
  it("places line heads with the tip on the end point, as the canvas draws them", () => {
    close(layerArrowheads({ type: "shape", shape: "line", strokeWidth: 4, arrowEnd: true }, 100, 20), [[88, 16, 100, 10, 88, 4]]);
  });

  it("uses path heads for paths and nothing for other shapes", () => {
    expect(layerArrowheads({ type: "shape", shape: "path", path: "M0 0.5 L1 0.5", strokeWidth: 4, arrowEnd: true }, 100, 50)).toHaveLength(1);
    expect(layerArrowheads({ type: "shape", shape: "rect", strokeWidth: 4, arrowEnd: true }, 100, 50)).toEqual([]);
  });
});

function extent(polygon: number[]) {
  const xs = polygon.filter((_, i) => i % 2 === 0);
  const ys = polygon.filter((_, i) => i % 2 === 1);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

describe("line end kinds", () => {
  const straight = { strokeWidth: 4, path: "M0 0.5 L1 0.5" };

  it("keeps the filled arrow when no kind is set or the kind is arrow", () => {
    close(pathArrowheads({ ...straight, arrowEnd: true, arrowEndKind: "arrow" }, 100, 50), [[100, 31, 112, 25, 100, 19]]);
  });

  it("centers a dot on the end of the path with the arrowhead size as its diameter", () => {
    const [dot] = pathArrowheads({ ...straight, arrowEnd: true, arrowEndKind: "dot" }, 100, 50);
    const box = extent(dot);
    expect(box.left).toBeCloseTo(94, 3);
    expect(box.right).toBeCloseTo(106, 3);
    expect(box.top).toBeCloseTo(19, 3);
    expect(box.bottom).toBeCloseTo(31, 3);
    expect(dot.length).toBeGreaterThan(40);
  });

  it("draws a square and a diamond centered on the end", () => {
    close(pathArrowheads({ ...straight, arrowEnd: true, arrowEndKind: "square" }, 100, 50), [[94, 31, 106, 31, 106, 19, 94, 19]]);
    close(pathArrowheads({ ...straight, arrowEnd: true, arrowEndKind: "diamond" }, 100, 50), [[94, 25, 100, 31, 106, 25, 100, 19]]);
  });

  it("draws a bar across the end as thick as the stroke", () => {
    close(pathArrowheads({ ...straight, arrowEnd: true, arrowEndKind: "bar" }, 100, 50), [[98, 31, 102, 31, 102, 19, 98, 19]]);
  });

  it("rounds one end with a half disc as wide as the stroke", () => {
    const [round] = pathArrowheads({ ...straight, arrowStart: true, arrowStartKind: "round" }, 100, 50);
    const box = extent(round);
    expect(box.left).toBeCloseTo(-2, 3);
    expect(box.right).toBeCloseTo(0, 3);
    expect(box.top).toBeCloseTo(23, 3);
    expect(box.bottom).toBeCloseTo(27, 3);
  });

  it("draws an open arrow as a chevron as thick as the stroke, tip just past the end", () => {
    const [open] = pathArrowheads({ ...straight, arrowEnd: true, arrowEndKind: "openArrow" }, 100, 50);
    expect(open).toHaveLength(12);
    const box = extent(open);
    expect(box.right).toBeCloseTo(100 + 2 * Math.sqrt(5), 3);
    expect(box.left).toBeLessThan(90);
    expect(box.bottom - box.top).toBeGreaterThan(12);
  });

  it("gives each end its own kind", () => {
    const heads = pathArrowheads({ ...straight, arrowStart: true, arrowStartKind: "dot", arrowEnd: true }, 100, 50);
    expect(heads).toHaveLength(2);
    expect(heads[0].length).toBeGreaterThan(40);
    expect(heads[1]).toHaveLength(6);
  });

  it("anchors line markers on the end point while the filled arrow keeps its tip there", () => {
    const [dot] = layerArrowheads({ type: "shape", shape: "line", strokeWidth: 4, arrowEnd: true, arrowEndKind: "dot" }, 100, 20);
    const box = extent(dot);
    expect(box.left).toBeCloseTo(94, 3);
    expect(box.right).toBeCloseTo(106, 3);
    close(layerArrowheads({ type: "shape", shape: "line", strokeWidth: 4, arrowStart: true, arrowStartKind: "bar" }, 100, 20), [[2, 4, -2, 4, -2, 16, 2, 16]]);
  });

  it("reads the kind of each end, empty when the end has no head", () => {
    expect(endKind({ arrowEnd: true }, "end")).toBe("arrow");
    expect(endKind({ arrowEnd: true, arrowEndKind: "diamond" }, "end")).toBe("diamond");
    expect(endKind({ arrowStartKind: "dot" }, "start")).toBeNull();
    expect(strokedArrowEnds({ type: "shape", shape: "line", arrowStart: true, arrowEnd: true, arrowEndKind: "dot" })).toEqual({ start: true, end: false });
    expect(strokedArrowEnds({ type: "shape", shape: "path", arrowEnd: true })).toEqual({ start: false, end: false });
  });
});
