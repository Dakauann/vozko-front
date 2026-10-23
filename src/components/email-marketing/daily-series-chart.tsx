"use client";

import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { vozGrid, vozLineMark, vozXAxis, vozYAxis } from "@/components/charts/vozko";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { hasTraffic } from "@/lib/email-marketing/figures";
import type { EmailDailyPoint } from "@/lib/email-marketing/types";

const SERIES = [
  { key: "sent", color: "hsl(var(--chart-4))" },
  { key: "delivered", color: "hsl(var(--chart-2))" },
  { key: "opens", color: "hsl(var(--chart-1))" },
  { key: "clicks", color: "hsl(var(--chart-3))" },
] as const;

export function DailySeriesChart({ daily, timeZone, loading }: { daily: EmailDailyPoint[]; timeZone: string | undefined; loading: boolean }) {
  const t = useTranslations("emailMarketing.overview.chart");
  const format = useFormatter();

  const config = useMemo<ChartConfig>(
    () => Object.fromEntries(SERIES.map((series) => [series.key, { label: t(`series.${series.key}`), color: series.color }])),
    [t],
  );

  const rows = useMemo(
    () =>
      daily.map((point) => ({
        label: format.dateTime(new Date(point.bucket), { day: "2-digit", month: "short", ...(timeZone ? { timeZone } : {}) }),
        sent: point.sent,
        delivered: point.delivered,
        opens: point.opens,
        clicks: point.clicks,
      })),
    [daily, format, timeZone],
  );

  if (loading && daily.length === 0) return <div className="h-60 w-full animate-pulse rounded-md bg-muted" />;

  if (!hasTraffic(daily)) {
    return (
      <div className="flex h-60 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-center">
        <p className="text-sm font-medium text-foreground">{t("emptyTitle")}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{t("emptyText")}</p>
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-60 w-full" aria-label={t("label")}>
      <ComposedChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid {...vozGrid} />
        <XAxis dataKey="label" {...vozXAxis} interval="preserveStartEnd" minTickGap={18} />
        <YAxis {...vozYAxis} allowDecimals={false} tickFormatter={(value: number) => format.number(value, { notation: "compact" })} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2 w-2 rounded-[2px]" style={{ background: item.color }} />
                    {config[String(name)]?.label ?? name}
                  </span>
                  <span className="readout font-semibold text-foreground">{format.number(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {SERIES.map((series) => (
          <Line key={series.key} dataKey={series.key} type="monotone" stroke={`var(--color-${series.key})`} {...vozLineMark} />
        ))}
      </ComposedChart>
    </ChartContainer>
  );
}
