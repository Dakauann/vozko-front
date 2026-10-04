"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { vozGrid, vozLineMark, vozXAxis, vozYAxis, VOZ_SERIES } from "@/components/charts/vozko";
import { ChartBar, Table } from "@/components/icons";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { metricFormat, type TrendMetric, type TrendRow } from "@/lib/advertising/trend-series";

import { useAdsFormat } from "./use-ads-format";

export interface ChartSeries {
  metric: TrendMetric;
  mark: "line" | "bar";
  axis: "left" | "right";
}

export function AdsTrendChart({
  rows,
  series,
  currency,
  loading,
  title,
  subtitle,
  toolbar,
}: {
  rows: TrendRow[];
  series: ChartSeries[];
  currency: string;
  loading: boolean;
  title: string;
  subtitle: string;
  toolbar?: ReactNode;
}) {
  const t = useTranslations("adsManager.trend");
  const fmt = useAdsFormat();
  const [asTable, setAsTable] = useState(false);

  const show = (metric: TrendMetric, value: number | null | undefined) => {
    const format = metricFormat(metric);
    if (format === "micros") return fmt.micros(value ?? null, currency);
    if (format === "percent") return fmt.percent(value ?? null);
    return fmt.count(value ?? null);
  };

  const data = useMemo(() => rows.map((row) => ({ label: row.label, ...row.values })), [rows]);

  const config = useMemo<ChartConfig>(
    () => Object.fromEntries(series.map(({ metric }, index) => [metric, { label: t(`metrics.${metric}`), color: VOZ_SERIES[index % VOZ_SERIES.length] }])),
    [series, t],
  );

  return (
    <figure className="rounded-[--radius] border border-border bg-card shadow-sm">
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <button
            type="button"
            onClick={() => setAsTable((value) => !value)}
            aria-pressed={asTable}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-2 py-1 text-2xs font-semibold text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {asTable ? <ChartBar className="h-3 w-3" weight="bold" /> : <Table className="h-3 w-3" weight="bold" />}
            {asTable ? t("showChart") : t("showTable")}
          </button>
        </div>
      </figcaption>
      <div className="p-3">
        {loading ? (
          <div className="h-56 w-full animate-pulse rounded-md bg-muted" />
        ) : rows.length === 0 ? (
          <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : asTable ? (
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border-strong">
                  <th scope="col" className="px-2 py-1.5 text-2xs font-semibold text-muted-foreground">{t("period")}</th>
                  {series.map(({ metric }) => (
                    <th key={metric} scope="col" className="px-2 py-1.5 text-right text-2xs font-semibold text-muted-foreground">
                      {t(`metrics.${metric}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="px-2 py-1.5 tabular-nums text-foreground">{row.label}</td>
                    {series.map(({ metric }) => (
                      <td key={metric} className="px-2 py-1.5 text-right tabular-nums text-foreground">
                        {show(metric, row.values[metric])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-56 w-full">
            <ComposedChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
              <CartesianGrid {...vozGrid} />
              <XAxis dataKey="label" {...vozXAxis} interval="preserveStartEnd" minTickGap={16} />
              {series.map(({ metric, axis }) => (
                <YAxis
                  key={metric}
                  yAxisId={metric}
                  orientation={axis}
                  {...vozYAxis}
                  width={64}
                  allowDecimals={metricFormat(metric) !== "count"}
                  tickFormatter={(value: number) => show(metric, value)}
                />
              ))}
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => (
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="h-2 w-2 rounded-[2px]" style={{ background: item.color }} />
                          {config[String(name)]?.label ?? name}
                        </span>
                        <span className="readout font-semibold text-foreground">{show(name as TrendMetric, Number(value))}</span>
                      </div>
                    )}
                  />
                }
              />
              {series.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
              {series.map(({ metric, mark }) =>
                mark === "bar" ? (
                  <Bar key={metric} yAxisId={metric} dataKey={metric} fill={`var(--color-${metric})`} radius={[4, 4, 0, 0]} maxBarSize={28} />
                ) : (
                  <Line key={metric} yAxisId={metric} dataKey={metric} type="monotone" stroke={`var(--color-${metric})`} {...vozLineMark} />
                ),
              )}
            </ComposedChart>
          </ChartContainer>
        )}
      </div>
    </figure>
  );
}
