"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { ChartLineUp } from "@/components/icons";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { ChartSkeleton, EmptyChart, localeTagFor, useMetricsFmt } from "@/components/dashboard/attendance/primitives";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { vozGrid, vozXAxis, vozYAxis } from "@/components/charts/vozko";
import ElevatedSegmentedControl from "@/components/elevated-design/elevated-segmented-control";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useCampaignTimeline } from "@/hooks/use-campaign-live";
import { TIMELINE_BUCKETS, type CampaignChannel, type CampaignTimeline, type TimelineBucket } from "@/lib/campaigns/live";

import { CAMPAIGN_STAGE_COLOR } from "./CampaignLiveOverview";

const SERIES = ["sent", "delivered", "read", "failed"] as const;

type Series = (typeof SERIES)[number];

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

function TimelineChart({ timeline }: { timeline: CampaignTimeline }) {
  const t = useTranslations("campaignDetail.timeline");
  const tStage = useTranslations("campaignDetail.stage");
  const locale = localeTagFor(useLocale());
  const fmt = useMetricsFmt();
  const config: ChartConfig = Object.fromEntries(
    SERIES.map((key) => [key, { label: tStage(key), color: CAMPAIGN_STAGE_COLOR[key] }]),
  );
  const tick = useMemo(() => new Intl.DateTimeFormat(locale, { ...TICK_FORMAT[timeline.bucket], timeZone: timeline.timezone }), [locale, timeline.bucket, timeline.timezone]);
  const full = useMemo(() => new Intl.DateTimeFormat(locale, { ...TOOLTIP_FORMAT[timeline.bucket], timeZone: timeline.timezone }), [locale, timeline.bucket, timeline.timezone]);
  const data = useMemo(() => timeline.points.map((point) => ({ ...point, label: tick.format(new Date(point.at)), title: full.format(new Date(point.at)) })), [timeline.points, tick, full]);

  if (!timeline.points.some((point) => point.sent + point.delivered + point.read + point.failed > 0)) {
    return <EmptyChart icon={<ChartLineUp className="h-8 w-8" weight="fill" />} message={t("empty")} height={260} />;
  }

  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...vozGrid} />
        <XAxis dataKey="label" minTickGap={24} {...vozXAxis} />
        <YAxis allowDecimals={false} {...vozYAxis} />
        <ChartTooltip
          cursor={{ stroke: "hsl(var(--border-strong))", strokeWidth: 1 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => (payload?.[0]?.payload as { title?: string } | undefined)?.title ?? ""}
              formatter={(value, name) => (
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: CAMPAIGN_STAGE_COLOR[name as Series] }} />
                    {config[String(name)]?.label}
                  </span>
                  <span className="font-semibold tabular-nums">{fmt.num(Number(value))}</span>
                </span>
              )}
            />
          }
        />
        <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
        {SERIES.map((key) => (
          <Line
            key={key}
            type="linear"
            dataKey={key}
            stroke={CAMPAIGN_STAGE_COLOR[key]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
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
        {timeline.data ? <TimelineChart timeline={timeline.data} /> : <ChartSkeleton height={260} />}
      </SectionState>
    </PanelSection>
  );
}
