import { accountPath } from "@/lib/advertising/report-query";
import { apiClient } from "@/lib/api/browser-client";
import type { ConversionRecord, ConversionSettings, Pixel } from "@/lib/advertising/conversions";

import type { AdsResult } from "./advertising";
import { settleAds } from "./advertising-result";

export async function listPixelsAction(accountId: string): Promise<AdsResult<Pixel[]>> {
  return settleAds(await apiClient<Pixel[]>(`${accountPath(accountId)}/pixels`, { method: "GET" }), []);
}

export async function createPixelAction(accountId: string, name: string): Promise<AdsResult<Pixel>> {
  return settleAds(await apiClient<Pixel>(`${accountPath(accountId)}/pixels`, { method: "POST", body: JSON.stringify({ name }) }));
}

export async function getConversionSettingsAction(): Promise<AdsResult<ConversionSettings | null>> {
  const result = await apiClient<ConversionSettings>("/ads/conversions/settings", { method: "GET" });
  if (result.error?.status === 404) return { data: null };
  return settleAds<ConversionSettings | null>(result, null);
}

export async function saveConversionSettingsAction(settings: ConversionSettings): Promise<AdsResult<ConversionSettings>> {
  return settleAds(await apiClient<ConversionSettings>("/ads/conversions/settings", { method: "PUT", body: JSON.stringify(settings) }));
}

export async function connectConversionDatasetAction(businessPhoneId: string): Promise<AdsResult<{ datasetId: string }>> {
  return settleAds(
    await apiClient<{ datasetId: string }>("/ads/conversions/dataset", { method: "POST", body: JSON.stringify({ businessPhoneId }) }),
  );
}

export async function listRecentConversionsAction(): Promise<AdsResult<ConversionRecord[]>> {
  return settleAds(await apiClient<ConversionRecord[]>("/ads/conversions/recent", { method: "GET" }), []);
}
