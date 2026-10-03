import { describe, expect, it } from "vitest";

import { buildDraft, emptyAdForm, emptyCard, emptyWizardForm, withDestination, withObjective, withParents, type ParentSummary, type WizardForm } from "./draft";
import type { AdObjectiveRoute, MetaAdDraft } from "./draft-types";
import { creativeSwapForm, draftMediaIds, draftPostRefs, formFromDraft } from "./editor-form";
import type { AdEditableObject, AdRow } from "./types";

const context = { timezone: "America/Sao_Paulo", currency: "BRL" };

const routes: AdObjectiveRoute[] = [
  { destination: "WEBSITE", goals: ["OFFSITE_CONVERSIONS", "VALUE"] },
  { destination: "WHATSAPP", goals: ["CONVERSATIONS"] },
];

const campaignParent: ParentSummary = { metaId: "c-1", name: "Campanha viva", objective: "OUTCOME_SALES", dailyBudget: 0, lifetimeBudget: 0 };
const fundedCampaign: ParentSummary = { ...campaignParent, dailyBudget: 5000 };
const adSetParent: ParentSummary = {
  metaId: "s-1",
  name: "Conjunto vivo",
  campaignId: "c-1",
  destination: "WHATSAPP",
  goal: "CONVERSATIONS",
  dailyBudget: 3000,
  lifetimeBudget: 0,
};

function newCampaignForm(): WizardForm {
  const base = withDestination(withObjective(emptyWizardForm("acc-1"), "OUTCOME_SALES", routes), "WHATSAPP", routes);
  return {
    ...base,
    campaignName: "Promo",
    pageId: "p1",
    instagramUserId: "ig-1",
    adSetName: "Conjunto",
    whatsAppNumber: "5511999990000",
    adSetBudget: { kind: "LIFETIME", input: "120,50" },
    adSetBid: { strategy: "COST_CAP", amountInput: "3,20", roasInput: "" },
    startMode: "date",
    startDay: "2026-11-01",
    endDay: "2026-11-30",
    scheduleOn: true,
    schedule: [{ days: [1, 2], startMinute: 480, endMinute: 1080 }],
    targeting: {
      ...base.targeting,
      locations: [{ kind: "city", key: "123", name: "Recife", radiusKm: 30 }],
      interests: [{ id: "i1", name: "Café" }],
      advantageAudience: false,
      ageMin: 21,
    },
    placements: { automatic: false, platforms: ["facebook"], positions: { facebook: ["feed"] }, devices: ["mobile"] },
    keepPaused: true,
    ads: [
      {
        ...emptyAdForm("a1"),
        name: "Imagem",
        primaryText: "Fale com a gente",
        headline: "Oferta",
        media: { kind: "image", mediaId: "m1", url: "https://cdn/m1.jpg" },
        greeting: "Oi!",
        iceBreakers: ["Preço?", "Entrega?"],
        enhancements: true,
      },
      {
        ...emptyAdForm("a2"),
        name: "Carrossel",
        format: "CAROUSEL",
        primaryText: "Veja",
        cards: [
          { ...emptyCard(), media: { kind: "image", mediaId: "m2", url: "https://cdn/m2.jpg" }, headline: "Um" },
          { ...emptyCard(), media: { kind: "video", mediaId: "m3", url: "https://cdn/m3.mp4" }, description: "Dois" },
        ],
      },
    ],
  };
}

function websiteForm(): WizardForm {
  const base = withObjective(emptyWizardForm("acc-1"), "OUTCOME_SALES", routes);
  return {
    ...base,
    campaignName: "Site",
    campaignBudgetOn: true,
    campaignBudget: { kind: "DAILY", input: "80" },
    campaignBid: { strategy: "LOWEST_COST_WITH_BID_CAP", amountInput: "2,00", roasInput: "" },
    pixelId: "px",
    pixelEvent: "PURCHASE",
    specialCategory: "HOUSING",
    targeting: { ...base.targeting, locations: [{ kind: "country", key: "BR", name: "Brasil" }] },
    ads: [
      {
        ...emptyAdForm("f1"),
        format: "FLEXIBLE",
        texts: ["Texto 1", "Texto 2"],
        headlines: ["Título"],
        medias: [{ kind: "image", mediaId: "m4", url: "https://cdn/m4.jpg" }],
        link: "https://loja.com",
        displayLink: "loja.com",
        callToAction: "SHOP_NOW",
      },
    ],
  };
}

function roundTrip(draft: MetaAdDraft, extra: Partial<Parameters<typeof formFromDraft>[1]> = {}): MetaAdDraft {
  return buildDraft(formFromDraft(draft, { ...context, ...extra }), context);
}

describe("formFromDraft", () => {
  it("rebuilds the same draft for a new campaign with messaging ads", () => {
    const draft = buildDraft(newCampaignForm(), context);
    expect(roundTrip(draft)).toEqual(draft);
  });

  it("rebuilds the same draft with a campaign budget, a pixel and a flexible ad", () => {
    const draft = buildDraft(websiteForm(), context);
    expect(roundTrip(draft)).toEqual(draft);
  });

  it("rebuilds an empty initial draft without inventing amounts", () => {
    const draft = buildDraft(withObjective(emptyWizardForm("acc-1"), "OUTCOME_SALES", routes), context);
    const form = formFromDraft(draft, context);
    expect(form.adSetBudget.input).toBe("");
    expect(form.campaignName).toBe("");
    expect(roundTrip(draft)).toEqual(draft);
  });

  it("rebuilds a new ad set inside an existing campaign", () => {
    const base = withDestination(withParents(emptyWizardForm("acc-1"), fundedCampaign, null), "WHATSAPP", routes);
    const draft = buildDraft({ ...base, adSetName: "Novo", pageId: "p1", ads: [{ ...emptyAdForm("x"), primaryText: "Oi" }] }, context);
    const form = formFromDraft(draft, { ...context, campaignParent: fundedCampaign });
    expect(form.mode).toBe("campaign");
    expect(form.campaignParent).toEqual(fundedCampaign);
    expect(draft.adSet.budget).toBeUndefined();
    expect(buildDraft(form, context)).toEqual(draft);
  });

  it("rebuilds new ads inside an existing ad set", () => {
    const base = withParents(emptyWizardForm("acc-1"), campaignParent, adSetParent);
    const draft = buildDraft({ ...base, pageId: "p1", ads: [{ ...emptyAdForm("x"), primaryText: "Oi" }] }, context);
    const form = formFromDraft(draft, { ...context, campaignParent, adSetParent });
    expect(form.mode).toBe("adSet");
    expect(form.adSetParent?.metaId).toBe("s-1");
    expect(buildDraft(form, context)).toEqual(draft);
  });

  it("keeps the existing ids when the parents could not be resolved", () => {
    const base = withParents(emptyWizardForm("acc-1"), campaignParent, adSetParent);
    const draft = buildDraft(base, context);
    const form = formFromDraft(draft, context);
    expect(form.campaignParent).toMatchObject({ metaId: "c-1", name: "" });
    expect(form.adSetParent).toMatchObject({ metaId: "s-1", name: "" });
    expect(buildDraft(form, context)).toEqual(draft);
  });

  it("fills media previews from the resolved urls", () => {
    const draft = buildDraft(newCampaignForm(), context);
    const form = formFromDraft(draft, { ...context, mediaUrls: { m1: "https://x/1.jpg", m2: "https://x/2.jpg" } });
    expect(form.ads[0].media).toEqual({ kind: "image", mediaId: "m1", url: "https://x/1.jpg" });
    expect(form.ads[1].cards[0].media?.url).toBe("https://x/2.jpg");
    expect(form.ads[1].cards[1].media).toEqual({ kind: "video", mediaId: "m3", url: "" });
  });

  it("gives every ad its own id", () => {
    const form = formFromDraft(buildDraft(newCampaignForm(), context), context);
    expect(new Set(form.ads.map((ad) => ad.id)).size).toBe(2);
  });
});

describe("draftMediaIds", () => {
  it("lists every media of every ad once", () => {
    expect(draftMediaIds(buildDraft(newCampaignForm(), context))).toEqual(["m1", "m2", "m3"]);
    expect(draftMediaIds(buildDraft(websiteForm(), context))).toEqual(["m4"]);
  });

  it("skips empty media slots", () => {
    expect(draftMediaIds(buildDraft(emptyWizardForm("acc-1"), context))).toEqual([]);
  });
});

describe("existing posts", () => {
  const postDraft = () => {
    const draft = buildDraft(newCampaignForm(), context);
    draft.ads = [
      { name: "A", creative: { format: "EXISTING_POST", postId: "page-1_9" } },
      { name: "B", creative: { format: "EXISTING_POST", instagramMediaId: "m-7" } },
      { name: "C", creative: { format: "EXISTING_POST", postId: "page-1_9" } },
    ];
    return draft;
  };

  it("lists each post once with its platform", () => {
    expect(draftPostRefs(postDraft())).toEqual([
      { id: "page-1_9", platform: "facebook" },
      { id: "m-7", platform: "instagram" },
    ]);
  });

  it("shows the post's picture and text in the preview when it was found", () => {
    const form = formFromDraft(postDraft(), {
      ...context,
      posts: { "page-1_9": { id: "page-1_9", platform: "facebook", message: "Promo de inverno", pictureUrl: "https://pic" } },
    });
    expect(form.ads[0].post).toEqual({ id: "page-1_9", platform: "facebook", message: "Promo de inverno", pictureUrl: "https://pic" });
    expect(form.ads[1].post).toEqual({ id: "m-7", platform: "instagram", message: undefined, pictureUrl: undefined });
  });
});

describe("creativeSwapForm", () => {
  const adSetRow = { metaId: "s-1", level: "adset", name: "Conjunto", campaignId: "c-1", destinationType: "WHATSAPP", optimizationGoal: "CONVERSATIONS", dailyBudget: 0, lifetimeBudget: 0 } as AdRow;
  const campaignRow = { metaId: "c-1", level: "campaign", name: "Campanha", objective: "OUTCOME_LEADS", dailyBudget: 1000, lifetimeBudget: 0 } as AdRow;
  const detail: AdEditableObject = {
    row: { metaId: "a-1", level: "ad", name: "Anúncio", creative: { imageUrl: "https://cdn/a.jpg" } } as AdRow,
    budget: null,
    bid: null,
    targeting: null,
    placements: null,
    schedule: null,
    creative: { format: "IMAGE", primaryText: "Oi", media: { kind: "image", mediaId: "m9" } },
    identity: { pageId: "p1", instagramUserId: "ig" },
  };

  it("opens the live ad as a single creative to swap", () => {
    const form = creativeSwapForm(detail, "acc-1", campaignRow, adSetRow);
    expect(form).toMatchObject({ mode: "creative", editAdId: "a-1", pageId: "p1", instagramUserId: "ig", destination: "WHATSAPP", objective: "OUTCOME_LEADS" });
    expect(form?.ads[0]).toMatchObject({ name: "Anúncio", primaryText: "Oi", media: { kind: "image", mediaId: "m9", url: "https://cdn/a.jpg" } });
  });

  it("refuses an ad whose creative Meta did not return", () => {
    expect(creativeSwapForm({ ...detail, creative: null }, "acc-1", campaignRow, adSetRow)).toBeNull();
  });
});
