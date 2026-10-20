"use client";

import { useId, useMemo, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Meter, VOZ_SERIES, VozAreaGradient, vozGrid, vozLineMark, vozRing, vozXAxis, vozYAxis, type VozBarSize, type VozSegment } from "@/components/charts/vozko";
import { Link, useRouter } from "@/i18n/routing";
import type { DailyPoint } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { clipLabel, flowSeries, isIsolatedValue, outerSegmentKey, rowTotal, stackedHeight, volumeSeries, type FlowDatum, type VolumeDatum } from "./chart-model";
import { ChartLegend, ChartTip, type LegendItem, type TipRow } from "./chart-parts";
import { QuietEmpty } from "./empty";
import { useGroupsFormat } from "./use-groups-format";

export const GROUPS_CHART_COLOR = {
  messages: VOZ_SERIES[0],
  activeGroups: VOZ_SERIES[1],
  responseTime: VOZ_SERIES[2],
  joins: VOZ_SERIES[0],
  leaves: VOZ_SERIES[3],
  balance: VOZ_SERIES[1],
  positivity: VOZ_SERIES[4],
  neutral: "hsl(var(--muted-foreground) / 0.45)",
  guide: "hsl(var(--border-strong))",
} as const;

const BAR_CURSOR = { fill: "hsl(var(--muted))" };
const LINE_CURSOR = { stroke: "hsl(var(--border-strong))" };
const LEGEND_ROW = 22;
const CHART_MARGIN = { top: 6, right: 4, left: -8, bottom: 0 };

export function FlowChart({ points, height, balance = true, legend = true }: { points: DailyPoint[]; height: number; balance?: boolean; legend?: boolean }) {
  const t = useTranslations("unofficialGroups.kit.chart");
  const fmt = useGroupsFormat();
  const data = useMemo(() => flowSeries(points), [points]);
  const items: LegendItem[] = [
    { key: "joins", label: t("joins"), color: GROUPS_CHART_COLOR.joins },
    { key: "leaves", label: t("leaves"), color: GROUPS_CHART_COLOR.leaves },
    ...(balance ? [{ key: "balance", label: t("balance"), color: GROUPS_CHART_COLOR.balance, shape: "line" as const }] : []),
  ];
  return (
    <div className="flex min-w-0 flex-col gap-1" style={{ height }}>
      {legend ? <ChartLegend items={items} className="h-4" /> : null}
      <div className="min-h-0 flex-1" style={{ height: legend ? height - LEGEND_ROW : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} stackOffset="sign" margin={CHART_MARGIN}>
            <CartesianGrid {...vozGrid} />
            <XAxis dataKey="day" tickFormatter={fmt.day} minTickGap={18} {...vozXAxis} />
            <YAxis allowDecimals={false} tickFormatter={(value: number) => fmt.compact(value)} {...vozYAxis} />
            <ReferenceLine y={0} stroke={GROUPS_CHART_COLOR.guide} />
            <Tooltip
              cursor={BAR_CURSOR}
              content={({ active, payload }) => {
                const datum = payload?.[0]?.payload as FlowDatum | undefined;
                if (!active || !datum) return null;
                return (
                  <ChartTip
                    title={fmt.dayLong(datum.day)}
                    rows={[
                      { key: "joins", label: t("joins"), value: fmt.num(datum.joins), color: GROUPS_CHART_COLOR.joins },
                      { key: "leaves", label: t("leaves"), value: fmt.num(datum.leaves), color: GROUPS_CHART_COLOR.leaves },
                      { key: "net", label: t("net"), value: fmt.signed(datum.net) },
                      ...(balance ? [{ key: "balance", label: t("balance"), value: fmt.signed(datum.balance), color: GROUPS_CHART_COLOR.balance }] : []),
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="joins" stackId="flow" fill={GROUPS_CHART_COLOR.joins} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="leavesDown" stackId="flow" fill={GROUPS_CHART_COLOR.leaves} radius={[0, 0, 4, 4]} maxBarSize={28} isAnimationActive={false} />
            {balance ? <Line dataKey="balance" type="monotone" stroke={GROUPS_CHART_COLOR.balance} isAnimationActive={false} {...vozLineMark} /> : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function VolumeChart({ points, height, legend = true }: { points: DailyPoint[]; height: number; legend?: boolean }) {
  const t = useTranslations("unofficialGroups.kit.chart");
  const fmt = useGroupsFormat();
  const data = useMemo(() => volumeSeries(points), [points]);
  const gradientId = `groups-volume-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <div className="flex min-w-0 flex-col gap-1" style={{ height }}>
      {legend ? (
        <ChartLegend
          className="h-4"
          items={[
            { key: "messages", label: t("messages"), color: GROUPS_CHART_COLOR.messages, shape: "line" },
            { key: "activeGroups", label: t("activeGroups"), color: GROUPS_CHART_COLOR.activeGroups, shape: "line" },
          ]}
        />
      ) : null}
      <div className="min-h-0 flex-1" style={{ height: legend ? height - LEGEND_ROW : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ ...CHART_MARGIN, right: 0 }}>
            <defs>
              <VozAreaGradient id={gradientId} color={GROUPS_CHART_COLOR.messages} />
            </defs>
            <CartesianGrid {...vozGrid} />
            <XAxis dataKey="day" tickFormatter={fmt.day} minTickGap={18} {...vozXAxis} />
            <YAxis yAxisId="messages" allowDecimals={false} tickFormatter={(value: number) => fmt.compact(value)} {...vozYAxis} />
            <YAxis yAxisId="groups" orientation="right" allowDecimals={false} {...vozYAxis} width={28} />
            <Tooltip
              cursor={LINE_CURSOR}
              content={({ active, payload }) => {
                const datum = payload?.[0]?.payload as VolumeDatum | undefined;
                if (!active || !datum) return null;
                return (
                  <ChartTip
                    title={fmt.dayLong(datum.day)}
                    rows={[
                      { key: "messages", label: t("messages"), value: fmt.num(datum.messages), color: GROUPS_CHART_COLOR.messages },
                      { key: "activeGroups", label: t("activeGroups"), value: fmt.num(datum.activeGroups), color: GROUPS_CHART_COLOR.activeGroups },
                    ]}
                  />
                );
              }}
            />
            <Area
              yAxisId="messages"
              dataKey="messages"
              type="monotone"
              stroke={GROUPS_CHART_COLOR.messages}
              fill={`url(#voz-fill-${gradientId})`}
              isAnimationActive={false}
              {...vozLineMark}
            />
            <Line yAxisId="groups" dataKey="activeGroups" type="monotone" stroke={GROUPS_CHART_COLOR.activeGroups} isAnimationActive={false} {...vozLineMark} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export interface TrendDatum {
  key: string;
  label: string;
  value: number | null;
  tip: TipRow[];
}

export function TrendArea({
  data,
  color,
  height,
  domain,
  reference,
  goal,
  formatY,
  legend,
}: {
  data: TrendDatum[];
  color: string;
  height: number;
  domain?: [number, number];
  reference?: { value: number; label: string };
  goal?: { value: number; label: string };
  formatY: (n: number) => string;
  legend?: LegendItem[];
}) {
  const gradientId = `groups-trend-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const values = useMemo(() => data.map((datum) => datum.value), [data]);
  const items = [...(legend ?? []), ...(goal ? [{ key: "goal", label: goal.label, color: GROUPS_CHART_COLOR.guide, shape: "dash" as const }] : [])];
  const showLegend = items.length > 0;
  return (
    <div className="flex min-w-0 flex-col gap-1" style={{ height }}>
      {showLegend ? <ChartLegend items={items} className="h-4" /> : null}
      <div className="min-h-0 flex-1" style={{ height: showLegend ? height - LEGEND_ROW : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={CHART_MARGIN}>
            <defs>
              <VozAreaGradient id={gradientId} color={color} />
            </defs>
            <CartesianGrid {...vozGrid} />
            <XAxis dataKey="label" minTickGap={18} {...vozXAxis} />
            <YAxis domain={domain ?? ["auto", "auto"]} tickFormatter={formatY} {...vozYAxis} />
            {reference ? <ReferenceLine y={reference.value} stroke={GROUPS_CHART_COLOR.guide} strokeDasharray="4 4" ifOverflow="extendDomain" /> : null}
            {goal ? <ReferenceLine y={goal.value} stroke={GROUPS_CHART_COLOR.guide} strokeDasharray="4 4" ifOverflow="extendDomain" /> : null}
            <Tooltip
              cursor={LINE_CURSOR}
              content={({ active, payload }) => {
                const datum = payload?.[0]?.payload as TrendDatum | undefined;
                if (!active || !datum) return null;
                return <ChartTip title={datum.label} rows={datum.tip} />;
              }}
            />
            <Area
              dataKey="value"
              type="monotone"
              stroke={color}
              fill={`url(#voz-fill-${gradientId})`}
              connectNulls={false}
              isAnimationActive={false}
              {...vozLineMark}
              dot={(props: { cx?: number; cy?: number; index?: number }) => (
                <circle
                  key={`trend-dot-${props.index}`}
                  cx={props.cx}
                  cy={props.cy}
                  r={isIsolatedValue(values, props.index ?? -1) ? 3 : 0}
                  fill={color}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                />
              )}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface StackedRow {
  key: string;
  label: string;
  href?: string;
  values: Record<string, number>;
}

interface StackedSeries {
  key: string;
  label: string;
  color: string;
}

type StackedDatum = { key: string; label: string; href?: string; total: number; values: Record<string, number> } & Record<string, unknown>;

const SEGMENT_PREFIX = "seg_";

function rightRoundedRect(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width, height / 2));
  return `M${x},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height - r}Q${x + width},${y + height} ${x + width - r},${y + height}H${x}Z`;
}

function StackedTick({
  x,
  y,
  payload,
  rows,
  maxLabel,
  onOpen,
}: {
  x?: number;
  y?: number;
  payload?: { value: string; index?: number };
  rows: StackedDatum[];
  maxLabel: number;
  onOpen: (href: string) => void;
}) {
  const row = rows.find((candidate) => candidate.key === payload?.value);
  if (!row || x === undefined || y === undefined) return null;
  const text = clipLabel(row.label, maxLabel);
  const href = row.href;
  const linkProps = href
    ? {
        role: "link",
        tabIndex: 0,
        onClick: () => onOpen(href),
        onKeyDown: (event: KeyboardEvent<SVGTextElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(href);
          }
        },
        style: { cursor: "pointer" },
        className: "outline-none hover:underline focus-visible:underline",
      }
    : {};
  return (
    <text x={x - 6} y={y} dy={4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={11} {...linkProps}>
      <title>{row.label}</title>
      {text}
    </text>
  );
}

export function StackedBarsH({
  rows,
  series,
  unit,
  rowHeight = 30,
  labelWidth = 132,
  maxLabel = 18,
}: {
  rows: StackedRow[];
  series: StackedSeries[];
  unit: (n: number) => string;
  rowHeight?: number;
  labelWidth?: number;
  maxLabel?: number;
}) {
  const router = useRouter();
  const fmt = useGroupsFormat();
  const keys = useMemo(() => series.map((item) => item.key), [series]);
  const data = useMemo<StackedDatum[]>(
    () =>
      rows.map((row) => {
        const flat: Record<string, number> = {};
        for (const key of keys) flat[`${SEGMENT_PREFIX}${key}`] = Math.max(0, row.values[key] ?? 0);
        return { key: row.key, label: row.label, href: row.href, total: rowTotal(row.values, keys), values: row.values, ...flat };
      }),
    [rows, keys],
  );
  const height = stackedHeight(rows.length, rowHeight);
  return (
    <div className="min-w-0 space-y-2">
      <ChartLegend items={series.map((item) => ({ key: item.key, label: item.label, color: item.color }))} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid {...vozGrid} vertical horizontal={false} />
            <XAxis type="number" allowDecimals={false} tickFormatter={(value: number) => fmt.compact(value)} {...vozXAxis} />
            <YAxis
              type="category"
              dataKey="key"
              width={labelWidth}
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={(props: { x?: number; y?: number; payload?: { value: string } }) => (
                <StackedTick {...props} rows={data} maxLabel={maxLabel} onOpen={(href) => router.push(href)} />
              )}
            />
            <Tooltip
              cursor={BAR_CURSOR}
              content={({ active, payload }) => {
                const datum = payload?.[0]?.payload as StackedDatum | undefined;
                if (!active || !datum) return null;
                return (
                  <ChartTip
                    title={datum.label}
                    rows={series.map((item) => {
                      const value = Math.max(0, datum.values[item.key] ?? 0);
                      return { key: item.key, label: item.label, value: `${unit(value)} (${fmt.share(value, datum.total)})`, color: item.color };
                    })}
                  />
                );
              }}
            />
            {series.map((item) => (
              <Bar
                key={item.key}
                dataKey={`${SEGMENT_PREFIX}${item.key}`}
                stackId="stack"
                fill={item.color}
                stroke="hsl(var(--card))"
                strokeWidth={1}
                maxBarSize={18}
                isAnimationActive={false}
                shape={(props: unknown) => {
                  const { x = 0, y = 0, width = 0, height: barHeight = 0, payload } = props as {
                    x?: number;
                    y?: number;
                    width?: number;
                    height?: number;
                    payload?: StackedDatum;
                  };
                  if (width <= 0 || barHeight <= 0) return <g />;
                  const outer = payload ? outerSegmentKey(payload.values, keys) === item.key : false;
                  return (
                    <path
                      d={outer ? rightRoundedRect(x, y, width, barHeight, 4) : `M${x},${y}h${width}v${barHeight}h${-width}Z`}
                      fill={item.color}
                      stroke="hsl(var(--card))"
                      strokeWidth={1}
                    />
                  );
                }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export interface RingLegendRow extends VozSegment {
  href?: string;
}

export function CompositionRing({
  slices,
  legend,
  centerValue,
  centerLabel,
  size = 132,
  thickness = 12,
  layout = "side",
  legendColumns = 1,
  formatValue,
  className,
}: {
  slices: VozSegment[];
  legend?: RingLegendRow[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  thickness?: number;
  layout?: "side" | "stacked";
  legendColumns?: 1 | 2;
  formatValue: (v: number, pct: number) => string;
  className?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const drawn = slices.filter((slice) => slice.value > 0);
  const rows: RingLegendRow[] = legend ?? slices;
  const outer = size / 2 - 2;
  return (
    <div className={cn("flex min-w-0 gap-4", layout === "stacked" ? "flex-col items-center" : "flex-wrap items-center", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <PieChart width={size} height={size}>
          {drawn.length > 0 ? (
            <Pie data={drawn} dataKey="value" nameKey="label" cx="50%" cy="50%" startAngle={90} endAngle={-270} isAnimationActive={false} {...vozRing(outer, outer - thickness)} paddingAngle={drawn.length > 1 ? 2.5 : 0}>
              {drawn.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
          ) : (
            <Pie data={[{ value: 1 }]} dataKey="value" cx="50%" cy="50%" isAnimationActive={false} {...vozRing(outer, outer - thickness)} paddingAngle={0}>
              <Cell fill="hsl(var(--muted))" />
            </Pie>
          )}
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="readout font-display text-xl font-semibold leading-none text-foreground">{centerValue}</span>
          <span className="mt-1 max-w-[70%] truncate text-2xs text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <ul
        className={cn(
          "min-w-[9rem] gap-y-1.5",
          layout === "stacked" ? "w-full" : "flex-1",
          legendColumns === 2 ? "grid grid-cols-1 gap-x-5 sm:grid-cols-2" : "grid grid-cols-1",
        )}
      >
        {rows.map((row) => (
          <li key={row.key} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-xs">
            <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: row.color }} />
            {row.href ? (
              <Link
                href={row.href}
                title={row.label}
                className="truncate rounded-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {row.label}
              </Link>
            ) : (
              <span className="truncate text-muted-foreground" title={row.label}>
                {row.label}
              </span>
            )}
            <span className="readout font-semibold tabular-nums text-foreground">{formatValue(row.value, total > 0 ? (row.value / total) * 100 : 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface RankedRow {
  key: string;
  label: string;
  value: number;
  display: string;
  href?: string;
  hint?: string;
  dot?: string;
  color?: string;
  badge?: ReactNode;
}

export function RankedList({
  rows,
  numbered,
  startRank = 1,
  emphasis = "first",
  emphasisKey,
  size = "sm",
  empty,
  className,
}: {
  rows: RankedRow[];
  numbered?: boolean;
  startRank?: number;
  emphasis?: "first" | "all" | "none";
  emphasisKey?: string;
  size?: VozBarSize;
  empty: { icon: ReactNode; message: string };
  className?: string;
}) {
  if (rows.length === 0) return <QuietEmpty icon={empty.icon} message={empty.message} />;
  const max = rows.reduce((top, row) => Math.max(top, row.value), 0);
  const emphasised = (row: RankedRow, index: number) => {
    if (emphasisKey) return row.key === emphasisKey;
    if (emphasis === "all") return true;
    if (emphasis === "first") return index === 0;
    return false;
  };
  return (
    <ol className={cn("space-y-2", className)}>
      {rows.map((row, index) => {
        const label = (
          <span className="truncate" title={row.label}>
            {row.label}
          </span>
        );
        return (
          <li key={row.key} className={cn("grid items-center gap-x-2", numbered ? "grid-cols-[1.25rem_minmax(0,1fr)]" : "grid-cols-1")}>
            {numbered ? <span className="readout row-span-2 self-start pt-px text-right text-2xs tabular-nums text-muted-foreground">{startRank + index}</span> : null}
            <div className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-2xs font-semibold text-muted-foreground">
                {row.dot ? <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: row.dot }} /> : null}
                {row.href ? (
                  <Link
                    href={row.href}
                    className="min-w-0 truncate rounded-sm text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {label}
                  </Link>
                ) : (
                  label
                )}
                {row.badge}
              </span>
              <span className="readout shrink-0 text-sm font-semibold tabular-nums text-foreground">{row.display}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Meter
                value={max > 0 ? (row.value / max) * 100 : 0}
                color={row.color ?? (emphasised(row, index) ? VOZ_SERIES[0] : GROUPS_CHART_COLOR.neutral)}
                size={size}
                label={row.label}
              />
              {row.hint ? <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">{row.hint}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
