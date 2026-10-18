import { localStore } from "@/lib/stored-size";

import { isModelCapability, type ModelCapability } from "./capabilities";
import { reasoningAfterModelChange, type ReasoningAdjustment, type ReasoningOptions } from "./reasoning";

interface ModelChoiceState {
  model: string;
  reasoning: string;
  adjusted: ReasoningAdjustment | null;
}

interface ModelChoiceStore {
  get: () => ModelChoiceState;
  getServer: () => ModelChoiceState;
  subscribe: (listener: () => void) => () => void;
  chooseModel: (model: string, options: ReasoningOptions | undefined) => void;
  chooseReasoning: (level: string) => void;
  acknowledgeAdjustment: () => void;
}

const EMPTY_CHOICE: ModelChoiceState = { model: "", reasoning: "", adjusted: null };

function readItem(key: string): string {
  try {
    return localStore()?.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeItem(key: string, value: string): void {
  try {
    localStore()?.setItem(key, value);
  } catch {
    return;
  }
}

export function createModelChoiceStore(storageKey: string): ModelChoiceStore {
  const modelKey = `${storageKey}:model`;
  const reasoningKey = `${storageKey}:reasoning`;
  let state: ModelChoiceState | null = null;
  const listeners = new Set<() => void>();

  const current = (): ModelChoiceState => {
    if (state === null) {
      state = typeof window === "undefined" ? EMPTY_CHOICE : { model: readItem(modelKey), reasoning: readItem(reasoningKey), adjusted: null };
    }
    return state;
  };

  const update = (next: ModelChoiceState) => {
    state = next;
    writeItem(modelKey, next.model);
    writeItem(reasoningKey, next.reasoning);
    listeners.forEach((listener) => listener());
  };

  return {
    get: current,
    getServer: () => EMPTY_CHOICE,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    chooseModel: (model, options) => {
      const { level, adjusted } = reasoningAfterModelChange(current().reasoning, options);
      update({ model, reasoning: level, adjusted });
    },
    chooseReasoning: (level) => {
      update({ ...current(), reasoning: level, adjusted: null });
    },
    acknowledgeAdjustment: () => {
      if (current().adjusted) update({ ...current(), adjusted: null });
    },
  };
}

const stores = new Map<string, ModelChoiceStore>();

export function modelChoiceStore(storageKey: string): ModelChoiceStore {
  let store = stores.get(storageKey);
  if (!store) {
    store = createModelChoiceStore(storageKey);
    stores.set(storageKey, store);
  }
  return store;
}

const FILTER_PREFIX = "ai-models:filters:";

export function readFilterMemory(surfaceKey: string): ModelCapability[] {
  try {
    const parsed: unknown = JSON.parse(localStore()?.getItem(FILTER_PREFIX + surfaceKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is ModelCapability => typeof value === "string" && isModelCapability(value)) : [];
  } catch {
    return [];
  }
}

export function writeFilterMemory(surfaceKey: string, filters: readonly ModelCapability[]): void {
  try {
    localStore()?.setItem(FILTER_PREFIX + surfaceKey, JSON.stringify(filters));
  } catch {
    return;
  }
}
