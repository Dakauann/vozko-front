import { afterEach, describe, expect, it } from "vitest";

import { emptyWizardForm } from "./draft";
import { clearWizard, parseStoredWizard, readWizard, serializeWizard, storedMatchesEntry, writeWizard } from "./wizard-storage";

describe("wizard storage", () => {
  afterEach(() => window.localStorage.clear());

  it("round trips the form and step", () => {
    const form = { ...emptyWizardForm("acc"), campaignName: "Promo" };
    writeWizard("ws1", form, "adSet");
    const stored = readWizard("ws1");
    expect(stored?.form.campaignName).toBe("Promo");
    expect(stored?.step).toBe("adSet");
    expect(readWizard("ws2")).toBeNull();
    clearWizard("ws1");
    expect(readWizard("ws1")).toBeNull();
  });

  it("rejects broken or old payloads", () => {
    expect(parseStoredWizard("{")).toBeNull();
    expect(parseStoredWizard(JSON.stringify({ version: 1, form: {} }))).toBeNull();
    expect(parseStoredWizard(JSON.stringify({ version: 2, form: { accountId: 1 } }))).toBeNull();
  });

  it("fills missing fields from the empty form", () => {
    const raw = JSON.stringify({
      version: 2,
      step: "nope",
      form: { accountId: "a", ads: [{ id: "x", name: "N" }], targeting: { locations: [] } },
    });
    const stored = parseStoredWizard(raw);
    expect(stored?.step).toBe("objective");
    expect(stored?.form.ads[0]).toMatchObject({ id: "x", name: "N", format: "IMAGE", cards: expect.any(Array) });
    expect(stored?.form.placements).toEqual({ automatic: true });
  });

  it("matches the stored draft against the manager entry", () => {
    const stored = parseStoredWizard(serializeWizard(emptyWizardForm("a"), "ads", new Date()))!;
    expect(storedMatchesEntry(stored, { accountId: null, adId: null, campaignId: null, adSetId: null })).toBe(true);
    expect(storedMatchesEntry(stored, { accountId: "a", adId: null, campaignId: null, adSetId: null })).toBe(true);
    expect(storedMatchesEntry(stored, { accountId: "b", adId: null, campaignId: null, adSetId: null })).toBe(false);
    expect(storedMatchesEntry(stored, { accountId: "a", adId: null, campaignId: "c", adSetId: null })).toBe(false);
    const editing = parseStoredWizard(serializeWizard({ ...emptyWizardForm("a"), mode: "creative", editAdId: "ad1" }, "ads", new Date()))!;
    expect(storedMatchesEntry(editing, { accountId: "a", adId: "ad1", campaignId: null, adSetId: null })).toBe(true);
    expect(storedMatchesEntry(editing, { accountId: "a", adId: null, campaignId: null, adSetId: null })).toBe(false);
    expect(storedMatchesEntry(stored, { accountId: "a", adId: "ad1", campaignId: null, adSetId: null })).toBe(false);
  });
});
