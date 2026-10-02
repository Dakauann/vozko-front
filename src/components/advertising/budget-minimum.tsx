"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { getAdBudgetMinimumAction } from "@/app/actions/advertising-create";
import { readyData, useAdsResource } from "@/components/advertising/wizard/use-ads-resource";
import type { AdOptimizationGoal } from "@/lib/advertising/draft-types";
import type { AdBudgetMinimum } from "@/lib/advertising/types";

import { useAdsFormat } from "./use-ads-format";

export interface BudgetMinimumQuery {
  accountId: string;
  goal: AdOptimizationGoal | string;
  bidAmount?: number;
}

export function useBudgetMinimum(query: BudgetMinimumQuery | null): AdBudgetMinimum | null {
  const bidAmount = query?.bidAmount ?? 0;
  const key = query && query.goal ? `budget-minimum:${query.accountId}:${query.goal}:${bidAmount}` : null;
  const resource = useAdsResource(key, () => getAdBudgetMinimumAction(query?.accountId ?? "", (query?.goal ?? "") as AdOptimizationGoal, bidAmount));
  const minimum = readyData(resource);
  return minimum && minimum.daily > 0 ? minimum : null;
}

export function useBudgetMinimumText() {
  const t = useTranslations("adsManager.budgetMinimum");
  const fmt = useAdsFormat();
  return useCallback(
    (key: "hint" | "below", minimum: AdBudgetMinimum) => t(key, { amount: fmt.minor(minimum.daily, minimum.currency) }),
    [t, fmt],
  );
}

export function BudgetMinimumHint({ minimum }: { minimum: AdBudgetMinimum | null }) {
  const text = useBudgetMinimumText();
  if (!minimum) return null;
  return <p className="text-xs tabular-nums text-muted-foreground">{text("hint", minimum)}</p>;
}
