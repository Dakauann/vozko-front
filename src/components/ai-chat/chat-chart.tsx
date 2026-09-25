"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { ChartBar, Table } from "@/components/icons";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useMetricsFmt } from "@/components/dashboard/attendance/primitives";
import { chartRows, formatChartValue, seriesKey, type ChartRow } from "@/lib/aichat/chart";
import { CHART_OTHER_CATEGORY, type ChatChart, type ChatValueKind } from "@/lib/aichat/types";
import { cn } from "@/lib/utils";

const OTHER_FILL = "hsl(var(--muted-foreground) / 0.45)";
const DOT_THRESHOLD = 24;
const AXIS = { tickLine: false, axisLine: false, tickMargin: 8, fontSize: 11 } as const;

function seriesColor(index: number): string {
  return `hsl(var(--chart-${index + 1}))`;
}

export function ChatChartView({ chart }: { chart: ChatChart }) {
  const t = useTranslations("aiChatPage.chart");
  const fmt = useMetricsFmt();
  const [asTable, setAsTable] = useState(chart.type === "table");
  const rows = useMemo(() => chartRows(chart, t("other")), [chart, t]);
  const config = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        chart.series.map((s, i) => [seriesKey(i), { label: s.label, color: seriesColor(i) }]),
      ),
    [chart.series],
  );
  const format = (kind: ChatValueKind, v: unknown) =>
    formatChartValue(fmt, kind, typeof v === "number" ? v : null);
  const kind = chart.series[0]?.kind ?? "number";

  return (
    <figure className="rounded-lg border border-border bg-card">
      <figcaption className="flex items-start justify-between gap-3 border-b border-border px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{chart.title}</p>
          {chart.subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{chart.subtitle}</p>
          ) : null}
        </div>
        {chart.type !== "table" ? (
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-2 py-1 text-2xs font-semibold text-muted-foreground transition-colors duration-DEFAULT hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {asTable ? <ChartBar className="h-3 w-3" weight="bold" /> : <Table className="h-3 w-3" weight="bold" />}
            {asTable ? t("showChart") : t("showTable")}
          </button>
        ) : null}
      </figcaption>
      <div className="p-3">
        {asTable ? (
          <ChartTable chart={chart} rows={rows} format={format} />
        ) : (
          <>
            <ChartContainer config={config} className="aspect-auto h-60 w-full">
            {renderPlot(chart, rows, (v) => format(kind, v))}
          </ChartContainer>
            {chart.type === "pie" || chart.type === "donut" ? <SliceLegend chart={chart} rows={rows} /> : null}
          </>
        )}
      </div>
    </figure>
  );
}

function tooltip(formatValue: (v: unknown) => string) {
  return (
    <ChartTooltip
      content={
        <ChartTooltipContent
          formatter={(value, name, item) => (
            <div className="flex w-full items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: item.color ?? item.payload?.fill }} />
                {name}
              </span>
              <span className="font-mono font-medium tabular-nums text-foreground">{formatValue(value)}</span>
            </div>
          )}
        />
      }
    />
  );
}

function legend(count: number) {
  return count > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null;
}

function renderPlot(chart: ChatChart, rows: ChartRow[], formatValue: (v: unknown) => string) {
  const keys = chart.series.map((_, i) => seriesKey(i));
  const names = chart.series.map((s) => s.label);
  const tick = (v: unknown) => formatValue(v);
  const stacked = chart.type === "stacked_bar" || chart.type === "stacked_area";
  const dots = rows.length <= DOT_THRESHOLD;

  switch (chart.type) {
    case "bar":
    case "stacked_bar":
      return (
        <BarChart data={rows} barCategoryGap="24%">
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="category" {...AXIS} interval="preserveStartEnd" />
          <YAxis {...AXIS} width={56} tickFormatter={tick} />
          {tooltip(formatValue)}
          {legend(keys.length)}
          {keys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              name={names[i]}
              fill={`var(--color-${k})`}
              stackId={stacked ? "stack" : undefined}
              stroke="hsl(var(--card))"
              strokeWidth={stacked ? 2 : 0}
              radius={!stacked || i === keys.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      );
    case "horizontal_bar":
      return (
        <BarChart data={rows} layout="vertical" barCategoryGap="20%">
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" {...AXIS} tickFormatter={tick} />
          <YAxis type="category" dataKey="category" {...AXIS} width={112} />
          {tooltip(formatValue)}
          {legend(keys.length)}
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} name={names[i]} fill={`var(--color-${k})`} radius={[0, 4, 4, 0]} maxBarSize={22} />
          ))}
        </BarChart>
      );
    case "line":
      return (
        <LineChart data={rows}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="category" {...AXIS} interval="preserveStartEnd" />
          <YAxis {...AXIS} width={56} tickFormatter={tick} />
          {tooltip(formatValue)}
          {legend(keys.length)}
          {keys.map((k, i) => (
            <Line
              key={k}
              dataKey={k}
              name={names[i]}
              type="monotone"
              stroke={`var(--color-${k})`}
              strokeWidth={2}
              dot={dots ? { r: 4, strokeWidth: 2, stroke: "hsl(var(--card))", fill: `var(--color-${k})` } : false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      );
    case "area":
    case "stacked_area":
      return (
        <AreaChart data={rows}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="category" {...AXIS} interval="preserveStartEnd" />
          <YAxis {...AXIS} width={56} tickFormatter={tick} />
          {tooltip(formatValue)}
          {legend(keys.length)}
          {keys.map((k, i) => (
            <Area
              key={k}
              dataKey={k}
              name={names[i]}
              type="monotone"
              stackId={stacked ? "stack" : undefined}
              stroke={`var(--color-${k})`}
              strokeWidth={2}
              fill={`var(--color-${k})`}
              fillOpacity={stacked ? 0.55 : 0.18}
            />
          ))}
        </AreaChart>
      );
    case "pie":
    case "donut":
      return (
        <PieChart>
          {tooltip(formatValue)}
          <Pie
            data={rows}
            dataKey="s0"
            nameKey="category"
            innerRadius={chart.type === "donut" ? "58%" : 0}
            outerRadius="88%"
            stroke="hsl(var(--card))"
            strokeWidth={2}
            paddingAngle={0}
          >
            {rows.map((row, i) => (
              <Cell
                key={i}
                fill={sliceColor(chart, i)}
              />
            ))}
          </Pie>
        </PieChart>
      );
    case "scatter":
      return (
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name={chart.xLabel} {...AXIS} />
          <YAxis type="number" dataKey="s0" name={names[0]} {...AXIS} width={56} tickFormatter={tick} />
          <ZAxis range={[64, 64]} />
          {tooltip(formatValue)}
          <Scatter data={rows} name={names[0]} fill="var(--color-s0)" stroke="hsl(var(--card))" strokeWidth={2} />
        </ScatterChart>
      );
    case "radar":
      return (
        <RadarChart data={rows} outerRadius="72%">
          <PolarGrid />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
          {tooltip(formatValue)}
          {legend(keys.length)}
          {keys.map((k, i) => (
            <Radar key={k} dataKey={k} name={names[i]} stroke={`var(--color-${k})`} strokeWidth={2} fill={`var(--color-${k})`} fillOpacity={0.15} />
          ))}
        </RadarChart>
      );
    default:
      return <></>;
  }
}

function ChartTable({
  chart,
  rows,
  format,
}: {
  chart: ChatChart;
  rows: ChartRow[];
  format: (kind: ChatValueKind, v: unknown) => string;
}) {
  const scatter = chart.type === "scatter";
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border text-left text-muted-foreground">
            <th scope="col" className="py-1.5 pr-3 font-semibold">{chart.xLabel}</th>
            {chart.series.map((s) => (
              <th key={s.key} scope="col" className="py-1.5 pl-3 text-right font-semibold">{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              <th scope="row" className={cn("py-1.5 pr-3 text-left font-medium text-foreground", scatter && "font-mono tabular-nums")}>
                {scatter ? format(chart.xKind, row.x) : row.category}
              </th>
              {chart.series.map((s, j) => (
                <td key={s.key} className="py-1.5 pl-3 text-right font-mono tabular-nums text-foreground">
                  {format(s.kind, row[seriesKey(j)])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sliceColor(chart: ChatChart, index: number): string {
  return chart.categories?.[index] === CHART_OTHER_CATEGORY ? OTHER_FILL : seriesColor(index);
}

function SliceLegend({ chart, rows }: { chart: ChatChart; rows: ChartRow[] }) {
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {rows.map((row, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: sliceColor(chart, i) }} />
          {row.category}
        </li>
      ))}
    </ul>
  );
}
