"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";

import { ruleSentence, ruleSentenceParts, type AutomatedRule, type RuleWords } from "@/lib/advertising/rules";

import { useAdsFormat } from "../use-ads-format";

type SentenceRule = Pick<AutomatedRule, "entity" | "objectIds" | "window" | "conditions" | "action" | "frequency">;

export function useRuleSentence(currency: string) {
  const t = useTranslations("adsRules.sentence");
  const fmt = useAdsFormat();

  const words = useMemo<RuleWords>(
    () => ({
      condition: (metric, window, operator, value) =>
        t("condition", { metric: t(`metrics.${metric}`), window: t(`windows.${window}`), operator: t(`operators.${operator}`), value }),
      and: t("and"),
      action: (choice, entity, percent) =>
        t(`actions.${choice}`, { object: t(`objects.${entity}`), of: t(`of.${entity}`), percent }),
      frequency: (frequency) => t(`frequencies.${frequency}`),
      sentence: (conditions, action) => t("sentence", { conditions, action }),
    }),
    [t],
  );

  return useCallback(
    (rule: SentenceRule) => ruleSentence(ruleSentenceParts(rule, currency, fmt.tag), words),
    [currency, fmt.tag, words],
  );
}
