import { describe, expect, it } from "vitest";

import {
  adFormFromCreative,
  ageMinOptions,
  bidFromInput,
  bidStrategiesFor,
  buildCreative,
  buildDraft,
  campaignBudgetActive,
  cleanPlacements,
  draftFeeTotal,
  duplicateAd,
  emptyAdForm,
  emptyWizardForm,
  parseRoas,
  scheduleAvailable,
  withAdvantageAudience,
  withCreativeEdit,
  withDestination,
  withObjective,
  withParents,
  withSpecialCategory,
  type WizardForm,
} from "./draft";
import type { AdObjectiveRoute } from "./draft-types";

const context = { timezone: "America/Sao_Paulo", currency: "BRL" };

const salesRoutes: AdObjectiveRoute[] = [
  { destination: "WEBSITE", goals: ["OFFSITE_CONVERSIONS", "VALUE"] },
  { destination: "WHATSAPP", goals: ["CONVERSATIONS"] },
];

function whatsappForm(): WizardForm {
  const form = withObjective(emptyWizardForm("acc-1"), "OUTCOME_SALES", salesRoutes);
  return {
    ...withDestination(form, "WHATSAPP", salesRoutes),
    campaignName: "Promo",
    pageId: "p1",
    whatsAppNumber: "+55 (11) 99999-0000",
    adSetBudget: { kind: "DAILY", input: "25,50" },
    targeting: { ...form.targeting, locations: [{ kind: "country", key: "BR", name: "Brasil" }] },
    ads: [{ ...emptyAdForm("a1"), primaryText: " Fale com a gente ", media: { kind: "image", mediaId: "m1", url: "u" } }],
  };
}

describe("withObjective and withDestination", () => {
  it("picks the first route and goal for the objective", () => {
    const form = withObjective(emptyWizardForm(), "OUTCOME_SALES", salesRoutes);
    expect(form.destination).toBe("WEBSITE");
    expect(form.goal).toBe("OFFSITE_CONVERSIONS");
  });

  it("keeps a goal that the new destination still allows", () => {
    const form = { ...emptyWizardForm(), objective: "OUTCOME_SALES" as const, destination: "WEBSITE" as const, goal: "VALUE" as const };
    expect(withDestination(form, "WEBSITE", salesRoutes).goal).toBe("VALUE");
    expect(withDestination(form, "WHATSAPP", salesRoutes).goal).toBe("CONVERSATIONS");
  });

  it("moves ads to a format the destination accepts", () => {
    const form = withDestination(emptyWizardForm(), "CATALOG", [{ destination: "CATALOG", goals: ["VALUE"] }]);
    expect(form.ads[0].format).toBe("CATALOG");
  });
});

describe("audience rules", () => {
  it("locks ages, genders and exclusions for special categories", () => {
    const form = emptyWizardForm();
    form.targeting = {
      ...form.targeting,
      ageMin: 30,
      ageMax: 40,
      genders: [1],
      locations: [{ kind: "city", key: "c", name: "Campinas", radiusKm: 17 }],
      excludedLocations: [{ kind: "country", key: "AR", name: "Argentina" }],
      excludedCustomAudiences: [{ id: "x", name: "X" }],
    };
    const next = withSpecialCategory(form, "HOUSING");
    expect(next.targeting).toMatchObject({
      ageMin: 18,
      ageMax: 65,
      genders: undefined,
      excludedLocations: undefined,
      excludedCustomAudiences: undefined,
    });
    expect(next.targeting.locations[0].radiusKm).toBe(25);
  });

  it("clamps ages when Advantage+ audience is turned on", () => {
    const targeting = { ...emptyWizardForm().targeting, advantageAudience: false, ageMin: 40, ageMax: 50 };
    expect(withAdvantageAudience(targeting, true)).toMatchObject({ advantageAudience: true, ageMin: 25, ageMax: 65 });
    expect(ageMinOptions({ ...targeting, advantageAudience: true }, "NONE")).toEqual([18, 19, 20, 21, 22, 23, 24, 25]);
    expect(ageMinOptions(targeting, "NONE")[0]).toBe(13);
  });
});

describe("budget and bid", () => {
  it("offers ROAS only on the ad set with a value goal", () => {
    expect(bidStrategiesFor("campaign", "VALUE")).not.toContain("LOWEST_COST_WITH_MIN_ROAS");
    expect(bidStrategiesFor("adSet", "OFFSITE_CONVERSIONS")).not.toContain("LOWEST_COST_WITH_MIN_ROAS");
    expect(bidStrategiesFor("adSet", "VALUE")).toContain("LOWEST_COST_WITH_MIN_ROAS");
  });

  it("converts bid inputs into minor units or a ROAS floor", () => {
    expect(bidFromInput({ strategy: "COST_CAP", amountInput: "12,34", roasInput: "" }, "BRL")).toEqual({
      strategy: "COST_CAP",
      amount: 1234,
    });
    expect(bidFromInput({ strategy: "LOWEST_COST_WITH_MIN_ROAS", amountInput: "", roasInput: "2,5" }, "BRL")).toEqual({
      strategy: "LOWEST_COST_WITH_MIN_ROAS",
      roasFloor: 2.5,
    });
    expect(bidFromInput({ strategy: "LOWEST_COST_WITHOUT_CAP", amountInput: "9", roasInput: "9" }, "BRL")).toEqual({
      strategy: "LOWEST_COST_WITHOUT_CAP",
    });
    expect(parseRoas("0")).toBeNull();
    expect(parseRoas("1001")).toBeNull();
  });

  it("puts the budget on the campaign or on the ad set, never both", () => {
    const form = { ...whatsappForm(), campaignBudgetOn: true, campaignBudget: { kind: "LIFETIME" as const, input: "500" } };
    const draft = buildDraft(form, context);
    expect(draft.campaign.budget).toEqual({ kind: "LIFETIME", amount: 50000 });
    expect(draft.adSet.budget).toBeUndefined();
    expect(draft.adSet.bid).toEqual({ strategy: "LOWEST_COST_WITHOUT_CAP" });
    expect(scheduleAvailable(form)).toBe(true);

    const own = buildDraft(whatsappForm(), context);
    expect(own.campaign.budget).toBeUndefined();
    expect(own.campaign.bid).toEqual({ strategy: "LOWEST_COST_WITHOUT_CAP" });
    expect(own.adSet.budget).toEqual({ kind: "DAILY", amount: 2550 });
  });

  it("treats an existing campaign with a budget as campaign budget", () => {
    const form = withParents(
      emptyWizardForm("acc"),
      { metaId: "c1", name: "C", dailyBudget: 0, lifetimeBudget: 9000, objective: "OUTCOME_LEADS" },
      null,
    );
    expect(form.mode).toBe("campaign");
    expect(form.objective).toBe("OUTCOME_LEADS");
    expect(campaignBudgetActive(form)).toBe(true);
    expect(scheduleAvailable(form)).toBe(true);
    expect(buildDraft(form, context).campaign).toEqual({ existingId: "c1", objective: "OUTCOME_LEADS" });
  });
});

describe("buildDraft", () => {
  it("sends only the fields the destination uses", () => {
    const form = { ...whatsappForm(), pixelId: "px", appId: "app", catalogId: "cat", endDay: "2026-10-10", keepPaused: true };
    const draft = buildDraft(form, context);
    expect(draft.adSet).toMatchObject({ destination: "WHATSAPP", goal: "CONVERSATIONS", whatsAppNumber: "+55 (11) 99999-0000" });
    expect(draft.adSet.pixelId).toBeUndefined();
    expect(draft.adSet.appId).toBeUndefined();
    expect(draft.adSet.catalogId).toBeUndefined();
    expect(draft.adSet.endAt).toBe("2026-10-11T03:00:00.000Z");
    expect(draft.adSet.placements).toEqual({ automatic: true });
    expect(draft.ads[0].creative).toEqual({ format: "IMAGE", primaryText: "Fale com a gente", media: { kind: "image", mediaId: "m1" } });
    expect(draft.keepPaused).toBe(true);
    expect(draft.identity).toEqual({ pageId: "p1", instagramUserId: undefined });
  });

  it("asks for the pixel only for conversion goals outside the catalog", () => {
    const form = { ...withDestination(whatsappForm(), "WEBSITE", salesRoutes), pixelId: "px", pixelEvent: "PURCHASE" as const };
    expect(buildDraft(form, context).adSet).toMatchObject({ pixelId: "px", pixelEvent: "PURCHASE" });
  });

  it("references the existing ad set and campaign", () => {
    const form = withParents(emptyWizardForm("acc"), null, {
      metaId: "s1",
      name: "Set",
      campaignId: "c9",
      goal: "CONVERSATIONS",
      destination: "WHATSAPP",
      dailyBudget: 100,
      lifetimeBudget: 0,
    });
    const draft = buildDraft(form, context);
    expect(draft.campaign.existingId).toBe("c9");
    expect(draft.adSet.existingId).toBe("s1");
    expect(draft.adSet.destination).toBe("WHATSAPP");
  });

  it("drops exclusions for restricted categories and keeps manual placements tidy", () => {
    const form = withSpecialCategory(whatsappForm(), "EMPLOYMENT");
    form.targeting = { ...form.targeting, excludedLocations: [{ kind: "country", key: "AR", name: "AR" }] };
    expect(buildDraft(form, context).adSet.targeting.excludedLocations).toBeUndefined();
    expect(
      cleanPlacements({ automatic: false, platforms: ["facebook"], positions: { facebook: ["feed"], instagram: ["stream"] }, devices: [] }),
    ).toEqual({ automatic: false, platforms: ["facebook"], positions: { facebook: ["feed"] }, devices: undefined });
  });
});

describe("buildCreative", () => {
  it("builds a carousel with links on website", () => {
    const ad = {
      ...emptyAdForm("a"),
      format: "CAROUSEL" as const,
      primaryText: "Oi",
      link: "https://loja.com",
      callToAction: "SHOP_NOW",
      cards: [
        { media: { kind: "image" as const, mediaId: "1", url: "" }, headline: "A", description: "", link: "https://loja.com/a" },
        { media: null, headline: "", description: "", link: "" },
      ],
    };
    expect(buildCreative(ad, "WEBSITE")).toEqual({
      format: "CAROUSEL",
      primaryText: "Oi",
      headline: undefined,
      description: undefined,
      cards: [
        { media: { kind: "image", mediaId: "1" }, headline: "A", description: undefined, link: "https://loja.com/a" },
        { media: { kind: "image", mediaId: "" }, headline: undefined, description: undefined, link: undefined },
      ],
      link: "https://loja.com",
      displayLink: undefined,
      callToAction: "SHOP_NOW",
    });
  });

  it("builds a flexible creative without the single text fields", () => {
    const ad = {
      ...emptyAdForm("a"),
      format: "FLEXIBLE" as const,
      primaryText: "ignored",
      texts: ["Um", " ", "Dois"],
      headlines: [""],
      medias: [{ kind: "video" as const, mediaId: "v", url: "" }],
      greeting: "Oi!",
      iceBreakers: ["Preço?", ""],
      enhancements: true,
    };
    expect(buildCreative(ad, "WHATSAPP")).toEqual({
      format: "FLEXIBLE",
      texts: ["Um", "Dois"],
      headlines: undefined,
      descriptions: undefined,
      medias: [{ kind: "video", mediaId: "v" }],
      greeting: "Oi!",
      iceBreakers: ["Preço?"],
      enhancements: true,
    });
  });

  it("references an Instagram post by media id", () => {
    const ad = { ...emptyAdForm("a"), format: "EXISTING_POST" as const, post: { id: "ig1", platform: "instagram" as const } };
    expect(buildCreative(ad, "ON_POST")).toEqual({ format: "EXISTING_POST", instagramMediaId: "ig1" });
  });

  it("adds the lead form on instant form ads", () => {
    const ad = { ...emptyAdForm("a"), primaryText: "x", leadFormId: "f1", media: { kind: "image" as const, mediaId: "m", url: "" } };
    expect(buildCreative(ad, "ON_AD")).toMatchObject({ leadFormId: "f1", callToAction: undefined });
  });
});

describe("duplicateAd", () => {
  it("copies the ad with a new id and a suffixed name", () => {
    const ad = { ...emptyAdForm("a"), name: "Promo", texts: ["x"] };
    const copy = duplicateAd(ad, "(cópia)");
    expect(copy.id).not.toBe("a");
    expect(copy.name).toBe("Promo (cópia)");
    copy.texts.push("y");
    expect(ad.texts).toEqual(["x"]);
  });
});

describe("draftFeeTotal", () => {
  it("uses the total from the backend or multiplies the per ad price", () => {
    expect(draftFeeTotal({ price: 1_000_000, currency: "USD", total: 2_500_000 }, 3)).toBe(2_500_000);
    expect(draftFeeTotal({ price: 1_000_000, currency: "USD" }, 3)).toBe(3_000_000);
  });
});

describe("creative edit", () => {
  const source = {
    metaId: "ad-9",
    name: "Promo",
    previewUrl: "https://cdn/x.jpg",
    pageId: "p1",
    creative: {
      format: "IMAGE" as const,
      primaryText: "Oi",
      media: { kind: "image" as const, mediaId: "m1" },
      greeting: "Ola",
      iceBreakers: ["Preço?"],
    },
  };

  it("fills the ad form from an existing creative", () => {
    const ad = adFormFromCreative(source);
    expect(ad).toMatchObject({ name: "Promo", format: "IMAGE", primaryText: "Oi", greeting: "Ola", iceBreakers: ["Preço?"] });
    expect(ad.media).toEqual({ kind: "image", mediaId: "m1", url: "https://cdn/x.jpg" });
    expect(adFormFromCreative({ ...source, creative: { format: "EXISTING_POST", instagramMediaId: "ig" } }).post).toMatchObject({
      id: "ig",
      platform: "instagram",
    });
  });

  it("switches the wizard to the creative mode of one ad", () => {
    const adSet = {
      metaId: "s1",
      name: "Set",
      campaignId: "c1",
      destination: "WHATSAPP",
      goal: "CONVERSATIONS",
      dailyBudget: 100,
      lifetimeBudget: 0,
    };
    const form = withCreativeEdit(emptyWizardForm("acc"), null, adSet, source);
    expect(form).toMatchObject({ mode: "creative", editAdId: "ad-9", pageId: "p1", destination: "WHATSAPP" });
    expect(form.ads).toHaveLength(1);
    expect(buildCreative(form.ads[0], form.destination)).toEqual({
      format: "IMAGE",
      primaryText: "Oi",
      headline: undefined,
      description: undefined,
      media: { kind: "image", mediaId: "m1" },
      greeting: "Ola",
      iceBreakers: ["Preço?"],
    });
  });
});
