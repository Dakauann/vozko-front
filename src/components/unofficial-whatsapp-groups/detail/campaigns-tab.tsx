"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";

import { CampaignStatusChip } from "@/components/campaigns/CampaignStatusChip";
import Button from "@/components/elevated-design/button";
import { EmptyValue, useEmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, Info, Megaphone } from "@/components/icons";
import { Link } from "@/i18n/routing";
import type { GroupCampaign, GroupDetail } from "@/lib/unofficial-whatsapp-groups/types";

import { StartCampaignButton } from "../kit/campaign";
import { useTableEmpty } from "../kit/empty";
import { ExternalRiskNotice } from "../kit/notices";
import { groupsRoutes } from "../kit/routes";
import { useGroupsFormat } from "../kit/use-groups-format";
import { campaignTally, campaignTotalLabel } from "./detail-model";
import type { GroupCampaignsState } from "./use-group-campaigns";

const ENTRY_TONE: Record<string, StatusChipTone> = {
  PENDING: "muted",
  SENT: "neutral",
  DELIVERED: "neutral",
  READ: "healthy",
  FAILED: "fault",
  NOT_ELIGIBLE_POSSIBLE_SPAM: "warning",
  SKIPPED_NOT_ON_WHATSAPP: "warning",
};

export function CampaignsTab({ detail, campaigns }: { detail: GroupDetail; campaigns: GroupCampaignsState }) {
  const t = useTranslations("unofficialGroups.detail.campaigns");
  const tTab = useTranslations("unofficialGroups.detail.campaignsTab");
  const fmt = useGroupsFormat();
  const tableEmpty = useTableEmpty();
  const empty = useEmptyValue();
  const { group, numbers } = detail;
  const { loading, error, reload } = campaigns;
  const rows = campaigns.campaigns;
  const tally = campaignTally(rows);
  const target = [{ id: group.id, origin: group.origin, numbers }];

  const statusLabel = useCallback((status: string) => (t.has(`campaignStatus.${status}`) ? t(`campaignStatus.${status}`) : status), [t]);
  const entryLabel = useCallback((status: string) => (t.has(`entryStatus.${status}`) ? t(`entryStatus.${status}`) : status), [t]);
  const numberLabel = useCallback((instanceId: string) => numbers.find((seat) => seat.instanceId === instanceId)?.label, [numbers]);

  const columns = useMemo<DashboardTableColumn<GroupCampaign>[]>(
    () => [
      {
        key: "name",
        header: t("columns.name"),
        render: (campaign) => {
          const seat = numberLabel(campaign.instanceId);
          return (
            <div className="min-w-0">
              <Link
                href={groupsRoutes.campaign(campaign.campaignId)}
                className="block truncate text-xs font-semibold text-foreground underline-offset-2 hover:underline focus-visible:rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {campaign.name}
              </Link>
              <p className="readout truncate text-[11px] text-muted-foreground">
                {seat ? tTab("createdBy", { when: fmt.dateTime(campaign.createdAt), number: seat }) : tTab("created", { when: fmt.dateTime(campaign.createdAt) })}
              </p>
            </div>
          );
        },
      },
      {
        key: "campaignStatus",
        header: t("columns.campaignStatus"),
        render: (campaign) => <CampaignStatusChip status={campaign.campaignStatus} label={statusLabel(campaign.campaignStatus)} />,
      },
      {
        key: "entryStatus",
        header: t("columns.entryStatus"),
        render: (campaign) => <StatusChip tone={ENTRY_TONE[campaign.entryStatus] ?? "outline"} label={entryLabel(campaign.entryStatus)} />,
      },
      {
        key: "sentAt",
        header: t("columns.sentAt"),
        render: (campaign) =>
          campaign.sentAt ? (
            <span className="readout text-xs tabular-nums text-muted-foreground">{fmt.dateTime(campaign.sentAt)}</span>
          ) : (
            <EmptyValue className="text-xs" />
          ),
      },
      {
        key: "error",
        header: t("columns.error"),
        render: (campaign) =>
          campaign.errorMessage ? (
            <span className="line-clamp-2 max-w-xs text-xs text-foreground" title={campaign.errorMessage}>
              {campaign.errorMessage}
            </span>
          ) : (
            <EmptyValue className="text-xs" />
          ),
      },
    ],
    [t, tTab, fmt, statusLabel, entryLabel, numberLabel],
  );

  const pending = loading && rows.length === 0;
  const stat = (value: string) => (error ? empty : pending ? "…" : value);

  return (
    <div className="space-y-3">
      {group.origin === "external" ? <ExternalRiskNotice /> : null}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {tTab("noFunnel")}
      </p>
      <DashboardTable<GroupCampaign>
        data={rows}
        columns={columns}
        rowKey={(campaign) => campaign.campaignId}
        loading={loading && rows.length === 0}
        stats={[
          { label: tTab("stats.total"), value: stat(campaignTotalLabel(tally, fmt.num)) },
          { label: tTab("stats.running"), value: stat(fmt.num(tally.running)) },
          { label: tTab("stats.delivered"), value: stat(fmt.num(tally.delivered)) },
          { label: tTab("stats.failed"), value: stat(fmt.num(tally.failed)) },
        ]}
        headerRight={
          <>
            <Button
              variant="ghost"
              aria-label={t("refresh")}
              icon={<ArrowClockwise className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} weight="bold" />}
              iconVisible
              onClick={reload}
              disabled={loading}
            />
            <StartCampaignButton groups={target} variant="primary" />
          </>
        }
        emptyState={
          error
            ? tableEmpty.error(t("error"), reload)
            : tableEmpty.firstUse({
                icon: <Megaphone className="h-7 w-7 opacity-40" />,
                title: t("empty.title"),
                description: t("empty.text"),
                action: <StartCampaignButton groups={target} variant="secondary" />,
              })
        }
      />
    </div>
  );
}
