"use client";

import { useOAuthPopupConnect, type OAuthPopupConfig } from "@/hooks/use-oauth-popup-connect";
import { TIKTOK_OAUTH_START_PATH, TIKTOK_POPUP_SOURCE, connectResultFromMessage } from "@/lib/tiktok/connect";
import type { TiktokConnectResult } from "@/lib/tiktok/types";

const TIKTOK_POPUP: OAuthPopupConfig<TiktokConnectResult> = {
  startPath: TIKTOK_OAUTH_START_PATH,
  popupName: TIKTOK_POPUP_SOURCE,
  messageSource: TIKTOK_POPUP_SOURCE,
  cancelled: { status: "cancelled" },
  parseResult: connectResultFromMessage,
};

export function useTiktokConnect(onResult?: (result: TiktokConnectResult) => void) {
  return useOAuthPopupConnect(TIKTOK_POPUP, onResult);
}
