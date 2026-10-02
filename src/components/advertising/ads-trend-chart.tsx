"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { vozGrid, vozLineMark, vozXAxis, vozYAxis, VOZ_SERIES } from "@/components/charts/vozko";
import { ChartBar, Table } from "@/components/icons";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatDay } from "@/lib/advertising/date-range";
import type { AdTrend } from "@/lib/advertising/types";

import { useAdsFormat } from "./use-ads-format";

const MICROS_PER_UNIT = 1_000_000;

export function AdsTrendChart({ trend, loading }: { trend: AdTrend | null; loading: boolean }) {
  const t = useTranslations("adsManager.trend");
  const fmt = useAdsFormat();
  const [asTable, setAsTable] = useState(false);
  const currency = trend?.currency ?? "";
  const points = useMemo(() => trend?.points ?? [], [trend]);

  const rows = useMemo(
    () =>
      points.map((point) => ({
        day: point.day,
        label: formatDay(point.day, fmt.tag),
        spend: point.spend / MICROS_PER_UNIT,
        results: point.results,
      })),
    [points, fmt.tag],
  );

  const config = useMemo<ChartConfig>(
    () => ({
      spend: { label: t("spend"), color: VOZ_SERIES[0] },
      results: { label: t("results"), color: VOZ_SERIES[1] },
    }),
    [t],
  );

  return (
    <figure className="rounded-[--radius] border border-border bg-card shadow-sm">
      <figcaption className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{t("title")}</p>
          <p className="truncate text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setAsTable((value) => !value)}
          aria-pressed={asTable}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-2 py-1 text-2xs font-semibold text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {asTable ? <ChartBar className="h-3 w-3" weight="bold" /> : <Table className="h-3 w-3" weight="bold" />}
          {asTable ? t("showChart") : t("showTable")}
        </button>
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
                  <th scope="col" className="px-2 py-1.5 text-2xs font-semibold text-muted-foreground">{t("day")}</th>
                  <th scope="col" className="px-2 py-1.5 text-right text-2xs font-semibold text-muted-foreground">{t("spend")}</th>
                  <th scope="col" className="px-2 py-1.5 text-right text-2xs font-semibold text-muted-foreground">{t("results")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {points.map((point) => (
                  <tr key={point.day}>
                    <td className="px-2 py-1.5 tabular-nums text-foreground">{formatDay(point.day, fmt.tag)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{fmt.micros(point.spend, currency)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{fmt.count(point.results)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-56 w-full">
            <ComposedChart data={rows} margin={{ left: 4, right: 4, top: 8 }}>
              <CartesianGrid {...vozGrid} />
              <XAxis dataKey="label" {...vozXAxis} interval="preserveStartEnd" minTickGap={16} />
              <YAxis
                yAxisId="spend"
                {...vozYAxis}
                width={64}
                tickFormatter={(value: number) => fmt.micros(value * MICROS_PER_UNIT, currency)}
              />
              <YAxis yAxisId="results" orientation="right" {...vozYAxis} allowDecimals={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => (
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="h-2 w-2 rounded-[2px]" style={{ background: item.color }} />
                          {config[String(name)]?.label ?? name}
                        </span>
                        <span className="readout font-semibold text-foreground">
                          {name === "spend"
                            ? fmt.micros(Number(value) * MICROS_PER_UNIT, currency)
                            : fmt.count(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar yAxisId="results" dataKey="results" fill="var(--color-results)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Line yAxisId="spend" dataKey="spend" type="monotone" stroke="var(--color-spend)" {...vozLineMark} />
            </ComposedChart>
          </ChartContainer>
        )}
      </div>
    </figure>
  );
}
