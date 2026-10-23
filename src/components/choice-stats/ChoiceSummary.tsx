"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { Notice } from "@/components/ui/notice";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { ChoiceStatsAnswer } from "@/lib/choice-stats/answer";
import type { PromptStats } from "@/lib/choice-stats/stats";

import { useChoiceFormat } from "./use-choice-format";

function Tile({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-2xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="readout mt-0.5 text-lg font-semibold leading-tight tabular-nums text-foreground">{value}</dd>
      {detail ? <dd className="mt-0.5 truncate text-2xs tabular-nums text-muted-foreground">{detail}</dd> : null}
    </div>
  );
}

export function hasSends(stats: PromptStats | null): stats is PromptStats {
  return stats !== null && stats.sends > 0;
}

export function ChoiceSummaryTiles({ stats }: { stats: PromptStats | null }) {
  const t = useTranslations("choiceStats.card");
  const format = useChoiceFormat();
  const sent = hasSends(stats);
  return (
    <dl className="grid grid-cols-3 gap-3">
      <Tile label={t("sends")} value={sent ? format.count(stats.sends) : <EmptyValue />} />
      <Tile
        label={t("clickRate")}
        value={sent ? format.rate(stats.clickRate) : <EmptyValue />}
        detail={sent ? t("clickedPrompts", { count: stats.clickedPrompts }) : undefined}
      />
      <Tile
        label={t("freeText")}
        value={sent ? format.rate(stats.freeText.rate) : <EmptyValue />}
        detail={sent ? t("freeTextCount", { count: stats.freeText.count }) : undefined}
      />
    </dl>
  );
}

export type ChoiceStatsProblem = Exclude<ChoiceStatsAnswer<unknown>, { status: "ready" }>;

export function ChoiceStatsProblemNotice({ problem, unreadable, failed, onRetry }: { problem: ChoiceStatsProblem; unreadable: string; failed: string; onRetry?: () => void }) {
  const t = useTranslations("choiceStats");
  const text = problem.status === "unreadable" ? unreadable : codedErrorMessage(t, { code: problem.code }, failed);
  return (
    <Notice tone="fault">
      <p>{text}</p>
      {onRetry ? <Button type="button" variant="secondary" size="sm" title={t("card.retry")} onClick={onRetry} className="mt-2" /> : null}
    </Notice>
  );
}
