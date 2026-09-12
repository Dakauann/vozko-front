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

/*
 * The conversation half of the audience view.
 *
 * A comment and a conversation are different subjects and deserve different
 * charts, which is why this is a sibling of the comment overview rather than
 * more series inside it. A comment has a stance and a severity; a conversation
 * has an objective it either advanced toward or did not, an agent whose conduct
 * is rated, and a length.
 *
 * Every chart primitive here is the one the comment overview already uses, so
 * the two halves of the page read as one instrument rather than two dashboards
 * that happen to share a route.
 */

/*
 * Disposition is ORDERED, not categorical: it runs from a closed objective to a
 * refusal, and the colours follow that order rather than being assigned per
 * label. A reader scanning the block sees the shape of the pipeline, not seven
 * unrelated hues.
 *
 * The two voice-call outcomes that used to trail this list, no_answer and
 * voicemail, are gone: they were telephony verdicts on a product with no voice
 * channel, and offering them let the model label a messaging conversation with
 * an outcome that cannot happen on it.
 */
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

/** The enum value each counter key maps to, for the translation lookup. */
const DISPOSITION_ENUM: Record<(typeof DISPOSITION_KEYS)[number], string> = {
  sale: "sale",
  fillingInfo: "filling_info",
  callback: "callback",
  pending: "pending",
  declined: "declined",
};

/**
 * The share of analysed conversations that reached the campaign's objective.
 *
 * Only `sale` counts. A callback booked is progress, not an outcome, and
 * counting it here is how an "objective reached" number quietly becomes a
 * number about effort. Returns null rather than 0 when nothing was analysed,
 * so the reading says "unmeasured" instead of "we achieved nothing".
 */
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
  /**
   * The same numbers over the period immediately before this one, for the
   * comparison. Null when the period has no "before" to speak of (an all-time
   * view), and the deltas are simply absent rather than invented.
   */
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

  /*
   * The denominator is what was ANALYSED, never what was queued.
   *
   * The engine's table is also its queue, so a slice holds rows that are still
   * waiting and rows that failed alongside the finished ones. Dividing by all
   * of them is how every percentage on this page silently understated itself
   * while a backlog was draining. What is in the queue is a real question, and
   * it has its own panel below rather than being folded into these rates.
   */
  const analysed = stats?.conversationAnalyzed ?? 0;
  const queued = stats?.conversationCount ?? 0;

  const rate = objectiveRate(stats);
  const previousRate = objectiveRate(previousStats ?? null);
  const rateDelta = rate !== null && previousRate !== null ? rate - previousRate : null;
  const previousQuality = (previousStats?.conversationAnalyzed ?? 0) > 0 ? previousStats?.attendanceQualityAvg ?? null : null;
  const qualityDelta = analysed > 0 && previousQuality !== null ? (stats?.attendanceQualityAvg ?? 0) - previousQuality : null;

  /*
   * A delta is signed in TEXT, not only in colour: a manager reading this in
   * greyscale, or with a colour vision deficiency, still gets the direction.
   * Below a tenth of a point it reads as flat rather than as a rounding artefact
   * dressed up as movement.
   */
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

  // Everything a person has to pick up, whatever the label says about it.
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

  /*
   * Qualification is a funnel, so it stays ordered hot → cold and coloured by
   * temperature rather than sorted by size: the order IS the meaning, and
   * re-ranking it would hide the very thing it is read for.
   *
   * Bars on one shared scale, not a waffle. A waffle asks the reader to count
   * squares to compare two categories; three bars against a common maximum are
   * compared by looking, and a workspace whose cold bar dwarfs the others is
   * not converting without a single number being read.
   */
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

  /*
   * Next action is what a human does tomorrow morning, so escalate leads: it is
   * the only value that means a person is needed rather than a process
   * continuing.
   */
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

  /*
   * The work queue, ranked by how many conversations are sitting in it.
   *
   * Ranked bars on one shared scale, not a composition: these are not parts of
   * a whole a manager wants the shape of, they are piles of work to be picked
   * up biggest-first. Escalations keep the accent even when another pile is
   * longer, because they are the only ones where a customer is already waiting
   * on a person rather than on a process.
   */
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

  /*
   * What the period's numbers are actually made of. This is the answer to "can
   * I trust these", and it is a composition of one whole on purpose: analysed,
   * waiting, failed and skipped are four states of the same set of rows.
   */
  const coverage = useMemo<ChartDatum[]>(
    () => [
      { key: "analyzed", label: t("analysedLabel"), value: analysed, color: "hsl(var(--healthy))" },
      { key: "pending", label: t("waitingLabel"), value: (stats?.pending ?? 0) + (stats?.inFlight ?? 0), color: VOZ_SERIES[1] },
      { key: "failed", label: t("failedLabel"), value: stats?.failed ?? 0, color: "hsl(var(--destructive))" },
      { key: "skipped", label: t("skippedLabel"), value: stats?.skipped ?? 0, color: "hsl(var(--muted-foreground))" },
    ],
    [analysed, stats, t],
  );

  /*
   * What people kept coming back to, as a rose: each subject fills its own
   * angular slice and grows outward with the share of conversations it came up
   * in, so the shape is the reading.
   *
   * Colour here does a SEQUENTIAL job, not a categorical one. These arcs are a
   * ranking, so one hue stepped dark to light says "biggest to smallest" and
   * keeps saying it however many subjects come back. Cycling five categorical
   * hues over a dozen arcs would imply five kinds of subject and repaint every
   * survivor the moment a filter changes the count.
   *
   * Cut to eight: a rose holds about that many labels around its rim before
   * they collide, and the long tail of subjects that came up once is noise on a
   * chart about repetition. The full ranking is in the chart's table view.
   */
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

  /*
   * When the last analysis landed. A dashboard with no clock on it cannot be
   * told apart from a dashboard whose pipeline stopped three days ago.
   */
  const lastAnalyzedAt = stats?.lastAnalyzedAt;
  const freshness = useMemo(() => {
    if (!lastAnalyzedAt) return t("freshnessNever");
    const when = new Date(lastAnalyzedAt);
    if (Number.isNaN(when.getTime())) return t("freshnessNever");
    return t("freshness", {
      when: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(when),
    });
  }, [lastAnalyzedAt, locale, t]);

  /*
   * The four readings answer the four questions a manager opens this page
   * with, in the order they ask them: are we hitting the goal, is anything
   * waiting on a person, are we getting better or worse, and can I trust any
   * of it. Conversation volume is supporting context rather than a headline,
   * so it rides under the coverage figure it actually qualifies.
   */
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
        // The range matters as much as the average: a 70 made of 40s and 100s
        // is a different operation from a 70 made of 68s and 72s.
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
        // Below nine in ten, the percentages above are describing a minority of
        // the period and the reader has to be told before they act on them.
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

  // Nothing to say yet. This is a normal state on a workspace that only
  // analyses comments, so it explains rather than looking broken.
  //
  // Conversations merely WAITING are a different state and say so: the reader
  // is told the work is queued rather than being shown an empty page that
  // reads as "analysis is not switched on".
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

      {/*
        What people are actually talking about, full width: it is the one panel
        that names the business rather than classifying it, and it is the first
        thing a manager scans for something they did not already know.
      */}
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
        {/*
          What is waiting on a person comes FIRST. Everything below it describes
          a period that has already happened; this is the only panel a manager
          can act on today.
        */}
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

        {/*
          The provenance panel: what these numbers are made of, and when they
          last moved. A reader who has just been shown four percentages is owed
          the sample they came from before acting on them.
        */}
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
