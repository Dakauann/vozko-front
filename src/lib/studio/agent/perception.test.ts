import { describe, expect, it } from "vitest";

import { guideTicks } from "./perception";

describe("guide marks", () => {
  it("ends a horizontal guide with a short upright tick at each end", () => {
    expect(guideTicks([0, 0], [10, 0], 2)).toEqual([
      [
        [0, -2],
        [0, 2],
      ],
      [
        [10, -2],
        [10, 2],
      ],
    ]);
  });

  it("ends a vertical guide with a short level tick at each end", () => {
    const [start, end] = guideTicks([5, 0], [5, 8], 1);
    expect(start.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000])).toEqual([
      [6, 0],
      [4, 0],
    ]);
    expect(end.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000])).toEqual([
      [6, 8],
      [4, 8],
    ]);
  });
});
