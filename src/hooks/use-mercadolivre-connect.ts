"use client";

import { useOAuthPopupConnect, type OAuthPopupConfig } from "@/hooks/use-oauth-popup-connect";
import { MERCADOLIVRE_OAUTH_START_PATH, MERCADOLIVRE_POPUP_SOURCE, connectResultFromMessage } from "@/lib/mercadolivre/connect";
import type { MercadoLivreConnectResult } from "@/lib/mercadolivre/types";

const MERCADOLIVRE_POPUP: OAuthPopupConfig<MercadoLivreConnectResult> = {
  startPath: MERCADOLIVRE_OAUTH_START_PATH,
  popupName: MERCADOLIVRE_POPUP_SOURCE,
  messageSource: MERCADOLIVRE_POPUP_SOURCE,
  cancelled: { status: "cancelled" },
  parseResult: connectResultFromMessage,
};

export function useMercadoLivreConnect(onResult?: (result: MercadoLivreConnectResult) => void) {
  return useOAuthPopupConnect(MERCADOLIVRE_POPUP, onResult);
}
