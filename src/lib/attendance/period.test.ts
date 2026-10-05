import { describe, expect, it } from "vitest";

import { presetRange } from "./period";

describe("presetRange", () => {
  const now = new Date(2026, 9, 5, 15, 30);

  it("counts today as the last day of a seven day window", () => {
    expect(presetRange("7d", now)).toEqual({ dateFrom: "2026-09-29", dateTo: "2026-10-05" });
  });

  it("covers thirty and ninety days the same way", () => {
    expect(presetRange("30d", now)).toEqual({ dateFrom: "2026-09-06", dateTo: "2026-10-05" });
    expect(presetRange("90d", now)).toEqual({ dateFrom: "2026-07-08", dateTo: "2026-10-05" });
  });
});
