"use client";

import { useEffect, useRef } from "react";

import { useOptionalCrm } from "@/contexts/crm-context";

export const LEADS_LIVE_REFETCH_INTERVAL_MS = 3_000;

export const LEADS_LIVE_AGGREGATES_INTERVAL_MS = 30_000;

export interface RefetchThrottle {
  request: () => void;
  resume: () => void;
  cancel: () => void;
}

export function createRefetchThrottle(run: () => void, intervalMs: number, hidden: () => boolean): RefetchThrottle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;
  let cancelled = false;

  const cool = () => {
    timer = setTimeout(() => {
      timer = null;
      if (!pending || cancelled) return;
      if (hidden()) return;
      fire();
    }, intervalMs);
  };

  const fire = () => {
    pending = false;
    run();
    cool();
  };

  return {
    request: () => {
      if (cancelled) return;
      pending = true;
      if (timer !== null || hidden()) return;
      fire();
    },
    resume: () => {
      if (cancelled || !pending || timer !== null || hidden()) return;
      fire();
    },
    cancel: () => {
      cancelled = true;
      pending = false;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}

export interface QuietReloadGate {
  markLive: () => void;
  quiet: (request: string) => boolean;
}

export function createQuietReloadGate(): QuietReloadGate {
  let live = false;
  let fetched: string | null = null;
  return {
    markLive: () => {
      live = true;
    },
    quiet: (request) => {
      const quiet = live && fetched === request;
      live = false;
      fetched = request;
      return quiet;
    },
  };
}

function pageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

export interface LeadsLiveRefetchOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export function useLeadsLiveRefetch(
  refetch: () => void,
  { enabled = true, intervalMs = LEADS_LIVE_REFETCH_INTERVAL_MS }: LeadsLiveRefetchOptions = {},
) {
  const crm = useOptionalCrm();
  const subscribeLead = crm?.subscribeLeadUpdates;
  const subscribeBulk = crm?.subscribeLeadsBulkUpdates;
  const live = crm?.status === "connected";
  const refetchRef = useRef(refetch);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    if (!enabled) return;
    const throttle = createRefetchThrottle(() => refetchRef.current(), intervalMs, pageHidden);
    const leaveLead = subscribeLead?.(() => throttle.request());
    const leaveBulk = subscribeBulk?.(() => throttle.request());
    const onVisibility = () => {
      if (!pageHidden()) throttle.resume();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      leaveLead?.();
      leaveBulk?.();
      document.removeEventListener("visibilitychange", onVisibility);
      throttle.cancel();
    };
  }, [enabled, intervalMs, subscribeLead, subscribeBulk]);

  useEffect(() => {
    if (!enabled || live) return;
    const onFocus = () => refetchRef.current();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [enabled, live]);
}
