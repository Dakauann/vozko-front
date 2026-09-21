"use client";

import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { EChartsOption } from "echarts";

import { CompareBars, ProgressRing, VOZ_SERIES, type CompareRow } from "@/components/charts/vozko";
import { BlockChart, RadialProfileChart } from "@/components/charts/composition-charts";
import { ChartLegend, DataChart, type ChartDatum } from "@/components/charts/dense-charts";
import { InstrumentStrip, type Instrument } from "@/components/console/page-shapes";
import { EmptyState, Panel, Skeleton } from "@/components/audience/shared";
import { ChartLineUp, ChatsCircle } from "@/components/icons";
import type { CommentAnalysisStats, TrendPoint } from "@/lib/audience/types";


const DISPOSITION_KEYS = [
  "sale",
  "fillingInfo",
  "callback",
  "pending",
  "declined",
] as const;

const DISPOSITION_COLOR: Record<(typeof DISPOSITION_KEYS)[number], string> = {
  sale: "hsl(var(--healthy))",
  fillingInfo: VOZ_SERIES[0],
  callback: VOZ_SERIES[3],
  pending: VOZ_SERIES[1],
  declined: "hsl(var(--destructive))",
};

const DISPOSITION_ENUM: Record<(typeof DISPOSITION_KEYS)[number], string> = {
  sale: "sale",
  fillingInfo: "filling_info",
  callback: "callback",
  pending: "pending",
  declined: "declined",
};

function objectiveRate(stats: CommentAnalysisStats | null): number | null {
  const analysed = stats?.conversationAnalyzed ?? 0;
  if (!stats || analysed === 0) return null;
  return (stats.dispositionSale / analysed) * 100;
}

export function CommentAnalysisConversations({
  stats,
  previousStats,
  trend,
  loading,
  layout = "page",
}: {
  stats: CommentAnalysisStats | null;
  previousStats?: CommentAnalysisStats | null;
  trend: TrendPoint[];
  loading: boolean;
  layout?: "page" | "narrow";
}) {
  const narrow = layout === "narrow";
  const t = useTranslations("audience.conversations");
  const tDisp = useTranslations("audience.enums.disposition");
  const tInterest = useTranslations("audience.enums.interest");
  const tQual = useTranslations("audience.enums.qualification");
  const tAction = useTranslations("audience.enums.nextAction");
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const nf1 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const orderedTrend = useMemo(() => [...trend].sort((a, b) => a.bucketDate.localeCompare(b.bucketDate)), [trend]);

  const analysed = stats?.conversationAnalyzed ?? 0;
  const queued = stats?.conversationCount ?? 0;

  const rate = objectiveRate(stats);
  const previousRate = objectiveRate(previousStats ?? null);
  const rateDelta = rate !== null && previousRate !== null ? rate - previousRate : null;
  const previousQuality = (previousStats?.conversationAnalyzed ?? 0) > 0 ? previousStats?.attendanceQualityAvg ?? null : null;
  const qualityDelta = analysed > 0 && previousQuality !== null ? (stats?.attendanceQualityAvg ?? 0) - previousQuality : null;

  const deltaDetail = useCallback(
    (delta: number | null) =>
      delta === null
        ? t("noComparison")
        : Math.abs(delta) < 0.1
          ? t("flatVsPrevious")
          : t("vsPrevious", { delta: `${delta > 0 ? "+" : "−"}${nf1.format(Math.abs(delta))}` }),
    [t, nf1],
  );
  const deltaTone = (delta: number | null) =>
    delta === null || Math.abs(delta) < 0.1 ? undefined : delta > 0 ? ("healthy" as const) : ("warning" as const);

  const needsHuman = (stats?.nextActionEscalate ?? 0) + (stats?.nextActionScheduleCallback ?? 0) + (stats?.nextActionSendWhatsApp ?? 0);

  const dispositions = useMemo<ChartDatum[]>(
    () =>
      DISPOSITION_KEYS.map((key) => ({
        key,
        label: tDisp(DISPOSITION_ENUM[key]),
        value:
          (stats?.[`disposition${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof CommentAnalysisStats] as number) ?? 0,
        color: DISPOSITION_COLOR[key],
      })),
    [stats, tDisp],
  );

  const qualification = useMemo<CompareRow[]>(
    () =>
      [
        { key: "hot", label: tQual("hot_lead"), value: stats?.qualificationHotLead ?? 0, color: "hsl(var(--healthy))" },
        { key: "warm", label: tQual("warm_lead"), value: stats?.qualificationWarmLead ?? 0, color: VOZ_SERIES[3] },
        { key: "cold", label: tQual("cold_lead"), value: stats?.qualificationColdLead ?? 0, color: "hsl(var(--muted-foreground))" },
      ].map((row) => ({
        ...row,
        display: nf.format(row.value),
        hint: analysed > 0 ? `${nf1.format((row.value / analysed) * 100)}%` : undefined,
      })),
    [stats, analysed, tQual, nf, nf1],
  );

  const interest = useMemo<ChartDatum[]>(
    () => [
      { key: "interested", label: tInterest("interested"), value: stats?.interestInterested ?? 0, color: "hsl(var(--healthy))" },
      { key: "undecided", label: tInterest("undecided"), value: stats?.interestUndecided ?? 0, color: VOZ_SERIES[1] },
      { key: "not_interested", label: tInterest("not_interested"), value: stats?.interestNotInterested ?? 0, color: "hsl(var(--destructive))" },
    ],
    [stats, tInterest],
  );

  const nextActions = useMemo<ChartDatum[]>(
    () => [
      { key: "escalate", label: tAction("escalate"), value: stats?.nextActionEscalate ?? 0, color: "hsl(var(--destructive))" },
      { key: "schedule_callback", label: tAction("schedule_callback"), value: stats?.nextActionScheduleCallback ?? 0, color: VOZ_SERIES[3] },
      { key: "send_whatsapp", label: tAction("send_whatsapp"), value: stats?.nextActionSendWhatsApp ?? 0, color: VOZ_SERIES[0] },
      { key: "continue", label: tAction("continue"), value: stats?.nextActionContinue ?? 0, color: VOZ_SERIES[1] },
      { key: "close", label: tAction("close"), value: stats?.nextActionClose ?? 0, color: "hsl(var(--muted-foreground))" },
    ],
    [stats, tAction],
  );

  const attention = useMemo<CompareRow[]>(
    () =>
      [
        { key: "escalate", label: tAction("escalate"), value: stats?.nextActionEscalate ?? 0, color: "hsl(var(--destructive))" },
        { key: "schedule_callback", label: tAction("schedule_callback"), value: stats?.nextActionScheduleCallback ?? 0, color: VOZ_SERIES[3] },
        { key: "send_whatsapp", label: tAction("send_whatsapp"), value: stats?.nextActionSendWhatsApp ?? 0, color: VOZ_SERIES[0] },
        { key: "callback_promised", label: tDisp("callback"), value: stats?.dispositionCallback ?? 0, color: VOZ_SERIES[1] },
        { key: "interested", label: tInterest("interested"), value: stats?.interestInterested ?? 0, color: "hsl(var(--healthy))" },
      ]
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((row) => ({
          ...row,
          display: nf.format(row.value),
          hint: analysed > 0 ? `${nf1.format((row.value / analysed) * 100)}%` : undefined,
        })),
    [stats, analysed, tAction, tDisp, tInterest, nf, nf1],
  );

  const coverage = useMemo<ChartDatum[]>(
    () => [
      { key: "analyzed", label: t("analysedLabel"), value: analysed, color: "hsl(var(--healthy))" },
      { key: "pending", label: t("waitingLabel"), value: (stats?.pending ?? 0) + (stats?.inFlight ?? 0), color: VOZ_SERIES[1] },
      { key: "failed", label: t("failedLabel"), value: stats?.failed ?? 0, color: "hsl(var(--destructive))" },
      { key: "skipped", label: t("skippedLabel"), value: stats?.skipped ?? 0, color: "hsl(var(--muted-foreground))" },
    ],
    [analysed, stats, t],
  );

  const subjects = useMemo<ChartDatum[]>(
    () =>
      (stats?.subjects ?? []).slice(0, 8).map((subject, index, all) => ({
        key: subject.key,
        label: subject.label || subject.key,
        value: subject.count,
        color: `hsl(var(--chart-1) / ${(1 - (index / Math.max(all.length, 2)) * 0.6).toFixed(2)})`,
      })),
    [stats?.subjects],
  );

  const lastAnalyzedAt = stats?.lastAnalyzedAt;
  const freshness = useMemo(() => {
    if (!lastAnalyzedAt) return t("freshnessNever");
    const when = new Date(lastAnalyzedAt);
    if (Number.isNaN(when.getTime())) return t("freshnessNever");
    return t("freshness", {
      when: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(when),
    });
  }, [lastAnalyzedAt, locale, t]);

  const instruments = useMemo<Instrument[]>(
    () => [
      {
        label: t("objectiveReached"),
        value: rate === null ? "—" : `${nf1.format(rate)}%`,
        detail: rate === null ? t("nothingAnalysed") : deltaDetail(rateDelta),
        tone: deltaTone(rateDelta),
        tooltip: t("objectiveTooltip"),
      },
      {
        label: t("needsHuman"),
        value: nf.format(needsHuman),
        detail: t("escalations", { count: nf.format(stats?.nextActionEscalate ?? 0) }),
        tone: (stats?.nextActionEscalate ?? 0) > 0 ? "fault" : needsHuman > 0 ? "warning" : undefined,
      },
      {
        label: t("attendanceQuality"),
        value: analysed > 0 ? nf.format(Math.round(stats?.attendanceQualityAvg ?? 0)) : "—",
        detail:
          analysed > 0
            ? `${t("range", { min: stats?.attendanceQualityMin ?? 0, max: stats?.attendanceQualityMax ?? 0 })} · ${deltaDetail(qualityDelta)}`
            : undefined,
        tone: deltaTone(qualityDelta),
      },
      {
        label: t("coverage"),
        value: queued > 0 ? `${nf1.format((analysed / queued) * 100)}%` : "—",
        detail: t("coverageDetail", { analysed: nf.format(analysed), queued: nf.format(queued) }),
        tone: queued > 0 && analysed / queued < 0.9 ? "warning" : undefined,
        tooltip: t("coverageTooltip"),
      },
    ],
    [analysed, queued, needsHuman, rate, rateDelta, qualityDelta, stats, t, nf, nf1, deltaDetail],
  );
  const trendOption = useMemo<EChartsOption>(() => ({
    animationDuration: 250,
    grid: { left: 8, right: 8, top: 12, bottom: 24, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: orderedTrend.map((point) => point.bucketDate), axisLabel: { hideOverlap: true } },
    yAxis: { type: "value", minInterval: 1 },
    series: [{ name: t("analysed"), type: "bar", data: orderedTrend.map((point) => point.conversationAnalyzed), itemStyle: { color: VOZ_SERIES[0] } }],
  }), [orderedTrend, t]);

  if (loading && !stats) {
    return <Skeleton className={narrow ? "h-48" : "h-72"} />;
  }

  if (analysed === 0) {
    return (
      <Panel title={t("title")} description={t("description")}>
        <EmptyState
          icon={<ChatsCircle />}
          title={queued > 0 ? t("queuedTitle") : t("emptyTitle")}
          description={queued > 0 ? t("queuedDescription", { count: nf.format(queued) }) : t("emptyDescription")}
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <InstrumentStrip instruments={instruments} />

      <Panel title={t("activityTitle")} description={t("activityDescription")}>
        {orderedTrend.length > 0 ? (
          <DataChart
            option={trendOption}
            label={t("activityTitle")}
            height={200}
            columns={[t("date"), t("analysed")]}
            rows={orderedTrend.map((point) => [point.bucketDate, point.conversationAnalyzed])}
          />
        ) : (
          <EmptyState icon={<ChartLineUp weight="duotone" />} title={t("activityEmptyTitle")} description={t("activityEmptyDescription")} />
        )}
      </Panel>

      {
}
      <Panel title={t("subjectsTitle")} description={t("subjectsDescription")}>
        {subjects.length > 0 ? (
          <>
            <RadialProfileChart data={subjects} total={analysed} label={t("subjectsTitle")} />
            <ChartLegend data={subjects} total={analysed} />
          </>
        ) : (
          <EmptyState icon={<ChatsCircle weight="duotone" />} title={t("subjectsEmptyTitle")} description={t("subjectsEmptyDescription")} />
        )}
      </Panel>

      <div className={narrow ? "flex flex-col gap-4" : "grid grid-cols-1 gap-4 lg:grid-cols-2"}>
        {
}
        <Panel title={t("attentionTitle")} description={t("attentionDescription")}>
          {attention.length > 0 ? (
            <CompareBars rows={attention} emphasisKey="escalate" />
          ) : (
            <EmptyState icon={<ChatsCircle weight="duotone" />} title={t("attentionClearTitle")} description={t("attentionClearDescription")} />
          )}
        </Panel>

        <Panel title={t("dispositionTitle")} description={t("dispositionDescription")}>
          <BlockChart data={dispositions} label={t("dispositionTitle")} legend={false} />
          <ChartLegend data={dispositions} total={analysed} />
        </Panel>

        <Panel title={t("qualificationTitle")} description={t("qualificationDescription")}>
          <CompareBars rows={qualification} />
        </Panel>

        <Panel title={t("interestTitle")} description={t("interestDescription")}>
          <BlockChart data={interest} label={t("interestTitle")} legend={false} />
          <ChartLegend data={interest} total={analysed} />
        </Panel>

        <Panel title={t("qualityTitle")} description={t("qualityDescription")}>
          <div className="flex items-center gap-6">
            <ProgressRing value={Math.round(stats?.attendanceQualityAvg ?? 0)} label={t("attendanceQuality")} />
            <div className="flex-1">
              <BlockChart data={nextActions} label={t("qualityTitle")} height={120} legend={false} />
              <ChartLegend data={nextActions} total={analysed} />
            </div>
          </div>
        </Panel>

        {
}
        <Panel title={t("coverageTitle")} description={t("coverageDescription")}>
          <BlockChart data={coverage} label={t("coverageTitle")} height={120} legend={false} />
          <ChartLegend data={coverage} total={queued} />
          <p className="mt-2 text-xs text-muted-foreground">
            {freshness}
            {" · "}
            {t("messagesTotal", { count: nf.format(stats?.messagesTotal ?? 0) })}
            {" · "}
            {t("messagesAvg")}: {nf1.format(stats?.messagesAvg ?? 0)}
          </p>
        </Panel>
      </div>
    </div>
  );
}
