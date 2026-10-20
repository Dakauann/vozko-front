import { describe, expect, it } from "vitest";

import { groupTargets } from "@/lib/unofficial-whatsapp-campaigns/group-audience";

import { campaignPipelineId, hasExternalPick, pickedFromGroup, pickedInRunningCampaigns } from "./group-picks";

describe("pickedFromGroup", () => {
  it("keeps the origin and the running campaigns next to what the campaign targets need", () => {
    expect(pickedFromGroup({ id: "g-1", jid: "g-1@g.us", subject: "Vendas", origin: "external" }, 2)).toEqual({
      id: "g-1",
      jid: "g-1@g.us",
      subject: "Vendas",
      origin: "external",
      runningCampaigns: 2,
    });
  });

  it("still builds the same targets as before", () => {
    const picked = [pickedFromGroup({ id: "g-1", jid: "g-1@g.us", subject: "Vendas", origin: "managed" })];
    expect(groupTargets(picked)).toEqual([{ groupJid: "g-1@g.us", name: "Vendas" }]);
  });
});

describe("pickedInRunningCampaigns", () => {
  it("counts the picked groups another running campaign already targets", () => {
    const picked = [
      pickedFromGroup({ id: "a", jid: "a@g.us", subject: "A", origin: "managed" }, 1),
      pickedFromGroup({ id: "b", jid: "b@g.us", subject: "B", origin: "managed" }),
      pickedFromGroup({ id: "c", jid: "c@g.us", subject: "C", origin: "managed" }, 3),
    ];
    expect(pickedInRunningCampaigns(picked)).toBe(2);
    expect(pickedInRunningCampaigns([])).toBe(0);
  });
});

describe("hasExternalPick", () => {
  it("is true when any picked group is external", () => {
    expect(hasExternalPick([{ id: "a", jid: "a@g.us", subject: "A", origin: "managed", runningCampaigns: 0 }])).toBe(false);
    expect(
      hasExternalPick([
        { id: "a", jid: "a@g.us", subject: "A", origin: "managed", runningCampaigns: 0 },
        { id: "b", jid: "b@g.us", subject: "B", origin: "external", runningCampaigns: 0 },
      ]),
    ).toBe(true);
    expect(hasExternalPick([])).toBe(false);
  });
});

describe("campaignPipelineId", () => {
  it("never sends a funnel for a groups campaign", () => {
    expect(campaignPipelineId(true, "p-1")).toBeNull();
  });

  it("sends the chosen funnel for a leads campaign, or none when left on the default", () => {
    expect(campaignPipelineId(false, "p-1")).toBe("p-1");
    expect(campaignPipelineId(false, "")).toBeNull();
  });
});
