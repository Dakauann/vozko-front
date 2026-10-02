import { describe, expect, it } from "vitest";

import {
  conversionStatusKey,
  emptySettings,
  eventKey,
  knownReason,
  sameSettings,
  settingsForAccount,
  settingsProblems,
} from "./conversions";

describe("record labels", () => {
  it("recognises the backend skip reasons only", () => {
    expect(knownReason("too_old")).toBe("too_old");
    expect(knownReason("graph error 100")).toBeNull();
    expect(knownReason(undefined)).toBeNull();
  });

  it("maps statuses and event names", () => {
    expect(conversionStatusKey("failed")).toBe("failed");
    expect(conversionStatusKey("queued")).toBe("unknown");
    expect(eventKey("LeadSubmitted")).toBe("lead");
    expect(eventKey("Purchase")).toBe("purchase");
    expect(eventKey("Other")).toBe("other");
  });
});

describe("settingsForAccount", () => {
  it("starts disabled with both events when nothing was saved", () => {
    expect(settingsForAccount(null, "acc")).toEqual({ adAccountId: "acc", sendLeads: true, sendPurchases: true, enabled: false });
  });

  it("keeps saved choices and points them at the chosen account", () => {
    const saved = { ...emptySettings("old"), enabled: true, pixelId: "p1" };
    expect(settingsForAccount(saved, "new")).toMatchObject({ adAccountId: "new", enabled: true, pixelId: "p1" });
  });
});

describe("settingsProblems", () => {
  it("mirrors the backend validation", () => {
    expect(settingsProblems({ ...emptySettings("a"), enabled: false })).toEqual([]);
    expect(settingsProblems({ ...emptySettings("a"), enabled: true })).toEqual(["needs_target"]);
    expect(settingsProblems({ ...emptySettings("a"), enabled: true, datasetId: "d", sendLeads: false, sendPurchases: false })).toEqual([
      "nothing_to_send",
    ]);
  });
});

describe("sameSettings", () => {
  it("treats missing and empty ids as equal", () => {
    expect(sameSettings({ ...emptySettings("a"), pixelId: "" }, emptySettings("a"))).toBe(true);
    expect(sameSettings(emptySettings("a"), { ...emptySettings("a"), sendLeads: false })).toBe(false);
  });
});
