"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getAdReadinessAction, isAdsError, syncAdAccountAction, type AdsResult } from "@/app/actions/advertising";
import { createPixelAction } from "@/app/actions/advertising-conversions";
import { useMetaAdsConnect } from "@/hooks/use-meta-ads-connect";
import { usePortalPopup } from "@/hooks/use-portal-popup";
import type { AdAccount, AdInAppAction, AdReadiness } from "@/lib/advertising/types";

import { useAdsErrorText } from "./use-ads-error";

interface Loaded {
  accountId: string;
  result: AdsResult<AdReadiness>;
}

export function useAdReadiness(account: AdAccount | null | undefined, onAccountUpdated: (account: AdAccount) => void) {
  const errorText = useAdsErrorText();
  const accountId = account?.id ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [checking, setChecking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const onUpdatedRef = useRef(onAccountUpdated);
  const inFlight = useRef(false);

  useEffect(() => {
    onUpdatedRef.current = onAccountUpdated;
  }, [onAccountUpdated]);

  const settle = useCallback((id: string, result: AdsResult<AdReadiness>) => {
    setLoaded({ accountId: id, result });
    if (!isAdsError(result)) onUpdatedRef.current(result.data.account);
  }, []);

  const load = useCallback(async (id: string) => settle(id, await getAdReadinessAction(id)), [settle]);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    void getAdReadinessAction(accountId).then((result) => {
      if (!cancelled) settle(accountId, result);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, settle]);

  const recheck = useCallback(async () => {
    if (!accountId || inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    const synced = await syncAdAccountAction(accountId);
    if (!isAdsError(synced)) onUpdatedRef.current(synced.data);
    await load(accountId);
    inFlight.current = false;
    setChecking(false);
  }, [accountId, load]);

  const refresh = useCallback(() => {
    if (accountId) void load(accountId);
  }, [accountId, load]);

  const { openPortal, awaiting } = usePortalPopup(() => void recheck());
  const { connect, isConnecting } = useMetaAdsConnect(() => void recheck());

  const runInApp = useCallback(
    async (key: AdInAppAction, pixelName: string) => {
      if (!accountId) return;
      setActionError(null);
      if (key === "reconnect") {
        connect(window.location.pathname + window.location.search);
        return;
      }
      if (key === "create_pixel") {
        setChecking(true);
        const created = await createPixelAction(accountId, pixelName);
        setChecking(false);
        if (isAdsError(created)) {
          setActionError(errorText(created));
          return;
        }
      }
      await recheck();
    },
    [accountId, connect, errorText, recheck],
  );

  const current = loaded && loaded.accountId === accountId ? loaded.result : null;
  return {
    readiness: current && !isAdsError(current) ? current.data : null,
    error: current && isAdsError(current) ? errorText(current) : null,
    actionError,
    loading: !!accountId && !current,
    checking: checking || isConnecting,
    awaiting,
    recheck: () => void recheck(),
    refresh,
    openPortal,
    runInApp: (key: AdInAppAction, pixelName: string) => void runInApp(key, pixelName),
  };
}

export type AdReadinessState = ReturnType<typeof useAdReadiness>;
