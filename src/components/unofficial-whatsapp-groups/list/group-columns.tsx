"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { Chip, SENTIMENT_COLOR } from "@/components/audience/shared";
import { Meter, VOZ_SERIES } from "@/components/charts/vozko";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import type { DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { Link } from "@/i18n/routing";
import { lastActivityOf, netGrowth, postingCount, seatsNeedAttention } from "@/lib/unofficial-whatsapp-groups/group-list";
import type { GroupRow } from "@/lib/unofficial-whatsapp-groups/types";

import { SignedFigure } from "../kit/figures";
import { highAlertMark } from "../kit/format";
import { GroupIdentity } from "../kit/identity";
import { MarkDot } from "../kit/kpi-band";
import { RelativeTime } from "../kit/relative-time";
import { groupsRoutes } from "../kit/routes";
import { useGroupsFormat } from "../kit/use-groups-format";
import { NumberSeats, RUN_SENTIMENT_COLOR, RunSentimentChip } from "../marks";

function GroupCell({ row }: { row: GroupRow }) {
  const t = useTranslations("unofficialGroups.list.table");
  return (
    <div className="min-w-[14rem] max-w-[20rem]">
      <GroupIdentity group={row.group} href={groupsRoutes.group(row.group.id)} sub="full" createdAt={row.groupCreatedAt} />
      {row.runningCampaigns > 0 ? (
        <Link
          href={groupsRoutes.group(row.group.id, { tab: "campaigns" })}
          onClick={(event) => event.stopPropagation()}
          className="ml-9 mt-1 inline-flex rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Chip dot="hsl(var(--healthy))" className="hover:bg-[hsl(var(--accent-hover))]">
            {t("runningCampaigns", { count: row.runningCampaigns })}
          </Chip>
        </Link>
      ) : null}
    </div>
  );
}

function AnalysisCell({ row }: { row: GroupRow }) {
  const t = useTranslations("unofficialGroups.list.table");
  const fmt = useGroupsFormat();
  const summary = row.summary;
  if (!summary) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-2xs text-muted-foreground">
        <EmptyValue className="text-xs" />
        {t("noRecentAnalysis")}
      </span>
    );
  }
  const mark = highAlertMark(summary.highAlertPct, summary.cycles);
  return (
    <div className="min-w-[10rem] space-y-1">
      <div className="flex items-center gap-2">
        <RunSentimentChip sentiment={summary.sentiment} />
        <span className="readout text-xs text-foreground">{t("positivityScore", { value: fmt.num(summary.positivity) })}</span>
        <Meter value={summary.positivity} size="sm" color={RUN_SENTIMENT_COLOR[summary.sentiment]} className="w-10" label={t("positivityLabel")} />
      </div>
      <p className="readout flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
        {t("cyclesAlert", { cycles: summary.cycles, pct: fmt.pct(summary.highAlertPct, 0) })}
        {mark ? <MarkDot mark={mark} /> : null}
      </p>
    </div>
  );
}

function HighlightsCell({ row }: { row: GroupRow }) {
  const tSentiment = useTranslations("audience.enums.sentiment");
  const theme = row.summary?.themes[0]?.label;
  const mention = row.summary?.mentions[0];
  if (!theme && !mention) return <EmptyValue className="text-xs" />;
  return (
    <div className="min-w-[8rem] max-w-[13rem] space-y-0.5 text-xs">
      {theme ? (
        <p className="truncate text-foreground" title={theme}>
          {theme}
        </p>
      ) : null}
      {mention ? (
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground" title={mention.entity}>
          <span
            role="img"
            aria-label={tSentiment(mention.dominantSentiment)}
            title={tSentiment(mention.dominantSentiment)}
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: SENTIMENT_COLOR[mention.dominantSentiment] }}
          />
          <span className="truncate">{mention.entity}</span>
        </p>
      ) : null}
    </div>
  );
}

function NumbersCell({ row }: { row: GroupRow }) {
  const t = useTranslations("unofficialGroups.list.table");
  if (row.numbers.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <EmptyValue className="text-xs" />
        <MarkDot mark="warning" label={t("numbersNeedAttention")} />
      </span>
    );
  }
  return (
    <div className="space-y-1">
      <NumberSeats seats={row.numbers} limit={2} />
      <p className="readout flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
        {t("posting", { posting: postingCount(row), total: row.numbers.length })}
        {seatsNeedAttention(row) ? <MarkDot mark="warning" label={t("numbersNeedAttention")} /> : null}
      </p>
    </div>
  );
}

export function useGroupColumns({ messagesMax, clientSortable }: { messagesMax: number; clientSortable: boolean }) {
  const t = useTranslations("unofficialGroups.list.table");
  const fmt = useGroupsFormat();

  return useMemo<DashboardTableColumn<GroupRow>[]>(
    () => [
      { key: "group", header: t("group"), sortKey: "group", render: (row) => <GroupCell row={row} /> },
      {
        key: "members",
        header: t("members"),
        sortKey: "members",
        className: "text-right",
        render: (row) => (
          <span className="readout text-xs font-semibold text-foreground" title={row.group.membersSyncedAt ? t("membersHint") : t("membersUnsyncedHint")}>
            {fmt.num(row.group.memberCount)}
          </span>
        ),
      },
      {
        key: "net",
        header: t("net"),
        sortKey: clientSortable ? "net" : undefined,
        className: "text-right",
        render: (row) => (
          <span className="inline-flex flex-col items-end">
            <SignedFigure value={netGrowth(row.activity)} className="text-xs" />
            <span className="readout whitespace-nowrap text-[11px] text-muted-foreground">
              {t("netSplit", { joins: fmt.num(row.activity.joins), leaves: fmt.num(row.activity.leaves) })}
            </span>
          </span>
        ),
      },
      {
        key: "messages",
        header: t("messages"),
        sortKey: clientSortable ? "messages" : undefined,
        className: "text-right",
        render: (row) => (
          <span className="inline-flex flex-col items-end gap-1">
            <span className="readout text-xs text-foreground">{fmt.num(row.activity.messages)}</span>
            <Meter value={(row.activity.messages / messagesMax) * 100} size="sm" color={VOZ_SERIES[0]} className="w-14" label={t("messages")} />
          </span>
        ),
      },
      { key: "analysis", header: t("analysis"), sortKey: clientSortable ? "analysis" : undefined, render: (row) => <AnalysisCell row={row} /> },
      { key: "highlights", header: t("highlights"), render: (row) => <HighlightsCell row={row} /> },
      { key: "numbers", header: t("numbers"), sortKey: clientSortable ? "numbers" : undefined, render: (row) => <NumbersCell row={row} /> },
      {
        key: "lastActivity",
        header: t("lastActivity"),
        sortKey: clientSortable ? "lastActivity" : undefined,
        render: (row) => <RelativeTime at={lastActivityOf(row)} className="readout whitespace-nowrap text-xs text-muted-foreground" />,
      },
    ],
    [t, fmt, messagesMax, clientSortable],
  );
}
