import type { TrendFilters } from "./report-query";
import type { AdLevel, AdRow } from "./types";

export type InsightsTab = "performance" | "budget" | "actions" | "history" | "preview" | "comments";

export type BudgetHome = { kind: "own" } | { kind: "children" } | { kind: "parent"; level: AdLevel; metaId: string } | { kind: "unknown" };

type BudgetRow = Pick<AdRow, "dailyBudget" | "lifetimeBudget">;

const BASE_TABS: InsightsTab[] = ["performance", "budget", "actions", "history"];

const AD_TABS: InsightsTab[] = [...BASE_TABS, "preview", "comments"];

export function insightsTabs(level: AdLevel): InsightsTab[] {
  return level === "ad" ? AD_TABS : BASE_TABS;
}

export function trendScope(row: Pick<AdRow, "level" | "metaId">): Omit<TrendFilters, "range"> {
  if (row.level === "campaign") return { campaignIds: [row.metaId] };
  if (row.level === "adset") return { adSetIds: [row.metaId] };
  return { adIds: [row.metaId] };
}

function hasBudget(row: BudgetRow): boolean {
  return row.dailyBudget > 0 || row.lifetimeBudget > 0;
}

function parent(level: AdLevel, metaId: string | undefined): BudgetHome {
  return metaId ? { kind: "parent", level, metaId } : { kind: "unknown" };
}

export function budgetHome(row: Pick<AdRow, "level" | "campaignId" | "adSetId"> & BudgetRow, adSet: BudgetRow | undefined): BudgetHome {
  if (hasBudget(row)) return { kind: "own" };
  if (row.level === "campaign") return { kind: "children" };
  if (row.level === "adset") return parent("campaign", row.campaignId);
  if (adSet && !hasBudget(adSet)) return parent("campaign", row.campaignId);
  return parent("adset", row.adSetId);
}
