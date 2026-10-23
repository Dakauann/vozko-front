"use client";

import {
  CampaignStatusChip,
  MetricCell,
} from "@/components/campaigns/CampaignStatusChip";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import type { DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { showsReady } from "@/lib/unofficial-whatsapp-campaigns/ready";
import { campaignTarget } from "@/lib/unofficial-whatsapp-campaigns/send-estimate";
import type { UnofficialWhatsAppCampaign } from "@/lib/unofficial-whatsapp-campaigns/types";
import { cn } from "@/lib/utils";

type T = (key: string, values?: Record<string, string | number>) => string;

function TargetCell({ row, t }: { row: UnofficialWhatsAppCampaign; t: T }) {
  const target = campaignTarget(row);
  if (target.kind === "leads") {
    return <span className="whitespace-nowrap text-sm text-foreground">{t("table.targetLeads", { count: target.count })}</span>;
  }
  return (
    <div className="min-w-0 max-w-[260px]">
      <span className="block text-2xs font-medium text-muted-foreground">{t("table.targetGroups")}</span>
      <span className="flex min-w-0 items-baseline gap-1.5 text-sm text-foreground">
        {target.names.length > 0 ? <span className="truncate">{target.names.join(", ")}</span> : <EmptyValue />}
        {target.more > 0 ? <span className="shrink-0 text-xs text-muted-foreground">{t("table.targetMore", { count: target.more })}</span> : null}
      </span>
    </div>
  );
}

export function campaignColumns(t: T, readyLabel: string): DashboardTableColumn<UnofficialWhatsAppCampaign>[] {
  return [
    {
      key: "name",
      header: t("table.name"),
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">
            {row.name}
          </span>
          {row.audience === "groups" && !row.instanceId ? (
            <span className="block truncate text-2xs text-muted-foreground">{t("table.senderPerGroup")}</span>
          ) : (
            <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">

              <span
                aria-hidden
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  row.instanceSessionLive ? "bg-healthy" : "bg-destructive",
                )}
              />
              <span className="truncate">{row.instanceLabel || <EmptyValue />}</span>
            </span>
          )}
        </div>
      ),
    },
    {
      key: "target",
      header: t("table.target"),
      render: (row) => <TargetCell row={row} t={t} />,
    },
    {
      key: "status",
      header: t("table.status"),
      render: (row) => (
        <CampaignStatusChip
          status={showsReady(row) ? "READY" : row.status}
          label={showsReady(row) ? readyLabel : t(`status.${row.status.toLowerCase()}`)}
        />
      ),
    },
    {
      key: "total",
      header: t("table.total"),
      render: (row) => <MetricCell value={row.metrics?.totalNumbers} />,
    },
    {
      key: "dispatches",
      header: t("table.dispatches"),
      render: (row) => <MetricCell value={row.metrics?.dispatches} />,
    },
    {
      key: "delivered",
      header: t("status.delivered"),
      render: (row) => <MetricCell value={row.metrics?.delivered} tone="healthy" />,
    },
    {
      key: "read",
      header: t("status.read"),
      render: (row) => <MetricCell value={row.metrics?.read} tone="muted" />,
    },
    {
      key: "failed",
      header: t("status.failed"),
      render: (row) => <MetricCell value={row.metrics?.failed} tone="destructive" />,
    },
    {
      key: "notOnWhatsapp",
      header: t("table.notOnWhatsapp"),
      render: (row) => (
        <MetricCell value={row.metrics?.skippedNotOnWhatsApp} tone="warning" />
      ),
    },
    {
      key: "avoidingSpam",
      header: t("table.avoidingSpam"),
      render: (row) => (
        <MetricCell value={row.metrics?.notEligiblePossibleSpam} tone="warning" />
      ),
    },
    {
      key: "successRate",
      header: t("table.successRate"),
      render: (row) => (
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {row.metrics?.successRate != null
            ? `${row.metrics.successRate.toFixed(1)}%`
            : <EmptyValue />}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: t("table.createdAt"),
      render: (row) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];
}
