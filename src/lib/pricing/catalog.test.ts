// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { PricingItem } from "@/lib/pricing/types";
import type { PlanPricingItem } from "@/lib/workspace-plan/types";
import {
  defaultsToDrafts,
  draftsToMutationInputs,
  filterBillableDefaults,
  isDraftCustomized,
  mergePlanPricingDrafts,
  resetDraftToDefault,
} from "./catalog";

function item(
  partial: Partial<PricingItem> &
    Pick<PricingItem, "category" | "service" | "metric">,
): PricingItem {
  return {
    id: partial.id ?? `${partial.category}-${partial.service}`,
    workspaceId: null,
    costMicros: partial.costMicros ?? 0,
    priceMicros: partial.priceMicros ?? 0,
    markupPct: partial.markupPct ?? 0,
    currency: partial.currency ?? "USD",
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

const catalog: PricingItem[] = [
  item({
    category: "whatsapp",
    service: "utility",
    metric: "per_message",
    costMicros: 6_800,
    priceMicros: 16_667,
  }),
  item({
    category: "whatsapp",
    service: "authentication",
    metric: "per_message",
    costMicros: 6_800,
    priceMicros: 16_667,
  }),
  item({
    category: "telephony",
    service: "sip_trunk",
    metric: "per_minute",
    costMicros: 4_167,
    priceMicros: 8_333,
  }),
  item({
    category: "telephony",
    service: "whatsapp_calls",
    metric: "per_minute",
    costMicros: 10_800,
    priceMicros: 13_333,
  }),
  item({
    category: "llm",
    service: "default_markup",
    metric: "percentage",
    markupPct: 0.2,
  }),
  item({
    category: "exchange_rate",
    service: "usd_to_brl",
    metric: "per_unit",
    priceMicros: 6_000_000,
    currency: "BRL",
  }),
];

describe("filterBillableDefaults", () => {
  it("drops exchange_rate", () => {
    const billable = filterBillableDefaults(catalog);
    expect(billable.every((i) => i.category !== "exchange_rate")).toBe(true);
    expect(billable).toHaveLength(5);
  });
});

describe("mergePlanPricingDrafts", () => {
  it("includes whatsapp_calls and authentication from defaults on empty plan", () => {
    const drafts = mergePlanPricingDrafts(undefined, catalog, 6);
    const keys = drafts.map((d) => `${d.category}|${d.service}|${d.metric}`);
    expect(keys).toContain("telephony|whatsapp_calls|per_minute");
    expect(keys).toContain("whatsapp|authentication|per_message");
    expect(keys).not.toContain("exchange_rate|usd_to_brl|per_unit");
  });

  it("preserves plan override prices in BRL", () => {
    const planItems: PlanPricingItem[] = [
      {
        id: "1",
        planDefinitionId: "p1",
        category: "telephony",
        service: "whatsapp_calls",
        metric: "per_minute",
        costMicros: 10_800,
        priceMicros: 20_000,
        markupPct: 0,
        currency: "USD",
        createdAt: "",
        updatedAt: "",
      },
    ];
    const drafts = mergePlanPricingDrafts(planItems, catalog, 6);
    const wa = drafts.find(
      (d) => d.service === "whatsapp_calls" && d.category === "telephony",
    );
    expect(wa).toBeDefined();
    // 20000 micros * 6 = 0.12 BRL
    expect(Number.parseFloat(wa!.priceBrl)).toBeCloseTo(0.12, 5);
    expect(isDraftCustomized(wa!, 6)).toBe(true);
  });

  it("defaultsToDrafts matches full billable catalog", () => {
    const drafts = defaultsToDrafts(catalog, 6);
    expect(drafts).toHaveLength(5);
  });

  it("draftsToMutationInputs converts BRL back to USD micros", () => {
    const drafts = mergePlanPricingDrafts(undefined, catalog, 6);
    const inputs = draftsToMutationInputs(drafts, 6);
    const wa = inputs.find(
      (i) => i.service === "whatsapp_calls" && i.category === "telephony",
    );
    expect(wa?.priceMicros).toBe(13_333);
    expect(wa?.currency).toBe("USD");
  });

  it("resetDraftToDefault clears customization", () => {
    const drafts = mergePlanPricingDrafts(undefined, catalog, 6);
    let wa = drafts.find((d) => d.service === "whatsapp_calls")!;
    wa = { ...wa, priceBrl: "1.5" };
    expect(isDraftCustomized(wa, 6)).toBe(true);
    wa = resetDraftToDefault(wa, 6);
    expect(isDraftCustomized(wa, 6)).toBe(false);
  });
});
