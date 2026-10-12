"use client";

import { useSyncExternalStore } from "react";

import { modelChoiceStore } from "@/lib/ai-models/model-choice-store";

export function useModelChoiceState(storageKey: string) {
  const store = modelChoiceStore(storageKey);
  const state = useSyncExternalStore(store.subscribe, store.get, store.getServer);
  return { state, store };
}
