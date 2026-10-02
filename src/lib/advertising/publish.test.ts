import { describe, expect, it } from "vitest";

import { emptyAdForm, emptyWizardForm } from "./draft";
import {
  canSwitchOnLater,
  jobOutcome,
  jobPlan,
  jobSteps,
  needsStructureRefresh,
  publishBlockers,
  publishedCampaignId,
  type ValidationState,
} from "./publish";

const fee = { price: 1_000_000, total: 1_000_000, currency: "USD" };
const done = (overrides: Partial<Extract<ValidationState, { status: "done" }>> = {}): ValidationState => ({
  status: "done",
  key: "k1",
  issues: [],
  fee,
  ...overrides,
});

describe("publishBlockers", () => {
  it("is empty only for a clean validation of the exact draft with a fee", () => {
    expect(publishBlockers({ canSpend: true }, done(), "k1")).toEqual([]);
  });

  it("names why publishing is not possible yet", () => {
    expect(publishBlockers({ canSpend: true }, { status: "idle" }, "k1")).toEqual(["notValidated"]);
    expect(publishBlockers({ canSpend: true }, { status: "validating" }, "k1")).toEqual(["validating"]);
    expect(publishBlockers({ canSpend: true }, { status: "failed", message: "x", code: "price_unavailable" }, "k1")).toEqual([
      "validationFailed",
    ]);
    expect(publishBlockers({ canSpend: true }, done(), "k2")).toEqual(["stale"]);
    expect(publishBlockers({ canSpend: true }, done({ issues: [{ field: "adSet", code: "required" }] }), "k1")).toEqual(["issues"]);
    expect(publishBlockers({ canSpend: true }, done({ fee: null }), "k1")).toEqual(["noFee"]);
  });

  it("refuses an account that cannot create, or no account at all", () => {
    expect(publishBlockers({ canSpend: false }, done(), "k1")).toEqual(["account"]);
    expect(publishBlockers(undefined, done({ fee: null }), "k1")).toEqual(["account", "noFee"]);
  });
});

describe("jobSteps", () => {
  const form = { ...emptyWizardForm("acc"), ads: [emptyAdForm("a1"), emptyAdForm("a2")] };

  it("plans every object a new campaign creates and activation unless kept paused", () => {
    expect(jobPlan(form)).toEqual({ newCampaign: true, newAdSet: true, ads: 2, activates: true });
    expect(jobPlan({ ...form, keepPaused: true }).activates).toBe(false);
    expect(jobPlan({ ...form, mode: "adSet" })).toMatchObject({ newCampaign: false, newAdSet: false });
    expect(jobPlan({ ...form, mode: "campaign" })).toMatchObject({ newCampaign: false, newAdSet: true });
  });

  it("marks what Meta already created", () => {
    const plan = jobPlan(form);
    expect(jobSteps({ campaignId: "c1", ads: { "0": "ad1" } }, plan)).toEqual([
      { key: "campaign", done: true },
      { key: "adSet", done: false },
      { key: "ads", done: false, created: 1, total: 2 },
      { key: "activate", done: false },
    ]);
    expect(jobSteps(undefined, { ...plan, activates: false }).map((step) => step.key)).toEqual(["campaign", "adSet", "ads"]);
    expect(jobSteps({ ads: { "0": "a", "1": "b" }, activated: true }, plan).filter((step) => step.done).map((step) => step.key)).toEqual([
      "ads",
      "activate",
    ]);
  });
});

describe("jobOutcome", () => {
  it("never reads an unknown status as published", () => {
    expect(jobOutcome("PUBLISHED")).toBe("published");
    expect(jobOutcome("FAILED")).toBe("failed");
    expect(jobOutcome("NEEDS_REVIEW")).toBe("needsReview");
    expect(jobOutcome("RUNNING")).toBe("working");
    expect(jobOutcome("SOMETHING")).toBe("working");
  });
});

describe("publishedCampaignId", () => {
  it("prefers the created campaign and falls back to the existing one", () => {
    expect(publishedCampaignId({ progress: { campaignId: "c1" } }, "c0")).toBe("c1");
    expect(publishedCampaignId({ progress: {} }, "c0")).toBe("c0");
    expect(publishedCampaignId({ progress: {} }, undefined)).toBeNull();
  });
});

describe("canSwitchOnLater", () => {
  it("offers switching on only a published job that is still off", () => {
    expect(canSwitchOnLater({ status: "PUBLISHED", progress: {} })).toBe(true);
    expect(canSwitchOnLater({ status: "PUBLISHED", progress: { activated: true } })).toBe(false);
    expect(canSwitchOnLater({ status: "RUNNING", progress: {} })).toBe(false);
    expect(canSwitchOnLater({ status: "FAILED", progress: {} })).toBe(false);
  });
});

describe("needsStructureRefresh", () => {
  it("asks for a sync only when the published campaign is missing from the report", () => {
    expect(needsStructureRefresh(["c1", "c2"], "c2")).toBe(false);
    expect(needsStructureRefresh(["c1"], "c2")).toBe(true);
    expect(needsStructureRefresh([], null)).toBe(false);
  });
});
