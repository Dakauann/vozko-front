import type { PlanDefinition, PublicPlanDetails } from "./types";

export const PLAN_CATEGORY_ORDER: Record<string, number> = {
  whatsapp: 0,
  telephony: 1,
  llm: 2,
};

export const MONTHLY_INVOICE_DUE_DAY = 23;

const INTERNAL_CATEGORIES = new Set(["exchange_rate", "margin"]);

export type FeaturedKind = "popular" | "exclusive";

export type PlanHighlight =
  | { kind: "balance"; cents: number }
  | { kind: "whatsappNumbers"; count: number }
  | { kind: "voices"; count: number }
  | { kind: "category"; category: string };

export function billableItems<T extends { category: string }>(items: T[] | undefined): T[] {
  return (items ?? []).filter((item) => !INTERNAL_CATEGORIES.has(item.category));
}

export function planCategories(plan: Pick<PlanDefinition, "pricingItems">): string[] {
  return [...new Set(billableItems(plan.pricingItems).map((item) => item.category))].sort(
    (a, b) => (PLAN_CATEGORY_ORDER[a] ?? 99) - (PLAN_CATEGORY_ORDER[b] ?? 99),
  );
}

export function sortedPlans(plans: PublicPlanDetails[]): PublicPlanDetails[] {
  return plans.filter((item) => !item.plan.archivedAt).sort((a, b) => a.plan.basePriceBRLCents - b.plan.basePriceBRLCents);
}

export function featuredPlan(plans: PublicPlanDetails[]): { planId: string; kind: FeaturedKind } | null {
  const ordered = sortedPlans(plans);
  if (ordered.length < 2) return null;
  const exclusive = ordered.find((item) => item.plan.exclusiveAffiliateId);
  if (exclusive) return { planId: exclusive.plan.id, kind: "exclusive" };
  return { planId: ordered[ordered.length === 2 ? 1 : Math.floor(ordered.length / 2)].plan.id, kind: "popular" };
}

export function planHighlights(plan: PlanDefinition): PlanHighlight[] {
  const highlights: PlanHighlight[] = [{ kind: "balance", cents: plan.basePriceBRLCents }];
  if ((plan.includedWhatsAppBusinessPhones ?? 0) > 0) {
    highlights.push({ kind: "whatsappNumbers", count: plan.includedWhatsAppBusinessPhones ?? 0 });
  }
  if ((plan.maxTtsConcurrency ?? 0) > 0) {
    highlights.push({ kind: "voices", count: plan.maxTtsConcurrency ?? 0 });
  }
  for (const category of planCategories(plan)) {
    highlights.push({ kind: "category", category });
  }
  return highlights;
}
