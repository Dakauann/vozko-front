"use client";

import {
  CampaignStatusChip,
  MetricCell,
} from "@/components/campaigns/CampaignStatusChip";
import type { DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import type { UnofficialWhatsAppCampaign } from "@/lib/unofficial-whatsapp-campaigns/types";
import { cn } from "@/lib/utils";

type T = (key: string) => string;

/**
 * The campaign list columns.
 *
 * Mirrors the official campaign's list one column at a time, with the three
 * differences the channel actually has:
 *
 *  - the second line under the name is the NUMBER this campaign sends from,
 *    where the official shows its template;
 *  - there is no message-type column, because there are no template categories;
 *  - there is a "não está no WhatsApp" column, because only this channel can
 *    check a number before sending — and that count is list quality, not failure.
 */
export function campaignColumns(t: T): DashboardTableColumn<UnofficialWhatsAppCampaign>[] {
  return [
    {
      key: "name",
      header: t("table.name"),
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">
            {row.name}
          </span>
          <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            {/* A live dot rather than words: the row is scanned, not read, and
                whether the number can send is the fact that decides whether
                Start will work. */}
            <span
              aria-hidden
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                row.instanceSessionLive ? "bg-healthy" : "bg-destructive",
              )}
            />
            <span className="truncate">{row.instanceLabel || "—"}</span>
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: t("table.status"),
      render: (row) => (
        <CampaignStatusChip
          status={row.status}
          label={t(`status.${row.status.toLowerCase()}`)}
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
            : "—"}
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
