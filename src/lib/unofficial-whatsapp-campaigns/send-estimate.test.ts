import { describe, expect, it } from "vitest";

import type { UnofficialWhatsAppCampaign } from "./types";
import { anyCampaignRunning, campaignTarget, remainingToShow, sendTimeParts } from "./send-estimate";

function campaign(patch: Partial<UnofficialWhatsAppCampaign>): UnofficialWhatsAppCampaign {
  return { id: "c", status: "STOPPED", audience: "leads", metrics: { totalNumbers: 0 }, ...patch } as UnofficialWhatsAppCampaign;
}

describe("sendTimeParts", () => {
  it("rounds up to whole minutes and splits hours", () => {
    expect(sendTimeParts(0)).toEqual({ key: "underMinute" });
    expect(sendTimeParts(45)).toEqual({ key: "underMinute" });
    expect(sendTimeParts(61)).toEqual({ key: "minutes", minutes: 2 });
    expect(sendTimeParts(3600)).toEqual({ key: "hours", hours: 1, minutes: 0 });
    expect(sendTimeParts(5400 + 30)).toEqual({ key: "hours", hours: 1, minutes: 31 });
  });
});

describe("remainingToShow", () => {
  it("shows what is left only while the campaign runs and something is pending", () => {
    const estimate = { seconds: 600, pending: 20, senders: 2, unsendable: 0 };
    expect(remainingToShow(campaign({ status: "RUNNING", estimate }))).toEqual(estimate);
    expect(remainingToShow(campaign({ status: "PAUSED", estimate }))).toBeNull();
    expect(remainingToShow(campaign({ status: "RUNNING", estimate: { ...estimate, pending: 0 } }))).toBeNull();
    expect(remainingToShow(campaign({ status: "RUNNING" }))).toBeNull();
  });
});

describe("campaignTarget", () => {
  it("names the first groups of a group campaign and counts the rest", () => {
    expect(campaignTarget(campaign({ audience: "groups", targetNames: ["Vila", "Centro", "Praia"], metrics: { totalNumbers: 7 } as UnofficialWhatsAppCampaign["metrics"] }))).toEqual({
      kind: "groups",
      names: ["Vila", "Centro", "Praia"],
      more: 4,
    });
  });

  it("counts the people of a person campaign", () => {
    expect(campaignTarget(campaign({ metrics: { totalNumbers: 30 } as UnofficialWhatsAppCampaign["metrics"] }))).toEqual({ kind: "leads", count: 30 });
  });

  it("never counts a negative rest", () => {
    expect(campaignTarget(campaign({ audience: "groups", targetNames: ["Vila"] }))).toEqual({ kind: "groups", names: ["Vila"], more: 0 });
  });
});

describe("anyCampaignRunning", () => {
  it("is true while any listed campaign runs", () => {
    expect(anyCampaignRunning([campaign({}), campaign({ status: "RUNNING" })])).toBe(true);
    expect(anyCampaignRunning([campaign({ status: "PAUSED" }), campaign({ status: "COMPLETED" })])).toBe(false);
    expect(anyCampaignRunning([])).toBe(false);
  });
});
