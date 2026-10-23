"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { LiveFact, LiveStamp, StageStrip, type StageTile } from "@/components/campaigns/detail/live-primitives";
import { SegmentBar } from "@/components/charts/vozko";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { CheckCircle, Clock, CursorClick, Eye, PaperPlaneTilt, Prohibit, ShieldWarning, UserMinus, Warning } from "@/components/icons";
import { share } from "@/lib/email-campaigns/format";
import { isSending } from "@/lib/email-campaigns/status";
import type { Metrics, RecipientStatus } from "@/lib/email-campaigns/types";

import { EMAIL_SERIES_COLOR, EmailCampaignStatusChip, useEmailFormat } from "../shared";

const ICON = "h-4 w-4";

export function EmailLiveOverview({
  metrics,
  launched,
  ready,
  sampledAt,
  unavailable,
  scheduledAt,
  timeZone,
  activeStatus,
  onFilterStatus,
}: {
  metrics: Metrics;
  launched: boolean;
  ready?: number;
  sampledAt: number | undefined;
  unavailable: boolean;
  scheduledAt?: string;
  timeZone?: string;
  activeStatus: RecipientStatus | "";
  onFilterStatus?: (status: RecipientStatus | "") => void;
}) {
  const t = useTranslations("emailCampaigns.detail.live");
  const { number, rate, locale, dateTime } = useEmailFormat();
  const live = isSending(metrics.status) && !unavailable;
  const eligible = launched ? Math.max(0, metrics.recipients - metrics.skipped_total) : (ready ?? 0);
  const processed = metrics.sent + metrics.failed;
  const completion = share(processed, eligible);
  const bounces = metrics.hard_bounces + metrics.soft_bounces;
  const time = sampledAt ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(sampledAt)) : null;
  const ratio = (basisPoints: number): ReactNode => (launched ? rate(basisPoints) : <EmptyValue />);
  const detail = (basisPoints: number) => (launched ? rate(basisPoints) : undefined);

  const segments = [
    { key: "delivered", label: t("segments.delivered"), value: metrics.delivered, color: EMAIL_SERIES_COLOR.delivered },
    { key: "sent", label: t("segments.inFlight"), value: Math.max(0, metrics.sent - metrics.delivered - bounces), color: EMAIL_SERIES_COLOR.sent },
    { key: "bounced", label: t("segments.bounced"), value: bounces, color: EMAIL_SERIES_COLOR.bounces },
    { key: "failed", label: t("segments.failed"), value: metrics.failed, color: EMAIL_SERIES_COLOR.failed },
    { key: "pending", label: t("segments.pending"), value: metrics.pending, color: EMAIL_SERIES_COLOR.pending },
  ];

  const tiles: (StageTile | null)[] = [
    { key: "queued", icon: <Clock className={`${ICON} text-muted-foreground`} weight="fill" />, label: t("tiles.queued"), value: number(metrics.pending), filter: "pending" },
    { key: "sent", icon: <PaperPlaneTilt className={`${ICON} ink-4`} weight="fill" />, label: t("tiles.sent"), value: number(metrics.sent), filter: "sent" },
    { key: "delivered", icon: <CheckCircle className={`${ICON} ink-2`} weight="fill" />, label: t("tiles.delivered"), value: number(metrics.delivered) },
    { key: "opened", icon: <Eye className={`${ICON} ink-1`} weight="fill" />, label: t("tiles.opened"), value: number(metrics.opens) },
    { key: "clicked", icon: <CursorClick className={`${ICON} ink-5`} weight="fill" />, label: t("tiles.clicked"), value: number(metrics.clicks) },
    { key: "bounced", icon: <Warning className={`${ICON} text-destructive-ink`} weight="fill" />, label: t("bounces"), value: number(bounces), detail: detail(metrics.bounce_rate) },
    { key: "complaints", icon: <ShieldWarning className={`${ICON} text-warning-ink`} weight="fill" />, label: t("complaints"), value: number(metrics.complaints), detail: detail(metrics.complaint_rate) },
    { key: "unsubscribed", icon: <UserMinus className={`${ICON} text-muted-foreground`} weight="fill" />, label: t("unsubscribes"), value: number(metrics.unsubscribes), detail: detail(metrics.unsubscribe_rate) },
    metrics.skipped_total > 0 ? { key: "skipped", icon: <Prohibit className={`${ICON} text-muted-foreground`} weight="fill" />, label: t("skipped"), value: number(metrics.skipped_total), filter: "skipped" } : null,
    metrics.failed > 0 ? { key: "failed", icon: <Warning className={`${ICON} text-destructive-ink`} weight="fill" />, label: t("failed"), value: number(metrics.failed), filter: "failed" } : null,
  ];

  const stamp = !launched
    ? scheduledAt
      ? t("startsAt", { date: dateTime(scheduledAt, timeZone) })
      : t("notStarted")
    : unavailable
      ? t("unavailable")
      : time
        ? live
          ? t("liveAt", { time })
          : t("updatedAt", { time })
        : t("loading");

  return (
    <section className="well relative overflow-hidden" aria-label={t("title")}>
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 border-b border-border px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-end gap-x-8 gap-y-3">
          <LiveFact emphasis value={number(metrics.sent)} label={t("sentOf", { total: number(eligible) })} detail={t("completion", { percent: Math.round(completion) })} />
          <LiveFact value={ratio(metrics.delivery_rate)} label={t("delivered", { count: number(metrics.delivered) })} />
          <LiveFact value={ratio(metrics.open_rate)} label={t("opened", { count: number(metrics.opens) })} />
          <LiveFact value={ratio(metrics.click_rate)} label={t("clicked", { count: number(metrics.clicks) })} />
          <LiveFact value={ratio(metrics.click_to_open_rate)} label={t("ctor")} />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <EmailCampaignStatusChip status={metrics.status} holdReason={metrics.hold_reason || undefined} scheduledAt={scheduledAt} />
          <LiveStamp live={live}>{stamp}</LiveStamp>
        </div>
      </div>

      <div className="px-4 py-3 sm:px-5">
        <p className="legend mb-2 flex justify-between">
          <span>{t("distribution")}</span>
          <span>{t("recipients", { count: metrics.recipients })}</span>
        </p>
        <SegmentBar segments={segments} size="md" formatValue={(value) => number(value)} />
      </div>

      <StageStrip
        total={number(metrics.recipients)}
        tiles={tiles.filter((tile): tile is StageTile => tile !== null)}
        active={activeStatus}
        onFilter={onFilterStatus ? (filter) => onFilterStatus(filter as RecipientStatus | "") : undefined}
      />
    </section>
  );
}
