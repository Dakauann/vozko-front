"use client";

import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import { useModelChoiceState } from "@/hooks/use-model-choice-state";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { CHAT_MODEL_STORAGE } from "@/lib/ai-models/storage-keys";
import { ELO_SURFACE } from "@/lib/ai-models/surfaces";

export function ChatModelSelector({
  label,
  value,
  onValueChange,
  models,
  modelPricing,
  disabled,
}: {
  label: string;
  value: string;
  onValueChange: (model: string) => void;
  models: string[];
  modelPricing: ModelPricingInfo[];
  disabled?: boolean;
}) {
  const { state, store } = useModelChoiceState(CHAT_MODEL_STORAGE);
  return (
    <AIModelSelector
      variant="toolbar"
      surface={ELO_SURFACE}
      label={label}
      value={value}
      onValueChange={onValueChange}
      models={models}
      modelPricing={modelPricing}
      disabled={disabled}
      reasoning={state.reasoning}
      onReasoningChange={store.chooseReasoning}
      reasoningAdjusted={state.adjusted}
      onReasoningAcknowledge={store.acknowledgeAdjustment}
    />
  );
}
