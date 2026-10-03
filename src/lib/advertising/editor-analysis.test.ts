import { describe, expect, it } from "vitest";

import { emptyAdForm, emptyWizardForm, type ParentSummary, type WizardForm } from "./draft";
import { draftAnalysis, objectAnalysis, type AnalysisSection } from "./editor-analysis";
import { AD_SET_NODE, CAMPAIGN_NODE, adNode } from "./editor-tree";
import type { AdEditableObject, AdRow } from "./types";

function form(changes: Partial<WizardForm> = {}): WizardForm {
  return {
    ...emptyWizardForm("acc-1"),
    objective: "OUTCOME_LEADS",
    campaignName: " Nova campanha de Leads ",
    adSetName: "Conjunto",
    destination: "WHATSAPP",
    goal: "CONVERSATIONS",
    whatsAppNumber: "5511999990000",
    adSetBudget: { kind: "DAILY", input: "50" },
    targeting: { ...emptyWizardForm().targeting, locations: [{ kind: "country", key: "BR", name: "Brasil" }] },
    ads: [{ ...emptyAdForm("a1"), name: "Anúncio", primaryText: "Fale com a gente", greeting: "Oi" }],
    ...changes,
  };
}

function values(section: AnalysisSection): Record<string, unknown> {
  return Object.fromEntries(section.facts.map((item) => [item.key, item.value]));
}

describe("draftAnalysis", () => {
  it("summarises the campaign of a new draft like Meta's Analisar", () => {
    const [campaign] = draftAnalysis(form(), "BRL", "Loja");
    expect(campaign.node).toEqual(CAMPAIGN_NODE);
    expect(values(campaign)).toEqual({
      campaignName: { kind: "text", text: "Nova campanha de Leads" },
      buyingType: { kind: "label", group: "buyingType", value: "AUCTION" },
      objective: { kind: "label", group: "objective", value: "OUTCOME_LEADS" },
      specialCategory: { kind: "label", group: "category", value: "NONE" },
      budgetStrategy: { kind: "label", group: "budgetStrategy", value: "adSet" },
    });
  });

  it("shows the campaign budget when the campaign holds it", () => {
    const [campaign, adSet] = draftAnalysis(
      form({ campaignBudgetOn: true, campaignBudget: { kind: "LIFETIME", input: "300" } }),
      "BRL",
      "",
    );
    expect(values(campaign).budget).toEqual({ kind: "budget", budget: { kind: "LIFETIME", amount: 30000 } });
    expect(values(campaign).bidStrategy).toEqual({ kind: "label", group: "bidStrategy", value: "LOWEST_COST_WITHOUT_CAP" });
    expect(values(adSet).budget).toEqual({ kind: "budgetElsewhere", place: "campaign" });
  });

  it("summarises the ad set with budget, audience and placements", () => {
    const adSet = draftAnalysis(form(), "BRL", "")[1];
    expect(adSet.node).toEqual(AD_SET_NODE);
    const facts = values(adSet);
    expect(facts.whatsAppNumber).toEqual({ kind: "text", text: "5511999990000" });
    expect(facts.budget).toEqual({ kind: "budget", budget: { kind: "DAILY", amount: 5000 } });
    expect(facts.locations).toEqual({ kind: "list", items: ["Brasil"] });
    expect(facts.ages).toEqual({ kind: "ages", min: 18, max: 65, advantage: true });
    expect(facts.languages).toEqual({ kind: "empty" });
    expect(facts.placements).toEqual({ kind: "placements", platforms: null });
    expect(facts.schedule).toEqual({ kind: "dates", startDay: "", endDay: "", hours: false });
  });

  it("marks an empty budget as missing instead of zero", () => {
    expect(values(draftAnalysis(form({ adSetBudget: { kind: "DAILY", input: "" } }), "BRL", "")[1]).budget).toEqual({ kind: "empty" });
  });

  it("summarises every ad with its page and creative", () => {
    const sections = draftAnalysis(form({ ads: [form().ads[0], { ...emptyAdForm("a2"), name: "" }] }), "BRL", "Loja");
    expect(sections.map((section) => section.node)).toEqual([CAMPAIGN_NODE, AD_SET_NODE, adNode(0), adNode(1)]);
    expect(values(sections[2])).toEqual({
      adName: { kind: "text", text: "Anúncio" },
      page: { kind: "text", text: "Loja" },
      format: { kind: "label", group: "format", value: "IMAGE" },
      primaryText: { kind: "text", text: "Fale com a gente" },
      headline: { kind: "empty" },
      callToAction: { kind: "label", group: "callToAction", value: "WHATSAPP_MESSAGE" },
      greeting: { kind: "text", text: "Oi" },
    });
    expect(values(sections[3]).adName).toEqual({ kind: "empty" });
  });

  it("names the existing parents and where their budget lives", () => {
    const campaign: ParentSummary = { metaId: "c1", name: "Viva", objective: "OUTCOME_LEADS", dailyBudget: 1000, lifetimeBudget: 0 };
    const adSet: ParentSummary = { metaId: "s1", name: "Conjunto vivo", dailyBudget: 0, lifetimeBudget: 0 };
    const [first, second] = draftAnalysis(form({ mode: "adSet", campaignParent: campaign, adSetParent: adSet }), "BRL", "");
    expect(values(first)).toEqual({
      campaignName: { kind: "text", text: "Viva" },
      objective: { kind: "label", group: "objective", value: "OUTCOME_LEADS" },
    });
    expect(values(second)).toMatchObject({ adSetName: { kind: "text", text: "Conjunto vivo" }, budget: { kind: "budgetElsewhere", place: "existingAdSet" } });
    expect(values(second).locations).toBeUndefined();
    const [, ownSet] = draftAnalysis(form({ mode: "campaign", campaignParent: campaign }), "BRL", "");
    expect(values(ownSet).budget).toEqual({ kind: "budgetElsewhere", place: "existingCampaign" });
  });
});

describe("objectAnalysis", () => {
  const base = { budget: null, bid: null, targeting: null, placements: null, schedule: null, creative: null, identity: null };

  it("summarises a live ad set", () => {
    const detail: AdEditableObject = {
      ...base,
      row: { metaId: "s1", level: "adset", name: "Conjunto", destinationType: "WHATSAPP", optimizationGoal: "CONVERSATIONS", endTime: "2026-12-01T03:00:00Z" } as AdRow,
      budget: { kind: "DAILY", amount: 2500 },
      bid: { strategy: "COST_CAP", amount: 300 },
      targeting: { locations: [{ kind: "city", key: "1", name: "Recife" }], ageMin: 21, ageMax: 40, advantageAudience: false },
      placements: { automatic: false, platforms: ["instagram"] },
    };
    expect(Object.fromEntries(objectAnalysis(detail, "America/Sao_Paulo").map((item) => [item.key, item.value]))).toMatchObject({
      name: { kind: "text", text: "Conjunto" },
      destination: { kind: "label", group: "destination", value: "WHATSAPP" },
      budget: { kind: "budget", budget: { kind: "DAILY", amount: 2500 } },
      bidStrategy: { kind: "label", group: "bidStrategy", value: "COST_CAP" },
      schedule: { kind: "dates", startDay: "", endDay: "2026-11-30", hours: false },
      locations: { kind: "list", items: ["Recife"] },
      placements: { kind: "placements", platforms: ["instagram"] },
    });
  });

  it("summarises a live ad from its creative", () => {
    const detail: AdEditableObject = {
      ...base,
      row: { metaId: "a1", level: "ad", name: "Anúncio", destinationType: "WEBSITE" } as AdRow,
      creative: { format: "IMAGE", primaryText: "Compre", link: "https://loja.com", callToAction: "SHOP_NOW" },
    };
    const keys = objectAnalysis(detail, "UTC").map((item) => item.key);
    expect(keys).toEqual(["name", "format", "primaryText", "headline", "callToAction", "link"]);
  });
});
