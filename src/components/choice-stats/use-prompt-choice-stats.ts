"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getTemplateChoiceStatsAction,
  getUnofficialCampaignChoiceStatsAction,
  getWhatsAppCampaignChoiceStatsAction,
} from "@/app/actions/choice-stats";
import type { ChoiceStatsAnswer } from "@/lib/choice-stats/answer";
import type { PromptChoiceStats } from "@/lib/choice-stats/stats";

export type PromptChoiceSource = { kind: "whatsapp_campaign" | "unofficial_campaign" | "template"; id: string };

export interface PromptChoiceRead {
  answer: ChoiceStatsAnswer<PromptChoiceStats> | null;
  loading: boolean;
  reload: () => void;
}

const LOADERS: Record<PromptChoiceSource["kind"], (id: string) => Promise<ChoiceStatsAnswer<PromptChoiceStats>>> = {
  whatsapp_campaign: getWhatsAppCampaignChoiceStatsAction,
  unofficial_campaign: getUnofficialCampaignChoiceStatsAction,
  template: getTemplateChoiceStatsAction,
};

export function usePromptChoiceStats(source: PromptChoiceSource | null): PromptChoiceRead {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ key: string; answer: ChoiceStatsAnswer<PromptChoiceStats> } | null>(null);
  const kind = source?.kind ?? null;
  const id = source?.id ?? null;
  const requestKey = kind && id ? `${kind}:${id}:${attempt}` : null;

  useEffect(() => {
    if (!kind || !id || !requestKey) return;
    let cancelled = false;
    void LOADERS[kind](id).then((answer) => {
      if (!cancelled) setSettled({ key: requestKey, answer });
    });
    return () => {
      cancelled = true;
    };
  }, [kind, id, requestKey]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  return { answer: settled?.answer ?? null, loading: requestKey !== null && settled?.key !== requestKey, reload };
}
