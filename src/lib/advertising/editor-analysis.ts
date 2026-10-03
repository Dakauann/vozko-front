import {
  budgetFromInput,
  buildCreative,
  campaignBudgetActive,
  cleanPlacements,
  scheduleAvailable,
  type BidInput,
  type WizardForm,
} from "@/lib/advertising/draft";
import type { AdBid, AdBudget, AdCreativeDraftV2, AdDraftDestination, AdDraftTargeting, AdPlacements } from "@/lib/advertising/draft-types";
import { AD_SET_NODE, CAMPAIGN_NODE, adNode, type EditorNode } from "@/lib/advertising/editor-tree";
import { endDayOf } from "@/lib/advertising/edit";
import type { CreativeField } from "@/lib/advertising/manager-bulk";
import type { AdEditableObject } from "@/lib/advertising/types";
import { destinationOf, isMessaging, resolvedCallToAction, showsLink } from "@/lib/advertising/wizard-routes";

export type LabelGroup = "objective" | "destination" | "goal" | "format" | "category" | "bidStrategy" | "callToAction" | "buyingType" | "budgetStrategy";

export type BudgetPlace = "campaign" | "existingCampaign" | "existingAdSet";

export type AnalysisValue =
  | { kind: "text"; text: string }
  | { kind: "label"; group: LabelGroup; value: string }
  | { kind: "budget"; budget: AdBudget }
  | { kind: "budgetElsewhere"; place: BudgetPlace }
  | { kind: "dates"; startDay: string; endDay: string; hours: boolean }
  | { kind: "ages"; min: number; max: number; advantage: boolean }
  | { kind: "list"; items: string[] }
  | { kind: "placements"; platforms: string[] | null }
  | { kind: "empty" };

export interface AnalysisFact {
  key: string;
  value: AnalysisValue;
}

export interface AnalysisSection {
  node: EditorNode;
  facts: AnalysisFact[];
}

const EMPTY: AnalysisValue = { kind: "empty" };

function text(value: string | undefined | null): AnalysisValue {
  const clean = (value ?? "").trim();
  return clean ? { kind: "text", text: clean } : EMPTY;
}

function label(group: LabelGroup, value: string | undefined | null): AnalysisValue {
  return value ? { kind: "label", group, value } : EMPTY;
}

function budget(value: AdBudget | null | undefined): AnalysisValue {
  return value && value.amount > 0 ? { kind: "budget", budget: value } : EMPTY;
}

function list(items: string[]): AnalysisValue {
  return items.length > 0 ? { kind: "list", items } : EMPTY;
}

function fact(key: string, value: AnalysisValue): AnalysisFact {
  return { key, value };
}

function bidStrategy(bid: AdBid | BidInput | null | undefined): AnalysisValue {
  return label("bidStrategy", bid?.strategy);
}

export function audienceFacts(targeting: AdDraftTargeting): AnalysisFact[] {
  return [
    fact("locations", list(targeting.locations.map((location) => location.name))),
    fact("ages", { kind: "ages", min: targeting.ageMin, max: targeting.ageMax, advantage: targeting.advantageAudience }),
    fact("languages", list((targeting.languages ?? []).map((item) => item.name))),
    fact("detailedTargeting", list([...(targeting.interests ?? []), ...(targeting.behaviors ?? [])].map((item) => item.name))),
    fact("customAudiences", list((targeting.customAudiences ?? []).map((item) => item.name))),
  ];
}

export function placementsFact(placements: AdPlacements): AnalysisFact {
  return fact("placements", { kind: "placements", platforms: placements.automatic ? null : (placements.platforms ?? []) });
}

export function creativeText(creative: AdCreativeDraftV2 | null, field: CreativeField): string {
  if (!creative) return "";
  const flexible = creative.format === "FLEXIBLE";
  switch (field) {
    case "primaryText":
      return (flexible ? creative.texts?.[0] : creative.primaryText) ?? "";
    case "headline":
      return (flexible ? creative.headlines?.[0] : creative.headline) ?? "";
    case "description":
      return (flexible ? creative.descriptions?.[0] : creative.description) ?? "";
    case "link":
      return creative.link ?? "";
  }
}

export function creativeFacts(creative: AdCreativeDraftV2, destination: AdDraftDestination | ""): AnalysisFact[] {
  const facts = [
    fact("format", label("format", creative.format)),
    fact("primaryText", text(creativeText(creative, "primaryText"))),
    fact("headline", text(creativeText(creative, "headline"))),
    fact("callToAction", label("callToAction", resolvedCallToAction(destination, creative.callToAction ?? ""))),
  ];
  if (showsLink(destination)) facts.push(fact("link", text(creativeText(creative, "link"))));
  if (isMessaging(destination)) facts.push(fact("greeting", text(creative.greeting)));
  return facts;
}

function campaignSection(form: WizardForm, currency: string): AnalysisSection {
  if (form.mode !== "new") {
    return {
      node: CAMPAIGN_NODE,
      facts: [fact("campaignName", text(form.campaignParent?.name)), fact("objective", label("objective", form.objective))],
    };
  }
  const facts = [
    fact("campaignName", text(form.campaignName)),
    fact("buyingType", label("buyingType", "AUCTION")),
    fact("objective", label("objective", form.objective)),
    fact("specialCategory", label("category", form.specialCategory)),
    fact("budgetStrategy", label("budgetStrategy", form.campaignBudgetOn ? "campaign" : "adSet")),
  ];
  if (form.campaignBudgetOn) {
    facts.push(fact("budget", budget(budgetFromInput(form.campaignBudget, currency))), fact("bidStrategy", bidStrategy(form.campaignBid)));
  }
  return { node: CAMPAIGN_NODE, facts };
}

function budgetFacts(form: WizardForm, currency: string): AnalysisFact[] {
  if (form.mode === "adSet") return [fact("budget", { kind: "budgetElsewhere", place: "existingAdSet" })];
  if (campaignBudgetActive(form)) {
    return [fact("budget", { kind: "budgetElsewhere", place: form.mode === "new" ? "campaign" : "existingCampaign" })];
  }
  return [fact("budget", budget(budgetFromInput(form.adSetBudget, currency))), fact("bidStrategy", bidStrategy(form.adSetBid))];
}

function adSetSection(form: WizardForm, currency: string): AnalysisSection {
  const facts = [
    fact("adSetName", text(form.mode === "adSet" ? form.adSetParent?.name : form.adSetName)),
    fact("destination", label("destination", form.destination)),
    fact("goal", label("goal", form.goal)),
  ];
  if (form.destination === "WHATSAPP" && form.mode !== "adSet") facts.push(fact("whatsAppNumber", text(form.whatsAppNumber)));
  facts.push(...budgetFacts(form, currency));
  if (form.mode === "adSet") return { node: AD_SET_NODE, facts };
  facts.push(
    fact("schedule", {
      kind: "dates",
      startDay: form.startMode === "date" ? form.startDay : "",
      endDay: form.endDay,
      hours: scheduleAvailable(form) && form.scheduleOn && form.schedule.length > 0,
    }),
    ...audienceFacts(form.targeting),
    placementsFact(cleanPlacements(form.placements)),
  );
  return { node: AD_SET_NODE, facts };
}

export function draftAnalysis(form: WizardForm, currency: string, pageName: string): AnalysisSection[] {
  const ads = form.ads.map((ad, index) => ({
    node: adNode(index),
    facts: [fact("adName", text(ad.name)), fact("page", text(pageName)), ...creativeFacts(buildCreative(ad, form.destination), form.destination)],
  }));
  return [campaignSection(form, currency), adSetSection(form, currency), ...ads];
}

export function objectAnalysis(detail: AdEditableObject, timezone: string): AnalysisFact[] {
  const { row } = detail;
  const facts = [fact("name", text(row.name))];
  if (row.objective) facts.push(fact("objective", label("objective", row.objective)));
  if (row.level === "adset") {
    facts.push(fact("destination", label("destination", row.destinationType)), fact("goal", label("goal", row.optimizationGoal)));
  }
  if (row.level !== "ad") {
    facts.push(fact("budget", budget(detail.budget)), fact("bidStrategy", bidStrategy(detail.bid)));
  }
  if (row.level === "adset") {
    facts.push(fact("schedule", { kind: "dates", startDay: "", endDay: endDayOf(row.endTime, timezone), hours: (detail.schedule ?? []).length > 0 }));
    if (detail.targeting) facts.push(...audienceFacts(detail.targeting));
    if (detail.placements) facts.push(placementsFact(detail.placements));
  }
  if (row.level === "ad" && detail.creative) facts.push(...creativeFacts(detail.creative, destinationOf(row.destinationType)));
  return facts;
}
