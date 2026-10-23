import { describe, expect, it } from "vitest";

import { basisPointsToPercent, formatBasisPoints } from "./basis-points";

describe("basis points", () => {
  it("turns basis points into a percent", () => {
    expect(basisPointsToPercent(1400)).toBe(14);
  });

  it("formats a rate for the locale, whole for tight spaces", () => {
    expect(formatBasisPoints(1400, "pt-BR", 0)).toBe("14%");
    expect(formatBasisPoints(8003, "pt-BR")).toBe("80,0%");
    expect(formatBasisPoints(8003, "en-US")).toBe("80.0%");
  });
});
