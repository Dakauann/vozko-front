import { describe, expect, it } from "vitest";

import { audienceFunnel, hasIssue, issueFix, wizardStepOf } from "../review";
import { LAUNCH_ISSUE_CODES, type AudienceSummary } from "../types";

const audience: AudienceSummary = {
  matched: 1000,
  with_email: 900,
  never_mailed: 0,
  sendable: 830,
  skipped: { no_email: 100, unsubscribed: 20, suppressed: 30, duplicate: 20 },
};

describe("audienceFunnel", () => {
  it("walks from the selection to the sendable list with the reasons for each drop", () => {
    const stages = audienceFunnel(audience);
    expect(stages.map((stage) => [stage.key, stage.value])).toEqual([
      ["matched", 1000],
      ["with_email", 900],
      ["sendable", 830],
    ]);
    expect(stages[0].dropped).toEqual([]);
    expect(stages[1].dropped).toEqual([{ reason: "no_email", count: 100 }]);
    expect(stages[2].dropped).toEqual([
      { reason: "duplicate", count: 20 },
      { reason: "unsubscribed", count: 20 },
      { reason: "suppressed", count: 30 },
    ]);
  });

  it("drops the leads left out for a missing merge tag at the sendable stage", () => {
    expect(audienceFunnel({ ...audience, skipped: { missing_variable: 18 } })[2].dropped).toEqual([{ reason: "missing_variable", count: 18 }]);
  });

  it("copes with a null skipped map", () => {
    expect(audienceFunnel({ ...audience, skipped: null })[1].dropped).toEqual([]);
  });
});

describe("issueFix", () => {
  it("has a way to fix every launch issue code", () => {
    for (const code of LAUNCH_ISSUE_CODES) expect(issueFix(code)).toBeTruthy();
  });

  it("sends people to the right place", () => {
    expect(issueFix("sender_not_verified")).toEqual({ kind: "link", href: "/dashboard/email/senders" });
    expect(issueFix("balance_insufficient")).toEqual({ kind: "link", href: "/dashboard/balance" });
    expect(issueFix("document_invalid")).toEqual({ kind: "step", step: "content" });
    expect(issueFix("audience_empty")).toEqual({ kind: "step", step: "audience" });
  });
});

describe("issue helpers", () => {
  it("finds an issue by code", () => {
    expect(hasIssue([{ code: "sender_missing" }], "sender_missing")).toBe(true);
    expect(hasIssue([{ code: "sender_missing" }], "audience_empty")).toBe(false);
  });
});

describe("wizardStepOf", () => {
  it("falls back to content", () => {
    expect(wizardStepOf("review")).toBe("review");
    expect(wizardStepOf("nope")).toBe("content");
    expect(wizardStepOf(null)).toBe("content");
  });
});
