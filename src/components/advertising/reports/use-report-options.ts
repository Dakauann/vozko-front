"use client";

import { getAdReportOptionsAction } from "@/app/actions/advertising-reports";

import { useAdsResource } from "../wizard/use-ads-resource";

export function useReportOptions(enabled: boolean) {
  return useAdsResource(enabled ? "report-options" : null, getAdReportOptionsAction);
}
