"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { TimelineLines } from "@/components/campaigns/detail/TimelineLines";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { ChartSkeleton, EmptyChart } from "@/components/dashboard/attendance/primitives";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { ChartLineUp } from "@/components/icons";
import { useEmailCampaignTimeline } from "@/hooks/use-email-campaigns";
import { hasTimelineActivity, timelineFormatters } from "@/lib/email-campaigns/format";
import type { Timeline } from "@/lib/email-campaigns/types";

import { EMAIL_SERIES_COLOR, useEmailFormat } from "../shared";

const SERIES = ["sent", "delivered", "opens", "clicks", "bounces"] as const;

function TimelineChart({ timeline }: { timeline: Timeline }) {
  const t = useTranslations("emailCampaigns.detail.timeline");
  const { locale, number } = useEmailFormat();
  const series = SERIES.map((key) => ({ key, label: t(`series.${key}`), color: EMAIL_SERIES_COLOR[key], dashed: key === "bounces" }));
  const data = useMemo(() => {
    const format = timelineFormatters(timeline.bucket, locale, timeline.time_zone);
    return timeline.points.map((point) => ({ ...point, label: format.tick(point.bucket), title: format.title(point.bucket) }));
  }, [timeline, locale]);

  if (!hasTimelineActivity(timeline.points)) {
    return <EmptyChart icon={<ChartLineUp className="h-8 w-8" weight="fill" />} message={t("empty")} height={260} />;
  }

  return <TimelineLines data={data} series={series} format={number} />;
}

export function EmailTimelinePanel({ campaignId, className }: { campaignId: string; className?: string }) {
  const t = useTranslations("emailCampaigns.detail.timeline");
  const timeline = useEmailCampaignTimeline(campaignId);
  return (
    <PanelSection
      boxed
      className={className}
      title={t("title")}
      description={t("description")}
      legend={timeline.data ? t(`bucket.${timeline.data.bucket}`, { zone: timeline.data.time_zone }) : undefined}
    >
      <SectionState query={timeline}>{timeline.data ? <TimelineChart timeline={timeline.data} /> : <ChartSkeleton height={260} />}</SectionState>
    </PanelSection>
  );
}
