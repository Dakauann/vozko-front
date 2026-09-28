"use client";

import { useOAuthPopupConnect, type OAuthPopupConfig } from "@/hooks/use-oauth-popup-connect";

export type InstagramConnectStatus = "connected" | "reconnected" | "error" | "cancelled";

export interface InstagramConnectResult {
    status: InstagramConnectStatus;
    username?: string;
    reason?: string;
}

const INSTAGRAM_POPUP: OAuthPopupConfig<InstagramConnectResult> = {
    startPath: "/oauth/instagram/start",
    popupName: "ig-business-login",
    messageSource: "ig-business-login",
    cancelled: { status: "cancelled" },
    parseResult: (data) =>
        data.status
            ? {
                  status: data.status as InstagramConnectStatus,
                  username: data.username as string | undefined,
                  reason: data.reason as string | undefined,
              }
            : null,
};

export function useInstagramConnect(onResult?: (result: InstagramConnectResult) => void) {
    return useOAuthPopupConnect(INSTAGRAM_POPUP, onResult);
}
