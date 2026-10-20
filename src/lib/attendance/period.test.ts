import { describe, expect, it } from "vitest";

import { CALENDAR_WINDOW_DAYS, presetRange, refusedForSpan } from "./period";

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

describe("refusedForSpan", () => {
  it("is the server's answer that the period is too wide to count in working days", () => {
    expect(refusedForSpan("range_too_wide")).toBe(true);
    expect(refusedForSpan("no_schedule")).toBe(false);
    expect(refusedForSpan(undefined)).toBe(false);
  });

  it("offers a window that is long but still countable", () => {
    expect(CALENDAR_WINDOW_DAYS).toBe(3650);
  });
});
