"use client";

import { useTranslations } from "next-intl";

import { useEmptyValue } from "@/components/elevated-design/empty-value";
import type { OptionChoiceStats } from "@/lib/choice-stats/stats";
import { cn } from "@/lib/utils";

import { useChoiceFormat } from "./use-choice-format";

export function OptionCtr({ option, fractionDigits = 1, className }: { option: OptionChoiceStats | null; fractionDigits?: number; className?: string }) {
  const t = useTranslations("choiceStats.option");
  const format = useChoiceFormat();
  const empty = useEmptyValue();
  if (option?.tracked === false) {
    return (
      <span title={t("untrackedHint")} className={cn("text-muted-foreground", className)}>
        {t("untracked")}
      </span>
    );
  }
  const measured = option !== null && option.shown > 0;
  return (
    <span data-option-ctr className={cn("tabular-nums", measured ? "text-foreground" : "text-muted-foreground", className)}>
      {measured ? t("ctr", { rate: format.rate(option.ctr, fractionDigits) }) : t("ctrEmpty", { empty })}
    </span>
  );
}
