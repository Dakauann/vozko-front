"use client";

import { useTranslations } from "next-intl";

import { listRecentConversionsAction } from "@/app/actions/advertising-conversions";
import { isAdsError } from "@/app/actions/advertising";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, ChartLineUp, Warning } from "@/components/icons";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { conversionStatusKey, eventKey, knownReason, type ConversionRecord } from "@/lib/advertising/conversions";
import { EMPTY_VALUE } from "@/lib/advertising/money";
import { formatWhen } from "@/lib/advertising/when";
import { cn } from "@/lib/utils";

import { IconAction } from "../icon-action";
import { StatusDot } from "../status-dot";
import { useAdsFormat } from "../use-ads-format";

const STATUS_TONE = { sent: "healthy", skipped: "neutral", failed: "fault", unknown: "neutral" } as const;

export function RecentConversions() {
  const t = useTranslations("adsConversions.recent");
  const fmt = useAdsFormat();
  const recent = useKeyedLoad("recent", listRecentConversionsAction);
  const response = recent.latest;
  const records = response && !isAdsError(response) ? response.data : [];
  const error = response && isAdsError(response) ? response.error : null;

  const reasonText = (record: ConversionRecord) => {
    const known = knownReason(record.reason);
    if (known) return t(`reasons.${known}`);
    return record.reason || EMPTY_VALUE;
  };

  const columns: DashboardTableColumn<ConversionRecord>[] = [
    {
      key: "deal",
      header: t("columns.deal"),
      render: (record) => (
        <span className="font-mono text-xs text-muted-foreground" title={record.opportunityId}>
          {record.opportunityId ? record.opportunityId.slice(0, 8) : EMPTY_VALUE}
        </span>
      ),
    },
    {
      key: "event",
      header: t("columns.event"),
      render: (record) => {
        const key = eventKey(record.eventName);
        return <span className="text-sm text-foreground">{key === "other" ? record.eventName || EMPTY_VALUE : t(`events.${key}`)}</span>;
      },
    },
    {
      key: "status",
      header: t("columns.status"),
      render: (record) => {
        const key = conversionStatusKey(record.status);
        return (
          <div className="min-w-0">
            <StatusDot tone={STATUS_TONE[key]}>{key === "unknown" ? record.status || EMPTY_VALUE : t(`statuses.${key}`)}</StatusDot>
            {key !== "sent" && record.reason ? <p className="max-w-72 text-2xs text-muted-foreground">{reasonText(record)}</p> : null}
          </div>
        );
      },
    },
    {
      key: "attempts",
      header: t("columns.attempts"),
      className: "text-right",
      render: (record) => <span className="text-sm tabular-nums">{fmt.count(record.attempts)}</span>,
    },
    {
      key: "sentAt",
      header: t("columns.sentAt"),
      render: (record) => <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{formatWhen(record.sentAt, fmt.tag)}</span>,
    },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      {error ? (
        <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted px-4 py-3 text-sm text-destructive-ink">
          <Warning className="h-4 w-4" aria-hidden />
          {error}
        </div>
      ) : null}
      <DashboardTable
        data={records}
        columns={columns}
        rowKey={(record, index) => `${record.opportunityId}-${record.eventName}-${index}`}
        loading={recent.loading && !response}
        headerRight={
          <IconAction label={t("refresh")} onClick={recent.reload} disabled={recent.loading}>
            <ArrowClockwise className={cn("h-4 w-4", recent.loading && "animate-spin")} />
          </IconAction>
        }
        emptyState={{
          icon: <ChartLineUp className="h-7 w-7 text-muted-foreground" />,
          title: t("emptyTitle"),
          description: t("emptyBody"),
        }}
      />
    </section>
  );
}
