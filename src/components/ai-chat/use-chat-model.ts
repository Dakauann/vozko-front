"use client";

import { useModelChoice } from "@/hooks/use-model-choice";
import { CHAT_MODEL_STORAGE } from "@/lib/ai-models/storage-keys";

export function useChatModel() {
  return useModelChoice(CHAT_MODEL_STORAGE);
}
