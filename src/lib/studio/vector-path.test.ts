import { describe, expect, it } from "vitest";

import { isValidPath, MAX_PATH_COORDINATE, scalePath } from "./vector-path";

describe("isValidPath", () => {
  it("accepts every SVG command, absolute and relative, with implicit repeats", () => {
    expect(isValidPath("M0 0.58 L1 0.40 L1 1 L0 1 Z")).toBe(true);
    expect(isValidPath("m0,0 l.5-.5 h.25 v.25 c.1 .1 .2 .2 .3 .3 s.1 .1 .2 .2 q.1 .1 .2 .2 t.1 .1 z")).toBe(true);
    expect(isValidPath("M0 1 L0 0.5 A0.5 0.5 0 0 1 1 0.5 L1 1 Z")).toBe(true);
    expect(isValidPath("M0 0 L1 0 1 1 0 1Z")).toBe(true);
    expect(isValidPath("M0 0 L1e-1 2.5E-1")).toBe(true);
    expect(isValidPath("M0.5.5 L1 1")).toBe(true);
  });

  it("refuses data that is not a path", () => {
    for (const data of ["", "   ", "L0 0", "Z", "M0", "M0 0 L1", "M0 0 C0 0 1 1", "M0 0 X1 1", "M0 0 L1 1 Z 1", "M0 0 L1 one", "M0 0 L1 1;", "M0 0 L1 1"]) {
      expect(isValidPath(data), data).toBe(false);
    }
  });

  it("needs arc flags to be 0 or 1", () => {
    expect(isValidPath("M0 0 A0.5 0.5 0 1 0 1 1")).toBe(true);
    expect(isValidPath("M0 0 A0.5 0.5 0 2 0 1 1")).toBe(false);
    expect(isValidPath("M0 0 A0.5 0.5 0 0.5 0 1 1")).toBe(false);
  });

  it("refuses numbers past the coordinate bound", () => {
    expect(isValidPath(`M0 0 L${MAX_PATH_COORDINATE} 0`)).toBe(true);
    expect(isValidPath(`M0 0 L${MAX_PATH_COORDINATE + 1} 0`)).toBe(false);
    expect(isValidPath("M0 0 L1e400 0")).toBe(false);
  });
});

describe("scalePath", () => {
  it("maps the unit box onto the layer box, command by command", () => {
    expect(scalePath("M0 0.5 L1 0.25 H0.5 V1 Z", 200, 100)).toBe("M0 50 L200 25 H100 V100 Z");
    expect(scalePath("m0 0 c0.5 0 0.5 1 1 1", 10, 20)).toBe("m0 0 c5 0 5 20 10 20");
    expect(scalePath("M0 0 Q0.5 0 1 1 T1 0 S0.5 0.5 0 0", 10, 10)).toBe("M0 0 Q5 0 10 10 T10 0 S5 5 0 0");
  });

  it("scales arc radii and end points but keeps rotation and flags", () => {
    expect(scalePath("M0 1 A0.5 0.5 30 0 1 1 0.5", 200, 100)).toBe("M0 100 A100 50 30 0 1 200 50");
  });

  it("keeps implicit repeats in step with their command", () => {
    expect(scalePath("M0 0 L1 0 1 1 0 1 Z", 4, 2)).toBe("M0 0 L4 0 4 2 0 2 Z");
    expect(scalePath("M0 0 0.5 0.5", 4, 2)).toBe("M0 0 2 1");
  });
});
