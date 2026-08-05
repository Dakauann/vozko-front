"use client";

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

import React from "react";

export interface ChartDataPoint {
  name: string;
  value: number;
  color: string;
}

export interface TimeSeriesDataPoint {
  [key: string]: string | number;
}

export interface AreaSeriesConfig {
  dataKey: string;
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
    <div className="bg-card border border-border rounded-[--radius] p-4 shadow-2xl shadow-slate-900/10">
      <p className="text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border">
        {displayLabel}
      </p>
      <div className="space-y-2">
        {payload.map((entry, index) => {
          const [formattedValue, formattedName] = formatter
            ? formatter(entry.value, entry.name)
            : [entry.value.toLocaleString(), entry.name];
          return (
            <div
              key={index}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {formattedName}
                </span>
              </div>
              <span className="text-sm font-semibold text-foreground">
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
            <linearGradient
              key={`gradient-${id}-${s.dataKey}`}
              id={`gradient-${id}-${s.dataKey}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity={0.4} />
              <stop offset="50%" stopColor={s.color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
          <filter id={`glow-${id}`}>
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="#e2e8f0"
          strokeOpacity={0.6}
          vertical={false}
        />
        <XAxis
          dataKey={xAxisDataKey}
          tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
          tickLine={false}
          axisLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
          dy={10}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
          tickLine={false}
          axisLine={false}
          dx={-5}
          tickFormatter={yAxisFormatter}
        />
        <Tooltip
          content={<ElevatedChartTooltip formatter={tooltipFormatter} />}
          cursor={{ stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "4 4" }}
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
            type="monotoneX"
            dataKey={s.dataKey}
            name={s.name || s.dataKey}
            stroke={s.color}
            strokeWidth={2.5}
            fill={`url(#gradient-${id}-${s.dataKey})`}
            dot={false}
            activeDot={{
              r: 6,
              strokeWidth: 3,
              stroke: "#fff",
              fill: s.color,
              filter: `url(#glow-${id})`,
            }}
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
  innerRadius = 55,
  outerRadius = 95,
  tooltipFormatter,
  id = "pie",
}) => {
  if (loading) {
    return <ChartLoadingState height={height} />;
  }

  if (!data || data.length === 0) {
    return (
      <ChartEmptyState height={height} message={emptyMessage} type="pie" />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <defs>
          {data.map((entry, index) => {
            const grainId = `pie-grain-${id}-${index}`;
            const gradId = `pie-gradient-${id}-${index}`;
            const patId = `pie-pat-${id}-${index}`;
            return (
              <React.Fragment key={`pie-defs-${id}-${index}`}>
                <filter id={grainId} x="0%" y="0%" width="100%" height="100%">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.65"
                    numOctaves={4}
                    seed={index * 17 + 3}
                    stitchTiles="stitch"
                    result="noise"
                  />
                  <feColorMatrix
                    in="noise"
                    type="saturate"
                    values="0"
                    result="mono"
                  />
                  <feBlend
                    in="SourceGraphic"
                    in2="mono"
                    mode="overlay"
                    result="blended"
                  />
                  <feComponentTransfer in="blended">
                    <feFuncA type="linear" slope="1" />
                  </feComponentTransfer>
                </filter>
                <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                  <stop
                    offset="100%"
                    stopColor={entry.color}
                    stopOpacity={0.75}
                  />
                </linearGradient>
                <pattern
                  id={patId}
                  patternUnits="objectBoundingBox"
                  width="1"
                  height="1"
                >
                  <rect width="100%" height="100%" fill={`url(#${gradId})`} />
                  <rect
                    width="100%"
                    height="100%"
                    fill={`url(#${gradId})`}
                    filter={`url(#${grainId})`}
                  />
                </pattern>
              </React.Fragment>
            );
          })}
          <filter
            id={`pie-shadow-${id}`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
          </filter>
        </defs>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={3}
          dataKey="value"
          cornerRadius={6}
          stroke="#fff"
          strokeWidth={2}
          filter={`url(#pie-shadow-${id})`}
        >
          {data.map((_entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={`url(#pie-pat-${id}-${index})`}
              style={{ cursor: "pointer" }}
            />
          ))}
        </Pie>
        <Tooltip
          content={<ElevatedChartTooltip formatter={tooltipFormatter} />}
        />
      </PieChart>
    </ResponsiveContainer>
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
  id = "bar",
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
        <defs>
          {data.map((entry, index) => {
            const grainId = `bar-grain-${id}-${index}`;
            const gradId = `bar-gradient-${id}-${index}`;
            const patId = `bar-pat-${id}-${index}`;
            return (
              <React.Fragment key={`bar-defs-${id}-${index}`}>
                <filter id={grainId} x="0%" y="0%" width="100%" height="100%">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.6"
                    numOctaves={4}
                    seed={index * 13 + 7}
                    stitchTiles="stitch"
                    result="noise"
                  />
                  <feColorMatrix
                    in="noise"
                    type="saturate"
                    values="0"
                    result="mono"
                  />
                  <feBlend
                    in="SourceGraphic"
                    in2="mono"
                    mode="overlay"
                    result="blended"
                  />
                  <feComponentTransfer in="blended">
                    <feFuncA type="linear" slope="1" />
                  </feComponentTransfer>
                </filter>
                <linearGradient
                  id={gradId}
                  x1="0"
                  y1="0"
                  x2={isVertical ? "1" : "0"}
                  y2={isVertical ? "0" : "1"}
                >
                  <stop offset="0%" stopColor={entry.color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={1} />
                </linearGradient>
                <pattern
                  id={patId}
                  patternUnits="objectBoundingBox"
                  width="1"
                  height="1"
                >
                  <rect width="100%" height="100%" fill={`url(#${gradId})`} />
                  <rect
                    width="100%"
                    height="100%"
                    fill={`url(#${gradId})`}
                    filter={`url(#${grainId})`}
                  />
                </pattern>
              </React.Fragment>
            );
          })}
          <filter id={`bar-shadow-${id}`}>
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
          </filter>
        </defs>
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="#e2e8f0"
          strokeOpacity={0.5}
          horizontal={!isVertical}
          vertical={isVertical ? false : true}
        />
        {isVertical ? (
          <>
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tickFormatter={xAxisFormatter}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: "#64748b", fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              width={leftMargin - 5}
            />
          </>
        ) : (
          <>
            <XAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              type="number"
              tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={xAxisFormatter}
            />
          </>
        )}
        <Tooltip
          content={<ElevatedChartTooltip formatter={tooltipFormatter} />}
          cursor={{ fill: "#f1f5f9", radius: 8 }}
        />
        <Bar
          dataKey="value"
          name={barName}
          radius={isVertical ? [0, 8, 8, 0] : [8, 8, 0, 0]}
          barSize={barSize}
          filter={`url(#bar-shadow-${id})`}
        >
          {data.map((_entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={`url(#bar-pat-${id}-${index})`}
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
