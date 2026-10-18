"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { SENTIMENT_COLOR } from "@/components/audience/shared";
import { ProgressRing, SegmentBar } from "@/components/charts/vozko";
import Button from "@/components/elevated-design/button";
import { ArrowSquareOut, ChartLine, ChatText, Plus, Sparkle, Stack, TagSimple, Users, UsersThree } from "@/components/icons";
import type { AlertLevel, AnalysisRun, GroupDetail } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { AnalysisFormSheet } from "../analyses/analysis-form-sheet";
import { ALERT_COLOR, AlertChip, RUN_SENTIMENT_COLOR, RunSentimentChip } from "../marks";
import { ChartPanel } from "../kit/chart-panel";
import { CompositionRing, FlowChart, GROUPS_CHART_COLOR, RankedList, StackedBarsH, TrendArea } from "../kit/charts";
import { flowTotals, hasFlow } from "../kit/chart-model";
import { QuietEmpty } from "../kit/empty";
import { RUN_SENTIMENT_ORDER, SentimentSplit } from "../kit/figures";
import { highAlertMark, jidLocal } from "../kit/format";
import { MarkDot } from "../kit/kpi-band";
import { NotFollowedNotice, SetupWarningsNotice } from "../kit/notices";
import { GroupsPanel } from "../kit/panel";
import { RelativeTime } from "../kit/relative-time";
import { groupsRoutes } from "../kit/routes";
import { useGroupName, useGroupsFormat } from "../kit/use-groups-format";
import { outstandingSetupWarnings, topTalkers } from "./detail-model";
import { NextInSeriesButton } from "./next-in-series";
import { SeatList } from "./seat-list";
import { forgetSetupWarnings, recallSetupWarnings } from "./setup-warnings-store";
import type { GroupActions } from "./use-group-actions";
import type { GroupPermissions } from "./use-group-permissions";

const TOP_ROWS = 8;
const ALERT_ORDER: AlertLevel[] = ["low", "medium", "high"];
const PART_COLOR = "hsl(var(--foreground) / 0.55)";

export function OverviewTab({
  detail,
  permissions,
  actions,
  onChanged,
}: {
  detail: GroupDetail;
  permissions: GroupPermissions;
  actions: GroupActions;
  onChanged: () => void;
}) {
  const t = useTranslations("unofficialGroups.detail.overviewTab");
  const fmt = useGroupsFormat();
  const { group, growth, series, numbers } = detail;
  const followed = Boolean(group.followedAt);
  const [creating, setCreating] = useState(false);
  const stored = useMemo(() => recallSetupWarnings(group.id), [group.id]);
  const warnings = useMemo(() => outstandingSetupWarnings(stored, group, numbers), [stored, group, numbers]);
  const settled = stored.length > 0 && warnings.length === 0;
  const totals = flowTotals(growth);
  const canCreateAnalysis = permissions.configure && followed;
  const hasSeries = series.length > 1;

  useEffect(() => {
    if (settled) forgetSetupWarnings(group.id);
  }, [settled, group.id]);

  return (
    <div className="space-y-3">
      {!followed ? <NotFollowedNotice onFollow={permissions.update ? () => void actions.follow() : undefined} busy={actions.busy !== null} /> : null}
      {warnings.length > 0 ? <SetupWarningsNotice warnings={warnings} groupId={group.id} /> : null}

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-12">
        <ChartPanel
          className="lg:col-span-2 xl:col-span-8"
          title={t("flow.title")}
          meta={<span className="readout">{t("last30")}</span>}
          height={220}
          state={hasFlow(growth) ? "ready" : "empty"}
          empty={{ icon: <Users />, message: followed ? t("flow.empty") : t("flow.notFollowed") }}
          readouts={[
            { label: t("flow.joins"), value: `+${fmt.num(totals.joins)}` },
            { label: t("flow.leaves"), value: `-${fmt.num(totals.leaves)}` },
            { label: t("flow.net"), value: fmt.signed(totals.net) },
          ]}
        >
          <FlowChart points={growth} height={220} />
        </ChartPanel>

        <AnalysisSummary detail={detail} className="lg:col-span-2 xl:col-span-4" onCreate={canCreateAnalysis ? () => setCreating(true) : undefined} />

        <PositivityPanel detail={detail} className="xl:col-span-5" />
        <AlertsPanel detail={detail} className="xl:col-span-3" />
        <CompositionPanel detail={detail} className="lg:col-span-2 xl:col-span-4" />

        <LatestRunPanel run={detail.latestRun} className="lg:col-span-2 xl:col-span-6" />
        <GroupsPanel className="xl:col-span-3" title={t("themes.title")} meta={<span className="readout">{t("last30")}</span>}>
          <RankedList
            numbered
            rows={detail.overview.themes.slice(0, TOP_ROWS).map((theme) => ({
              key: theme.label,
              label: theme.label,
              value: theme.count,
              display: t("cycles", { count: theme.count }),
            }))}
            empty={{ icon: <TagSimple />, message: t("themes.empty") }}
          />
        </GroupsPanel>
        <GroupsPanel className="xl:col-span-3" title={t("mentions.title")} meta={<span className="readout">{t("last30")}</span>}>
          <RankedList
            rows={detail.overview.mentions.slice(0, TOP_ROWS).map((mention) => ({
              key: mention.entity,
              label: mention.entity,
              value: mention.frequency,
              display: fmt.num(mention.frequency),
              dot: SENTIMENT_COLOR[mention.dominantSentiment],
              hint: t("mentions.count", { count: mention.frequency }),
              badge: <SentimentSplit counts={mention.sentiments} kind="mention" size="sm" legend={false} className="w-14 min-w-0 shrink-0" />,
            }))}
            empty={{ icon: <ChatText />, message: t("mentions.empty") }}
          />
        </GroupsPanel>

        <TalkersPanel detail={detail} className={cn("lg:col-span-2", hasSeries ? "xl:col-span-6" : "xl:col-span-12")} />
        {hasSeries ? <SeriesPanel detail={detail} actions={actions} permissions={permissions} className="lg:col-span-2 xl:col-span-6" /> : null}
      </div>

      {canCreateAnalysis ? (
        <AnalysisFormSheet
          open={creating}
          onOpenChange={setCreating}
          presetGroupId={group.id}
          lockGroup
          group={group}
          onSaved={() => {
            setCreating(false);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

function SummaryTile({ label, value, sub }: { label: string; value: ReactNode; sub: ReactNode }) {
  return (
    <div className="min-w-0 bg-card px-3 py-2.5">
      <p className="truncate text-2xs font-semibold text-muted-foreground">{label}</p>
      <p className="readout mt-1 font-display text-xl font-semibold leading-none text-foreground">{value}</p>
      <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-2xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function AnalysisSummary({ detail, className, onCreate }: { detail: GroupDetail; className?: string; onCreate?: () => void }) {
  const t = useTranslations("unofficialGroups.detail.overviewTab.summary");
  const tw = useTranslations("unofficialGroups.detail.overviewTab");
  const fmt = useGroupsFormat();
  const { overview } = detail;
  const mark = highAlertMark(overview.highAlertPct, overview.completed);
  const high = overview.alertCounts.high ?? 0;

  return (
    <GroupsPanel className={className} title={t("title")} meta={<span className="readout">{tw("last30")}</span>}>
      {overview.cycles === 0 ? (
        <QuietEmpty
          icon={<Sparkle />}
          message={t("empty")}
          action={onCreate ? <Button variant="secondary" size="sm" title={t("create")} icon={<Plus />} iconVisible onClick={onCreate} /> : undefined}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <ProgressRing value={overview.avgPositivity} size={64} strokeWidth={7} color={RUN_SENTIMENT_COLOR[overview.dominantSentiment]} label={t("positivity")}>
              <span className="readout font-display text-sm font-semibold text-foreground">{fmt.num(Math.round(overview.avgPositivity))}</span>
            </ProgressRing>
            <div className="min-w-0 space-y-1">
              <p className="readout font-display text-xl font-semibold leading-none text-foreground">
                {t("score", { value: fmt.num(Math.round(overview.avgPositivity)) })}
              </p>
              <RunSentimentChip sentiment={overview.dominantSentiment} />
              {overview.lastRunAt ? (
                <p className="flex items-center gap-1 text-2xs text-muted-foreground">
                  {t("updated")}
                  <RelativeTime at={overview.lastRunAt} className="readout tabular-nums text-foreground" />
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[--radius] border border-border bg-border">
            <SummaryTile label={t("cycles")} value={fmt.num(overview.completed)} sub={t("cyclesSub")} />
            <SummaryTile label={t("messages")} value={fmt.num(overview.messages)} sub={t("messagesSub")} />
            <SummaryTile
              label={t("highAlerts")}
              value={fmt.num(high)}
              sub={
                <>
                  {mark ? <MarkDot mark={mark} /> : null}
                  <span className="truncate">{t("highAlertsSub", { pct: fmt.pct(overview.highAlertPct, 0) })}</span>
                </>
              }
            />
          </div>
        </div>
      )}
    </GroupsPanel>
  );
}

function PositivityPanel({ detail, className }: { detail: GroupDetail; className?: string }) {
  const t = useTranslations("unofficialGroups.detail.overviewTab.positivity");
  const tw = useTranslations("unofficialGroups.detail.overviewTab");
  const fmt = useGroupsFormat();
  const trend = detail.overview.trend;
  const data = useMemo(
    () =>
      trend.map((point) => ({
        key: `${point.cycle}-${point.at}`,
        label: `#${point.cycle}`,
        value: point.positivity,
        tip: [
          { key: "when", label: t("cycle", { cycle: point.cycle }), value: fmt.dateTime(point.at) },
          { key: "score", label: t("score"), value: t("outOf", { value: fmt.num(Math.round(point.positivity)) }), color: GROUPS_CHART_COLOR.positivity },
        ],
      })),
    [trend, t, fmt],
  );
  return (
    <ChartPanel
      className={className}
      title={t("title")}
      subtitle={t("subtitle")}
      meta={<span className="readout">{tw("last30")}</span>}
      height={200}
      state={trend.length > 0 ? "ready" : "empty"}
      empty={{ icon: <ChartLine />, message: t("empty") }}
    >
      <TrendArea
        data={data}
        color={GROUPS_CHART_COLOR.positivity}
        height={200}
        domain={[0, 100]}
        reference={{ value: 50, label: t("midline") }}
        formatY={(value) => fmt.num(value)}
      />
    </ChartPanel>
  );
}

function AlertsPanel({ detail, className }: { detail: GroupDetail; className?: string }) {
  const t = useTranslations("unofficialGroups.detail.overviewTab.alerts");
  const tAlert = useTranslations("unofficialGroups.common.alert");
  const tw = useTranslations("unofficialGroups.detail.overviewTab");
  const fmt = useGroupsFormat();
  const { overview } = detail;
  return (
    <GroupsPanel
      className={className}
      title={t("title")}
      subtitle={t("subtitle", { count: overview.completed })}
      meta={<span className="readout">{tw("last30")}</span>}
    >
      {overview.completed === 0 ? (
        <QuietEmpty icon={<Sparkle />} message={t("empty")} />
      ) : (
        <div className="space-y-4">
          <CompositionRing
            size={104}
            slices={ALERT_ORDER.map((level) => ({ key: level, label: tAlert(level), value: overview.alertCounts[level] ?? 0, color: ALERT_COLOR[level] }))}
            centerValue={fmt.pct(overview.highAlertPct, 0)}
            centerLabel={t("high")}
            formatValue={(value, pct) => `${fmt.num(value)} · ${fmt.pct(pct, 0)}`}
          />
          <div className="space-y-1.5">
            <p className="text-2xs font-semibold text-muted-foreground">{t("sentiment")}</p>
            <SentimentSplit counts={overview.sentimentCounts} kind="run" size="md" className="min-w-0" />
          </div>
        </div>
      )}
    </GroupsPanel>
  );
}

function CompositionPanel({ detail, className }: { detail: GroupDetail; className?: string }) {
  const t = useTranslations("unofficialGroups.detail.overviewTab.composition");
  const fmt = useGroupsFormat();
  const { members, numbers } = detail;
  const withoutLead = Math.max(0, members.active - members.withLead);
  const visible = Math.max(0, members.active - members.hidden);
  const formatValue = (value: number, pct: number) => `${fmt.num(value)} (${fmt.pct(pct, 0)})`;
  return (
    <GroupsPanel className={className} title={t("title")} subtitle={t("subtitle")}>
      <div className="space-y-3">
        <SegmentBar
          size="md"
          formatValue={formatValue}
          segments={[
            { key: "withLead", label: t("withLead"), value: members.withLead, color: PART_COLOR },
            { key: "withoutLead", label: t("withoutLead"), value: withoutLead, color: GROUPS_CHART_COLOR.neutral },
          ]}
        />
        <SegmentBar
          size="md"
          formatValue={formatValue}
          segments={[
            { key: "visible", label: t("visible"), value: visible, color: PART_COLOR },
            { key: "hidden", label: t("hidden"), value: members.hidden, color: GROUPS_CHART_COLOR.neutral },
          ]}
        />
        <div className="border-t border-border pt-2">
          <p className="mb-1 text-2xs font-semibold text-muted-foreground">{t("seats", { count: numbers.length })}</p>
          {numbers.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noSeats")}</p>
          ) : (
            <SeatList seats={numbers} />
          )}
        </div>
      </div>
    </GroupsPanel>
  );
}

function LatestRunPanel({ run, className }: { run?: AnalysisRun; className?: string }) {
  const t = useTranslations("unofficialGroups.detail.overviewTab.latest");
  const fmt = useGroupsFormat();
  const result = run?.result;
  if (!run || !result) {
    return (
      <GroupsPanel className={className} title={t("title")}>
        <QuietEmpty icon={<Sparkle />} message={t("empty")} />
      </GroupsPanel>
    );
  }
  const href = groupsRoutes.analysis(run.analysisId, { run: run.id });
  return (
    <GroupsPanel
      className={className}
      title={t("cycle", { cycle: run.cycle })}
      subtitle={t("subtitle", { when: fmt.dateTime(run.completedAt), messages: run.messagesAnalyzed })}
      meta={
        <span className="flex items-center gap-1.5">
          <RunSentimentChip sentiment={result.sentiment} />
          <AlertChip level={result.alertLevel} />
        </span>
      }
    >
      <div className="max-h-[340px] space-y-3 overflow-y-auto pr-1">
        {result.summary ? <p className="whitespace-pre-line text-xs leading-relaxed text-foreground">{result.summary}</p> : null}
        {result.insights.length > 0 ? (
          <section className="space-y-1">
            <h4 className="text-2xs font-semibold text-muted-foreground">{t("insights")}</h4>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-foreground">
              {result.insights.slice(0, 3).map((insight, index) => (
                <li key={`${index}-${insight}`}>{insight}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {result.suggestedActions.length > 0 ? (
          <section className="space-y-1">
            <h4 className="text-2xs font-semibold text-muted-foreground">{t("actions")}</h4>
            <ul className="divide-y divide-border rounded-[--radius] border border-border">
              {result.suggestedActions.slice(0, 3).map((action, index) => (
                <li key={`${index}-${action.situation}`} className="px-2.5 py-1.5">
                  <p className="text-xs font-semibold text-foreground">{action.situation}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{action.strategy}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-2.5">
        <Button variant="secondary" size="sm" title={t("open", { cycle: run.cycle })} link={href} newTab={false} icon={<ArrowSquareOut />} iconVisible />
        <Button variant="ghost" size="sm" title={t("messages")} link={`${href}#messages`} newTab={false} />
      </div>
    </GroupsPanel>
  );
}

function TalkersPanel({ detail, className }: { detail: GroupDetail; className?: string }) {
  const t = useTranslations("unofficialGroups.detail.overviewTab.talkers");
  const tw = useTranslations("unofficialGroups.detail.overviewTab");
  const tSentiment = useTranslations("unofficialGroups.common.sentiment");
  const tk = useTranslations("unofficialGroups.kit");
  const rows = topTalkers(detail.overview.participants, TOP_ROWS).map((person) => {
    const local = person.jid ? jidLocal(person.jid) : "";
    return {
      key: person.key,
      label: person.name?.trim() || local || tk("unnamedPerson"),
      href: local ? groupsRoutes.people({ search: local }) : undefined,
      values: person.sentiments as Record<string, number>,
    };
  });
  return (
    <GroupsPanel className={className} title={t("title")} subtitle={t("subtitle")} meta={<span className="readout">{tw("last30")}</span>}>
      {rows.length === 0 ? (
        <QuietEmpty icon={<UsersThree />} message={t("empty")} />
      ) : (
        <StackedBarsH
          rows={rows}
          series={RUN_SENTIMENT_ORDER.map((key) => ({ key, label: tSentiment(key), color: RUN_SENTIMENT_COLOR[key] }))}
          unit={(count) => tw("msgs", { count })}
        />
      )}
    </GroupsPanel>
  );
}

function SeriesPanel({ detail, actions, permissions, className }: { detail: GroupDetail; actions: GroupActions; permissions: GroupPermissions; className?: string }) {
  const t = useTranslations("unofficialGroups.detail.overviewTab.series");
  const fmt = useGroupsFormat();
  const groupName = useGroupName();
  const { group, series } = detail;
  const rows = [...series]
    .sort((a, b) => b.members - a.members)
    .map((sibling) => ({
      key: sibling.groupId,
      label: `#${sibling.sequence} ${groupName(sibling.subject)}`,
      value: sibling.members,
      display: fmt.num(sibling.members),
      href: sibling.groupId === group.id ? undefined : groupsRoutes.group(sibling.groupId),
    }));
  return (
    <GroupsPanel
      className={className}
      title={t("title")}
      subtitle={t("subtitle", { count: series.length })}
      actions={<NextInSeriesButton detail={detail} actions={actions} permissions={permissions} label={t("next")} />}
    >
      <RankedList rows={rows} emphasisKey={group.id} empty={{ icon: <Stack />, message: t("empty") }} />
    </GroupsPanel>
  );
}
