"use client";

import { useTranslations } from "next-intl";

import { SENTIMENT_COLOR } from "@/components/audience/shared";
import { Meter, SegmentBar, type VozBarSize } from "@/components/charts/vozko";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { RUN_SENTIMENT_COLOR } from "@/components/unofficial-whatsapp-groups/marks";
import type { AnalysisStatus, GroupAnalysis, MentionSentiment, RunSentiment } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { MarkDot } from "./kpi-band";
import { useGroupsFormat } from "./use-groups-format";

export function SignedFigure({ value, rate, noBaseLabel, className }: { value: number; rate?: number | null; noBaseLabel?: string; className?: string }) {
  const fmt = useGroupsFormat();
  const second = rate === undefined ? null : rate === null ? (noBaseLabel ?? null) : fmt.signedPct(rate);
  return (
    <span className={cn("inline-flex flex-col items-end leading-tight", className)}>
      <span className="readout font-semibold tabular-nums text-foreground">{fmt.signed(value)}</span>
      {second ? <span className="readout text-[11px] tabular-nums text-muted-foreground">{second}</span> : null}
    </span>
  );
}

export function RateCell({ rate }: { rate: number | null }) {
  const t = useTranslations("unofficialGroups.kit.rate");
  const fmt = useGroupsFormat();
  if (rate === null) {
    return (
      <TooltipWrapper content={t("noBaseHint")}>
        <span className="text-2xs text-muted-foreground">{t("noBase")}</span>
      </TooltipWrapper>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Meter value={Math.min(100, Math.max(0, rate))} size="sm" color="hsl(var(--foreground) / 0.4)" className="w-12" label={fmt.pct(rate)} />
      <span className="readout text-xs tabular-nums text-foreground">{fmt.pct(rate)}</span>
    </span>
  );
}

export const RUN_SENTIMENT_ORDER = ["positive", "neutral", "mixed", "negative"] as const satisfies readonly RunSentiment[];

const MENTION_SENTIMENT_ORDER = ["positive", "neutral", "negative"] as const satisfies readonly MentionSentiment[];

type SentimentCounts = Partial<Record<RunSentiment, number>> | Partial<Record<MentionSentiment, number>>;

export function SentimentSplit({
  counts,
  kind,
  size = "md",
  legend = true,
  className,
}: {
  counts: SentimentCounts;
  kind: "run" | "mention";
  size?: VozBarSize;
  legend?: boolean;
  className?: string;
}) {
  const t = useTranslations("unofficialGroups.common.sentiment");
  const fmt = useGroupsFormat();
  const values = counts as Partial<Record<RunSentiment, number>>;
  const order: readonly RunSentiment[] = kind === "run" ? RUN_SENTIMENT_ORDER : MENTION_SENTIMENT_ORDER;
  const colors: Record<string, string> = kind === "run" ? RUN_SENTIMENT_COLOR : SENTIMENT_COLOR;
  return (
    <SegmentBar
      size={size}
      legend={legend}
      className={cn("min-w-[160px]", className)}
      formatValue={(value) => fmt.num(value)}
      segments={order
        .map((key) => ({ key, label: t(key), value: Math.max(0, values[key] ?? 0), color: colors[key] }))
        .filter((segment) => segment.value > 0)}
    />
  );
}

const ANALYSIS_STATUS_TONE: Record<AnalysisStatus, StatusChipTone> = {
  active: "healthy",
  paused: "warning",
  archived: "muted",
};

export function AnalysisStatusMark({ analysis }: { analysis: Pick<GroupAnalysis, "status" | "pausedReason" | "failures"> }) {
  const t = useTranslations("unofficialGroups.kit.status");
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <StatusChip tone={ANALYSIS_STATUS_TONE[analysis.status]} label={t(analysis.status)} />
      {analysis.pausedReason ? (
        <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
          <MarkDot mark="fault" label={t("pausedAfterFailures")} />
          {t("pausedAfterFailures")}
        </span>
      ) : analysis.status === "active" && analysis.failures > 0 ? (
        <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
          <MarkDot mark="warning" label={t("failures", { count: analysis.failures })} />
          {t("failures", { count: analysis.failures })}
        </span>
      ) : null}
    </span>
  );
}

export function CycleProgress({
  analysis,
  compact,
  timeZone,
}: {
  analysis: Pick<GroupAnalysis, "status" | "trigger" | "messagesPerCycle" | "pendingMessages" | "nextRunAt">;
  compact?: boolean;
  timeZone?: string;
}) {
  const t = useTranslations("unofficialGroups.kit.cycle");
  const fmt = useGroupsFormat(timeZone);
  if (analysis.status !== "active") return <span className="text-xs text-muted-foreground">{t("stopped")}</span>;
  if (analysis.trigger === "scheduled") {
    if (!analysis.nextRunAt) return <EmptyValue className="text-xs" />;
    return <span className="readout whitespace-nowrap text-xs text-foreground">{t("next", { dateTime: fmt.dateTime(analysis.nextRunAt) })}</span>;
  }
  const perCycle = Math.max(1, analysis.messagesPerCycle);
  const pending = Math.max(0, Math.min(perCycle, analysis.pendingMessages));
  const remaining = Math.max(0, analysis.messagesPerCycle - analysis.pendingMessages);
  return (
    <span className={cn("inline-flex min-w-0", compact ? "items-center gap-2" : "w-full flex-col gap-1")}>
      <Meter value={(pending / perCycle) * 100} size="sm" className={compact ? "w-14" : "w-full"} label={t("progress")} />
      <span className="readout whitespace-nowrap text-2xs text-muted-foreground">{t("remaining", { count: remaining })}</span>
    </span>
  );
}

function clock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function TriggerSummary({
  analysis,
  timezone,
  withBatch,
}: {
  analysis: Pick<GroupAnalysis, "trigger" | "messagesPerCycle" | "scheduleHour" | "scheduleMinute">;
  timezone?: string;
  withBatch?: boolean;
}) {
  const t = useTranslations("unofficialGroups.kit.trigger");
  const time = clock(analysis.scheduleHour, analysis.scheduleMinute);
  const main =
    analysis.trigger === "scheduled"
      ? timezone
        ? t("dailyAtZone", { time, timezone })
        : t("dailyAt", { time })
      : t("everyMessages", { count: analysis.messagesPerCycle });
  if (!withBatch) return <span className="whitespace-nowrap">{main}</span>;
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="whitespace-nowrap">{main}</span>
      <span className="readout text-[11px] text-muted-foreground">{t("batch", { count: analysis.messagesPerCycle })}</span>
    </span>
  );
}
