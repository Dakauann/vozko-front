"use client";

import { runAdReportAction } from "@/app/actions/advertising-reports";
import type { AdReportRunRequest } from "@/lib/advertising/types";

import { useAdsResource } from "../wizard/use-ads-resource";

export function useReportRun(accountId: string, request: AdReportRunRequest | null, refreshToken = 0) {
  const key = request ? `report-run:${JSON.stringify({ accountId, request, refreshToken })}` : null;
  return useAdsResource(key, () => runAdReportAction(accountId, request!));
}
