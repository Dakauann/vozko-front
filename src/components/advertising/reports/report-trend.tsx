"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { vozGrid, vozLineMark, vozXAxis, vozYAxis, VOZ_SERIES } from "@/components/charts/vozko";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatDay } from "@/lib/advertising/date-range";
import type { AdReportMetric, AdReportRun } from "@/lib/advertising/types";

import { useAdsFormat } from "../use-ads-format";
import type { ReportLabels } from "./use-report-labels";

function MetricTrend({ metric, run, color, labels }: { metric: AdReportMetric; run: AdReportRun; color: string; labels: ReportLabels }) {
  const fmt = useAdsFormat();
  const rows = useMemo(
    () => run.series.map((entry) => ({ label: formatDay(entry.day, fmt.tag), value: entry.values[metric] ?? null })),
    [run.series, metric, fmt.tag],
  );
  const config = useMemo<ChartConfig>(() => ({ value: { label: labels.metric(metric), color } }), [labels, metric, color]);

  return (
    <figure className="rounded-[--radius] border border-border bg-card shadow-sm">
      <figcaption className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">{labels.metric(metric)}</figcaption>
      <div className="p-3">
        <ChartContainer config={config} className="aspect-auto h-48 w-full">
          <LineChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid {...vozGrid} />
            <XAxis dataKey="label" {...vozXAxis} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...vozYAxis} width={72} tickFormatter={(value: number) => labels.formatMetric(run, metric, value)} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <span className="readout font-semibold text-foreground">{labels.formatMetric(run, metric, Number(value))}</span>
                  )}
                />
              }
            />
            <Line dataKey="value" type="monotone" stroke="var(--color-value)" {...vozLineMark} />
          </LineChart>
        </ChartContainer>
      </div>
    </figure>
  );
}

export function ReportTrend({ metrics, run, labels }: { metrics: AdReportMetric[]; run: AdReportRun; labels: ReportLabels }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {metrics.map((metric, index) => (
        <MetricTrend key={metric} metric={metric} run={run} color={VOZ_SERIES[index % VOZ_SERIES.length]} labels={labels} />
      ))}
    </div>
  );
}
