"use client";

import { useOAuthPopupConnect, type OAuthPopupConfig } from "@/hooks/use-oauth-popup-connect";
import { META_ADS_POPUP_SOURCE, metaAdsResultFromMessage } from "@/lib/advertising/connect";
import type { MetaAdsConnectResult } from "@/lib/advertising/types";

const META_ADS_POPUP: OAuthPopupConfig<MetaAdsConnectResult> = {
  startPath: "/oauth/meta-ads/start",
  popupName: META_ADS_POPUP_SOURCE,
  messageSource: META_ADS_POPUP_SOURCE,
  cancelled: { status: "cancelled" },
  parseResult: metaAdsResultFromMessage,
};

export function useMetaAdsConnect(onResult?: (result: MetaAdsConnectResult) => void) {
  return useOAuthPopupConnect(META_ADS_POPUP, onResult);
}
