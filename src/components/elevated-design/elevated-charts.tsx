"use client";

/**
 * Elevated design-system chart primitives.
 *
 * Rendering follows the Vozko chart grammar defined in
 * `@/components/charts/vozko` (recessive grid/axis chrome, 2.5px line
 * marks with gradient dissolves, segmented-ring pies, rounded bars).
 * Change the grammar in that kit module, not here; this module only
 * wraps it behind loading/empty-state conveniences.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartBar, ChartLine, ChartPie, Spinner } from "@/components/icons";
import {
  VozAreaGradient,
  vozGrid,
  vozLineMark,
  vozRing,
  vozXAxis,
  vozYAxis,
} from "@/components/charts/vozko";

import React from "react";

export interface ChartDataPoint {
  name: string;
  value: number;
  /** Series color — pass a token such as `hsl(var(--chart-1))`, not a hex. */
  color: string;
}

export interface TimeSeriesDataPoint {
  [key: string]: string | number;
}

export interface AreaSeriesConfig {
  dataKey: string;
  /** Series color — pass a token such as `hsl(var(--chart-1))`, not a hex. */
  color: string;
  name?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
  formatter?: (value: number, name: string) => [string, string];
  labelFormatter?: (label: string) => string;
}

export const ElevatedChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}) => {
  if (!active || !payload?.length) return null;

  const displayLabel = (() => {
    if (labelFormatter) return labelFormatter(label || "");
    const dataName = payload?.[0]?.payload?.name;
    if (
      dataName &&
      typeof dataName === "string" &&
      (!label || /^\d+(\.\d+)?$/.test(String(label)))
    ) {
      return dataName;
    }
    return label;
  })();

  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">
        {displayLabel}
      </p>
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const [formattedValue, formattedName] = formatter
            ? formatter(entry.value, entry.name)
            : [entry.value.toLocaleString(), entry.name];
          return (
            <div
              key={index}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">
                  {formattedName}
                </span>
              </div>
              <span className="readout font-semibold text-foreground">
                {formattedValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ChartLoadingStateProps {
  height?: number;
}

export const ChartLoadingState: React.FC<ChartLoadingStateProps> = ({
  height = 300,
}) => (
  <div
    className="flex items-center justify-center"
    style={{ height: `${height}px` }}
  >
    <Spinner className="h-8 w-8 animate-spin text-primary-ink" />
  </div>
);

interface ChartEmptyStateProps {
  height?: number;
  message: string;
  type?: "area" | "pie" | "bar";
}

export const ChartEmptyState: React.FC<ChartEmptyStateProps> = ({
  height = 300,
  message,
  type = "bar",
}) => {
  const Icon =
    type === "pie" ? ChartPie : type === "area" ? ChartLine : ChartBar;

  return (
    <div
      className="flex flex-col items-center justify-center text-muted-foreground"
      style={{ height: `${height}px` }}
    >
      <Icon className="h-12 w-12 mb-2 text-muted-foreground" />
      <p>{message}</p>
    </div>
  );
};

interface ElevatedAreaChartProps {
  data: TimeSeriesDataPoint[];
  series: AreaSeriesConfig[];
  loading?: boolean;
  emptyMessage?: string;
  height?: number;
  xAxisDataKey?: string;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number, name: string) => [string, string];
  legendFormatter?: (value: string) => string;
  showLegend?: boolean;
  id?: string;
}

export const ElevatedAreaChart: React.FC<ElevatedAreaChartProps> = ({
  data,
  series,
  loading = false,
  emptyMessage = "No data available",
  height = 400,
  xAxisDataKey = "formattedTime",
  yAxisFormatter,
  tooltipFormatter,
  legendFormatter,
  showLegend = true,
  id = "area",
}) => {
  if (loading) {
    return <ChartLoadingState height={height} />;
  }

  if (!data || data.length === 0) {
    return (
      <ChartEmptyState height={height} message={emptyMessage} type="area" />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
      >
        <defs>
          {series.map((s) => (
            <VozAreaGradient
              key={`gradient-${id}-${s.dataKey}`}
              id={`${id}-${s.dataKey}`}
              color={s.color}
            />
          ))}
        </defs>
        <CartesianGrid {...vozGrid} />
        <XAxis {...vozXAxis} dataKey={xAxisDataKey} />
        <YAxis {...vozYAxis} tickFormatter={yAxisFormatter} />
        <Tooltip
          content={<ElevatedChartTooltip formatter={tooltipFormatter} />}
          cursor={{ stroke: "hsl(var(--border-strong))", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        {showLegend && (
          <Legend
            formatter={legendFormatter}
            wrapperStyle={{ paddingTop: "20px" }}
            iconType="circle"
            iconSize={8}
          />
        )}
        {series.map((s) => (
          <Area
            key={s.dataKey}
            {...vozLineMark}
            type="monotoneX"
            dataKey={s.dataKey}
            name={s.name || s.dataKey}
            stroke={s.color}
            fill={`url(#voz-fill-${id}-${s.dataKey})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};

interface ElevatedPieChartProps {
  data: ChartDataPoint[];
  loading?: boolean;
  emptyMessage?: string;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  tooltipFormatter?: (value: number, name: string) => [string, string];
  id?: string;
}

export const ElevatedPieChart: React.FC<ElevatedPieChartProps> = ({
  data,
  loading = false,
  emptyMessage = "No data available",
  height = 300,
  /* Thin segmented ring per the voz grammar: inner ≈ outer − 12. */
  innerRadius = 83,
  outerRadius = 95,
  tooltipFormatter,
}) => {
  if (loading) {
    return <ChartLoadingState height={height} />;
  }

  if (!data || data.length === 0) {
    return (
      <ChartEmptyState height={height} message={emptyMessage} type="pie" />
    );
  }

  const total = data.reduce((acc, entry) => acc + entry.value, 0);

  return (
    <div className="relative" style={{ height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            {...vozRing(outerRadius, innerRadius)}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                style={{ cursor: "pointer" }}
              />
            ))}
          </Pie>
          <Tooltip
            content={<ElevatedChartTooltip formatter={tooltipFormatter} />}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="readout font-display text-lg font-semibold leading-none text-foreground">
          {total.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

interface ElevatedBarChartProps {
  data: ChartDataPoint[];
  loading?: boolean;
  emptyMessage?: string;
  height?: number;
  layout?: "horizontal" | "vertical";
  barSize?: number;
  leftMargin?: number;
  xAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number, name: string) => [string, string];
  tooltipLabel?: string;
  barName?: string;
  id?: string;
}

export const ElevatedBarChart: React.FC<ElevatedBarChartProps> = ({
  data,
  loading = false,
  emptyMessage = "No data available",
  height = 300,
  layout = "vertical",
  barSize = 28,
  leftMargin = 90,
  xAxisFormatter,
  tooltipFormatter,
  barName = "Valor",
}) => {
  if (loading) {
    return <ChartLoadingState height={height} />;
  }

  if (!data || data.length === 0) {
    return (
      <ChartEmptyState height={height} message={emptyMessage} type="bar" />
    );
  }

  const isVertical = layout === "vertical";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={{
          left: isVertical ? leftMargin : 10,
          right: 20,
          top: 10,
          bottom: 10,
        }}
      >
        <CartesianGrid
          {...vozGrid}
          horizontal={!isVertical}
          vertical={isVertical}
        />
        {isVertical ? (
          <>
            <XAxis
              {...vozXAxis}
              type="number"
              tickFormatter={xAxisFormatter}
            />
            <YAxis
              {...vozYAxis}
              type="category"
              dataKey="name"
              width={leftMargin - 5}
            />
          </>
        ) : (
          <>
            <XAxis {...vozXAxis} type="category" dataKey="name" />
            <YAxis
              {...vozYAxis}
              type="number"
              tickFormatter={xAxisFormatter}
            />
          </>
        )}
        <Tooltip
          content={<ElevatedChartTooltip formatter={tooltipFormatter} />}
          cursor={{ fill: "hsl(var(--muted))", radius: 8 }}
        />
        <Bar
          dataKey="value"
          name={barName}
          radius={isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          barSize={barSize}
          maxBarSize={28}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color}
              style={{ cursor: "pointer" }}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const ElevatedCharts = {
  ElevatedAreaChart,
  ElevatedPieChart,
  ElevatedBarChart,
  ElevatedChartTooltip,
  ChartLoadingState,
  ChartEmptyState,
};

export default ElevatedCharts;
