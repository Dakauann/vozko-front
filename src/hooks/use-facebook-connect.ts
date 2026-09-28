"use client";

import { useOAuthPopupConnect, type OAuthPopupConfig } from "@/hooks/use-oauth-popup-connect";
import { FACEBOOK_POPUP_SOURCE, connectResultFromMessage } from "@/lib/facebook/connect";
import type { FacebookConnectResult } from "@/lib/facebook/types";

const FACEBOOK_POPUP: OAuthPopupConfig<FacebookConnectResult> = {
    startPath: "/oauth/facebook/start",
    popupName: FACEBOOK_POPUP_SOURCE,
    messageSource: FACEBOOK_POPUP_SOURCE,
    cancelled: { status: "cancelled" },
    parseResult: connectResultFromMessage,
};

export function useFacebookConnect(onResult?: (result: FacebookConnectResult) => void) {
    return useOAuthPopupConnect(FACEBOOK_POPUP, onResult);
}
