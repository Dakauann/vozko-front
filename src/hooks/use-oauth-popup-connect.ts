"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getApiBaseUrl } from "@/lib/api/browser-client";
import { closePopup, openCenteredPopup, watchPopupClosed } from "@/lib/browser/popup";

export interface OAuthPopupConfig<R> {
    startPath: string;
    popupName: string;
    messageSource: string;
    cancelled: R;
    parseResult: (data: Record<string, unknown>) => R | null;
}

function apiOriginOf(apiBaseUrl: string): string {
    try {
        return new URL(apiBaseUrl).origin;
    } catch {
        return "";
    }
}

export function useOAuthPopupConnect<R>(config: OAuthPopupConfig<R>, onResult?: (result: R) => void) {
    const [isConnecting, setIsConnecting] = useState(false);
    const cleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => () => cleanupRef.current?.(), []);

    const connect = useCallback(
        (returnPath?: string) => {
            const apiBaseUrl = getApiBaseUrl();
            const params = new URLSearchParams({ redirect: "1", popup: "1" });
            if (returnPath) params.set("returnPath", returnPath);
            const startUrl = `${apiBaseUrl}${config.startPath}?${params.toString()}`;

            const popup = openCenteredPopup(startUrl, config.popupName);

            setIsConnecting(true);
            if (!popup) {
                window.location.href = startUrl;
                return;
            }

            const apiOrigin = apiOriginOf(apiBaseUrl);

            const cleanup = () => {
                window.removeEventListener("message", onMessage);
                stopWatching();
                cleanupRef.current = null;
                setIsConnecting(false);
            };

            const onMessage = (event: MessageEvent) => {
                if (apiOrigin && event.origin !== apiOrigin) return;
                const data = event.data as Record<string, unknown> | null;
                if (!data || data.source !== config.messageSource) return;

                cleanup();
                closePopup(popup);
                const result = config.parseResult(data);
                if (result !== null) onResult?.(result);
            };

            const stopWatching = watchPopupClosed(popup, () => {
                cleanup();
                onResult?.(config.cancelled);
            });

            window.addEventListener("message", onMessage);
            cleanupRef.current = cleanup;
        },
        [config, onResult],
    );

    return { connect, isConnecting };
}
