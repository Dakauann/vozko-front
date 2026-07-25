// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  filterBillableDefaults,
  mergePlanPricingDrafts,
} from "@/lib/pricing/catalog";
import type { PricingItem } from "@/lib/pricing/types";

const pageSource = readFileSync(resolve(__dirname, "page.tsx"), "utf-8");

describe("Admin plans page, catalog integrity", () => {
  it("does not hardcode a DEFAULT_PRICING_CATALOG or getDefaultPricingCatalog seed", () => {
    expect(pageSource).not.toMatch(/function getDefaultPricingCatalog/);
    expect(pageSource).not.toMatch(/DEFAULT_PRICING_CATALOG/);
  });

  it("loads catalog from getDefaultPricingItemsAction", () => {
    expect(pageSource).toContain("getDefaultPricingItemsAction");
    expect(pageSource).toContain("mergePlanPricingDrafts");
  });

  it("never seeds exchange_rate into plan drafts via merge", () => {
    const defaults: PricingItem[] = [
      {
        id: "1",
        workspaceId: null,
        category: "telephony",
        service: "whatsapp_calls",
        metric: "per_minute",
        costMicros: 10_800,
        priceMicros: 13_333,
        markupPct: 0,
        currency: "USD",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "2",
        workspaceId: null,
        category: "exchange_rate",
        service: "usd_to_brl",
        metric: "per_unit",
        costMicros: 0,
        priceMicros: 6_000_000,
        markupPct: 0,
        currency: "BRL",
        createdAt: "",
        updatedAt: "",
      },
    ];
    expect(filterBillableDefaults(defaults)).toHaveLength(1);
    const drafts = mergePlanPricingDrafts(undefined, defaults, 6);
    expect(drafts.every((d) => d.category !== "exchange_rate")).toBe(true);
    expect(drafts.some((d) => d.service === "whatsapp_calls")).toBe(true);
  });
});
