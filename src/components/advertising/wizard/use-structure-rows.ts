"use client";

import { getAdsReportAction, isAdsError } from "@/app/actions/advertising";
import { rangeForPreset } from "@/lib/advertising/date-range";
import type { AdLevel, AdRow } from "@/lib/advertising/types";

import { useAdsResource } from "./use-ads-resource";

export function useStructureRows(accountId: string, level: AdLevel, enabled: boolean, today: string | null, campaignIds: string[] = []) {
  const scope = campaignIds.join(",");
  const key = enabled && accountId ? `structure:${accountId}:${level}:${scope}` : null;
  return useAdsResource<AdRow[]>(key, async () => {
    const day = today ?? new Date().toISOString().slice(0, 10);
    const result = await getAdsReportAction(accountId, { level, range: rangeForPreset("last30", day), campaignIds });
    return isAdsError(result) ? result : { data: result.data.rows ?? [] };
  });
}
