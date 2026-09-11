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

export interface BlockGroup {
  key: string;
  label: string;
  /** Group-level colour; children are tinted steps of it. */
  color: string;
  children: ChartDatum[];
}

/**
 * A treemap with ONE level of grouping, for "every group at once".
 *
 * A flat treemap cannot serve this: two groups routinely own a block of the
 * same name — a workspace with several funnels really does have "em
 * atendimento" in each — and flattening them would draw two identical labels
 * with no way to tell which belongs to whom, or silently merge them.
 *
 * ECharts nests natively, so the group band carries the name and the blocks
 * inside it stay comparable by area ACROSS groups, which is the one thing a
 * per-group chart each in its own box cannot do.
 */
export function GroupedBlockChart({ groups, label, height = 240 }: {
  groups: BlockGroup[]; label: string; height?: number;
}) {
  const t = useTranslations("denseCharts");
  const locale = useLocale();
  const option = useMemo<EChartsOption>(() => {
    const nf = new Intl.NumberFormat(locale);
    const total = groups.reduce(
      (sum, group) => sum + group.children.reduce((s, item) => s + Math.max(0, item.value), 0),
      0,
    );
    return {
      series: [{
        type: "treemap", left: 0, top: 0, right: 0, bottom: 0,
        roam: false, nodeClick: false, breadcrumb: { show: false },
        visibleMin: 0, sort: "desc",
        // The group's name rides a band at the top of its own region rather
        // than inside a child block, so it is never mistaken for a stage.
        //
        // It needs its OWN formatter. ECharts lets upperLabel inherit the
        // leaf `label`, and that one is a rich template — inherited into a
        // band with no `rich` of its own, it printed the markup verbatim:
        // the band literally read "{name|Funil Anhanguera}".
        upperLabel: {
          show: true, height: 20, color: "hsl(var(--foreground))",
          fontSize: 11, fontWeight: 600, formatter: "{b}", overflow: "truncate",
        },
        label: {
          show: true, position: "insideTopLeft", padding: 5, overflow: "truncate",
          formatter: (params) => `{name|${params.name}}\n{value|${nf.format(Number(params.value))}}`,
          rich: {
            name: { fontSize: 10, color: "hsl(var(--foreground))", backgroundColor: "hsl(var(--card))", padding: [2, 3], borderRadius: 2, lineHeight: 16 },
            value: { fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))", backgroundColor: "hsl(var(--card))", padding: [2, 3], borderRadius: 2, lineHeight: 18 },
          },
        },
        levels: [
          // The invisible root. Its band drew too, as an empty "{name|}".
          { itemStyle: { borderColor: "hsl(var(--border))", borderWidth: 0, gapWidth: 3 }, upperLabel: { show: false } },
          { itemStyle: { borderColor: "hsl(var(--card))", borderWidth: 3, gapWidth: 3 }, upperLabel: { show: true } },
          { itemStyle: { borderColor: "hsl(var(--card))", borderWidth: 1, gapWidth: 1 } },
        ],
        data: groups.map((group) => {
          const groupTotal = group.children.reduce((sum, item) => sum + Math.max(0, item.value), 0);
          // A band narrower than its own name draws a stub: a funnel holding
          // 2% of the workspace rendered as the two letters "At". Two letters
          // are not a label, and the group is still named in the table twin
          // and wherever the groups are listed in full.
          const nameable = total > 0 && groupTotal / total >= 0.08;
          return {
            id: group.key,
            name: group.label,
            itemStyle: { color: group.color },
            upperLabel: { show: nameable },
            children: group.children
              .filter((item) => item.value > 0 && Number.isFinite(item.value))
              .map((item) => ({ id: item.key, name: item.label, value: item.value, itemStyle: { color: item.color } })),
          };
        }),
      }],
      tooltip: { valueFormatter: (value) => nf.format(Number(value)) },
    };
  }, [groups, locale]);

  return <DataChart
    option={option}
    label={label}
    height={height}
    columns={[t("category"), t("count")]}
    rows={groups.flatMap((group) => group.children.map((item) => [`${group.label} · ${item.label}`, item.value]))}
  />;
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
      // No numeric scale on the axis. Once the rose fills its whole slice the
      // labels had nowhere to sit but on top of the fills, and putting them on
      // little chips to survive that just laid clutter over the plot. The
      // dashed rings still carry the quarters, and the share is printed inside
      // its own wedge where the reader is already looking.
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: "hsl(var(--border))", type: "dashed" } },
    },
    series: [{
      type: "bar", coordinateSystem: "polar",
      // A Nightingale rose, not a ring of slivers: each category fills its
      // whole angular slice and grows outward with its share, so the shape
      // itself is the reading. At 54% width the wedges were thin spokes with
      // dead air between them, which reads as a decoration rather than a
      // composition. Neighbours are separated by a surface-coloured stroke —
      // the gap, not a border, same rule the stacked bars follow.
      barWidth: "100%",
      roundCap: false,
      // The share sits INSIDE its own wedge, near the rim. White on a
      // mid-saturation status fill with a dark text outline reads on all of
      // them, in both themes, without laying a chip over the plot.
      label: {
        show: true,
        position: "middle",
        formatter: (params) =>
          `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(params.value))}%`,
        fontSize: 11,
        fontWeight: 600,
        color: "#fff",
        textBorderColor: "rgba(0,0,0,0.45)",
        textBorderWidth: 2,
      },
      // A wedge too small to hold its own number drops the label rather than
      // spilling it over its neighbour. The exact value is in the legend and
      // the table either way.
      labelLayout: { hideOverlap: true },
      data: data.map((item) => ({
        name: item.label,
        value: total > 0 ? item.value / total * 100 : 0,
        itemStyle: {
          color: item.color,
          opacity: 0.9,
          borderColor: "hsl(var(--card))",
          borderWidth: 2,
        },
      })),
    }],
    tooltip: { valueFormatter: (value) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(value))}%` },
  }), [data, total, locale]);
  return <div className="space-y-2">
    <DataChart option={option} label={label} height={210} columns={[t("category"), t("count")]} rows={data.map((item) => [item.label, item.value])} />
    <ChartLegend data={data} total={total} />
  </div>;
}
