"use client";

import { useTranslations } from "next-intl";

import { ChartBar } from "@/components/icons";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { PeriodPreset } from "@/lib/attendance/period";
import { cn } from "@/lib/utils";

import { CHOICE_STATS_PERIODS, useCanvasChoiceStats } from "./choice-stats-store";

const PERIOD_DAYS: Record<PeriodPreset, number> = { "7d": 7, "30d": 30, "90d": 90 };

function ChoiceStatsMark({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("choiceStats");
  const { loading, result } = useCanvasChoiceStats();
  if (loading) {
    return <span role="status" aria-label={t("period.loading")} title={t("period.loading")} className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />;
  }
  if (result?.status === "unreadable") {
    return <span role="status" aria-label={t("period.unreadable")} title={t("period.unreadable")} className="h-1.5 w-1.5 rounded-full bg-warning" />;
  }
  if (result?.status === "failed") {
    const message = codedErrorMessage(t, { code: result.code }, t("period.failed"));
    return (
      <button
        type="button"
        aria-label={message}
        title={`${message} ${t("card.retry")}`}
        onClick={onRetry}
        className="inline-flex h-5 w-5 items-center justify-center rounded-[--radius] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-destructive" />
      </button>
    );
  }
  return null;
}

export function ChoiceStatsPeriodChip({
  period,
  onChange,
  onRetry,
}: {
  period: PeriodPreset;
  onChange: (period: PeriodPreset) => void;
  onRetry: () => void;
}) {
  const t = useTranslations("choiceStats.period");
  return (
    <div role="group" aria-label={t("label")} title={t("hint")} className="flex shrink-0 items-center gap-1 rounded-[--radius] border border-border bg-card px-1.5 py-0.5">
      <ChartBar size={13} weight="bold" aria-hidden className="text-muted-foreground" />
      <span className="whitespace-nowrap text-xs text-muted-foreground">{t("label")}</span>
      {CHOICE_STATS_PERIODS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === period}
          onClick={() => onChange(option)}
          className={cn(
            "whitespace-nowrap rounded-[--radius] px-1.5 py-0.5 text-2xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            option === period ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
          )}
        >
          {t("days", { days: PERIOD_DAYS[option] })}
        </button>
      ))}
      <ChoiceStatsMark onRetry={onRetry} />
    </div>
  );
}
