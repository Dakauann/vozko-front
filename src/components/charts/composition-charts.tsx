"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { EChartsOption } from "echarts";
import { ChartLegend, DataChart, type ChartDatum } from "./dense-charts";

export function BlockChart({ data, label, height = 180, legend = true }: {
  data: ChartDatum[]; label: string; height?: number; legend?: boolean;
}) {
  const t = useTranslations("denseCharts");
  const locale = useLocale();
  const option = useMemo<EChartsOption>(() => {
    const nf = new Intl.NumberFormat(locale);
    return {
      series: [{
        type: "treemap", left: 0, top: 0, right: 0, bottom: 0,
        roam: false, nodeClick: false, breadcrumb: { show: false },
        visibleMin: 0, sort: "desc",
        label: {
          show: true, position: "insideTopLeft", padding: 7,
          formatter: (params) => `{name|${params.name}}\n{value|${nf.format(Number(params.value))}}`,
          rich: {
            name: { fontSize: 11, color: "hsl(var(--foreground))", backgroundColor: "hsl(var(--card))", padding: [3, 4], borderRadius: 2, lineHeight: 22 },
            value: { fontSize: 16, fontWeight: 600, color: "hsl(var(--foreground))", backgroundColor: "hsl(var(--card))", padding: [3, 4], borderRadius: 2, lineHeight: 24 },
          },
        },
        itemStyle: { borderColor: "hsl(var(--card))", borderWidth: 2, gapWidth: 3 },
        emphasis: { itemStyle: { borderColor: "hsl(var(--foreground))" } },
        data: data.filter((item) => item.value > 0 && Number.isFinite(item.value)).map((item) => ({
          id: item.key, name: item.label, value: item.value, itemStyle: { color: item.color },
        })),
      }],
      tooltip: { valueFormatter: (value) => nf.format(Number(value)) },
    };
  }, [data, locale]);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return <div className="space-y-2">
    <DataChart option={option} label={label} height={height} columns={[t("category"), t("count")]} rows={data.map((item) => [item.label, item.value])} />
    {legend ? <ChartLegend data={data} total={total} /> : null}
  </div>;
}

/** Radial distance encodes share on an explicit common 0–100% scale. */
export function RadialProfileChart({ data, total, label }: { data: ChartDatum[]; total: number; label: string }) {
  const t = useTranslations("denseCharts");
  const locale = useLocale();
  const option = useMemo<EChartsOption>(() => ({
    polar: { radius: [10, "72%"], center: ["50%", "50%"] },
    angleAxis: {
      type: "category", data: data.map((item) => item.label), startAngle: 90,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: "hsl(var(--muted-foreground))", fontSize: 10, margin: 5 },
    },
    radiusAxis: {
      min: 0, max: 100, interval: 25,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: "hsl(var(--muted-foreground))", fontSize: 9, formatter: "{value}%" },
      splitLine: { lineStyle: { color: "hsl(var(--border))", type: "dashed" } },
    },
    series: [{
      type: "bar", coordinateSystem: "polar", barWidth: "54%",
      data: data.map((item) => ({ name: item.label, value: total > 0 ? item.value / total * 100 : 0, itemStyle: { color: item.color, opacity: 0.9 } })),
    }],
    tooltip: { valueFormatter: (value) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(value))}%` },
  }), [data, total, locale]);
  return <div className="space-y-2">
    <DataChart option={option} label={label} height={210} columns={[t("category"), t("count")]} rows={data.map((item) => [item.label, item.value])} />
    <ChartLegend data={data} total={total} />
  </div>;
}
