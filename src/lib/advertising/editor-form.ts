import { civilToday } from "@/lib/advertising/date-range";
import {
  adFormFromCreative,
  emptyWizardForm,
  parentFromRow,
  withCreativeEdit,
  type DraftContext,
  type ParentSummary,
  type WizardForm,
  type WizardMode,
} from "@/lib/advertising/draft";
import type { AdBudget, AdMediaRef, AdPagePost, AdPostPlatform, MetaAdDraft } from "@/lib/advertising/draft-types";
import { bidInputOf, budgetInputOf, endDayOf } from "@/lib/advertising/edit";
import type { AdEditableObject, AdRow } from "@/lib/advertising/types";

export interface FormContext extends DraftContext {
  campaignParent?: ParentSummary | null;
  adSetParent?: ParentSummary | null;
  mediaUrls?: Record<string, string>;
  posts?: Record<string, AdPagePost>;
}

function modeOf(draft: MetaAdDraft): WizardMode {
  if (draft.adSet.existingId) return "adSet";
  return draft.campaign.existingId ? "campaign" : "new";
}

function parentOr(resolved: ParentSummary | null | undefined, metaId: string | undefined): ParentSummary | null {
  if (!metaId) return null;
  if (resolved && resolved.metaId === metaId) return resolved;
  return { metaId, name: "", dailyBudget: 0, lifetimeBudget: 0 };
}

function budgetOr(budget: AdBudget | undefined, currency: string): WizardForm["adSetBudget"] {
  return budgetInputOf(budget ?? null, currency) ?? { kind: "DAILY", input: "" };
}

function startDayOf(iso: string | undefined, timezone: string): string {
  if (!iso) return "";
  const instant = Date.parse(iso);
  return Number.isNaN(instant) ? "" : (civilToday(timezone, new Date(instant)) ?? "");
}

export function formFromDraft(draft: MetaAdDraft, context: FormContext): WizardForm {
  const { currency, timezone } = context;
  const base = emptyWizardForm(draft.adAccountId);
  const { campaign, adSet } = draft;
  const mode = modeOf(draft);
  const startDay = startDayOf(adSet.startAt, timezone);
  return {
    ...base,
    mode,
    campaignParent: parentOr(context.campaignParent, campaign.existingId ?? context.adSetParent?.campaignId),
    adSetParent: parentOr(context.adSetParent, adSet.existingId),
    objective: campaign.objective ?? "",
    campaignName: campaign.name ?? context.campaignParent?.name ?? "",
    specialCategory: campaign.specialCategory ?? "NONE",
    campaignBudgetOn: !!campaign.budget,
    campaignBudget: budgetOr(campaign.budget, currency),
    campaignBid: bidInputOf(campaign.bid ?? null, currency),
    pageId: draft.identity.pageId ?? "",
    instagramUserId: draft.identity.instagramUserId ?? "",
    adSetName: adSet.name ?? context.adSetParent?.name ?? "",
    destination: adSet.destination ?? "",
    goal: adSet.goal ?? "",
    whatsAppNumber: adSet.whatsAppNumber ?? "",
    pixelId: adSet.pixelId ?? "",
    pixelEvent: adSet.pixelEvent ?? "",
    appId: adSet.appId ?? "",
    appStoreUrl: adSet.appStoreUrl ?? "",
    catalogId: adSet.catalogId ?? "",
    productSetId: adSet.productSetId ?? "",
    adSetBudget: budgetOr(adSet.budget, currency),
    adSetBid: bidInputOf(adSet.bid ?? null, currency),
    startMode: startDay ? "date" : "now",
    startDay,
    endDay: endDayOf(adSet.endAt, timezone),
    scheduleOn: (adSet.schedule?.length ?? 0) > 0,
    schedule: adSet.schedule ?? [],
    targeting: adSet.targeting ?? base.targeting,
    placements: adSet.placements ?? base.placements,
    ads: draft.ads.length > 0
      ? draft.ads.map((item) => adFormFromCreative({ metaId: "", name: item.name ?? "", creative: item.creative, mediaUrls: context.mediaUrls, posts: context.posts }))
      : base.ads,
    keepPaused: draft.keepPaused === true,
  };
}

function creativeMedias(creative: MetaAdDraft["ads"][number]["creative"]): (AdMediaRef | undefined)[] {
  return [creative.media, ...(creative.cards ?? []).map((card) => card.media), ...(creative.medias ?? [])];
}

export function draftMediaIds(draft: MetaAdDraft): string[] {
  const ids = draft.ads.flatMap((item) => creativeMedias(item.creative)).map((media) => media?.mediaId ?? "");
  return [...new Set(ids.filter(Boolean))];
}

export interface DraftPostRef {
  id: string;
  platform: AdPostPlatform;
}

export function draftPostRefs(draft: MetaAdDraft): DraftPostRef[] {
  const refs = draft.ads.flatMap((item): DraftPostRef[] => {
    if (item.creative.instagramMediaId) return [{ id: item.creative.instagramMediaId, platform: "instagram" }];
    if (item.creative.postId) return [{ id: item.creative.postId, platform: "facebook" }];
    return [];
  });
  return refs.filter((ref, index) => refs.findIndex((other) => other.id === ref.id) === index);
}

export function creativeSwapForm(detail: AdEditableObject, accountId: string, campaign: AdRow | null, adSet: AdRow | null): WizardForm | null {
  const { row, creative, identity, mediaUrls } = detail;
  if (!creative) return null;
  return withCreativeEdit(emptyWizardForm(accountId), campaign ? parentFromRow(campaign) : null, adSet ? parentFromRow(adSet) : null, {
    metaId: row.metaId,
    name: row.name,
    creative,
    previewUrl: row.creative?.imageUrl ?? row.creative?.thumbnailUrl,
    mediaUrls,
    pageId: identity?.pageId,
    instagramUserId: identity?.instagramUserId,
  });
}
