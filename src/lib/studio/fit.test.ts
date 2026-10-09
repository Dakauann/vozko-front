import { describe, expect, it } from "vitest";

import { fitRect } from "./fit";

describe("fitRect", () => {
  it("crops the source for cover", () => {
    const r = fitRect(2000, 1000, 100, 100, "cover");
    expect(r).toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000, dx: 0, dy: 0, dw: 100, dh: 100 });
  });

  it("letterboxes the destination for contain", () => {
    const r = fitRect(2000, 1000, 100, 100, "contain");
    expect(r).toEqual({ sx: 0, sy: 0, sw: 2000, sh: 1000, dx: 0, dy: 25, dw: 100, dh: 50 });
  });
});
