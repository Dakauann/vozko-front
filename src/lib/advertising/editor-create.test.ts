import { describe, expect, it } from "vitest";

import { buildDraft, type ParentSummary } from "./draft";
import type { AdObjectiveRoute } from "./draft-types";
import { choiceObjective, createdLevels, initialForm, type CreateNames } from "./editor-create";

const context = { timezone: "America/Sao_Paulo", currency: "BRL" };
const names: CreateNames = { campaign: "Nova campanha de Leads" };
const leadRoutes: AdObjectiveRoute[] = [
  { destination: "ON_AD", goals: ["LEAD_GENERATION", "QUALITY_LEAD"] },
  { destination: "WHATSAPP", goals: ["CONVERSATIONS"] },
];
const campaign: ParentSummary = { metaId: "c-1", name: "Campanha viva", objective: "OUTCOME_LEADS", dailyBudget: 0, lifetimeBudget: 0 };
const adSet: ParentSummary = {
  metaId: "s-1",
  name: "Conjunto vivo",
  campaignId: "c-1",
  destination: "WHATSAPP",
  goal: "CONVERSATIONS",
  dailyBudget: 2000,
  lifetimeBudget: 0,
};

describe("initialForm", () => {
  it("names only the campaign and leaves the optional names empty for their fallback", () => {
    const form = initialForm("acc-1", { kind: "new", objective: "OUTCOME_LEADS" }, leadRoutes, names);
    const draft = buildDraft(form, context);
    expect(draft.adAccountId).toBe("acc-1");
    expect(draft.campaign).toMatchObject({ name: names.campaign, objective: "OUTCOME_LEADS", specialCategory: "NONE" });
    expect(draft.campaign.existingId).toBeUndefined();
    expect(draft.adSet).toMatchObject({ destination: "ON_AD", goal: "LEAD_GENERATION" });
    expect(draft.adSet.name).toBeUndefined();
    expect(draft.ads).toHaveLength(1);
    expect(draft.ads[0].name).toBeUndefined();
  });

  it("adds a new ad set and ad to an existing campaign", () => {
    const form = initialForm("acc-1", { kind: "existing", campaign, adSet: null }, leadRoutes, names);
    const draft = buildDraft(form, context);
    expect(form.mode).toBe("campaign");
    expect(draft.campaign).toEqual({ existingId: "c-1", objective: "OUTCOME_LEADS" });
    expect(draft.adSet).toMatchObject({ destination: "ON_AD", goal: "LEAD_GENERATION" });
    expect(draft.adSet.existingId).toBeUndefined();
    expect(draft.adSet.name).toBeUndefined();
    expect(draft.ads[0].name).toBeUndefined();
  });

  it("adds a new ad to an existing ad set", () => {
    const form = initialForm("acc-1", { kind: "existing", campaign, adSet }, leadRoutes, names);
    const draft = buildDraft(form, context);
    expect(form.mode).toBe("adSet");
    expect(draft.campaign.existingId).toBe("c-1");
    expect(draft.adSet).toMatchObject({ existingId: "s-1", destination: "WHATSAPP", goal: "CONVERSATIONS" });
    expect(draft.ads[0].name).toBeUndefined();
  });
});

describe("create choice", () => {
  it("names the objective the draft is created for", () => {
    expect(choiceObjective({ kind: "new", objective: "OUTCOME_SALES" })).toBe("OUTCOME_SALES");
    expect(choiceObjective({ kind: "existing", campaign, adSet: null })).toBe("OUTCOME_LEADS");
    expect(choiceObjective({ kind: "existing", campaign: { ...campaign, objective: "LINK_CLICKS" }, adSet: null })).toBeNull();
  });

  it("lists the levels the draft creates", () => {
    expect(createdLevels({ kind: "new", objective: "OUTCOME_SALES" })).toEqual(["campaign", "adSet", "ad"]);
    expect(createdLevels({ kind: "existing", campaign, adSet: null })).toEqual(["adSet", "ad"]);
    expect(createdLevels({ kind: "existing", campaign, adSet })).toEqual(["ad"]);
  });
});
