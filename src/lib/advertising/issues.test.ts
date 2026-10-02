import { describe, expect, it } from "vitest";

import { issueFieldKey, issuesAt, issuesUnder, withBudgetMinimum, withoutIssue } from "./issues";

describe("issueFieldKey", () => {
  it("drops indexes and joins the path with underscores", () => {
    expect(issueFieldKey("questions[2].label")).toBe("questions_label");
    expect(issueFieldKey("action.budgetPercent")).toBe("action_budgetPercent");
    expect(issueFieldKey("name")).toBe("name");
  });
});

describe("issuesAt and issuesUnder", () => {
  const expected = { name: "required", "questions[1].label": "required", "questions[1].options": "too_many", questions: "needs_phone_or_email" };

  it("finds the issue of one field only", () => {
    expect(issuesAt(expected, "name")).toEqual([{ field: "name", code: "required" }]);
    expect(issuesAt(expected, "privacyUrl")).toEqual([]);
    expect(issuesAt(undefined, "name")).toEqual([]);
  });

  it("collects every issue below a path", () => {
    expect(issuesUnder(expected, "questions[1]").map((issue) => issue.field)).toEqual(["questions[1].label", "questions[1].options"]);
    expect(issuesUnder(expected, "questions")).toHaveLength(3);
  });
});

describe("withoutIssue", () => {
  it("removes the field and keeps the rest", () => {
    expect(withoutIssue({ name: "required", pageId: "required" }, "name")).toEqual({ pageId: "required" });
  });

  it("returns the same object when nothing changes", () => {
    const expected = { name: "required" };
    expect(withoutIssue(expected, "other")).toBe(expected);
  });
});

describe("withBudgetMinimum", () => {
  const minimum = { field: "adSet.budget.amount", daily: 519, currency: "BRL" };

  it("gives the minimum to the issues that are below it", () => {
    const issues = [
      { field: "adSet.budget.amount", code: "below_minimum" },
      { field: "adSet.name", code: "required" },
    ];
    expect(withBudgetMinimum(issues, minimum)).toEqual([
      { field: "adSet.budget.amount", code: "below_minimum", minimum },
      { field: "adSet.name", code: "required" },
    ]);
  });

  it("leaves the issues alone when the minimum is unknown", () => {
    const issues = [{ field: "budget.amount", code: "below_minimum" }];
    expect(withBudgetMinimum(issues, null)).toBe(issues);
  });
});
