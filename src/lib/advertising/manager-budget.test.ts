import { describe, expect, it } from "vitest";

import { DAILY_PEAK_FACTOR, WEEKLY_FACTOR, dailySpendLimits } from "./manager-budget";

describe("dailySpendLimits", () => {
  it("lets Meta spend up to 1.75 times the budget in a day and 7 times in a week", () => {
    expect(DAILY_PEAK_FACTOR).toBe(1.75);
    expect(WEEKLY_FACTOR).toBe(7);
    expect(dailySpendLimits(2000)).toEqual({ day: 3500, week: 14000 });
  });

  it("rounds to the smallest unit of the currency", () => {
    expect(dailySpendLimits(1001)).toEqual({ day: 1752, week: 7007 });
  });

  it("has nothing to say about an empty or broken budget", () => {
    expect(dailySpendLimits(0)).toBeNull();
    expect(dailySpendLimits(Number.NaN)).toBeNull();
  });
});
