import { describe, expect, it } from "vitest";

import { arrowheadSize, hasOpenEnds, layerArrowheads, pathArrowheads, takesArrowheads } from "./arrowheads";

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
