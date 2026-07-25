import type { PricingItem } from "@/lib/pricing/types";
import type {
  PlanPricingItem,
  PlanPricingItemInput,
} from "@/lib/workspace-plan/types";
import {
  isPercentageMetric,
  parseBrlToUsdMicros,
  resolveExchangeRate,
  usdMicrosToBrlInput,
} from "@/lib/pricing/money";

export type PricingItemDraft = {
  category: string;
  service: string;
  metric: string;
  /** BRL input string for cost (ignored when percentage metric). */
  costBrl: string;
  /** BRL input string for customer price. */
  priceBrl: string;
  markupPct: string;
  currency: string;
  /** Platform defaults used for "customized" badge and reset. */
  defaultCostMicros: number;
  defaultPriceMicros: number;
  defaultMarkupPct: number;
};

export function pricingItemKey(
  category: string,
  service: string,
  metric: string,
): string {
  return `${category}|${service}|${metric}`;
}

/** Billable catalog rows only (exclude exchange_rate). */
export function filterBillableDefaults(items: PricingItem[]): PricingItem[] {
  return items.filter((item) => item.category !== "exchange_rate");
}

export function defaultsToDrafts(
  defaults: PricingItem[],
  rate: number,
): PricingItemDraft[] {
  const billable = filterBillableDefaults(defaults);
  return billable.map((item) => draftFromMicros(item, item, rate));
}

function draftFromMicros(
  current: {
    category: string;
    service: string;
    metric: string;
    costMicros?: number;
    priceMicros: number;
    markupPct?: number;
    currency?: string;
  },
  defaults: {
    costMicros?: number;
    priceMicros: number;
    markupPct?: number;
  },
  rate: number,
): PricingItemDraft {
  const costMicros = current.costMicros ?? 0;
  const priceMicros = current.priceMicros ?? 0;
  const markupPct = current.markupPct ?? 0;
  const defaultCost = defaults.costMicros ?? 0;
  const defaultPrice = defaults.priceMicros ?? 0;
  const defaultMarkup = defaults.markupPct ?? 0;
  const percentage = isPercentageMetric(current.metric);

  return {
    category: current.category,
    service: current.service,
    metric: current.metric,
    costBrl: percentage ? "0" : usdMicrosToBrlInput(costMicros, rate),
    priceBrl: percentage ? "0" : usdMicrosToBrlInput(priceMicros, rate),
    markupPct: String(markupPct),
    currency: current.currency || "USD",
    defaultCostMicros: defaultCost,
    defaultPriceMicros: defaultPrice,
    defaultMarkupPct: defaultMarkup,
  };
}

/**
 * Merge plan pricing items onto the full platform catalog so new services
 * (e.g. whatsapp_calls) always appear, even on older plans.
 */
export function mergePlanPricingDrafts(
  planItems: PlanPricingItem[] | undefined,
  defaults: PricingItem[],
  rate: number,
): PricingItemDraft[] {
  const resolvedRate = resolveExchangeRate(rate);
  if (resolvedRate == null) {
    return [];
  }

  const billable = filterBillableDefaults(defaults);
  const planMap = new Map<string, PlanPricingItem>();
  for (const item of planItems ?? []) {
    if (item.category === "exchange_rate") continue;
    planMap.set(
      pricingItemKey(item.category, item.service, item.metric),
      item,
    );
  }

  const drafts: PricingItemDraft[] = billable.map((d) => {
    const key = pricingItemKey(d.category, d.service, d.metric);
    const plan = planMap.get(key);
    if (plan) {
      return draftFromMicros(
        {
          category: plan.category,
          service: plan.service,
          metric: plan.metric,
          costMicros: plan.costMicros ?? 0,
          priceMicros: plan.priceMicros,
          markupPct: plan.markupPct ?? 0,
          currency: plan.currency,
        },
        d,
        resolvedRate,
      );
    }
    return draftFromMicros(d, d, resolvedRate);
  });

  // Preserve any plan only rows not in defaults (defensive).
  for (const plan of planItems ?? []) {
    if (plan.category === "exchange_rate") continue;
    const key = pricingItemKey(plan.category, plan.service, plan.metric);
    if (billable.some((d) => pricingItemKey(d.category, d.service, d.metric) === key)) {
      continue;
    }
    drafts.push(
      draftFromMicros(
        {
          category: plan.category,
          service: plan.service,
          metric: plan.metric,
          costMicros: plan.costMicros ?? 0,
          priceMicros: plan.priceMicros,
          markupPct: plan.markupPct ?? 0,
          currency: plan.currency,
        },
        {
          costMicros: plan.costMicros ?? 0,
          priceMicros: plan.priceMicros,
          markupPct: plan.markupPct ?? 0,
        },
        resolvedRate,
      ),
    );
  }

  return drafts;
}

export function draftsToMutationInputs(
  drafts: PricingItemDraft[],
  rate: number,
): PlanPricingItemInput[] {
  const resolvedRate = resolveExchangeRate(rate);
  if (resolvedRate == null) {
    return [];
  }

  return drafts
    .filter((item) => item.category && item.service && item.metric)
    .map((item) => {
      const percentage = isPercentageMetric(item.metric);
      return {
        category: item.category,
        service: item.service,
        metric: item.metric,
        costMicros: percentage
          ? 0
          : parseBrlToUsdMicros(item.costBrl, resolvedRate),
        priceMicros: percentage
          ? 0
          : parseBrlToUsdMicros(item.priceBrl, resolvedRate),
        markupPct: Number.parseFloat(item.markupPct) || 0,
        currency: item.currency || "USD",
      };
    });
}

export function isDraftCustomized(draft: PricingItemDraft, rate: number): boolean {
  const resolvedRate = resolveExchangeRate(rate);
  if (resolvedRate == null) return false;

  if (isPercentageMetric(draft.metric)) {
    const markup = Number.parseFloat(draft.markupPct) || 0;
    return Math.abs(markup - draft.defaultMarkupPct) > 1e-9;
  }

  const cost = parseBrlToUsdMicros(draft.costBrl, resolvedRate);
  const price = parseBrlToUsdMicros(draft.priceBrl, resolvedRate);
  const markup = Number.parseFloat(draft.markupPct) || 0;

  return (
    cost !== draft.defaultCostMicros ||
    price !== draft.defaultPriceMicros ||
    Math.abs(markup - draft.defaultMarkupPct) > 1e-9
  );
}

export function resetDraftToDefault(
  draft: PricingItemDraft,
  rate: number,
): PricingItemDraft {
  const resolvedRate = resolveExchangeRate(rate) ?? 1;
  if (isPercentageMetric(draft.metric)) {
    return {
      ...draft,
      costBrl: "0",
      priceBrl: "0",
      markupPct: String(draft.defaultMarkupPct),
    };
  }
  return {
    ...draft,
    costBrl: usdMicrosToBrlInput(draft.defaultCostMicros, resolvedRate),
    priceBrl: usdMicrosToBrlInput(draft.defaultPriceMicros, resolvedRate),
    markupPct: String(draft.defaultMarkupPct),
  };
}

/** Stable category order for admin tables. */
export const PRICING_CATEGORY_ORDER = [
  "tts",
  "stt",
  "llm",
  "whatsapp",
  "telephony",
  "margin",
] as const;

export function sortDraftsByCatalog(drafts: PricingItemDraft[]): PricingItemDraft[] {
  const order = new Map(
    PRICING_CATEGORY_ORDER.map((c, i) => [c, i] as const),
  );
  return [...drafts].sort((a, b) => {
    const ai = order.get(a.category as (typeof PRICING_CATEGORY_ORDER)[number]) ?? 99;
    const bi = order.get(b.category as (typeof PRICING_CATEGORY_ORDER)[number]) ?? 99;
    if (ai !== bi) return ai - bi;
    return pricingItemKey(a.category, a.service, a.metric).localeCompare(
      pricingItemKey(b.category, b.service, b.metric),
    );
  });
}
