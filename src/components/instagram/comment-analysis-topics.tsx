"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { CommentTopic, TopicStat } from "@/lib/comment-analysis/types";
import { Panel, SeverityBar, EmptyState, percent, topicColor, topicLabel } from "@/components/instagram/comment-analysis-shared";
import { Hash, Lightning } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * Topics ranked by volume, each with its sentiment mix and average severity.
 * "other" climbing is the signal that the account's topic set is missing a
 * theme (plan §5.2); the panel says so instead of leaving it to be noticed.
 */

const LOCALE_TAG: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", de: "de-DE" };

/** Share of "other" from which the panel prompts for a new topic. */
const OTHER_PROMPT_SHARE = 20;

export function CommentAnalysisTopics({
  topics,
  stats,
  onEditTopics,
}: {
  topics: CommentTopic[];
  stats: TopicStat[];
  onEditTopics?: () => void;
}) {
  const t = useTranslations("commentAnalysis.topics");
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_TAG[locale] ?? "pt-BR"), [locale]);

  const total = useMemo(() => stats.reduce((sum, s) => sum + s.count, 0), [stats]);
  const ranked = useMemo(() => [...stats].sort((a, b) => b.count - a.count), [stats]);
  const otherShare = percent(stats.find((s) => s.topicKey === "other")?.count ?? 0, total);
  const max = ranked[0]?.count ?? 0;

  return (
    <Panel title={t("title")} description={t("description")}>
      {otherShare >= OTHER_PROMPT_SHARE ? (
        <div className="mb-4 flex items-start gap-3 rounded-[--radius] border border-border bg-muted px-4 py-3">
          <Lightning className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" weight="fill" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-foreground">{t("otherPrompt.title", { share: otherShare })}</p>
            <p className="text-xs text-muted-foreground">{t("otherPrompt.description")}</p>
          </div>
          {onEditTopics ? (
            <button type="button" onClick={onEditTopics} className="shrink-0 text-xs font-medium text-primary-ink hover:underline">
              {t("otherPrompt.cta")}
            </button>
          ) : null}
        </div>
      ) : null}

      {ranked.length === 0 ? (
        <EmptyState icon={<Hash weight="duotone" />} title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ol className="space-y-3">
          {ranked.map((s, index) => {
            const color = topicColor(topics, s.topicKey);
            const label = topicLabel(topics, s.topicKey, t("otherLabel"));
            const share = percent(s.count, total);
            return (
              <li key={s.topicKey} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3">
                <span className="readout text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                <div className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                      <span className={cn("truncate font-medium", s.topicKey === "other" ? "text-muted-foreground" : "text-foreground")}>{label}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">
                      {nf.format(s.count)} <span className="font-normal text-muted-foreground">({share}%)</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full" style={{ width: `${max > 0 ? (s.count / max) * 100 : 0}%`, backgroundColor: color }} />
                  </div>
                  {/* Sentiment mix under the volume bar: three segments with a
                      2px surface gap, plus the numbers so it is never colour
                      alone. */}
                  <div className="mt-1.5 flex items-center gap-3 text-2xs text-muted-foreground">
                    <div className="flex h-1.5 w-24 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                      <span className="bg-healthy" style={{ width: `${percent(s.sentimentPositive, s.count)}%` }} />
                      <span className="bg-muted-foreground/40" style={{ width: `${percent(s.sentimentNeutral, s.count)}%` }} />
                      <span className="bg-destructive" style={{ width: `${percent(s.sentimentNegative, s.count)}%` }} />
                    </div>
                    <span className="tabular-nums">
                      {t("mix", {
                        positive: percent(s.sentimentPositive, s.count),
                        neutral: percent(s.sentimentNeutral, s.count),
                        negative: percent(s.sentimentNegative, s.count),
                      })}
                    </span>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <SeverityBar severity={Math.round(s.severityAvg)} compact />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
