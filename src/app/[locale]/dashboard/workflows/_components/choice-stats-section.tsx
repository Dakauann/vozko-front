"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { ChoiceStatsProblemNotice, ChoiceSummaryTiles, hasSends } from "@/components/choice-stats/ChoiceSummary";
import { OptionCtr } from "@/components/choice-stats/OptionCtr";
import { useChoiceFormat } from "@/components/choice-stats/use-choice-format";

import { useCanvasChoiceStats, useNodeChoiceStats } from "./choice-stats-store";

export function ChoiceStatsSection({ nodeId, saved, optionLabel }: { nodeId: string; saved: boolean; optionLabel: (optionId: string) => string | null }) {
  const t = useTranslations("choiceStats");
  const titleId = useId();
  const format = useChoiceFormat();
  const { loading, result } = useCanvasChoiceStats();
  const view = useNodeChoiceStats(nodeId);
  const stats = view?.kind === "stats" ? view.stats : null;

  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p id={titleId} className="text-xs font-medium text-foreground">
          {t("panel.title")}
        </p>
        {result?.status === "ready" && result.stats.from && result.stats.to ? (
          <span className="text-2xs tabular-nums text-muted-foreground">
            {t("panel.range", { from: format.day(result.stats.from), to: format.day(result.stats.to) })}
          </span>
        ) : null}
      </div>
      {!saved ? <p className="text-2xs text-muted-foreground">{t("panel.unsaved")}</p> : null}
      {saved && !result && loading ? <p className="text-2xs text-muted-foreground">{t("panel.loading")}</p> : null}
      {saved && result && result.status !== "ready" ? (
        <ChoiceStatsProblemNotice problem={result} unreadable={t("panel.unreadable")} failed={t("panel.failed")} />
      ) : null}
      {saved && result?.status === "ready" ? (
        <>
          <ChoiceSummaryTiles stats={stats} />
          {hasSends(stats) ? (
            <table className="w-full table-fixed text-2xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th scope="col" className="w-[40%] pb-1 font-semibold">{t("panel.option")}</th>
                  <th scope="col" className="pb-1 text-right font-semibold">{t("panel.shown")}</th>
                  <th scope="col" className="pb-1 text-right font-semibold">{t("panel.clicks")}</th>
                  <th scope="col" className="pb-1 text-right font-semibold">{t("panel.ctr")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {stats.options.map((option) => (
                  <tr key={option.optionId}>
                    <th scope="row" className="truncate py-1 text-left font-medium text-foreground">
                      {optionLabel(option.optionId) ?? t("option.fallback", { id: option.optionId })}
                    </th>
                    <td className="py-1 text-right tabular-nums text-foreground">{format.count(option.shown)}</td>
                    <td className="py-1 text-right tabular-nums text-foreground">{format.count(option.clicks)}</td>
                    <td className="py-1 text-right">
                      <OptionCtr option={option} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-2xs text-muted-foreground">{t("panel.noSends")}</p>
          )}
          {hasSends(stats) ? <p className="text-2xs leading-relaxed text-muted-foreground">{t("panel.freeTextHint")}</p> : null}
        </>
      ) : null}
    </section>
  );
}
