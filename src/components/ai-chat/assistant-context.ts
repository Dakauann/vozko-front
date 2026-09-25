"use client";

import { useEffect, useSyncExternalStore } from "react";

import { createAssistantContextStore, type AssistantContext } from "@/lib/aichat/assistant-context";

const store = createAssistantContextStore();

export function useAssistantContext(): AssistantContext | null {
  return useSyncExternalStore(store.subscribe, store.get, () => null);
}

export function usePublishAssistantContext(context: AssistantContext | null) {
  const fingerprint = JSON.stringify(context);

  useEffect(() => {
    store.set(JSON.parse(fingerprint) as AssistantContext | null);
  }, [fingerprint]);

  useEffect(() => () => store.set(null), []);
}
