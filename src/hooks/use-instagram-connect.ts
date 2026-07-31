"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getApiBaseUrl } from "@/lib/api/browser-client";

export type InstagramConnectStatus = "connected" | "reconnected" | "error" | "cancelled";

export interface InstagramConnectResult {
    status: InstagramConnectStatus;
    username?: string;
    reason?: string;
}

/**
 * Launches Business Login for Instagram in a centered popup, mirroring the
 * WhatsApp Embedded Signup transport so both channels onboard the same way.
 *
 * Security notes, since this is an OAuth transport:
 *
 *  - the popup receives its result via `postMessage`, and the listener compares
 *    `event.origin` for EXACT equality with the API origin. A suffix check would
 *    let `evilourapi.com` through.
 *  - the redirect URI is never passed from here. It is server-side configuration
 *    that must match the Meta App Dashboard exactly; a caller-supplied redirect
 *    URI is how authorization codes get delivered to an attacker. The only thing
 *    the caller chooses is `returnPath`, which the backend validates as a
 *    relative path.
 *  - if the popup is blocked, this falls back to a full-page redirect, which is
 *    also the mobile-friendly path where `window.opener` is often null.
 */
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

            // Popup blocked, or a mobile browser that will not give us a usable
            // opener: fall back to navigating this tab.
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
                // EXACT origin comparison. Never endsWith.
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
                    /* the popup may already be gone */
                }
                if (data.status) {
                    onResult?.({ status: data.status, username: data.username, reason: data.reason });
                }
            };

            // Abandonment detection: the user closing the popup is a normal outcome
            // and must resolve the button state rather than leaving it spinning.
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
