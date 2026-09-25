"use client";

import { useCallback, useEffect, useState } from "react";

import { getAgentOptionsAction } from "@/app/actions/agents";
import type { ModelPricingInfo } from "@/lib/agents/types";

const CHAT_MODEL_KEY = "ai-chat:model";

function storedModel(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(CHAT_MODEL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function useChatModel() {
  const [models, setModels] = useState<string[]>([]);
  const [pricing, setPricing] = useState<ModelPricingInfo[]>([]);
  const [model, setModel] = useState<string>(storedModel);

  useEffect(() => {
    let cancelled = false;
    getAgentOptionsAction().then(({ options }) => {
      if (cancelled || !options) return;
      const messagingModels = options.messaging ?? [];
      setModels(messagingModels);
      setPricing(options.modelPricing ?? []);
      setModel((prev) => prev || options.defaults?.messagingModel || messagingModels[0] || "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const changeModel = useCallback((next: string) => {
    setModel(next);
    try {
      localStorage.setItem(CHAT_MODEL_KEY, next);
    } catch {
    }
  }, []);

  return { model, models, pricing, changeModel };
}
