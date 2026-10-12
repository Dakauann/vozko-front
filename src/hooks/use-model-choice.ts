"use client";

import { useCallback, useEffect, useState } from "react";

import { getAgentOptionsAction } from "@/app/actions/agents";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { reasoningOptionsOf, resolveReasoning } from "@/lib/ai-models/reasoning";

import { useModelChoiceState } from "./use-model-choice-state";

interface ModelCatalog {
  models: string[];
  pricing: ModelPricingInfo[];
  fallback: string;
}

const EMPTY_CATALOG: ModelCatalog = { models: [], pricing: [], fallback: "" };

export function useModelChoice(storageKey: string) {
  const { state, store } = useModelChoiceState(storageKey);
  const [catalog, setCatalog] = useState<ModelCatalog>(EMPTY_CATALOG);

  useEffect(() => {
    let cancelled = false;
    getAgentOptionsAction().then(({ options }) => {
      if (cancelled || !options) return;
      const models = options.messaging ?? [];
      setCatalog({ models, pricing: options.modelPricing ?? [], fallback: options.defaults?.messagingModel || models[0] || "" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const model = state.model || catalog.fallback;
  const reasoning = resolveReasoning(reasoningOptionsOf(catalog.pricing, model), state.reasoning);

  const changeModel = useCallback(
    (next: string) => store.chooseModel(next, reasoningOptionsOf(catalog.pricing, next)),
    [store, catalog.pricing],
  );
  const changeReasoning = useCallback((level: string) => store.chooseReasoning(level), [store]);
  const acknowledgeAdjustment = useCallback(() => store.acknowledgeAdjustment(), [store]);

  return {
    model,
    models: catalog.models,
    pricing: catalog.pricing,
    reasoning,
    storedReasoning: state.reasoning,
    adjusted: state.adjusted,
    changeModel,
    changeReasoning,
    acknowledgeAdjustment,
  };
}
