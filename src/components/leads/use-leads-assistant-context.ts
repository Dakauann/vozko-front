"use client";

import { useTranslations } from "next-intl";

import { usePublishAssistantContext } from "@/components/ai-chat/assistant-context";
import { leadsAssistantContext, type LeadsScreenState } from "@/lib/aichat/leads-context";

export type { LeadsScreenState };

export function usePublishLeadsAssistantContext(state: LeadsScreenState) {
  const t = useTranslations("leadsPage.assistant");
  usePublishAssistantContext(
    leadsAssistantContext(state, {
      all: t("all"),
      filtered: (conditions) => t("filtered", { count: conditions }),
      selected: (count) => t("selected", { count }),
    }),
  );
}
