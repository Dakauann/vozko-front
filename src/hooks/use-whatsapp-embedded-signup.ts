"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useWorkspace } from "@/contexts/workspace-context";
import { apiOriginOf, embeddedSignupResult, embeddedSignupUrl, EMBEDDED_SIGNUP_SOURCE } from "@/lib/whatsapp-business-phones/embedded-signup";

const POPUP_WIDTH = 520;
const POPUP_HEIGHT = 720;
const CLOSED_POLL_MS = 600;

export type EmbeddedSignupOutcome = "success" | "failed" | "no_workspace";

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
}

export function useWhatsAppEmbeddedSignup(onOutcome?: (outcome: EmbeddedSignupOutcome, status?: string) => void) {
  const { currentWorkspace } = useWorkspace();
  const [connecting, setConnecting] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const outcomeRef = useRef(onOutcome);
  useEffect(() => {
    outcomeRef.current = onOutcome;
  }, [onOutcome]);

  useEffect(() => () => cleanupRef.current?.(), []);

  const start = useCallback(() => {
    if (!currentWorkspace?.id) {
      outcomeRef.current?.("no_workspace");
      return;
    }
    const base = apiBaseUrl();
    const signupUrl = embeddedSignupUrl(base, currentWorkspace.id, window.location.origin + window.location.pathname);
    const left = window.screenX + Math.max(0, (window.outerWidth - POPUP_WIDTH) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - POPUP_HEIGHT) / 2);
    const popup = window.open(
      signupUrl,
      EMBEDDED_SIGNUP_SOURCE,
      `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );
    setConnecting(true);
    if (!popup) {
      window.location.href = signupUrl;
      return;
    }

    const apiOrigin = apiOriginOf(base);
    const onMessage = (event: MessageEvent) => {
      const status = embeddedSignupResult(event, apiOrigin);
      if (status === null) return;
      cleanup();
      try {
        popup.close();
      } catch {}
      outcomeRef.current?.(status === "success" ? "success" : "failed", status);
    };
    const closedTimer = window.setInterval(() => {
      if (popup.closed) cleanup();
    }, CLOSED_POLL_MS);
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(closedTimer);
      cleanupRef.current = null;
      setConnecting(false);
    };
    cleanupRef.current?.();
    cleanupRef.current = cleanup;
    window.addEventListener("message", onMessage);
  }, [currentWorkspace?.id]);

  return { start, connecting };
}
