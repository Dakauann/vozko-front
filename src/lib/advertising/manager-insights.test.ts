import { describe, expect, it } from "vitest";

import { budgetHome, insightsTabs, trendScope } from "./manager-insights";

const row = (overrides: Partial<Parameters<typeof budgetHome>[0]> = {}): Parameters<typeof budgetHome>[0] => ({
  level: "ad",
  campaignId: "c1",
  adSetId: "s1",
  dailyBudget: 0,
  lifetimeBudget: 0,
  ...overrides,
});

describe("insightsTabs", () => {
  it("adds the preview and the comments only for ads, like Meta", () => {
    expect(insightsTabs("campaign")).toEqual(["performance", "budget", "actions", "history"]);
    expect(insightsTabs("ad")).toEqual(["performance", "budget", "actions", "history", "preview", "comments"]);
  });
});

describe("trendScope", () => {
  it("charts exactly the object of the row", () => {
    expect(trendScope({ level: "campaign", metaId: "c1" })).toEqual({ campaignIds: ["c1"] });
    expect(trendScope({ level: "adset", metaId: "s1" })).toEqual({ adSetIds: ["s1"] });
    expect(trendScope({ level: "ad", metaId: "a1" })).toEqual({ adIds: ["a1"] });
  });
});

describe("budgetHome", () => {
  it("edits the budget where it lives", () => {
    expect(budgetHome(row({ level: "adset", dailyBudget: 1000 }), undefined)).toEqual({ kind: "own" });
    expect(budgetHome(row({ level: "campaign", lifetimeBudget: 5000 }), undefined)).toEqual({ kind: "own" });
  });

  it("points to the level that holds it otherwise", () => {
    expect(budgetHome(row({ level: "campaign" }), undefined)).toEqual({ kind: "children" });
    expect(budgetHome(row({ level: "adset" }), undefined)).toEqual({ kind: "parent", level: "campaign", metaId: "c1" });
    expect(budgetHome(row(), { dailyBudget: 1000, lifetimeBudget: 0 })).toEqual({ kind: "parent", level: "adset", metaId: "s1" });
    expect(budgetHome(row(), { dailyBudget: 0, lifetimeBudget: 0 })).toEqual({ kind: "parent", level: "campaign", metaId: "c1" });
    expect(budgetHome(row(), undefined)).toEqual({ kind: "parent", level: "adset", metaId: "s1" });
  });

  it("does not invent a parent it does not know", () => {
    expect(budgetHome(row({ level: "adset", campaignId: undefined }), undefined)).toEqual({ kind: "unknown" });
  });
});
