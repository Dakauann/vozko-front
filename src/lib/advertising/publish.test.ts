import { describe, expect, it } from "vitest";

import { emptyAdForm, emptyWizardForm } from "./draft";
import {
  canSwitchOnLater,
  jobOutcome,
  jobPlan,
  jobSteps,
  needsStructureRefresh,
  publishBlockers,
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

const ready = { ready: true, blocking: [] };

describe("publishBlockers", () => {
  it("is empty only for a ready account and a clean validation of the exact draft with a fee", () => {
    expect(publishBlockers(ready, done(), "k1")).toEqual([]);
  });

  it("names why publishing is not possible yet", () => {
    expect(publishBlockers(ready, { status: "idle" }, "k1")).toEqual(["notValidated"]);
    expect(publishBlockers(ready, { status: "validating" }, "k1")).toEqual(["validating"]);
    expect(publishBlockers(ready, { status: "failed", message: "x", code: "price_unavailable" }, "k1")).toEqual(["validationFailed"]);
    expect(publishBlockers(ready, done(), "k2")).toEqual(["stale"]);
    expect(publishBlockers(ready, done({ issues: [{ field: "adSet", code: "required" }] }), "k1")).toEqual(["issues"]);
    expect(publishBlockers(ready, done({ fee: null }), "k1")).toEqual(["noFee"]);
  });

  it("lists every readiness item that still blocks the account", () => {
    expect(publishBlockers({ ready: false, blocking: ["payment_method", "page"] }, done(), "k1")).toEqual(["payment_method", "page"]);
  });

  it("fails closed when readiness is missing, contradictory or names an unknown item", () => {
    expect(publishBlockers(null, done({ fee: null }), "k1")).toEqual(["readinessUnchecked", "noFee"]);
    expect(publishBlockers({ ready: false, blocking: [] }, done(), "k1")).toEqual(["readinessUnchecked"]);
    expect(publishBlockers({ ready: true, blocking: ["page"] }, done(), "k1")).toEqual(["page"]);
    expect(publishBlockers({ ready: false, blocking: ["page", "something_new"] }, done(), "k1")).toEqual(["page", "readinessUnchecked"]);
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
