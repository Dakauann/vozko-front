import { describe, expect, it } from "vitest";

import { activeSpendCap, spendCapProblem, spendCapUsage } from "./spend-cap";

describe("spend cap", () => {
  it("treats a missing or zero cap as no limit", () => {
    expect(activeSpendCap({ spendCap: null })).toBeNull();
    expect(activeSpendCap({ spendCap: 0 })).toBeNull();
    expect(activeSpendCap({ spendCap: 10_000 })).toBe(10_000);
  });

  it("refuses a cap at or below what was already spent, like Meta", () => {
    expect(spendCapProblem(5_000, 5_000)).toBe("notAboveSpent");
    expect(spendCapProblem(5_001, 5_000)).toBeNull();
    expect(spendCapProblem(null, 0)).toBe("invalid");
    expect(spendCapProblem(100, undefined)).toBeNull();
  });

  it("measures how much of the cap is used only when both numbers are known", () => {
    expect(spendCapUsage({ spendCap: 10_000, amountSpent: 2_500 })).toBe(0.25);
    expect(spendCapUsage({ spendCap: 10_000, amountSpent: null })).toBeNull();
    expect(spendCapUsage({ spendCap: null, amountSpent: 2_500 })).toBeNull();
  });
});
