import { describe, expect, it } from "vitest";

import { groupTargets } from "@/lib/unofficial-whatsapp-campaigns/group-audience";

import { campaignPipelineId, hasExternalPick, pickedFromGroup } from "./group-picks";

describe("pickedFromGroup", () => {
  it("keeps the origin next to what the campaign targets need", () => {
    expect(pickedFromGroup({ id: "g-1", jid: "g-1@g.us", subject: "Vendas", origin: "external" })).toEqual({
      id: "g-1",
      jid: "g-1@g.us",
      subject: "Vendas",
      origin: "external",
    });
  });

  it("still builds the same targets as before", () => {
    const picked = [pickedFromGroup({ id: "g-1", jid: "g-1@g.us", subject: "Vendas", origin: "managed" })];
    expect(groupTargets(picked)).toEqual([{ groupJid: "g-1@g.us", name: "Vendas" }]);
  });
});

describe("hasExternalPick", () => {
  it("is true when any picked group is external", () => {
    expect(hasExternalPick([{ id: "a", jid: "a@g.us", subject: "A", origin: "managed" }])).toBe(false);
    expect(
      hasExternalPick([
        { id: "a", jid: "a@g.us", subject: "A", origin: "managed" },
        { id: "b", jid: "b@g.us", subject: "B", origin: "external" },
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
