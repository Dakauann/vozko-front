"use client";

import { useMemo } from "react";

import { useOAuthPopupConnect, type OAuthPopupConfig } from "@/hooks/use-oauth-popup-connect";
import { GOOGLE_POPUP_SOURCE, googleResultFromMessage, googleStartPath } from "@/lib/google/connect";
import type { GoogleConnectResult, GoogleProduct } from "@/lib/google/types";

export function useGoogleConnect(product: GoogleProduct, onResult?: (result: GoogleConnectResult) => void) {
  const config = useMemo<OAuthPopupConfig<GoogleConnectResult>>(
    () => ({
      startPath: googleStartPath(product),
      popupName: GOOGLE_POPUP_SOURCE,
      messageSource: GOOGLE_POPUP_SOURCE,
      cancelled: { status: "cancelled" },
      parseResult: googleResultFromMessage,
    }),
    [product],
  );
  return useOAuthPopupConnect(config, onResult);
}
