"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { EChartsOption } from "echarts";
import { ProgressRing, VOZ_SERIES } from "@/components/charts/vozko";
import { BlockChart, RadialProfileChart } from "@/components/charts/composition-charts";
import { ChartLegend, DataChart, Sparkline, WaffleChart, type ChartDatum } from "@/components/charts/dense-charts";
import { InstrumentStrip, type Instrument } from "@/components/console/page-shapes";
import type { CommentAnalysisStats, CommentTopic, TrendPoint } from "@/lib/comment-analysis/types";
import { HIGH_SEVERITY_THRESHOLD } from "@/lib/comment-analysis/types";
import { EmptyState, Panel, STANCE_COLOR, Skeleton, topicColor, topicLabel } from "@/components/instagram/comment-analysis-shared";
import { ChartLineUp } from "@/components/icons";
import { cn } from "@/lib/utils";

const NO_TOPICS: CommentTopic[] = [];

export function CommentAnalysisOverview({ stats, trend, loading, layout = "page", topics = NO_TOPICS }: {
  stats: CommentAnalysisStats | null;
  trend: TrendPoint[];
  loading: boolean;
  layout?: "page" | "narrow";
  topics?: CommentTopic[];
}) {
  const narrow = layout === "narrow";
  const t = useTranslations("commentAnalysis.overview");
  const td = useTranslations("denseCharts");
  const tStance = useTranslations("commentAnalysis.enums.stance");
  const tSent = useTranslations("commentAnalysis.enums.sentiment");
  const tIntent = useTranslations("commentAnalysis.enums.intent");
  const tTopics = useTranslations("commentAnalysis.topics");
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const df = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }), [locale]);
  const analyzed = stats?.analyzed ?? 0;
  const orderedTrend = useMemo(() => [...trend].sort((a, b) => a.bucketDate.localeCompare(b.bucketDate)), [trend]);
  const stances = useMemo<ChartDatum[]>(() => [
    { key: "supporter", label: tStance("supporter"), value: stats?.stanceSupporter ?? 0, color: STANCE_COLOR.supporter },
    { key: "neutral", label: tStance("neutral"), value: stats?.stanceNeutral ?? 0, color: STANCE_COLOR.neutral },
    { key: "critic", label: tStance("critic"), value: stats?.stanceCritic ?? 0, color: STANCE_COLOR.critic },
    { key: "hostile", label: tStance("hostile"), value: stats?.stanceHostile ?? 0, color: STANCE_COLOR.hostile },
  ], [stats, tStance]);
  const trendTotals = useMemo(() => stances.map((item, index) => ({
    ...item,
    value: orderedTrend.reduce((sum, point) => sum + point[(["stanceSupporter", "stanceNeutral", "stanceCritic", "stanceHostile"] as const)[index]], 0),
  })), [stances, orderedTrend]);
  const sentiment: ChartDatum[] = [
    { key: "positive", label: tSent("positive"), value: stats?.sentimentPositive ?? 0, color: "hsl(var(--healthy))" },
    { key: "neutral", label: tSent("neutral"), value: stats?.sentimentNeutral ?? 0, color: "hsl(var(--muted-foreground))" },
    { key: "negative", label: tSent("negative"), value: stats?.sentimentNegative ?? 0, color: "hsl(var(--destructive))" },
  ];
  const intents = useMemo<ChartDatum[]>(() => [
    { key: "praise", label: tIntent("praise"), value: stats?.intentPraise ?? 0, color: VOZ_SERIES[0] },
    { key: "question", label: tIntent("question"), value: stats?.intentQuestion ?? 0, color: VOZ_SERIES[3] },
    { key: "complaint", label: tIntent("complaint"), value: stats?.intentComplaint ?? 0, color: VOZ_SERIES[2] },
    { key: "support_request", label: tIntent("support_request"), value: stats?.intentSupportRequest ?? 0, color: VOZ_SERIES[1] },
    { key: "spam", label: tIntent("spam"), value: stats?.intentSpam ?? 0, color: "hsl(var(--destructive))" },
    { key: "sales_lead", label: tIntent("sales_lead"), value: stats?.intentSalesLead ?? 0, color: VOZ_SERIES[4] },
    { key: "other", label: tIntent("other"), value: stats?.intentOther ?? 0, color: "hsl(var(--muted-foreground))" },
  ], [stats, tIntent]);
  const topicData = useMemo(() => (stats?.topics ?? []).map((item) => ({
    key: item.topicKey, label: topicLabel(topics, item.topicKey, tTopics("otherLabel")), value: item.count, color: topicColor(topics, item.topicKey),
  })), [stats, topics, tTopics]);

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
    series: (["stanceSupporter", "stanceNeutral", "stanceCritic", "stanceHostile"] as const).map((key, index) => ({
      type: "bar" as const, stack: "comments", name: stances[index].label, barMaxWidth: 20,
      itemStyle: { color: stances[index].color }, data: orderedTrend.map((point) => [Date.parse(point.bucketDate + "T00:00:00Z"), point[key]]),
      emphasis: { focus: "series" as const },
    })),
  }), [orderedTrend, df, nf, stances]);

  const mini = (key: "analyzed" | "requiresActionCount" | "severityHighCount" | "flaggedAuthors", color: string) => (
    <Sparkline points={orderedTrend.map((point) => ({ date: point.bucketDate, value: point[key] }))} label={td("dailyTrend")} color={color} />
  );
  const instruments: Instrument[] = [
    { label: t("tiles.analyzed"), value: nf.format(analyzed), detail: t("tiles.analyzedDetail", { total: nf.format(stats?.total ?? 0) }), chart: mini("analyzed", VOZ_SERIES[0]) },
    { label: t("tiles.requiresAction"), value: nf.format(stats?.requiresActionCount ?? 0), detail: t("tiles.requiresActionDetail"), chart: mini("requiresActionCount", VOZ_SERIES[3]), tone: (stats?.requiresActionCount ?? 0) > 0 ? "warning" : "default" },
    { label: t("tiles.highSeverity"), value: nf.format(stats?.severityHighCount ?? 0), detail: t("tiles.highSeverityDetail", { threshold: HIGH_SEVERITY_THRESHOLD }), chart: mini("severityHighCount", "hsl(var(--destructive))"), tone: (stats?.severityHighCount ?? 0) > 0 ? "fault" : "default" },
    { label: t("tiles.flaggedAuthors"), value: nf.format(stats?.flaggedAuthors ?? 0), detail: t("tiles.flaggedAuthorsDetail", { authors: nf.format(stats?.distinctAuthors ?? 0) }), chart: mini("flaggedAuthors", VOZ_SERIES[4]), tone: (stats?.flaggedAuthors ?? 0) > 0 ? "fault" : "default" },
  ];
  const empty = <EmptyState icon={<ChartLineUp weight="duotone" />} title={t("empty.title")} description={t("empty.description")} />;
  const score = stats?.acceptanceScore ?? 0;
  const scoreColor = score >= 70 ? "hsl(var(--healthy))" : score >= 45 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

  if (loading && !stats) return <div className="space-y-3"><Skeleton className="h-28" /><div className="grid gap-3 lg:grid-cols-3"><Skeleton className="h-72 lg:col-span-2" /><Skeleton className="h-72" /></div><Skeleton className="h-52" /></div>;

  return <div className="space-y-3">
    <InstrumentStrip instruments={instruments} columns={narrow ? 2 : 4} compact loading={loading} className="grid-cols-2" />
    {orderedTrend.length > 0 ? <p className="text-2xs text-muted-foreground">{td("miniHint")}</p> : null}

    <div className={cn("grid gap-3", !narrow && "xl:grid-cols-3")}>
      <Panel compact title={td("activity")} description={td("activityHint")} className={!narrow ? "xl:col-span-2" : undefined}>
        {orderedTrend.length === 0 ? <EmptyState icon={<ChartLineUp weight="duotone" />} title={t("trend.emptyTitle")} description={t("trend.emptyDescription")} /> : <div className="space-y-2">
          <DataChart option={trendOption} label={td("activity")} height={220} columns={[td("date"), ...stances.map((item) => item.label)]} rows={orderedTrend.map((point) => [point.bucketDate, point.stanceSupporter, point.stanceNeutral, point.stanceCritic, point.stanceHostile])} />
          <ChartLegend data={trendTotals} />
        </div>}
      </Panel>
      <Panel compact title={t("stance.title")} description={td("radialHint")}>
        {analyzed > 0 ? <RadialProfileChart data={stances} total={analyzed} label={t("stance.title")} /> : empty}
      </Panel>
    </div>

    <div className={cn("grid gap-3", !narrow && "md:grid-cols-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.35fr)]")}>
      <Panel compact title={t("score.title")} description={t("score.description")}>
        {analyzed > 0 ? <>
          <div className="flex items-center gap-3">
            <ProgressRing value={score} label={t("score.label")} size={96} strokeWidth={9} color={scoreColor} className="shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <span className="text-2xs text-muted-foreground">{td("dailyScore")}</span>
              <Sparkline points={orderedTrend.map((point) => ({ date: point.bucketDate, value: point.analyzed > 0 ? point.acceptanceScore : null }))} label={td("dailyScore")} domain={[0, 100]} color={scoreColor} />
              <p className="text-2xs tabular-nums text-muted-foreground">0–100</p>
            </div>
          </div>
          {analyzed < 30 ? <p className="mt-2 text-2xs text-muted-foreground">{t("score.smallSample", { count: analyzed })}</p> : null}
          {(stats?.pending ?? 0) > 0 ? <p className="mt-2 text-2xs text-muted-foreground">{t("score.pending", { count: nf.format(stats?.pending ?? 0) })}</p> : null}
          <details className="mt-2 text-2xs text-muted-foreground"><summary className="cursor-pointer rounded-sm focus-visible:ring-2 focus-visible:ring-ring">{td("scoreMethod")}</summary><p className="mt-1 leading-relaxed">{t("score.explainer")}</p></details>
        </> : empty}
      </Panel>
      <Panel compact title={t("sentiment.title")} description={t("sentiment.description")}>
        {analyzed > 0 ? <WaffleChart data={sentiment} label={t("sentiment.title")} /> : empty}
      </Panel>
      <Panel compact title={td("intent")} description={td("blockHint")} className={!narrow ? "md:col-span-2 xl:col-span-1" : undefined}>
        {intents.some((item) => item.value > 0) ? <BlockChart data={intents} label={td("intent")} height={120} /> : empty}
      </Panel>
    </div>
    {topicData.some((item) => item.value > 0) ? <Panel compact title={tTopics("title")} description={tTopics("description")}><BlockChart data={topicData} label={tTopics("title")} height={narrow ? 160 : 120} /></Panel> : null}
  </div>;
}
