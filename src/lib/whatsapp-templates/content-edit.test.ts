import { describe, expect, it } from "vitest";

import { CONTENT_EDIT_CATEGORIES, categoryLockedOnEdit, contentEditable } from "./content-edit";
import { templateExitMissing, type ExitVerdict } from "./exit";

describe("contentEditable", () => {
  it("opens approved, rejected and paused templates", () => {
    for (const status of ["APPROVED", "REJECTED", "PAUSED"] as const) {
      expect(contentEditable({ status, category: "MARKETING" })).toBe(true);
    }
  });

  it("keeps pending and disabled templates closed", () => {
    expect(contentEditable({ status: "PENDING", category: "UTILITY" })).toBe(false);
    expect(contentEditable({ status: "DISABLED", category: "UTILITY" })).toBe(false);
  });

  it("never opens an authentication template", () => {
    expect(contentEditable({ status: "APPROVED", category: "AUTHENTICATION" })).toBe(false);
  });
});

describe("categoryLockedOnEdit", () => {
  it("locks the category only while the template is approved", () => {
    expect(categoryLockedOnEdit("APPROVED")).toBe(true);
    expect(categoryLockedOnEdit("REJECTED")).toBe(false);
    expect(categoryLockedOnEdit("PAUSED")).toBe(false);
  });

  it("never offers authentication", () => {
    expect(CONTENT_EDIT_CATEGORIES).not.toContain("AUTHENTICATION");
  });
});

describe("templateExitMissing", () => {
  const verdict = (state: ExitVerdict["state"], templateExitRequired: boolean): ExitVerdict => ({
    state,
    templateExitRequired,
    campaignAcknowledgementRequired: true,
    buttons: [],
    exitWords: [],
  });

  it("is true only when the server requires an exit the draft does not show", () => {
    expect(templateExitMissing(verdict("none", true))).toBe(true);
    expect(templateExitMissing(verdict("none", false))).toBe(false);
    expect(templateExitMissing(verdict("ok", true))).toBe(false);
  });
});
