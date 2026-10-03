import { describe, expect, it } from "vitest";

import { draftOnlyBlockers, draftSummary, draftValidationKey, publishableDrafts, reviewBlockers, validationDone } from "./manager-publish";
import type { ValidationState } from "./publish";
import type { DraftIssue } from "./wizard-issues";
import { fixtureContent, fixtureDraft } from "./manager-test-fixtures";

const ready = { ready: true, blocking: [] };
const fee = { price: 1_000_000, currency: "USD", total: 2_000_000 };
const validated = (key: string, issues: DraftIssue[] = []): ValidationState => ({
  status: "done",
  key,
  issues,
  fee,
});

describe("reviewBlockers", () => {
  it("lets a validated draft with a fee through on a ready account", () => {
    const draft = fixtureDraft();
    expect(reviewBlockers(draft, ready, validated(draftValidationKey(draft)))).toEqual([]);
  });

  it("blocks a draft that changed since it was validated", () => {
    const draft = fixtureDraft({ version: 2 });
    expect(reviewBlockers(draft, ready, validated("d1:1"))).toEqual(["stale"]);
  });

  it("blocks a draft with issues, without a check, or while it publishes", () => {
    const draft = fixtureDraft();
    expect(reviewBlockers(draft, ready, validated(draftValidationKey(draft), [{ field: "pageId", code: "required" }]))).toEqual(["issues"]);
    expect(reviewBlockers(draft, ready, { status: "idle" })).toEqual(["notValidated"]);
    const publishing = fixtureDraft({ state: "publishing" });
    expect(reviewBlockers(publishing, ready, validated(draftValidationKey(publishing)))).toEqual(["publishing"]);
    const unknown = fixtureDraft({ state: "archived" as never });
    expect(reviewBlockers(unknown, ready, validated(draftValidationKey(unknown)))).toEqual(["publishing"]);
  });

  it("blocks every draft when the account is not ready or was never checked", () => {
    const draft = fixtureDraft();
    const key = draftValidationKey(draft);
    expect(reviewBlockers(draft, { ready: false, blocking: ["payment_method"] }, validated(key))).toEqual(["payment_method"]);
    expect(reviewBlockers(draft, null, validated(key))).toEqual(["readinessUnchecked"]);
  });
});

describe("publishableDrafts", () => {
  it("keeps the chosen drafts without blockers, in list order", () => {
    const drafts = [fixtureDraft({ id: "d1" }), fixtureDraft({ id: "d2" }), fixtureDraft({ id: "d3" })];
    const blockers = new Map([
      ["d1", []],
      ["d2", ["issues" as const]],
      ["d3", []],
    ]);
    expect(publishableDrafts(drafts, blockers, new Set(["d3", "d2", "d1"]))).toEqual(["d1", "d3"]);
    expect(publishableDrafts(drafts, new Map(), new Set(["d1"]))).toEqual([]);
  });
});

describe("draftSummary", () => {
  it("names a new campaign and counts its new ad sets and ads", () => {
    expect(draftSummary(fixtureDraft(), new Map())).toEqual({ name: "Nova campanha de Leads", existingCampaignId: null, adSets: 1, ads: 2 });
  });

  it("names an existing campaign from the table", () => {
    const draft = fixtureDraft({
      draft: fixtureContent({ campaign: { existingId: "500" } }),
      rows: [
        { key: "d1:adset", level: "adset", name: "Conjunto", parentMetaId: "500" },
        { key: "d1:ad:0", level: "ad", name: "Anúncio", parentKey: "d1:adset" },
      ],
    });
    expect(draftSummary(draft, new Map([["500", "Campanha de Natal"]]))).toEqual({ name: "Campanha de Natal", existingCampaignId: "500", adSets: 1, ads: 1 });
    expect(draftSummary(draft, new Map()).name).toBeNull();
  });
});

describe("validationDone", () => {
  it("keeps the issues and the fee under the draft version it checked", () => {
    expect(validationDone("d1:3", { issues: null, fee })).toEqual({ status: "done", key: "d1:3", issues: [], fee });
    expect(validationDone("d1:3", { issues: [] })).toEqual({ status: "done", key: "d1:3", issues: [], fee: null });
  });

  it("attaches the budget minimum to a below minimum issue", () => {
    const minimum = { daily: 500, currency: "BRL" };
    const state = validationDone("d1:3", { issues: [{ field: "adSet.budget.amount", code: "below_minimum" }], budgetMinimum: minimum, fee });
    expect(state.status === "done" ? state.issues : []).toEqual([{ field: "adSet.budget.amount", code: "below_minimum", minimum }]);
  });
});

describe("draftOnlyBlockers", () => {
  it("leaves out what belongs to the account, which the dialog shows once on top", () => {
    expect(draftOnlyBlockers(["payment_method", "readinessUnchecked", "issues", "publishing"])).toEqual(["issues", "publishing"]);
  });
});
