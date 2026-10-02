import { describe, expect, it } from "vitest";

import {
  adHasIssues,
  adIndexOfIssue,
  issueMessageKey,
  issuesForStep,
  issuesFromCreativeEdit,
  issuesFromExpected,
  issuesUnder,
  stepOfIssue,
  stepsFor,
} from "./wizard-issues";

describe("wizard issues", () => {
  it("lists the steps for each mode", () => {
    expect(stepsFor("new")).toEqual(["objective", "campaign", "adSet", "ads", "review"]);
    expect(stepsFor("campaign")).toEqual(["objective", "adSet", "ads", "review"]);
    expect(stepsFor("adSet")).toEqual(["objective", "ads", "review"]);
    expect(stepsFor("creative")).toEqual(["ads", "review"]);
  });

  it("maps fields to steps", () => {
    expect(stepOfIssue("campaign.objective", "new")).toBe("objective");
    expect(stepOfIssue("adAccountId", "new")).toBe("objective");
    expect(stepOfIssue("campaign.budget.amount", "new")).toBe("campaign");
    expect(stepOfIssue("campaign.budget.amount", "campaign")).toBe("objective");
    expect(stepOfIssue("adSet.targeting.age", "new")).toBe("adSet");
    expect(stepOfIssue("adSet.targeting.age", "adSet")).toBe("objective");
    expect(stepOfIssue("identity.pageId", "new")).toBe("ads");
    expect(stepOfIssue("ads[1].creative.cards", "new")).toBe("ads");
    expect(stepOfIssue("ads", "new")).toBe("ads");
    expect(stepOfIssue("something", "new")).toBe("review");
    expect(stepOfIssue("adSet.goal", "creative")).toBe("ads");
    expect(stepOfIssue("adAccountId", "creative")).toBe("ads");
  });

  it("finds the ad index of an issue", () => {
    expect(adIndexOfIssue("ads[3].creative.media")).toBe(3);
    expect(adIndexOfIssue("ads")).toBeNull();
    expect(adHasIssues([{ field: "ads[1].name", code: "required" }], 1)).toBe(true);
    expect(adHasIssues([{ field: "ads[1].name", code: "required" }], 0)).toBe(false);
  });

  it("filters issues by prefix and step", () => {
    const issues = [
      { field: "adSet.targeting.age", code: "invalid" },
      { field: "adSet.targetingX", code: "invalid" },
      { field: "ads[0].creative.cards[1].media", code: "required" },
    ];
    expect(issuesUnder(issues, "adSet.targeting")).toEqual([issues[0]]);
    expect(issuesUnder(issues, "ads[0].creative.cards")).toEqual([issues[2]]);
    expect(issuesForStep(issues, "ads", "new")).toEqual([issues[2]]);
  });

  it("builds a translation key without indexes", () => {
    expect(issueMessageKey({ field: "ads[1].creative.cards[0].media", code: "required" })).toBe("ads_creative_cards_media.required");
    expect(issueMessageKey({ field: "adSet.targeting.age", code: "advantage_audience_limits" })).toBe(
      "adSet_targeting_age.advantage_audience_limits",
    );
  });

  it("reads the expected map of a 422", () => {
    expect(issuesFromExpected({ "adSet.goal": "not_for_objective" })).toEqual([{ field: "adSet.goal", code: "not_for_objective" }]);
    expect(issuesFromExpected(undefined)).toEqual([]);
  });

  it("moves creative edit issues onto the single ad", () => {
    expect(issuesFromCreativeEdit({ "creative.link": "invalid_url", name: "too_long" })).toEqual([
      { field: "ads[0].creative.link", code: "invalid_url" },
      { field: "name", code: "too_long" },
    ]);
  });
});
