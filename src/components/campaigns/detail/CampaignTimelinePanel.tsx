"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ChartLineUp } from "@/components/icons";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { ChartSkeleton, EmptyChart, localeTagFor, useMetricsFmt } from "@/components/dashboard/attendance/primitives";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import ElevatedSegmentedControl from "@/components/elevated-design/elevated-segmented-control";
import { useCampaignTimeline } from "@/hooks/use-campaign-live";
import { TIMELINE_BUCKETS, type CampaignChannel, type CampaignTimeline, type TimelineBucket } from "@/lib/campaigns/live";

import { CAMPAIGN_STAGE_COLOR } from "./CampaignLiveOverview";
import { TimelineLines } from "./TimelineLines";

const SERIES = ["sent", "delivered", "read", "failed"] as const;

const TICK_FORMAT: Record<TimelineBucket, Intl.DateTimeFormatOptions> = {
  minute: { hour: "2-digit", minute: "2-digit" },
  hour: { day: "2-digit", month: "2-digit", hour: "2-digit" },
  day: { day: "2-digit", month: "2-digit" },
};

const TOOLTIP_FORMAT: Record<TimelineBucket, Intl.DateTimeFormatOptions> = {
  minute: { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" },
  hour: { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" },
  day: { weekday: "short", day: "2-digit", month: "short" },
};

export type TimelineChartData = Pick<CampaignTimeline, "bucket" | "points"> & { timezone?: string };

export function CampaignTimelineChart({ timeline }: { timeline: TimelineChartData }) {
  const t = useTranslations("campaignDetail.timeline");
  const tStage = useTranslations("campaignDetail.stage");
  const locale = localeTagFor(useLocale());
  const fmt = useMetricsFmt();
  const series = SERIES.map((key) => ({ key, label: tStage(key), color: CAMPAIGN_STAGE_COLOR[key] }));
  const tick = useMemo(() => new Intl.DateTimeFormat(locale, { ...TICK_FORMAT[timeline.bucket], timeZone: timeline.timezone }), [locale, timeline.bucket, timeline.timezone]);
  const full = useMemo(() => new Intl.DateTimeFormat(locale, { ...TOOLTIP_FORMAT[timeline.bucket], timeZone: timeline.timezone }), [locale, timeline.bucket, timeline.timezone]);
  const data = useMemo(() => timeline.points.map((point) => ({ ...point, label: tick.format(new Date(point.at)), title: full.format(new Date(point.at)) })), [timeline.points, tick, full]);

  if (!timeline.points.some((point) => point.sent + point.delivered + point.read + point.failed > 0)) {
    return <EmptyChart icon={<ChartLineUp className="h-8 w-8" weight="fill" />} message={t("empty")} height={260} />;
  }

  return <TimelineLines data={data} series={series} format={fmt.num} />;
}

export function CampaignTimelinePanel({
  channel,
  campaignId,
  className,
  actions,
}: {
  channel: CampaignChannel;
  campaignId: string;
  className?: string;
  actions?: ReactNode;
}) {
  const t = useTranslations("campaignDetail.timeline");
  const [bucket, setBucket] = useState<TimelineBucket | undefined>(undefined);
  const timeline = useCampaignTimeline(channel, campaignId, bucket);
  const shown = timeline.data?.bucket ?? bucket ?? null;

  return (
    <PanelSection
      boxed
      className={className}
      title={t("title")}
      description={t("subtitle")}
      legend={timeline.data ? t("timezone", { timezone: timeline.data.timezone }) : undefined}
      actions={
        <>
          <ElevatedSegmentedControl
            size="sm"
            variant="outline"
            value={shown}
            onChange={(value) => setBucket(value as TimelineBucket)}
            options={TIMELINE_BUCKETS.map((value) => ({ value, label: t(`bucket.${value}`) }))}
          />
          {actions}
        </>
      }
    >
      <SectionState query={timeline}>
        {timeline.data ? <CampaignTimelineChart timeline={timeline.data} /> : <ChartSkeleton height={260} />}
      </SectionState>
    </PanelSection>
  );
}
