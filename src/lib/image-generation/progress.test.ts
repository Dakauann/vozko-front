import { describe, expect, it } from "vitest";

import { estimatedProgress, PROGRESS_CEILING, TYPICAL_GENERATION_MS } from "./progress";

describe("estimatedProgress", () => {
  it("starts at zero and never runs backwards", () => {
    expect(estimatedProgress(0)).toBe(0);
    expect(estimatedProgress(-500)).toBe(0);
    let previous = 0;
    for (let ms = 0; ms <= 10 * 60_000; ms += 250) {
      const current = estimatedProgress(ms);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it("is about three quarters done at the typical duration", () => {
    expect(estimatedProgress(TYPICAL_GENERATION_MS)).toBeGreaterThanOrEqual(70);
    expect(estimatedProgress(TYPICAL_GENERATION_MS)).toBeLessThanOrEqual(80);
  });

  it("approaches but never reaches completion on its own", () => {
    expect(estimatedProgress(60 * 60_000)).toBe(PROGRESS_CEILING);
    expect(PROGRESS_CEILING).toBeLessThan(100);
  });

  it("is a whole percentage", () => {
    expect(Number.isInteger(estimatedProgress(12_345))).toBe(true);
    expect(estimatedProgress(Number.NaN)).toBe(0);
  });
});
