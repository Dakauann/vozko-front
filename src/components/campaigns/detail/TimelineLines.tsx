"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { vozGrid, vozXAxis, vozYAxis } from "@/components/charts/vozko";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export interface TimelineSeries {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
}

export type TimelineRow = { label: string; title: string } & Record<string, unknown>;

export function TimelineLines({ data, series, format }: { data: TimelineRow[]; series: readonly TimelineSeries[]; format: (value: number) => string }) {
  const config: ChartConfig = Object.fromEntries(series.map((line) => [line.key, { label: line.label, color: line.color }]));
  const colorOf = (key: string) => series.find((line) => line.key === key)?.color;

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
                    <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: colorOf(String(name)) }} />
                    {config[String(name)]?.label}
                  </span>
                  <span className="readout font-semibold">{format(Number(value))}</span>
                </span>
              )}
            />
          }
        />
        <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
        {series.map((line) => (
          <Line
            key={line.key}
            type="linear"
            dataKey={line.key}
            stroke={line.color}
            strokeWidth={line.dashed ? 1.5 : 2}
            strokeDasharray={line.dashed ? "4 3" : undefined}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
