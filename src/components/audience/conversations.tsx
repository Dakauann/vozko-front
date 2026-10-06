"use client";

import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { EChartsOption } from "echarts";

import { CompareBars, ProgressRing, VOZ_SERIES, type CompareRow } from "@/components/charts/vozko";
import { BlockChart, RadialProfileChart } from "@/components/charts/composition-charts";
import { ChartLegend, DataChart, Sparkline, WaffleChart, type ChartDatum } from "@/components/charts/dense-charts";
import { InstrumentStrip, type Instrument } from "@/components/console/page-shapes";
import { EmptyState, Panel, Skeleton } from "@/components/audience/shared";
import { useEmptyValue } from "@/components/elevated-design/empty-value";
import { ChartLineUp, ChatsCircle } from "@/components/icons";
import type { CommentAnalysisStats, TrendPoint } from "@/lib/audience/types";
import { cn } from "@/lib/utils";

const TEMPERATURE_SERIES = ["qualificationHotLead", "qualificationWarmLead", "qualificationColdLead"] as const;


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
  const td = useTranslations("denseCharts");
  const empty = useEmptyValue();
  const tDisp = useTranslations("audience.enums.disposition");
  const tInterest = useTranslations("audience.enums.interest");
  const tQual = useTranslations("audience.enums.qualification");
  const tAction = useTranslations("audience.enums.nextAction");
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const nf1 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const df = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }), [locale]);
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

  const temperature = useMemo<ChartDatum[]>(
    () => [
      { key: "hot", label: tQual("hot_lead"), value: stats?.qualificationHotLead ?? 0, color: "hsl(var(--healthy))" },
      { key: "warm", label: tQual("warm_lead"), value: stats?.qualificationWarmLead ?? 0, color: VOZ_SERIES[3] },
      { key: "cold", label: tQual("cold_lead"), value: stats?.qualificationColdLead ?? 0, color: "hsl(var(--muted-foreground))" },
    ],
    [stats, tQual],
  );

  const temperatureTotals = useMemo<ChartDatum[]>(
    () =>
      temperature.map((item, index) => ({
        ...item,
        value: orderedTrend.reduce((sum, point) => sum + point[TEMPERATURE_SERIES[index]], 0),
      })),
    [temperature, orderedTrend],
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

  const subjects = useMemo<CompareRow[]>(
    () =>
      (stats?.subjects ?? []).slice(0, 8).map((subject, index, all) => ({
        key: subject.key,
        label: subject.label || subject.key,
        value: subject.count,
        color: `hsl(var(--chart-1) / ${(1 - (index / Math.max(all.length, 2)) * 0.6).toFixed(2)})`,
        display: nf.format(subject.count),
        hint: analysed > 0 ? `${nf1.format((subject.count / analysed) * 100)}%` : undefined,
      })),
    [stats?.subjects, analysed, nf, nf1],
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

  const instruments = useMemo<Instrument[]>(() => {
    const mini = (value: (point: TrendPoint) => number | null, color: string, domain?: [number, number]) => (
      <Sparkline points={orderedTrend.map((point) => ({ date: point.bucketDate, value: value(point) }))} label={td("dailyTrend")} color={color} domain={domain} />
    );
    return [
      {
        label: t("objectiveReached"),
        value: rate === null ? empty : `${nf1.format(rate)}%`,
        detail: rate === null ? t("nothingAnalysed") : deltaDetail(rateDelta),
        tone: deltaTone(rateDelta),
        tooltip: t("objectiveTooltip"),
        chart: mini((point) => point.dispositionSale, "hsl(var(--healthy))"),
      },
      {
        label: t("needsHuman"),
        value: nf.format(needsHuman),
        detail: t("escalations", { count: nf.format(stats?.nextActionEscalate ?? 0) }),
        tone: (stats?.nextActionEscalate ?? 0) > 0 ? "fault" : needsHuman > 0 ? "warning" : undefined,
        chart: mini((point) => point.nextActionEscalate + point.nextActionScheduleCallback + point.nextActionSendWhatsApp, VOZ_SERIES[3]),
      },
      {
        label: t("attendanceQuality"),
        value: analysed > 0 ? nf.format(Math.round(stats?.attendanceQualityAvg ?? 0)) : empty,
        detail:
          analysed > 0
            ? `${t("range", { min: stats?.attendanceQualityMin ?? 0, max: stats?.attendanceQualityMax ?? 0 })} · ${deltaDetail(qualityDelta)}`
            : undefined,
        tone: deltaTone(qualityDelta),
        chart: mini((point) => (point.conversationAnalyzed > 0 ? point.attendanceQualityAvg : null), VOZ_SERIES[0], [0, 100]),
      },
      {
        label: t("coverage"),
        value: queued > 0 ? `${nf1.format((analysed / queued) * 100)}%` : empty,
        detail: t("coverageDetail", { analysed: nf.format(analysed), queued: nf.format(queued) }),
        tone: queued > 0 && analysed / queued < 0.9 ? "warning" : undefined,
        tooltip: t("coverageTooltip"),
        chart: mini((point) => point.conversationAnalyzed, VOZ_SERIES[4]),
      },
    ];
  }, [analysed, queued, needsHuman, rate, rateDelta, qualityDelta, stats, t, td, nf, nf1, deltaDetail, empty, orderedTrend]);

  const trendOption = useMemo<EChartsOption>(() => ({
    grid: { left: 35, right: 6, top: 10, bottom: 25 },
    xAxis: {
      type: "time", minInterval: 86400000,
      axisTick: { show: false }, axisLine: { show: false },
      axisLabel: { color: "hsl(var(--muted-foreground))", fontSize: 10, hideOverlap: true, formatter: (value: number) => df.format(new Date(value)) },
    },
    yAxis: { type: "value", minInterval: 1, axisLabel: { color: "hsl(var(--muted-foreground))", fontSize: 10 }, splitLine: { lineStyle: { color: "hsl(var(--border))", type: "dashed" } } },
    tooltip: { trigger: "axis", formatter: (params) => {
      const items = Array.isArray(params) ? params : [params];
      const first = items[0]?.value as [number, number] | undefined;
      if (!first) return "";
      return [df.format(new Date(first[0])), ...items.map((item) => `${item.seriesName}: ${nf.format((item.value as [number, number])[1])}`)].join("\n");
    } },
    series: TEMPERATURE_SERIES.map((key, index) => ({
      type: "bar" as const, stack: "conversations", name: temperature[index].label, barMaxWidth: 20,
      itemStyle: { color: temperature[index].color }, data: orderedTrend.map((point) => [Date.parse(point.bucketDate + "T00:00:00Z"), point[key]]),
      emphasis: { focus: "series" as const },
    })),
  }), [orderedTrend, df, nf, temperature]);

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
    <div className="space-y-3">
      <InstrumentStrip instruments={instruments} columns={narrow ? 2 : 4} compact loading={loading} className="grid-cols-2" />
      {orderedTrend.length > 0 ? <p className="text-2xs text-muted-foreground">{td("miniHint")}</p> : null}

      <div className={cn("grid gap-3", !narrow && "xl:grid-cols-3")}>
        <Panel compact title={t("activityTitle")} description={t("activityDescription")} className={!narrow ? "xl:col-span-2" : undefined}>
          {orderedTrend.length > 0 ? (
            <div className="space-y-2">
              <DataChart
                option={trendOption}
                label={t("activityTitle")}
                height={220}
                columns={[t("date"), ...temperature.map((item) => item.label)]}
                rows={orderedTrend.map((point) => [point.bucketDate, ...TEMPERATURE_SERIES.map((key) => point[key])])}
              />
              <ChartLegend data={temperatureTotals} />
            </div>
          ) : (
            <EmptyState icon={<ChartLineUp weight="duotone" />} title={t("activityEmptyTitle")} description={t("activityEmptyDescription")} />
          )}
        </Panel>
        <Panel compact title={t("qualificationTitle")} description={t("qualificationDescription")}>
          <RadialProfileChart data={temperature} total={analysed} label={t("qualificationTitle")} />
        </Panel>
      </div>

      <div className={cn("grid gap-3", !narrow && "md:grid-cols-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.35fr)]")}>
        <Panel compact title={t("qualityTitle")} description={t("attendanceQuality")}>
          <div className="flex items-center gap-3">
            <ProgressRing value={Math.round(stats?.attendanceQualityAvg ?? 0)} label={t("attendanceQuality")} size={96} strokeWidth={9} className="shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <span className="text-2xs text-muted-foreground">{t("attendanceQuality")}</span>
              <Sparkline
                points={orderedTrend.map((point) => ({ date: point.bucketDate, value: point.conversationAnalyzed > 0 ? point.attendanceQualityAvg : null }))}
                label={t("attendanceQuality")}
                domain={[0, 100]}
              />
              <p className="text-2xs tabular-nums text-muted-foreground">0 → 100</p>
            </div>
          </div>
          <div className="mt-3">
            <BlockChart data={nextActions} label={t("qualityTitle")} height={110} />
          </div>
        </Panel>
        <Panel compact title={t("interestTitle")} description={t("interestDescription")}>
          <WaffleChart data={interest} label={t("interestTitle")} />
        </Panel>
        <Panel compact title={t("dispositionTitle")} description={t("dispositionDescription")} className={!narrow ? "md:col-span-2 xl:col-span-1" : undefined}>
          <BlockChart data={dispositions} label={t("dispositionTitle")} height={120} />
        </Panel>
      </div>

      <div className={cn("grid gap-3", !narrow && "lg:grid-cols-2")}>
        <Panel compact title={t("subjectsTitle")} description={t("subjectsDescription")}>
          {subjects.length > 0 ? (
            <CompareBars rows={subjects} />
          ) : (
            <EmptyState icon={<ChatsCircle weight="duotone" />} title={t("subjectsEmptyTitle")} description={t("subjectsEmptyDescription")} />
          )}
        </Panel>
        <Panel compact title={t("attentionTitle")} description={t("attentionDescription")}>
          {attention.length > 0 ? (
            <CompareBars rows={attention} emphasisKey="escalate" />
          ) : (
            <EmptyState icon={<ChatsCircle weight="duotone" />} title={t("attentionClearTitle")} description={t("attentionClearDescription")} />
          )}
        </Panel>
      </div>

      <Panel compact title={t("coverageTitle")} description={t("coverageDescription")}>
        <BlockChart data={coverage} label={t("coverageTitle")} height={110} legend={false} />
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
  );
}
