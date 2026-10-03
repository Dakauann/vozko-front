import { describe, expect, it } from "vitest";

import { buildDraft, emptyWizardForm } from "./draft";
import { draftEditable, draftStatus, saveFailure, validationKey } from "./editor-status";

describe("draftStatus", () => {
  it("reads the saved state when no job is followed", () => {
    expect(draftStatus("editing", null)).toBe("draft");
    expect(draftStatus("publishing", null)).toBe("publishing");
    expect(draftStatus("failed", null)).toBe("failed");
  });

  it("follows the job once there is one", () => {
    expect(draftStatus("editing", { status: "RUNNING" })).toBe("publishing");
    expect(draftStatus("publishing", { status: "FAILED" })).toBe("failed");
    expect(draftStatus("publishing", { status: "NEEDS_REVIEW" })).toBe("failed");
    expect(draftStatus("publishing", { status: "PUBLISHED" })).toBe("publishing");
  });

  it("treats an unknown state as publishing, so nothing is edited by mistake", () => {
    expect(draftStatus("archived", null)).toBe("publishing");
  });
});

describe("draftEditable", () => {
  it("allows edits only on a draft or a failed publish", () => {
    expect(draftEditable("editing", null)).toBe(true);
    expect(draftEditable("failed", null)).toBe(true);
    expect(draftEditable("publishing", null)).toBe(false);
    expect(draftEditable("editing", { status: "QUEUED" })).toBe(false);
    expect(draftEditable("other", null)).toBe(false);
  });
});

describe("saveFailure", () => {
  it("names the two conflicts the server reports", () => {
    expect(saveFailure({ code: "draft_changed", status: 409 })).toBe("changed");
    expect(saveFailure({ code: "draft_publishing", status: 409 })).toBe("publishing");
    expect(saveFailure({ code: "invalid", status: 422 })).toBe("other");
    expect(saveFailure({})).toBe("other");
  });
});

describe("validationKey", () => {
  it("ignores the paused switch, which does not change what Meta checks", () => {
    const draft = buildDraft(emptyWizardForm("acc-1"), { timezone: "UTC", currency: "BRL" });
    expect(validationKey({ ...draft, keepPaused: true })).toBe(validationKey(draft));
    expect(validationKey({ ...draft, adAccountId: "acc-2" })).not.toBe(validationKey(draft));
  });
});
