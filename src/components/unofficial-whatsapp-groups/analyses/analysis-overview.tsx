"use client";

import { useMemo, useState } from "react";
import { useNow, useTranslations } from "next-intl";

import { SENTIMENT_COLOR, Skeleton } from "@/components/audience/shared";
import { Meter, ProgressRing } from "@/components/charts/vozko";
import Button from "@/components/elevated-design/button";
import { EmptyValue, useEmptyValue } from "@/components/elevated-design/empty-value";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { CalendarBlank, ChartLine, ChatsCircle, Clock, Lightbulb, Pulse, Smiley, Tag, UsersThree, Warning } from "@/components/icons";
import { GLYPH_PLATE } from "@/components/icons/glyph-plates";
import { ALERT_COLOR, RUN_SENTIMENT_COLOR, RunSentimentChip } from "@/components/unofficial-whatsapp-groups/marks";
import { useRouter } from "@/i18n/routing";
import type { AnalysisDetail, ParticipantTotal } from "@/lib/unofficial-whatsapp-groups/types";

import { GROUPS_CHART_COLOR, CompositionRing, RankedList } from "../kit/charts";
import { QuietEmpty } from "../kit/empty";
import { CycleProgress, RUN_SENTIMENT_ORDER, SentimentSplit } from "../kit/figures";
import { WindowToggle } from "../kit/filters";
import { highAlertMark, jidLocal, shareOf } from "../kit/format";
import { GroupLinks, PersonIdentity } from "../kit/identity";
import { KpiBand, type KpiCell } from "../kit/kpi-band";
import { GroupsChapter, GroupsPanel } from "../kit/panel";
import { ANALYSIS_WINDOWS, groupsRoutes, type AnalysisWindow } from "../kit/routes";
import { useGroupsFormat } from "../kit/use-groups-format";
import { scheduleTimeOf } from "./analysis-form";
import {
  ALERT_ORDER,
  dominantOf,
  multiGroupCount,
  nextParticipantSort,
  perCycle,
  sentimentShares,
  sortParticipants,
  type ParticipantSort,
} from "./analysis-series";
import { CycleChart, CycleHighlights } from "./cycle-chart";

const TOP_RANKED = 10;
const CHART_HEIGHT = 236;
const RING_SIZE = 120;

function useWindowOptions() {
  const t = useTranslations("unofficialGroups.analyses.period");
  return ANALYSIS_WINDOWS.map((value) => ({ value, label: value === -1 ? t("windows.all") : t("windows.days", { count: value }) }));
}

export function AnalysisPeriodChapter({
  detail,
  days,
  onDays,
  refreshing,
  participantGroups,
}: {
  detail: AnalysisDetail;
  days: AnalysisWindow;
  onDays: (days: AnalysisWindow) => void;
  refreshing: boolean;
  participantGroups: AnalysisDetail["participantGroups"];
}) {
  const t = useTranslations("unofficialGroups.analyses.period");
  const options = useWindowOptions();
  const { overview, timezone } = detail;
  const subtitle = detail.windowDays === 0 ? t("subtitleAll", { timezone }) : t("subtitleDays", { days: detail.windowDays, timezone });

  return (
    <GroupsChapter
      id="analysis-period"
      icon={<CalendarBlank />}
      title={t("title")}
      subtitle={subtitle}
      meta={<WindowToggle<AnalysisWindow> ariaLabel={t("windowAria")} value={days} options={options} onChange={onDays} />}
    >
      {refreshing ? (
        <PeriodSkeleton />
      ) : overview.cycles === 0 ? (
        <PeriodEmpty detail={detail} onAll={() => onDays(-1)} />
      ) : (
        <>
          <PeriodKpis detail={detail} participantGroups={participantGroups} />
          <div className="grid gap-3 xl:grid-cols-12">
            <CyclesPanel detail={detail} />
            <ClimatePanel detail={detail} />
          </div>
          <ParticipantsTable detail={detail} participantGroups={participantGroups} />
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-12">
            <ThemesPanel detail={detail} />
            <MentionsPanel detail={detail} />
            <SuggestionsPanel detail={detail} />
          </div>
        </>
      )}
    </GroupsChapter>
  );
}

function PeriodSkeleton() {
  return (
    <>
      <KpiBand label="" cells={[]} columns={6} loading />
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-12">
        <Skeleton className="h-[320px] xl:col-span-8" />
        <Skeleton className="h-[320px] xl:col-span-4" />
      </div>
    </>
  );
}

function PeriodEmpty({ detail, onAll }: { detail: AnalysisDetail; onAll: () => void }) {
  const t = useTranslations("unofficialGroups.analyses.period");
  const { analysis, timezone } = detail;
  const time = scheduleTimeOf(analysis.scheduleHour, analysis.scheduleMinute);
  const hasOlderRuns = detail.windowDays > 0 && Boolean(analysis.lastRunAt);
  return (
    <GroupsPanel title={hasOlderRuns ? t("emptyWindowTitle") : t("emptyTitle")}>
      <QuietEmpty
        icon={<ChartLine />}
        message={
          hasOlderRuns
            ? t("emptyWindow", { days: detail.windowDays })
            : analysis.trigger === "scheduled"
              ? t("emptyScheduled", { time, timezone })
              : t("emptyCount", { count: analysis.messagesPerCycle })
        }
        action={hasOlderRuns ? <Button variant="secondary" size="sm" title={t("seeAll")} onClick={onAll} /> : undefined}
      />
    </GroupsPanel>
  );
}

function PeriodKpis({ detail, participantGroups }: { detail: AnalysisDetail; participantGroups: AnalysisDetail["participantGroups"] }) {
  const t = useTranslations("unofficialGroups.analyses.period.kpi");
  const ts = useTranslations("unofficialGroups.common.sentiment");
  const fmt = useGroupsFormat(detail.timezone);
  const now = useNow({ updateInterval: 60_000 });
  const empty = useEmptyValue();
  const { overview, analysis } = detail;
  const failed = Math.max(0, overview.cycles - overview.completed);
  const average = perCycle(overview.messages, overview.completed);
  const high = overview.alertCounts.high ?? 0;
  const dominant = overview.dominantSentiment;
  const lastRunAt = overview.lastRunAt ?? analysis.lastRunAt;
  const anyCompleted = overview.completed > 0;
  const ring = (value: number, color: string, label: string) => (
    <ProgressRing value={value} size={36} strokeWidth={4} color={color} label={label}>
      <span />
    </ProgressRing>
  );

  const cells: KpiCell[] = [
    {
      key: "cycles",
      icon: Pulse,
      plate: GLYPH_PLATE.Pulse,
      label: t("cycles"),
      value: fmt.num(overview.completed),
      total: t("of", { total: fmt.num(overview.cycles) }),
      sub: t("failed", { count: failed }),
      mark: failed > 0 ? "warning" : undefined,
      visual: overview.cycles > 0 ? ring(shareOf(overview.completed, overview.cycles) ?? 0, "hsl(var(--healthy))", t("completedShare")) : undefined,
    },
    {
      key: "messages",
      icon: ChatsCircle,
      plate: GLYPH_PLATE.ChatsCircle,
      label: t("messages"),
      value: fmt.num(overview.messages),
      sub: average === null ? undefined : t("average", { value: fmt.num(Math.round(average * 10) / 10) }),
    },
    {
      key: "positivity",
      icon: Smiley,
      plate: GLYPH_PLATE.Pulse,
      label: t("positivityLabel"),
      value: anyCompleted ? fmt.num(overview.avgPositivity) : empty,
      total: anyCompleted ? t("outOf100") : undefined,
      sub: anyCompleted ? t("dominantSub", { sentiment: ts(dominant) }) : undefined,
      visual: anyCompleted ? ring(overview.avgPositivity, RUN_SENTIMENT_COLOR[dominant], t("positivityLabel")) : undefined,
    },
    {
      key: "high",
      icon: Warning,
      plate: high > 0 ? "tile-fault" : GLYPH_PLATE.Warning,
      label: t("highAlerts"),
      value: anyCompleted ? fmt.pct(overview.highAlertPct, 0) : empty,
      mark: anyCompleted ? highAlertMark(overview.highAlertPct, overview.completed) : undefined,
      sub: anyCompleted ? t("highAlertsOf", { count: high, total: overview.completed }) : undefined,
      visual: anyCompleted ? ring(overview.highAlertPct, ALERT_COLOR.high, t("highAlerts")) : undefined,
    },
    {
      key: "participants",
      icon: UsersThree,
      plate: GLYPH_PLATE.UsersThree,
      label: t("participants"),
      value: fmt.num(overview.participantCount),
      sub: t("participantsSub", { count: multiGroupCount(participantGroups) }),
    },
    {
      key: "last",
      icon: Clock,
      plate: GLYPH_PLATE.Clock,
      label: t("lastCycle"),
      value: lastRunAt ? fmt.relative(lastRunAt, now) : empty,
      title: lastRunAt ? fmt.dateTime(lastRunAt) : undefined,
      sub: <CycleProgress analysis={analysis} compact timeZone={detail.timezone} />,
    },
  ];
  return <KpiBand label={t("label")} cells={cells} columns={6} />;
}

function CyclesPanel({ detail }: { detail: AnalysisDetail }) {
  const t = useTranslations("unofficialGroups.analyses.period.cycleChart");
  const { overview, timezone } = detail;
  return (
    <GroupsPanel title={t("title")} subtitle={t("subtitle")} className="xl:col-span-8">
      {overview.trend.length === 0 ? (
        <QuietEmpty icon={<ChartLine />} message={t("empty")} />
      ) : (
        <div className="space-y-2.5">
          <CycleChart trend={overview.trend} height={CHART_HEIGHT} timezone={timezone} />
          <CycleHighlights trend={overview.trend} timezone={timezone} />
        </div>
      )}
    </GroupsPanel>
  );
}

function ClimatePanel({ detail }: { detail: AnalysisDetail }) {
  const t = useTranslations("unofficialGroups.analyses.period");
  const ts = useTranslations("unofficialGroups.common.sentiment");
  const ta = useTranslations("unofficialGroups.common.alert");
  const fmt = useGroupsFormat(detail.timezone);
  const { overview } = detail;
  const sentiments = sentimentShares(overview.sentimentCounts, RUN_SENTIMENT_ORDER).rows;
  const alerts = sentimentShares(overview.alertCounts, ALERT_ORDER).rows.slice().reverse();
  return (
    <GroupsPanel title={t("climate.title")} subtitle={t("climate.subtitle", { count: overview.completed })} className="xl:col-span-4">
      {overview.completed === 0 ? (
        <QuietEmpty icon={<ChartLine />} message={t("trendEmpty")} />
      ) : (
        <div className="space-y-4">
          <CompositionRing
            size={RING_SIZE}
            slices={sentiments.map((row) => ({ key: row.key, label: ts(row.key), value: row.value, color: RUN_SENTIMENT_COLOR[row.key] }))}
            centerValue={fmt.num(overview.completed)}
            centerLabel={t("cyclesCenter", { count: overview.completed })}
            formatValue={(value, pct) => t("countShare", { count: fmt.num(value), share: fmt.pct(pct, 0) })}
          />
          <table className="w-full text-xs">
            <thead>
              <tr className="text-2xs text-muted-foreground">
                <th className="pb-1.5 text-left font-semibold">{t("climate.alertHead")}</th>
                <th className="pb-1.5 text-right font-semibold">{t("climate.cyclesHead")}</th>
                <th className="w-12 pb-1.5 text-right font-semibold">{t("climate.shareHead")}</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((row) => (
                <tr key={row.key} className="border-t border-border">
                  <td className="py-1.5">
                    <span className="inline-flex items-center gap-2 text-foreground">
                      <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: ALERT_COLOR[row.key] }} />
                      {ta(row.key)}
                    </span>
                  </td>
                  <td className="readout py-1.5 text-right font-semibold tabular-nums text-foreground">{fmt.num(row.value)}</td>
                  <td className="readout py-1.5 text-right tabular-nums text-muted-foreground">{fmt.pct(row.share, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GroupsPanel>
  );
}

function ThemesPanel({ detail }: { detail: AnalysisDetail }) {
  const t = useTranslations("unofficialGroups.analyses.period");
  const fmt = useGroupsFormat(detail.timezone);
  const { overview } = detail;
  return (
    <GroupsPanel title={t("themes")} subtitle={t("themesSub")} className="xl:col-span-4">
      <RankedList
        numbered
        rows={overview.themes.slice(0, TOP_RANKED).map((theme, index) => ({
          key: `${theme.label}-${index}`,
          label: theme.label,
          value: theme.count,
          display: t("cycles", { count: theme.count, value: fmt.num(theme.count) }),
          hint: t("ofCycles", { share: fmt.share(theme.count, overview.completed) }),
        }))}
        empty={{ icon: <Tag />, message: t("themesEmpty") }}
      />
    </GroupsPanel>
  );
}

function MentionsPanel({ detail }: { detail: AnalysisDetail }) {
  const t = useTranslations("unofficialGroups.analyses.period");
  const fmt = useGroupsFormat(detail.timezone);
  return (
    <GroupsPanel title={t("mentions")} subtitle={t("mentionsSub")} className="xl:col-span-4">
      <RankedList
        numbered
        rows={detail.overview.mentions.slice(0, TOP_RANKED).map((mention, index) => ({
          key: `${mention.entity}-${index}`,
          label: mention.entity,
          value: mention.frequency,
          display: t("mentionCount", { count: mention.frequency, value: fmt.num(mention.frequency) }),
          dot: SENTIMENT_COLOR[mention.dominantSentiment],
          badge: <SentimentSplit counts={mention.sentiments} kind="mention" size="sm" legend={false} className="w-14 min-w-0 shrink-0" />,
        }))}
        empty={{ icon: <ChatsCircle />, message: t("mentionsEmpty") }}
      />
    </GroupsPanel>
  );
}

function SuggestionsPanel({ detail }: { detail: AnalysisDetail }) {
  const t = useTranslations("unofficialGroups.analyses.period");
  const fmt = useGroupsFormat(detail.timezone);
  const { overview } = detail;
  return (
    <GroupsPanel title={t("suggestions")} subtitle={t("suggestionsSub")} className="lg:col-span-2 xl:col-span-4">
      <RankedList
        numbered
        rows={overview.suggestions.slice(0, TOP_RANKED).map((suggestion, index) => ({
          key: `${suggestion.label}-${index}`,
          label: suggestion.label,
          value: suggestion.count,
          display: t("cycles", { count: suggestion.count, value: fmt.num(suggestion.count) }),
          hint: t("ofCycles", { share: fmt.share(suggestion.count, overview.completed) }),
        }))}
        empty={{ icon: <Lightbulb />, message: t("suggestionsEmpty") }}
      />
    </GroupsPanel>
  );
}

function ParticipantsTable({ detail, participantGroups }: { detail: AnalysisDetail; participantGroups: AnalysisDetail["participantGroups"] }) {
  const t = useTranslations("unofficialGroups.analyses.period.table");
  const router = useRouter();
  const fmt = useGroupsFormat(detail.timezone);
  const [sort, setSort] = useState<ParticipantSort>({ key: "messages", direction: "desc" });
  const { participants, participantCount } = detail.overview;
  const total = participants.reduce((sum, participant) => sum + Math.max(0, participant.messages), 0);
  const rows = useMemo(() => sortParticipants(participants, sort), [participants, sort]);
  const peopleHref = (participant: ParticipantTotal) => (participant.jid ? groupsRoutes.people({ search: jidLocal(participant.jid) }) : undefined);

  const columns = useMemo<DashboardTableColumn<ParticipantTotal>[]>(
    () => [
      {
        key: "person",
        header: t("person"),
        sortKey: "name",
        render: (row) => (
          <PersonIdentity
            person={{ name: row.name, jid: row.jid }}
            compact
            href={peopleHref(row)}
            trailing={row.jid ? <GroupLinks groups={participantGroups[row.jid] ?? []} variant="badge" /> : null}
          />
        ),
      },
      {
        key: "messages",
        header: t("messages"),
        sortKey: "messages",
        render: (row) => (
          <span className="inline-flex items-center gap-2">
            <span className="readout w-10 text-right text-xs font-semibold tabular-nums text-foreground">{fmt.num(row.messages)}</span>
            <Meter value={shareOf(row.messages, total) ?? 0} size="sm" color={GROUPS_CHART_COLOR.neutral} className="w-20" label={t("shareOfTop", { share: fmt.share(row.messages, total) })} />
          </span>
        ),
      },
      {
        key: "share",
        header: t("share"),
        render: (row) => <span className="readout text-xs tabular-nums text-muted-foreground">{fmt.share(row.messages, total)}</span>,
      },
      {
        key: "split",
        header: t("split"),
        render: (row) => <SentimentSplit counts={row.sentiments} kind="run" size="sm" legend={false} className="w-56" />,
      },
      {
        key: "dominant",
        header: t("dominant"),
        render: (row) => {
          const dominant = dominantOf(row.sentiments, RUN_SENTIMENT_ORDER);
          return dominant ? <RunSentimentChip sentiment={dominant} /> : <EmptyValue className="text-xs" />;
        },
      },
    ],
    [fmt, participantGroups, t, total],
  );

  return (
    <DashboardTable<ParticipantTotal>
      data={rows}
      columns={columns}
      rowKey={(row) => row.key}
      onRowClick={(row) => {
        const href = peopleHref(row);
        if (href) router.push(href);
      }}
      sorting={{ sorts: [sort], onToggle: (key) => setSort((current) => nextParticipantSort(current, key as ParticipantSort["key"])) }}
      headerLeft={
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold leading-tight text-foreground">{t("title")}</h3>
          <p className="text-xs text-muted-foreground">
            {participantCount > participants.length
              ? t("subtitleOf", { shown: participants.length, total: participantCount })
              : t("subtitle", { count: participants.length })}
          </p>
        </div>
      }
      emptyState={{ icon: <UsersThree className="h-7 w-7 text-muted-foreground" />, title: t("empty") }}
    />
  );
}
