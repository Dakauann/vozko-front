"use client";

import { useCallback, useSyncExternalStore } from "react";

import { useSignedInUserId } from "@/contexts/auth-context";
import {
  DEFAULT_INFO_PANEL,
  infoPanelPreferencesKey,
  readInfoPanelPreferences,
  writeInfoPanelPreferences,
  type InfoPanelPreferences,
  type InfoPanelTab,
} from "@/lib/crm/info-panel-preferences";
import { localStore } from "@/lib/stored-size";

const ANONYMOUS = "anonymous";
const remembered = new Map<string, InfoPanelPreferences>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function current(storageKey: string | null): InfoPanelPreferences {
  const memoryKey = storageKey ?? ANONYMOUS;
  const known = remembered.get(memoryKey);
  if (known) return known;
  const stored = storageKey ? readInfoPanelPreferences(localStore(), storageKey) : DEFAULT_INFO_PANEL;
  remembered.set(memoryKey, stored);
  return stored;
}

export function useInfoPanelPreferences() {
  const storageKey = infoPanelPreferencesKey(useSignedInUserId());
  const preferences = useSyncExternalStore(
    subscribe,
    () => current(storageKey),
    () => DEFAULT_INFO_PANEL,
  );

  const update = useCallback(
    (patch: Partial<InfoPanelPreferences>) => {
      const next = { ...current(storageKey), ...patch };
      remembered.set(storageKey ?? ANONYMOUS, next);
      if (storageKey) writeInfoPanelPreferences(localStore(), storageKey, next);
      listeners.forEach((listener) => listener());
    },
    [storageKey],
  );

  const setOpen = useCallback((open: boolean) => update({ open }), [update]);
  const toggleOpen = useCallback(() => update({ open: !current(storageKey).open }), [storageKey, update]);
  const setTab = useCallback((tab: InfoPanelTab) => update({ tab }), [update]);

  return { open: preferences.open, tab: preferences.tab, setOpen, toggleOpen, setTab };
}
