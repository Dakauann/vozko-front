import { describe, expect, it } from "vitest";

import { checkPeriodLimit, periodDays, wholeUnitAmount, windowShare } from "./period-limit";

describe("periodDays", () => {
  it("counts both ends of the period", () => {
    expect(periodDays("2026-09-01", "2026-09-01")).toBe(1);
    expect(periodDays("2026-09-01", "2026-09-30")).toBe(30);
  });

  it("counts calendar days across a daylight saving change", () => {
    expect(periodDays("2026-02-01", "2026-03-31")).toBe(59);
  });
});

describe("checkPeriodLimit", () => {
  it("keeps a period the view can show", () => {
    expect(checkPeriodLimit("2026-07-01", "2026-09-30", 92)).toEqual({
      exceeded: false,
      days: 92,
      window: { from: "2026-07-01", to: "2026-09-30" },
    });
  });

  it("offers only the most recent days of a longer period", () => {
    expect(checkPeriodLimit("2026-01-01", "2026-09-30", 92)).toEqual({
      exceeded: true,
      days: 273,
      window: { from: "2026-07-01", to: "2026-09-30" },
    });
  });

  it("treats a period it cannot read as within the limit rather than guessing", () => {
    expect(checkPeriodLimit("", "2026-09-30", 92).exceeded).toBe(false);
    expect(checkPeriodLimit("2026-09-30", "2026-09-01", 92).exceeded).toBe(false);
  });
});

describe("windowShare", () => {
  it("is the part of the chosen period the view keeps", () => {
    expect(windowShare(92, 368)).toBe(0.25);
    expect(windowShare(92, 50)).toBe(1);
    expect(windowShare(92, 0)).toBe(1);
  });
});

describe("wholeUnitAmount", () => {
  it("says a long window in the largest whole unit", () => {
    expect(wholeUnitAmount(3650, "days")).toEqual({ limit: 10, unit: "years" });
    expect(wholeUnitAmount(36, "months")).toEqual({ limit: 3, unit: "years" });
  });

  it("keeps a window that is not a whole number of a larger unit", () => {
    expect(wholeUnitAmount(92, "days")).toEqual({ limit: 92, unit: "days" });
    expect(wholeUnitAmount(731, "days")).toEqual({ limit: 731, unit: "days" });
    expect(wholeUnitAmount(37, "months")).toEqual({ limit: 37, unit: "months" });
  });
});
