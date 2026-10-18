"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { vozGrid, vozLineMark, vozXAxis, vozYAxis } from "@/components/charts/vozko";
import { ALERT_COLOR, RUN_SENTIMENT_COLOR } from "@/components/unofficial-whatsapp-groups/marks";
import type { TrendPoint } from "@/lib/unofficial-whatsapp-groups/types";

import { ChartLegend, ChartTip, Readout } from "../kit/chart-parts";
import { GROUPS_CHART_COLOR } from "../kit/charts";
import { useGroupsFormat } from "../kit/use-groups-format";
import { ALERT_ORDER, cycleHighlights } from "./analysis-series";

const LEGEND_ROW = 22;
const BAR_CURSOR = { fill: "hsl(var(--muted))" };
const POSITIVITY_TICKS = [0, 50, 100];

type CycleDatum = TrendPoint & { key: string; label: string };

function SentimentDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: CycleDatum }) {
  if (cx === undefined || cy === undefined || !payload) return <g />;
  return <circle cx={cx} cy={cy} r={4} fill={RUN_SENTIMENT_COLOR[payload.sentiment]} stroke="hsl(var(--card))" strokeWidth={2} />;
}

export function CycleChart({ trend, height, timezone }: { trend: TrendPoint[]; height: number; timezone: string }) {
  const t = useTranslations("unofficialGroups.analyses.period.cycleChart");
  const tp = useTranslations("unofficialGroups.analyses.period");
  const ta = useTranslations("unofficialGroups.common.alert");
  const ts = useTranslations("unofficialGroups.common.sentiment");
  const fmt = useGroupsFormat(timezone);
  const data = useMemo<CycleDatum[]>(
    () => trend.map((point, index) => ({ ...point, key: `${point.cycle}-${index}`, label: tp("cycleShort", { cycle: point.cycle }) })),
    [trend, tp],
  );

  return (
    <div className="flex min-w-0 flex-col gap-1" style={{ height }}>
      <ChartLegend
        className="h-4"
        items={[
          ...ALERT_ORDER.map((level) => ({ key: level, label: ta(level), color: ALERT_COLOR[level] })),
          { key: "positivity", label: t("positivity"), color: GROUPS_CHART_COLOR.positivity, shape: "line" as const },
          { key: "midline", label: tp("midline"), color: GROUPS_CHART_COLOR.guide, shape: "dash" as const },
        ]}
      />
      <div className="min-h-0 flex-1" style={{ height: height - LEGEND_ROW }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 0, left: -8, bottom: 0 }} barCategoryGap="32%">
            <CartesianGrid {...vozGrid} />
            <XAxis dataKey="label" minTickGap={12} {...vozXAxis} />
            <YAxis yAxisId="messages" allowDecimals={false} tickFormatter={(value: number) => fmt.compact(value)} {...vozYAxis} />
            <YAxis yAxisId="positivity" orientation="right" domain={[0, 100]} ticks={POSITIVITY_TICKS} {...vozYAxis} width={30} />
            <ReferenceLine yAxisId="positivity" y={50} stroke={GROUPS_CHART_COLOR.guide} strokeDasharray="4 4" />
            <Tooltip
              cursor={BAR_CURSOR}
              content={({ active, payload }) => {
                const datum = payload?.[0]?.payload as CycleDatum | undefined;
                if (!active || !datum) return null;
                return (
                  <ChartTip
                    title={`${datum.label} · ${fmt.dateTime(datum.at)}`}
                    rows={[
                      { key: "messages", label: t("messages"), value: fmt.num(datum.messages), color: ALERT_COLOR[datum.alert] },
                      { key: "participants", label: t("participants"), value: fmt.num(datum.participants) },
                      { key: "alert", label: t("alert"), value: ta(datum.alert), color: ALERT_COLOR[datum.alert] },
                      { key: "sentiment", label: t("sentiment"), value: ts(datum.sentiment), color: RUN_SENTIMENT_COLOR[datum.sentiment] },
                      { key: "positivity", label: t("positivity"), value: t("score", { value: fmt.num(datum.positivity) }), color: GROUPS_CHART_COLOR.positivity },
                    ]}
                  />
                );
              }}
            />
            <Bar yAxisId="messages" dataKey="messages" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false}>
              {data.map((datum) => (
                <Cell key={datum.key} fill={ALERT_COLOR[datum.alert]} fillOpacity={0.85} />
              ))}
            </Bar>
            <Line
              yAxisId="positivity"
              dataKey="positivity"
              type="monotone"
              stroke={GROUPS_CHART_COLOR.positivity}
              isAnimationActive={false}
              {...vozLineMark}
              dot={(props: { cx?: number; cy?: number; payload?: CycleDatum; index?: number }) => <SentimentDot key={`cycle-dot-${props.index}`} {...props} />}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CycleHighlights({ trend, timezone }: { trend: TrendPoint[]; timezone: string }) {
  const t = useTranslations("unofficialGroups.analyses.period.cycleChart");
  const fmt = useGroupsFormat(timezone);
  const { busiest, best, worst } = useMemo(() => cycleHighlights(trend), [trend]);
  if (!busiest || !best || !worst) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border pt-2.5">
      <Readout label={t("busiest")} value={t("busiestValue", { cycle: busiest.cycle, count: busiest.messages })} />
      <Readout label={t("best")} value={t("scoreValue", { cycle: best.cycle, value: fmt.num(best.positivity) })} />
      <Readout label={t("worst")} value={t("scoreValue", { cycle: worst.cycle, value: fmt.num(worst.positivity) })} />
    </div>
  );
}
