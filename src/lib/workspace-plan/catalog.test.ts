import { describe, expect, it } from "vitest";

import { billableItems, featuredPlan, planCategories, planHighlights, sortedPlans } from "./catalog";
import type { PlanDefinition, PlanPricingItem, PublicPlanDetails } from "./types";

function item(category: string, service = "x"): PlanPricingItem {
  return { id: `${category}-${service}`, planDefinitionId: "p", category, service, metric: "per_message", priceMicros: 1, currency: "USD", createdAt: "", updatedAt: "" } as PlanPricingItem;
}

function plan(id: string, cents: number, extra: Partial<PlanDefinition> = {}): PublicPlanDetails {
  return {
    plan: {
      id, name: id, description: "", basePriceBRLCents: cents, maxCallChannels: 0, isGloballyVisible: true,
      createdAt: "", updatedAt: "", ...extra,
    } as PlanDefinition,
  };
}

describe("plan catalog", () => {
  it("leaves out internal pricing lines", () => {
    expect(billableItems([item("whatsapp"), item("exchange_rate"), item("telephony"), item("margin"), item("llm")]).map((i) => i.category)).toEqual(["whatsapp", "telephony", "llm"]);
  });

  it("lists each included service once, in the product's order", () => {
    expect(planCategories({ pricingItems: [item("llm"), item("whatsapp", "a"), item("telephony"), item("whatsapp", "b")] } as PlanDefinition)).toEqual(["whatsapp", "telephony", "llm"]);
  });

  it("orders plans by price and hides archived ones", () => {
    expect(sortedPlans([plan("pro", 300), plan("old", 50, { archivedAt: "2026-01-01" }), plan("start", 100)]).map((p) => p.plan.id)).toEqual(["start", "pro"]);
  });

  it("features the partner's exclusive plan first", () => {
    expect(featuredPlan([plan("a", 100), plan("b", 200, { exclusiveAffiliateId: "aff" }), plan("c", 300)])).toEqual({ planId: "b", kind: "exclusive" });
  });

  it("features the middle plan as the popular choice", () => {
    expect(featuredPlan([plan("a", 100), plan("b", 200), plan("c", 300)])).toEqual({ planId: "b", kind: "popular" });
    expect(featuredPlan([plan("a", 100), plan("b", 200)])).toEqual({ planId: "b", kind: "popular" });
  });

  it("features nothing when there is no choice to make", () => {
    expect(featuredPlan([plan("a", 100)])).toBeNull();
    expect(featuredPlan([])).toBeNull();
  });

  it("says what the plan gives, leading with the balance the payment becomes", () => {
    const pro = plan("pro", 50_300, { includedWhatsAppBusinessPhones: 2, maxTtsConcurrency: 0, pricingItems: [item("whatsapp"), item("llm")] }).plan;
    expect(planHighlights(pro)).toEqual([
      { kind: "balance", cents: 50_300 },
      { kind: "whatsappNumbers", count: 2 },
      { kind: "category", category: "whatsapp" },
      { kind: "category", category: "llm" },
    ]);
  });
});
