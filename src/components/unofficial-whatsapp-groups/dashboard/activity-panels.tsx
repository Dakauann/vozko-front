"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { SENTIMENT_COLOR, Skeleton } from "@/components/audience/shared";
import { VOZ_SERIES } from "@/components/charts/vozko";
import { ChartBar, Smiley, Timer } from "@/components/icons";
import { hasVolume } from "@/components/unofficial-whatsapp-groups/kit/chart-model";
import { ChartPanel } from "@/components/unofficial-whatsapp-groups/kit/chart-panel";
import { CompositionRing, GROUPS_CHART_COLOR, RankedList, StackedBarsH, TrendArea, VolumeChart } from "@/components/unofficial-whatsapp-groups/kit/charts";
import { QuietEmpty } from "@/components/unofficial-whatsapp-groups/kit/empty";
import { WindowToggle } from "@/components/unofficial-whatsapp-groups/kit/filters";
import { RESPONSE_GOAL_MINUTES } from "@/components/unofficial-whatsapp-groups/kit/format";
import { GroupsPanel } from "@/components/unofficial-whatsapp-groups/kit/panel";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { useGroupName, useGroupsFormat } from "@/components/unofficial-whatsapp-groups/kit/use-groups-format";
import type { DailyPoint, GroupCount, GroupSentiment, ResponseTimePoint, SentimentTally } from "@/lib/unofficial-whatsapp-groups/types";

import {
  rankSentimentByGroup,
  responseStats,
  SENTIMENT_GROUP_LIMIT,
  sentimentTotal,
  sumOf,
  volumeStats,
  type SentimentGroupOrder,
} from "./dashboard-data";

const SENTIMENT_KEYS = ["positive", "neutral", "negative"] as const;

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function VolumePanel({
  points,
  timezone,
  loading,
  className,
}: {
  points: DailyPoint[];
  timezone: string;
  loading: boolean;
  className?: string;
}) {
  const t = useTranslations("unofficialGroups.dashboard.volumePanel");
  const fmt = useGroupsFormat(timezone);
  const stats = useMemo(() => volumeStats(points), [points]);
  const readouts = [
    { label: t("total"), value: fmt.num(stats.total) },
    { label: t("average"), value: t("perDay", { value: fmt.num(roundOne(stats.average)) }) },
    ...(stats.peak ? [{ label: t("peak", { day: fmt.day(stats.peak.day) }), value: fmt.num(stats.peak.messages) }] : []),
  ];
  return (
    <ChartPanel
      title={t("title")}
      subtitle={t("subtitle")}
      height={220}
      state={loading ? "loading" : hasVolume(points) ? "ready" : "empty"}
      empty={{ icon: <ChartBar />, message: t("empty") }}
      readouts={readouts}
      className={className}
    >
      <VolumeChart points={points} height={220} />
    </ChartPanel>
  );
}

export function SentimentPanel({ tally, loading, className }: { tally: SentimentTally; loading: boolean; className?: string }) {
  const t = useTranslations("unofficialGroups.dashboard.sentimentPanel");
  const ts = useTranslations("unofficialGroups.common.sentiment");
  const fmt = useGroupsFormat();
  const total = sentimentTotal(tally);
  return (
    <ChartPanel
      title={t("title")}
      subtitle={t("subtitle")}
      height={220}
      state={loading ? "loading" : total > 0 ? "ready" : "empty"}
      empty={{ icon: <Smiley />, message: t("empty") }}
      className={className}
    >
      <div className="flex h-full items-center">
        <CompositionRing
          className="w-full justify-center"
          slices={SENTIMENT_KEYS.map((key) => ({ key, label: ts(key), value: tally[key], color: SENTIMENT_COLOR[key] }))}
          centerValue={total >= 10_000 ? fmt.compact(total) : fmt.num(total)}
          centerLabel={t("center")}
          formatValue={(value, pct) => t("share", { value: fmt.num(value), share: fmt.pct(pct, 0) })}
        />
      </div>
    </ChartPanel>
  );
}

export function SentimentByGroupPanel({
  groups,
  loading,
  className,
}: {
  groups: GroupSentiment[];
  loading: boolean;
  className?: string;
}) {
  const t = useTranslations("unofficialGroups.dashboard.sentimentGroups");
  const ts = useTranslations("unofficialGroups.common.sentiment");
  const groupName = useGroupName();
  const [order, setOrder] = useState<SentimentGroupOrder>("negative");
  const ranked = useMemo(() => rankSentimentByGroup(groups, order), [groups, order]);

  return (
    <GroupsPanel
      title={t("title")}
      subtitle={t("subtitle", { count: SENTIMENT_GROUP_LIMIT })}
      className={className}
      actions={
        <WindowToggle<SentimentGroupOrder>
          ariaLabel={t("orderLabel")}
          value={order}
          onChange={setOrder}
          options={(["negative", "messages"] as const).map((value) => ({ value, label: t(`orders.${value}`) }))}
        />
      }
    >
      {loading ? (
        <Skeleton className="h-[220px] w-full" />
      ) : ranked.length === 0 ? (
        <QuietEmpty icon={<Smiley />} message={t("empty")} className="h-[220px] py-0" />
      ) : (
        <StackedBarsH
          rows={ranked.map((group) => ({
            key: group.groupId,
            label: groupName(group.subject),
            href: groupsRoutes.group(group.groupId, { tab: "analysis" }),
            values: { positive: group.positive, neutral: group.neutral, negative: group.negative },
          }))}
          series={SENTIMENT_KEYS.map((key) => ({ key, label: ts(key), color: SENTIMENT_COLOR[key] }))}
          unit={(count) => t("unit", { count })}
        />
      )}
    </GroupsPanel>
  );
}

export function TopGroupsPanel({
  groups,
  points,
  loading,
  className,
}: {
  groups: GroupCount[];
  points: DailyPoint[];
  loading: boolean;
  className?: string;
}) {
  const t = useTranslations("unofficialGroups.dashboard.activeGroups");
  const tm = useTranslations("unofficialGroups.dashboard.topGroups");
  const fmt = useGroupsFormat();
  const groupName = useGroupName();
  const windowTotal = Math.max(sumOf(points, (point) => point.messages), sumOf(groups, (group) => group.count));

  return (
    <GroupsPanel title={t("title")} subtitle={t("subtitle")} className={className}>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-7 w-full" />
          ))}
        </div>
      ) : (
        <RankedList
          numbered
          empty={{ icon: <ChartBar />, message: t("empty") }}
          rows={groups.map((group, index) => ({
            key: group.groupId,
            color: VOZ_SERIES[index % VOZ_SERIES.length],
            dot: VOZ_SERIES[index % VOZ_SERIES.length],
            label: groupName(group.subject),
            value: group.count,
            display: tm("messages", { count: group.count, value: fmt.num(group.count) }),
            href: groupsRoutes.group(group.groupId),
            hint: t("share", { share: fmt.share(group.count, windowTotal) }),
          }))}
        />
      )}
    </GroupsPanel>
  );
}

export function ResponsePanel({
  points,
  timezone,
  loading,
  className,
}: {
  points: ResponseTimePoint[];
  timezone: string;
  loading: boolean;
  className?: string;
}) {
  const t = useTranslations("unofficialGroups.dashboard.responsePanel");
  const fmt = useGroupsFormat(timezone);
  const stats = useMemo(() => responseStats(points, RESPONSE_GOAL_MINUTES), [points]);
  const data = useMemo(
    () =>
      points.map((point) => {
        const value = point.samples > 0 ? point.avgMinutes : null;
        return {
          key: point.day,
          label: fmt.day(point.day),
          value,
          tip: [
            {
              key: "average",
              label: t("averageLine"),
              value: value === null ? t("noSamples") : fmt.minutes(value),
              color: GROUPS_CHART_COLOR.responseTime,
            },
            { key: "samples", label: t("samplesLabel"), value: fmt.num(point.samples) },
          ],
        };
      }),
    [points, fmt, t],
  );

  return (
    <ChartPanel
      title={t("title")}
      subtitle={t("subtitle")}
      height={180}
      state={loading ? "loading" : stats.average === null ? "empty" : "ready"}
      empty={{ icon: <Timer />, message: t("empty") }}
      readouts={
        stats.average === null
          ? []
          : [
              { label: t("average"), value: fmt.minutes(stats.average) },
              { label: t("samplesLabel"), value: fmt.num(stats.samples) },
              { label: t("aboveGoal"), value: t("days", { count: stats.daysAboveGoal }) },
            ]
      }
      className={className}
    >
      <TrendArea
        data={data}
        color={GROUPS_CHART_COLOR.responseTime}
        height={180}
        formatY={(value) => fmt.num(Math.round(value))}
        goal={{ value: RESPONSE_GOAL_MINUTES, label: t("goal", { value: RESPONSE_GOAL_MINUTES }) }}
        legend={[{ key: "average", label: t("averageLine"), color: GROUPS_CHART_COLOR.responseTime, shape: "line" }]}
      />
    </ChartPanel>
  );
}
