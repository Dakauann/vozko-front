"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isAdsError } from "@/app/actions/advertising";
import { updateAdDraftAction } from "@/app/actions/advertising-drafts";
import type { MetaAdDraft } from "@/lib/advertising/draft-types";
import { saveFailure, type SaveFailure } from "@/lib/advertising/editor-status";

import { useAdsErrorText } from "../use-ads-error";

const AUTOSAVE_DELAY_MS = 800;

const MAX_FLUSH_ROUNDS = 3;

export type AutosaveState = "saved" | "pending" | "saving" | "error";

export function useDraftAutosave({
  draftId,
  draft,
  version,
  enabled,
  onConflict,
}: {
  draftId: string;
  draft: MetaAdDraft;
  version: number;
  enabled: boolean;
  onConflict: (failure: Exclude<SaveFailure, "other">) => void;
}) {
  const errorText = useAdsErrorText();
  const key = JSON.stringify(draft);
  const [savedKey, setSavedKey] = useState(key);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef({ draft, key });
  const savedKeyRef = useRef(key);
  const versionRef = useRef(version);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const conflict = useRef(onConflict);

  useEffect(() => {
    latest.current = { draft, key };
    conflict.current = onConflict;
  });

  const saveLatest = useCallback(async (): Promise<boolean> => {
    const target = latest.current;
    if (target.key === savedKeyRef.current) return true;
    setSaving(true);
    const result = await updateAdDraftAction(draftId, target.draft, versionRef.current);
    setSaving(false);
    if (isAdsError(result)) {
      const failure = saveFailure(result);
      if (failure === "other") setError(errorText(result));
      else conflict.current(failure);
      return false;
    }
    versionRef.current = result.data.version;
    savedKeyRef.current = target.key;
    setSavedKey(target.key);
    setError(null);
    return true;
  }, [draftId, errorText]);

  const flush = useCallback(async (): Promise<boolean> => {
    while (inFlight.current) await inFlight.current;
    let ok = true;
    for (let attempt = 0; ok && attempt < MAX_FLUSH_ROUNDS && latest.current.key !== savedKeyRef.current; attempt += 1) {
      const run = saveLatest();
      inFlight.current = run;
      ok = await run;
      inFlight.current = null;
    }
    return ok && latest.current.key === savedKeyRef.current;
  }, [saveLatest]);

  useEffect(() => {
    if (!enabled || key === savedKey || error) return;
    const timer = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled, key, savedKey, error, flush]);

  const unsaved = enabled && key !== savedKey;

  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const retry = useCallback(() => {
    setError(null);
    void flush();
  }, [flush]);

  const savedVersion = useCallback(() => versionRef.current, []);
  const adoptVersion = useCallback((next: number) => {
    versionRef.current = next;
  }, []);

  const state: AutosaveState = error ? "error" : saving ? "saving" : key === savedKey ? "saved" : "pending";
  return { state, error, flush, retry, savedVersion, adoptVersion };
}
