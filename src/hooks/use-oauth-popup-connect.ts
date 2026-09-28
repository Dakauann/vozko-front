"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getApiBaseUrl } from "@/lib/api/browser-client";

export interface OAuthPopupConfig<R> {
    startPath: string;
    popupName: string;
    messageSource: string;
    cancelled: R;
    parseResult: (data: Record<string, unknown>) => R | null;
}

const POPUP_WIDTH = 520;
const POPUP_HEIGHT = 720;
const CLOSE_POLL_MS = 600;

function apiOriginOf(apiBaseUrl: string): string {
    try {
        return new URL(apiBaseUrl).origin;
    } catch {
        return "";
    }
}

function closePopup(popup: Window): boolean {
    try {
        popup.close();
        return true;
    } catch {
        return false;
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

            const left = window.screenX + Math.max(0, (window.outerWidth - POPUP_WIDTH) / 2);
            const top = window.screenY + Math.max(0, (window.outerHeight - POPUP_HEIGHT) / 2);
            const popup = window.open(
                startUrl,
                config.popupName,
                `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},resizable=yes,scrollbars=yes`,
            );

            setIsConnecting(true);
            if (!popup) {
                window.location.href = startUrl;
                return;
            }

            const apiOrigin = apiOriginOf(apiBaseUrl);

            const cleanup = () => {
                window.removeEventListener("message", onMessage);
                window.clearInterval(closeTimer);
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

            const closeTimer = window.setInterval(() => {
                if (popup.closed) {
                    cleanup();
                    onResult?.(config.cancelled);
                }
            }, CLOSE_POLL_MS);

            window.addEventListener("message", onMessage);
            cleanupRef.current = cleanup;
        },
        [config, onResult],
    );

    return { connect, isConnecting };
}
