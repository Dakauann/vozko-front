"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getApiBaseUrl } from "@/lib/api/browser-client";

export type InstagramConnectStatus = "connected" | "reconnected" | "error" | "cancelled";

export interface InstagramConnectResult {
    status: InstagramConnectStatus;
    username?: string;
    reason?: string;
}

export function useInstagramConnect(onResult?: (result: InstagramConnectResult) => void) {
    const [isConnecting, setIsConnecting] = useState(false);
    const cleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => () => cleanupRef.current?.(), []);

    const connect = useCallback(
        (returnPath?: string) => {
            const apiBaseUrl = getApiBaseUrl();
            const params = new URLSearchParams({ redirect: "1", popup: "1" });
            if (returnPath) params.set("returnPath", returnPath);
            const startUrl = `${apiBaseUrl}/oauth/instagram/start?${params.toString()}`;

            const w = 520;
            const h = 720;
            const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
            const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
            const popup = window.open(
                startUrl,
                "ig-business-login",
                `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
            );

            if (!popup) {
                setIsConnecting(true);
                window.location.href = startUrl;
                return;
            }

            setIsConnecting(true);

            let apiOrigin = "";
            try {
                apiOrigin = new URL(apiBaseUrl).origin;
            } catch {
                apiOrigin = "";
            }

            const cleanup = () => {
                window.removeEventListener("message", onMessage);
                window.clearInterval(closeTimer);
                cleanupRef.current = null;
                setIsConnecting(false);
            };

            const onMessage = (event: MessageEvent) => {
                if (apiOrigin && event.origin !== apiOrigin) return;

                const data = event.data as {
                    source?: string;
                    status?: InstagramConnectStatus;
                    username?: string;
                    reason?: string;
                };
                if (data?.source !== "ig-business-login") return;

                cleanup();
                try {
                    popup.close();
                } catch {
                }
                if (data.status) {
                    onResult?.({ status: data.status, username: data.username, reason: data.reason });
                }
            };

            const closeTimer = window.setInterval(() => {
                if (popup.closed) {
                    cleanup();
                    onResult?.({ status: "cancelled" });
                }
            }, 600);

            window.addEventListener("message", onMessage);
            cleanupRef.current = cleanup;
        },
        [onResult],
    );

    return { connect, isConnecting };
}
