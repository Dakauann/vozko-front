"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { EChartsOption } from "echarts";
import type { MemberRow } from "@/lib/attendance/types";
import { entityColorIndex } from "@/lib/charts/data";
import { VOZ_SERIES } from "./vozko";
import { DataChart } from "./dense-charts";

export function TeamResponseChart({ rows }: { rows: MemberRow[] }) {
  const t = useTranslations("denseCharts");
  const locale = useLocale();
  const measured = useMemo(() => rows.filter((row) => row.avg_response_mins !== null && Number.isFinite(row.avg_response_mins) && row.resolved + row.open + row.pending > 0), [rows]);
  const option = useMemo<EChartsOption>(() => {
    const maxLoad = Math.max(...measured.map((row) => row.resolved + row.open + row.pending), 1);
    const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    return {
      grid: { left: 45, right: 18, top: 15, bottom: 48 },
      xAxis: { type: "value", name: t("responseMinutes"), nameLocation: "middle", nameGap: 30, min: 0, axisLabel: { color: "hsl(var(--muted-foreground))" }, splitLine: { lineStyle: { color: "hsl(var(--border))", type: "dashed" } } },
      yAxis: { type: "value", min: 0, max: 100, axisLabel: { formatter: "{value}%", color: "hsl(var(--muted-foreground))" }, splitLine: { lineStyle: { color: "hsl(var(--border))", type: "dashed" } } },
      series: [{
        type: "scatter",
        symbolSize: (value: number[]) => Math.sqrt(value[2] / maxLoad) * 44,
        data: measured.map((row) => ({
          name: row.display_name,
          value: [row.avg_response_mins, row.resolution_pct, row.resolved + row.open + row.pending],
          itemStyle: { color: VOZ_SERIES[entityColorIndex(row.actor_id)], opacity: 0.8, borderColor: "hsl(var(--card))", borderWidth: 1.5 },
        })),
        emphasis: { label: { show: true, position: "top", formatter: "{b}", color: "hsl(var(--foreground))" } },
      }],
      tooltip: { formatter: (params) => {
        const point = Array.isArray(params) ? params[0] : params;
        const value = point.value as number[];
        return `${point.name}\n${t("responseMinutes")}: ${nf.format(value[0])}\n${t("resolution")}: ${nf.format(value[1])}%\n${t("load")}: ${nf.format(value[2])}`;
      } },
    };
  }, [measured, t, locale]);
  return <div>
    <p className="mb-1 text-2xs text-muted-foreground">{t("responseMapHint")}</p>
    <DataChart option={option} label={t("responseMap")} height={240} columns={[t("category"), t("responseMinutes"), t("resolution"), t("load")]} rows={measured.map((row) => [row.display_name, row.avg_response_mins!, row.resolution_pct, row.resolved + row.open + row.pending])} />
    {measured.length < rows.length ? <p className="mt-2 text-2xs text-muted-foreground">{t("missingResponse", { count: rows.length - measured.length })}</p> : null}
  </div>;
}
