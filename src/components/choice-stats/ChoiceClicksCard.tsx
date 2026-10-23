"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { Meter } from "@/components/charts/vozko";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { basisPointsToPercent } from "@/lib/format/basis-points";
import { optionStatsOf, type OptionChoiceStats, type PromptStats } from "@/lib/choice-stats/stats";

import { ChoiceStatsProblemNotice, ChoiceSummaryTiles, hasSends } from "./ChoiceSummary";
import { OptionCtr } from "./OptionCtr";
import { useChoiceFormat } from "./use-choice-format";
import type { PromptChoiceRead } from "./use-prompt-choice-stats";

export interface ChoiceOptionLabel {
  optionId: string;
  label: string;
}

interface CardRow {
  optionId: string;
  label: string;
  stats: OptionChoiceStats | null;
}

function rowsOf(stats: PromptStats, options: readonly ChoiceOptionLabel[], fallback: (id: string) => string): CardRow[] {
  const named = options.map((option) => ({ ...option, stats: optionStatsOf(stats, option.optionId) }));
  const known = new Set(options.map((option) => option.optionId));
  const extra = stats.options.filter((option) => !known.has(option.optionId)).map((option) => ({ optionId: option.optionId, label: fallback(option.optionId), stats: option }));
  return [...named, ...extra];
}

function OptionRow({ row }: { row: CardRow }) {
  const t = useTranslations("choiceStats.card");
  const format = useChoiceFormat();
  const labelId = useId();
  const measured = row.stats !== null && row.stats.tracked !== false && row.stats.shown > 0;
  return (
    <li aria-labelledby={labelId}>
      <div className="flex items-baseline justify-between gap-2">
        <span id={labelId} className="truncate text-2xs font-semibold text-muted-foreground">
          {row.label}
        </span>
        <OptionCtr option={row.stats} className="readout shrink-0 text-sm font-semibold" />
      </div>
      {measured && row.stats ? (
        <div className="mt-1 flex items-center gap-2">
          <Meter value={basisPointsToPercent(row.stats.ctr)} label={row.label} size="md" />
          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">{t("ofShown", { clicks: format.count(row.stats.clicks), shown: format.count(row.stats.shown) })}</span>
        </div>
      ) : null}
    </li>
  );
}

export function ChoiceClicksCard({
  read,
  options,
  scope,
  className,
}: {
  read: PromptChoiceRead;
  options: readonly ChoiceOptionLabel[];
  scope: "campaign" | "template";
  className?: string;
}) {
  const t = useTranslations("choiceStats");
  const { answer, loading } = read;
  const stats = answer?.status === "ready" ? answer.stats.prompt : null;

  return (
    <PanelSection boxed className={className} title={t("card.title")} description={scope === "campaign" ? t("card.campaignDescription") : t("card.templateDescription")}>
      <div className="space-y-4">
        {!answer && loading ? <p className="text-xs text-muted-foreground">{t("card.loading")}</p> : null}
        {answer && answer.status !== "ready" ? (
          <ChoiceStatsProblemNotice problem={answer} unreadable={t("card.unreadable")} failed={t("card.failed")} onRetry={read.reload} />
        ) : null}
        {answer?.status === "ready" ? (
          <>
            <ChoiceSummaryTiles stats={stats} />
            {hasSends(stats) ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">{t("card.optionsTitle")}</p>
                <ul className="space-y-2.5">
                  {rowsOf(stats, options, (id) => t("option.fallback", { id })).map((row) => (
                    <OptionRow key={row.optionId} row={row} />
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("card.noSends")}</p>
            )}
          </>
        ) : null}
      </div>
    </PanelSection>
  );
}
