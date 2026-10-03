"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isAdsError, type AdsResult } from "@/app/actions/advertising";
import { listAdDraftsAction } from "@/app/actions/advertising-drafts";
import { hasPublishing } from "@/lib/advertising/manager-drafts";
import type { AdDraftList } from "@/lib/advertising/types";

import { useAdsErrorText } from "../use-ads-error";

const PUBLISHING_POLL_MS = 5_000;

interface Loaded {
  accountId: string;
  result: AdsResult<AdDraftList>;
}

export function useAdDrafts(accountId: string | null, enabled: boolean, onPublishingSettled: () => void) {
  const errorText = useAdsErrorText();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [token, setToken] = useState(0);
  const settledRef = useRef(onPublishingSettled);
  const publishingBefore = useRef(false);

  useEffect(() => {
    settledRef.current = onPublishingSettled;
  }, [onPublishingSettled]);

  useEffect(() => {
    if (!enabled || !accountId) return;
    let cancelled = false;
    void listAdDraftsAction(accountId).then((result) => {
      if (cancelled) return;
      const publishing = !isAdsError(result) && hasPublishing(result.data.drafts ?? []);
      if (publishingBefore.current && !publishing) settledRef.current();
      publishingBefore.current = publishing;
      setLoaded({ accountId, result });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, accountId, token]);

  const current = loaded && loaded.accountId === accountId ? loaded.result : null;
  const list = current && !isAdsError(current) ? current.data : null;
  const drafts = list ? (list.drafts ?? []) : null;
  const publishing = drafts ? hasPublishing(drafts) : false;

  useEffect(() => {
    if (!publishing) return;
    const timer = window.setTimeout(() => setToken((value) => value + 1), PUBLISHING_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [publishing, loaded]);

  const reload = useCallback(() => setToken((value) => value + 1), []);

  return {
    drafts,
    objectCount: list ? list.objectCount : null,
    error: current && isAdsError(current) ? errorText(current) : null,
    loading: enabled && !!accountId && !current,
    reload,
  };
}

export type AdDraftsState = ReturnType<typeof useAdDrafts>;
