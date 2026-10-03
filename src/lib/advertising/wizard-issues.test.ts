import { describe, expect, it } from "vitest";

import {
  adIndexOfIssue,
  issueMessageKey,
  issuesFromCreativeEdit,
  issuesFromExpected,
  issuesUnder,
} from "./wizard-issues";

describe("wizard issues", () => {
  it("finds the ad index of an issue", () => {
    expect(adIndexOfIssue("ads[3].creative.media")).toBe(3);
    expect(adIndexOfIssue("ads")).toBeNull();
  });

  it("filters issues by prefix", () => {
    const issues = [
      { field: "adSet.targeting.age", code: "invalid" },
      { field: "adSet.targetingX", code: "invalid" },
      { field: "ads[0].creative.cards[1].media", code: "required" },
    ];
    expect(issuesUnder(issues, "adSet.targeting")).toEqual([issues[0]]);
    expect(issuesUnder(issues, "ads[0].creative.cards")).toEqual([issues[2]]);
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
