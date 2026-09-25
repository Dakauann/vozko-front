"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  MetricKind,
  MetricProjection,
  OverviewBacklogXray,
  OverviewPeriod,
  OverviewQuality,
  OverviewRevenue,
  RevenueSourceRow,
  OverviewRework,
  OverviewStanding,
  OverviewTeamRanking,
  OverviewTrend,
  QualityRow,
  RankedMember,
  ReworkRow,
  TrendSeries,
  Verdict,
  XrayDimension,
} from "@/lib/attendance/types";

import {
  Meter,
  VozAreaGradient,
  vozGrid,
  vozLineMark,
  vozXAxis,
  vozYAxis,
} from "@/components/charts/vozko";
import { ShareRows } from "@/components/charts/share-rows";
import {
  ChartSkeleton,
  SectionNotice,
  Surface,
  UnavailableNote,
  type MetricsFmt,
} from "@/components/dashboard/attendance/primitives";
import {
  memberClassTone,
  toneColor,
  toneDotClass,
  toneTextClass,
  verdictTone,
} from "@/components/dashboard/attendance/verdict";
import { cn } from "@/lib/utils";

const XRAY_OTHER_KEY = "_other";
const XRAY_UNKNOWN_KEY = "_unknown";

const BAND_KEYS = new Set([
  "0_1d",
  "1_3d",
  "3_7d",
  "7_30d",
  "30d_plus",
  "under_1m",
  "1_6m",
  "6_12m",
  "12m_plus",
  "returning",
  "first_contact",
]);

function useExecutiveTranslations() {
  return {
    te: useTranslations("metricsOps.attendance.executive"),
    tc: useTranslations("metricsOps.common"),
  };
}

function formatMetricValue(
  fmt: MetricsFmt,
  kind: MetricKind,
  value: number | null | undefined,
  currency?: string,
): string {
  if (value === null || value === undefined) return fmt.na;
  switch (kind) {
    case "money":
      return fmt.money(value, currency);
    case "percent":
      return fmt.pct(value);
    case "minutes":
      return fmt.mins(value);
    default:
      return fmt.num(Math.round(value));
  }
}

function BlockUnavailable() {
  const { te } = useExecutiveTranslations();
  return <SectionNotice tone="warning" title={te("blockUnavailableTitle")} message={te("blockUnavailableBody")} />;
}

function VerdictDot({ verdict }: { verdict: Verdict | "" | undefined }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        toneDotClass(verdictTone(verdict)),
      )}
    />
  );
}

export function PeriodProgressStrip({
  period,
  standing,
  loading,
  fmt,
  onConfigureSchedule,
}: {
  period: OverviewPeriod | undefined;
  standing: OverviewStanding | undefined;
  loading: boolean;
  fmt: MetricsFmt;
  onConfigureSchedule?: () => void;
}) {
  const { te, tc } = useExecutiveTranslations();

  if (loading) return <ChartSkeleton height={72} />;
  if (!period) return <BlockUnavailable />;

  if (!period.available) {
    return (
      <SectionNotice
        tone="warning"
        title={te("periodUnavailableTitle")}
        message={te(`periodReason.${period.reason || "period_unavailable"}`)}
        action={onConfigureSchedule ? { label: te("configureSchedule"), onClick: onConfigureSchedule } : undefined}
      />
    );
  }

  const clusterTone =
    standing?.available && standing.cluster
      ? standing.cluster === "excellence" || standing.cluster === "on_track"
        ? "healthy"
        : standing.cluster === "improvement"
          ? "warning"
          : "destructive"
      : "muted";

  return (
    <Surface>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            {te("periodTitle")}
          </p>
          <p className="readout mt-0.5 text-sm font-semibold tabular-nums text-foreground">
            {te("daysDone", {
              done: fmt.num(period.open_days_done),
              total: fmt.num(period.open_days_total),
            })}
          </p>
        </div>

        <div className="min-w-[180px] flex-1">
          <Meter
            value={period.elapsed_pct}
            label={te("elapsedLabel", { pct: fmt.pct(period.elapsed_pct) })}
          />
          <p className="mt-1 text-2xs text-muted-foreground">
            {te("elapsedLabel", { pct: fmt.pct(period.elapsed_pct) })}
            {" · "}
            {te("daysLeft", { count: fmt.num(period.open_days_left) })}
          </p>
        </div>

        {standing ? (
          <div className="text-right">
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {te("clusterTitle")}
            </p>
            {standing.available && standing.cluster ? (
              <>
                <p
                  className={cn(
                    "readout mt-0.5 text-sm font-semibold",
                    toneTextClass(clusterTone),
                  )}
                >
                  {te(`cluster.${standing.cluster}`)}
                </p>
                <p className="text-2xs text-muted-foreground">
                  {te("onTrackOf", {
                    onTrack: fmt.num(standing.on_track),
                    total: fmt.num(standing.targets_set),
                  })}
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-2xs text-muted-foreground">
                {te("noTargetsSet")}
              </p>
            )}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-2xs text-muted-foreground">
        {te("timezoneNote", { timezone: period.timezone })}
        {" · "}
        {tc("period")}
      </p>
    </Surface>
  );
}

function PaceBar({ projection }: { projection: MetricProjection }) {
  const { te } = useExecutiveTranslations();
  const projected = projection.cumulative ? projection.projected : null;
  const scale = Math.max(projection.actual, projection.target ?? 0, projected ?? 0) * 1.08 || 1;
  const at = (value: number) => `${Math.min(100, Math.max(0, (value / scale) * 100))}%`;
  const color = toneColor(verdictTone(projection.verdict));

  return (
    <div className="relative mt-3 h-3 rounded-full bg-muted" role="img" aria-label={te("attainment")}>
      {projected !== null && projected > projection.actual ? (
        <div
          className="absolute inset-y-0 left-0 rounded-full opacity-35"
          style={{ width: at(projected), backgroundColor: color }}
        />
      ) : null}
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: at(projection.actual), backgroundColor: color }} />
      {projection.target !== null ? (
        <div
          className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: at(projection.target) }}
          title={te("target")}
        />
      ) : null}
    </div>
  );
}

function ProjectionCard({
  projection,
  fmt,
  currency,
}: {
  projection: MetricProjection;
  fmt: MetricsFmt;
  currency?: string;
}) {
  const { te } = useExecutiveTranslations();
  const tone = verdictTone(projection.verdict);
  const value = (v: number | null) => formatMetricValue(fmt, projection.kind, v, currency);
  const stats = [
    { key: "target", label: te("target"), value: value(projection.target) },
    ...(projection.cumulative
      ? [
          { key: "projected", label: te("projected"), value: value(projection.projected) },
          { key: "perOpenDay", label: te("perOpenDay"), value: value(projection.per_open_day) },
        ]
      : []),
    { key: "attainment", label: te("attainment"), value: fmt.pct(projection.attain_pct) },
  ];

  return (
    <Surface className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <p
          className="cursor-help text-2xs font-semibold uppercase tracking-wide text-muted-foreground"
          title={te(`metricHelp.${projection.metric_key}`)}
        >
          {te(`metric.${projection.metric_key}`)}
        </p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-[--radius] bg-muted px-2 py-0.5 text-2xs font-semibold",
            toneTextClass(tone),
          )}
        >
          <VerdictDot verdict={projection.verdict} />
          {te(`verdict.${projection.verdict}`)}
        </span>
      </div>

      <p className="readout mt-1 font-display text-3xl font-semibold tracking-tight tabular-nums text-foreground">
        {value(projection.actual)}
      </p>
      {projection.reason ? (
        <p className="text-2xs leading-snug text-muted-foreground">{te(`projectionReason.${projection.reason}`)}</p>
      ) : null}

      <PaceBar projection={projection} />

      <div className="mt-auto pt-3.5">
        <dl
          className={cn(
            "grid gap-px overflow-hidden rounded-[--radius] border border-border bg-border text-2xs",
            stats.length > 2 ? "grid-cols-4" : "grid-cols-2",
          )}
        >
          {stats.map((stat) => (
            <div key={stat.key} className="min-w-0 bg-card px-2 py-1.5">
              <dt className="truncate text-muted-foreground">{stat.label}</dt>
              <dd className="readout truncate text-sm font-semibold tabular-nums text-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Surface>
  );
}

export function ProjectionGrid({
  projections,
  loading,
  fmt,
  currency,
  onEditTargets,
}: {
  projections: MetricProjection[] | undefined;
  loading: boolean;
  fmt: MetricsFmt;
  currency?: string;
  onEditTargets?: () => void;
}) {
  const { te } = useExecutiveTranslations();

  const targeted = useMemo(
    () => (projections ?? []).filter((p) => p.target !== null),
    [projections],
  );

  if (loading) return <ChartSkeleton height={140} />;

  if (targeted.length === 0) {
    return (
      <SectionNotice
        title={te("noTargetsTitle")}
        message={te("noTargetsBody")}
        action={onEditTargets ? { label: te("setTargets"), onClick: onEditTargets } : undefined}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {targeted.map((projection) => (
        <ProjectionCard key={projection.metric_key} projection={projection} fmt={fmt} currency={currency} />
      ))}
    </div>
  );
}

function TrendChart({
  series,
  fmt,
  currency,
}: {
  series: TrendSeries;
  fmt: MetricsFmt;
  currency?: string;
}) {
  const { te } = useExecutiveTranslations();

  const data = useMemo(() => {
    const byBucket = new Map<
      string,
      { bucket: string; actual: number | null; projected: number | null }
    >();
    for (const point of series.points) {
      const existing = byBucket.get(point.bucket) ?? {
        bucket: point.bucket,
        actual: null,
        projected: null,
      };
      if (point.projected) {
        existing.projected = point.value;
      } else {
        existing.actual = point.value;
      }
      byBucket.set(point.bucket, existing);
    }
    return Array.from(byBucket.values());
  }, [series.points]);

  const label = te(`metric.${series.metric_key}`);
  const gradientId = `trend-${series.metric_key}`;

  return (
    <Surface>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="cursor-help text-2xs font-semibold uppercase tracking-wide text-muted-foreground"
            title={te(`metricHelp.${series.metric_key}`)}
          >
            {label}
          </p>
          {series.available && series.best_bucket ? (
            <p className="mt-0.5 text-2xs text-muted-foreground">
              {te("bestInWindow", {
                bucket: series.best_bucket,
                value: formatMetricValue(
                  fmt,
                  series.kind,
                  series.best_value ?? null,
                  currency,
                ),
                from: series.window_from ?? "",
                to: series.window_to ?? "",
              })}
            </p>
          ) : null}
        </div>
        {series.delta_pct !== null ? (
          <span
            className={cn(
              "readout text-2xs font-semibold tabular-nums",
              series.delta_pct >= 0
                ? series.direction === "lower"
                  ? "text-destructive-ink"
                  : "text-healthy-ink"
                : series.direction === "lower"
                  ? "text-healthy-ink"
                  : "text-destructive-ink",
            )}
            title={te("deltaHint")}
          >
            {series.delta_pct >= 0 ? "+" : ""}
            {fmt.pct(series.delta_pct)}
          </span>
        ) : null}
      </div>

      {!series.available ? (
        <UnavailableNote
          message={te(`trendReason.${series.reason || "no_closed_buckets"}`)}
        />
      ) : (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <VozAreaGradient id={gradientId} color="hsl(var(--chart-1))" />
              </defs>
              <CartesianGrid {...vozGrid} vertical={false} />
              <XAxis dataKey="bucket" {...vozXAxis} />
              <YAxis {...vozYAxis} width={52} />
              {series.best_value !== null && series.best_value !== undefined ? (
                <ReferenceLine
                  y={series.best_value}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                />
              ) : null}
              <Tooltip
                cursor={{
                  stroke: "hsl(var(--muted-foreground))",
                  strokeWidth: 1,
                  strokeDasharray: "3 3",
                }}
                content={({ active, payload, label: bucket }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                      <p className="mb-1 font-semibold text-foreground">
                        {String(bucket)}
                      </p>
                      {payload.map((entry) => (
                        <p key={String(entry.dataKey)} className="text-muted-foreground">
                          {entry.dataKey === "projected"
                            ? te("projected")
                            : te("actual")}
                          {": "}
                          <span className="font-medium text-foreground">
                            {formatMetricValue(
                              fmt,
                              series.kind,
                              typeof entry.value === "number" ? entry.value : null,
                              currency,
                            )}
                          </span>
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke="hsl(var(--chart-1))"
                fill={`url(#voz-fill-${gradientId})`}
                connectNulls
                isAnimationActive={false}
                {...vozLineMark}
              />
              <Area
                type="monotone"
                dataKey="projected"
                stroke="hsl(var(--chart-1))"
                strokeDasharray="4 3"
                fill="none"
                connectNulls
                isAnimationActive={false}
                {...vozLineMark}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Surface>
  );
}

export function TrendSection({
  trend,
  loading,
  fmt,
  currency,
}: {
  trend: OverviewTrend | undefined;
  loading: boolean;
  fmt: MetricsFmt;
  currency?: string;
}) {
  const { te } = useExecutiveTranslations();

  if (loading) return <ChartSkeleton height={200} />;
  if (!trend) return <BlockUnavailable />;

  if (!trend.available || trend.series.length === 0) {
    return (
      <SectionNotice
        title={te("trendUnavailableTitle")}
        message={te(`trendReason.${trend.reason || "trend_repository_unavailable"}`)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {trend.series.map((series) => (
          <TrendChart
            key={series.metric_key}
            series={series}
            fmt={fmt}
            currency={currency}
          />
        ))}
      </div>
      {trend.unbucketed > 0 ? (
        <p className="text-2xs text-muted-foreground">
          {te("unbucketed", { count: fmt.num(trend.unbucketed) })}
        </p>
      ) : null}
    </div>
  );
}

export function RevenueCard({
  revenue,
  loading,
  fmt,
}: {
  revenue: OverviewRevenue | undefined;
  loading: boolean;
  fmt: MetricsFmt;
}) {
  const { te } = useExecutiveTranslations();

  if (loading) return <ChartSkeleton height={160} />;
  if (!revenue) return <BlockUnavailable />;

  if (!revenue.available) {
    return (
      <SectionNotice
        tone="warning"
        title={te("revenueUnavailableTitle")}
        message={te(`revenueReason.${revenue.reason || "revenue_repository_unavailable"}`)}
      />
    );
  }

  if (revenue.currencies.length === 0) {
    return <SectionNotice title={te("noRevenueTitle")} message={te("noRevenueBody")} />;
  }

  return (
    <div className="space-y-3">
      {revenue.mixed_currencies ? (
        <p className="rounded-[--radius] bg-muted px-3 py-2 text-2xs text-muted-foreground">
          {te("mixedCurrencies")}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {revenue.currencies.map((row) => (
          <Surface key={row.currency}>
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {te("revenueIn", { currency: row.currency })}
            </p>
            <p className="readout mt-1 text-xl font-semibold tabular-nums text-foreground">
              {fmt.money(row.value_cents, row.currency)}
            </p>
            <dl className="mt-2 space-y-1 text-2xs">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">{te("wonCount")}</dt>
                <dd className="readout tabular-nums text-foreground">
                  {fmt.num(row.won_count)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">{te("avgTicket")}</dt>
                <dd className="readout tabular-nums text-foreground">
                  {fmt.money(row.avg_ticket_cents, row.currency)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">{te("perOpenDay")}</dt>
                <dd className="readout tabular-nums text-foreground">
                  {fmt.money(row.per_open_day_cents, row.currency)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">{te("projected")}</dt>
                <dd className="readout tabular-nums text-foreground">
                  {fmt.money(row.projected_cents, row.currency)}
                </dd>
              </div>
              {row.prev_closed_cents !== null ? (
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">{te("prevClosed")}</dt>
                  <dd className="readout tabular-nums text-foreground">
                    {fmt.money(row.prev_closed_cents, row.currency)}
                    {row.delta_pct !== null ? (
                      <span
                        className={cn(
                          "ml-1",
                          row.delta_pct >= 0
                            ? "text-healthy-ink"
                            : "text-destructive-ink",
                        )}
                      >
                        {row.delta_pct >= 0 ? "+" : ""}
                        {fmt.pct(row.delta_pct)}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
            <RevenueSources
              rows={revenue.by_source.filter((source) => source.currency === row.currency)}
              fmt={fmt}
            />
          </Surface>
        ))}
      </div>

      {revenue.won_without_value > 0 ? (
        <p className="rounded-[--radius] bg-muted px-3 py-2 text-2xs text-muted-foreground">
          {te("wonWithoutValue", { count: fmt.num(revenue.won_without_value) })}
        </p>
      ) : null}

      {revenue.unattributed > 0 || revenue.unowned_count > 0 ? (
        <p className="text-2xs text-muted-foreground">
          {revenue.unattributed > 0
            ? te("unattributed", { count: fmt.num(revenue.unattributed) })
            : ""}
          {revenue.unattributed > 0 && revenue.unowned_count > 0 ? " · " : ""}
          {revenue.unowned_count > 0
            ? te("unowned", { count: fmt.num(revenue.unowned_count) })
            : ""}
        </p>
      ) : null}
    </div>
  );
}

function RevenueSources({ rows, fmt }: { rows: RevenueSourceRow[]; fmt: MetricsFmt }) {
  const { te } = useExecutiveTranslations();
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + row.value_cents, 0);

  return (
    <div className="mt-3 space-y-1.5 border-t border-border pt-2">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {te("bySource")}
      </p>
      {rows.map((row) => (
        <div key={row.source} className="space-y-0.5">
          <div className="flex items-baseline justify-between gap-2 text-2xs">
            <span className="text-muted-foreground">
              {te(`revenueSource.${row.source}`)} · {fmt.num(row.won_count)}
            </span>
            <span className="readout tabular-nums text-foreground">
              {fmt.money(row.value_cents, row.currency)}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${total > 0 ? (row.value_cents / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function XrayDimensionCard({
  dimension,
  fmt,
  labelFor,
}: {
  dimension: XrayDimension;
  fmt: MetricsFmt;
  labelFor?: (key: string, fallback: string) => string;
}) {
  const { te } = useExecutiveTranslations();

  return (
    <Surface>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          {te(`dimension.${dimension.dimension}`)}
        </p>
        <span
          className="readout cursor-help text-2xs tabular-nums text-muted-foreground underline decoration-dotted underline-offset-2"
          title={te("measuredHint")}
        >
          {te("measured", { count: fmt.num(dimension.measured) })}
        </span>
      </div>
      <p
        className="mb-3 truncate text-2xs text-muted-foreground"
        title={te(`dimensionHelp.${dimension.dimension}`)}
      >
        {te(`dimensionHelp.${dimension.dimension}`)}
      </p>

      {!dimension.available ? (
        <UnavailableNote
          message={te(`xrayReason.${dimension.reason || "no_coverage"}`)}
          className="py-2"
        />
      ) : (
        <ShareRows
          formatValue={fmt.num}
          formatShare={fmt.pct}
          rows={dimension.buckets.map((bucket) => {
            const fallback = bucket.label || bucket.key;
            return {
              key: bucket.key,
              label: labelFor ? labelFor(bucket.key, fallback) : fallback,
              value: bucket.count,
              share: bucket.pct,
            };
          })}
        />
      )}

      {dimension.unknown > 0 ? (
        <p className="mt-2 text-2xs text-muted-foreground">
          {te("unknownCount", { count: fmt.num(dimension.unknown) })}
        </p>
      ) : null}
    </Surface>
  );
}

export function BacklogXraySection({
  backlog,
  loading,
  fmt,
  channelLabel,
  showTotal = true,
}: {
  backlog: OverviewBacklogXray | undefined;
  loading: boolean;
  fmt: MetricsFmt;
  channelLabel: (channel: string) => string;
  showTotal?: boolean;
}) {
  const { te } = useExecutiveTranslations();

  if (loading) return <ChartSkeleton height={220} />;
  if (!backlog) return <BlockUnavailable />;

  if (!backlog.available) {
    return (
      <SectionNotice
        title={te("backlogUnavailableTitle")}
        message={te(`xrayReason.${backlog.reason || "no_backlog"}`)}
      />
    );
  }

  const bandLabel = (key: string, fallback: string) => {
    if (key === XRAY_OTHER_KEY) return te("otherBucket");
    if (key === XRAY_UNKNOWN_KEY) return te("unknownBucket");
    if (!BAND_KEYS.has(key)) return fallback;
    return te(`band.${key}`);
  };

  const entityLabel = (key: string, fallback: string) => {
    if (key === XRAY_OTHER_KEY) return te("otherBucket");
    if (key === XRAY_UNKNOWN_KEY) return te("unknownBucket");
    return fallback;
  };

  return (
    <div className="space-y-3">
      {showTotal ? (
        <p className="text-2xs text-muted-foreground">
          {te("backlogTotal", { count: fmt.num(backlog.total) })}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <XrayDimensionCard dimension={backlog.origin} fmt={fmt} labelFor={entityLabel} />
        <XrayDimensionCard dimension={backlog.assignee} fmt={fmt} labelFor={entityLabel} />
        <XrayDimensionCard dimension={backlog.age} fmt={fmt} labelFor={bandLabel} />
        <XrayDimensionCard dimension={backlog.tenure} fmt={fmt} labelFor={bandLabel} />
        <XrayDimensionCard dimension={backlog.returning} fmt={fmt} labelFor={bandLabel} />

        <Surface>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {te("recordCompleteness")}
            </p>
            <span
              className="readout cursor-help text-2xs tabular-nums text-muted-foreground underline decoration-dotted underline-offset-2"
              title={te("measuredHint")}
            >
              {te("measured", {
                count: fmt.num(backlog.record_completeness.measured),
              })}
            </span>
          </div>
          <p className="mb-3 truncate text-2xs text-muted-foreground" title={te("recordCompletenessHelp")}>
            {te("recordCompletenessHelp")}
          </p>
          {!backlog.record_completeness.available ? (
            <UnavailableNote
              message={te(
                `xrayReason.${backlog.record_completeness.reason || "no_coverage"}`,
              )}
              className="py-2"
            />
          ) : (
            <>
              <div className="mb-2.5 flex items-baseline gap-2">
                <span className="readout font-display text-2xl font-semibold tabular-nums text-foreground">
                  {fmt.pct(backlog.record_completeness.avg_fill_pct)}
                </span>
                <span className="truncate text-2xs text-muted-foreground" title={te("recordFieldsHelp")}>
                  {te("recordFieldsHelp")}
                </span>
              </div>
              <ShareRows
                formatValue={fmt.num}
                formatShare={fmt.pct}
                rows={backlog.record_completeness.fields.map((field) => ({
                  key: field.key,
                  label: te(`recordField.${field.key}`),
                  value: field.filled,
                  share: field.pct,
                }))}
              />
            </>
          )}
        </Surface>
      </div>

      <Surface>
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          {te("reachability")}
        </p>
        <p className="mb-2 text-2xs text-muted-foreground">
          {te("reachabilityHint")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {backlog.reachability.map((row) => (
            <div
              key={row.channel}
              className="rounded-[--radius] bg-muted px-3 py-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xs font-semibold text-foreground">
                  {channelLabel(row.channel)}
                </span>
                <span className="readout text-2xs tabular-nums text-muted-foreground">
                  {te("measured", { count: fmt.num(row.measured) })}
                </span>
              </div>
              {!row.available ? (
                <p className="mt-1 text-2xs text-muted-foreground">
                  {te(`xrayReason.${row.reason || "no_window_model"}`)}
                </p>
              ) : (
                <>
                  <p className="readout mt-1 text-base font-semibold tabular-nums text-warning-ink">
                    {fmt.pct(row.closed_pct)}
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    {te("windowClosed", {
                      closed: fmt.num(row.window_closed),
                      open: fmt.num(row.window_open),
                    })}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}

function QualityRows({
  rows,
  fmt,
  muted,
  te,
}: {
  rows: QualityRow[];
  fmt: MetricsFmt;
  muted?: boolean;
  te: (key: string, values?: Record<string, string>) => string;
}) {
  return (
    <>
      {rows.map((row) => (
        <tr
          key={`${row.actor_kind}-${row.actor_id}`}
          className={cn("border-t border-border", muted && "text-muted-foreground")}
        >
          <td className="px-2 py-2">{row.display_name}</td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {fmt.num(row.closes)}
          </td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {fmt.num(row.captured)}
          </td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {fmt.num(row.durable)}
          </td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {fmt.pct(row.durable_pct)}
          </td>
          <td className="px-2 py-2 text-right">
            {row.verdict ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-2xs font-semibold",
                  toneTextClass(verdictTone(row.verdict)),
                )}
              >
                <VerdictDot verdict={row.verdict} />
                {te(`verdict.${row.verdict}`)}
              </span>
            ) : (
              <span className="text-2xs text-muted-foreground">
                {te("notScored")}
              </span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

export function QualitySection({
  quality,
  loading,
  fmt,
  onConfigure,
}: {
  quality: OverviewQuality | undefined;
  loading: boolean;
  fmt: MetricsFmt;
  onConfigure?: () => void;
}) {
  const { te } = useExecutiveTranslations();

  if (loading) return <ChartSkeleton height={220} />;
  if (!quality) return <BlockUnavailable />;

  if (!quality.available) {
    return (
      <SectionNotice
        tone="warning"
        title={te("qualityOffTitle")}
        message={[
          te(`qualityReason.${quality.reason || "outcome_capture_disabled"}`),
          quality.not_captured > 0 ? te("notCaptured", { count: fmt.num(quality.not_captured) }) : "",
        ]
          .filter(Boolean)
          .join(" ")}
        action={onConfigure ? { label: te("configureCapture"), onClick: onConfigure } : undefined}
      />
    );
  }

  return (
    <Surface>
      <p className="mb-2 text-2xs text-muted-foreground">
        {te("thresholdNote", { threshold: fmt.pct(quality.threshold) })}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">{te("operator")}</th>
              <th className="px-2 py-2 text-right">{te("closes")}</th>
              <th className="px-2 py-2 text-right" title={te("capturedHint")}>
                {te("captured")}
              </th>
              <th className="px-2 py-2 text-right">{te("durable")}</th>
              <th className="px-2 py-2 text-right">{te("durablePct")}</th>
              <th className="px-2 py-2 text-right">{te("riskAssessment")}</th>
            </tr>
          </thead>
          <tbody>
            <QualityRows rows={quality.rows} fmt={fmt} te={te} />
            {quality.adjacent.length > 0 ? (
              <Fragment>
                <tr className="border-t border-border bg-muted/40">
                  <td
                    colSpan={6}
                    className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {te("adjacents")}
                  </td>
                </tr>
                <QualityRows rows={quality.adjacent} fmt={fmt} muted te={te} />
              </Fragment>
            ) : null}
            <tr className="border-t-2 border-border font-semibold">
              <td className="px-2 py-2">{te("teamTotal")}</td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {fmt.num(quality.team.closes)}
              </td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {fmt.num(quality.team.captured)}
              </td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {fmt.num(quality.team.durable)}
              </td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {fmt.pct(quality.team.durable_pct)}
              </td>
              <td className="px-2 py-2 text-right">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-2xs font-semibold",
                    toneTextClass(verdictTone(quality.team.verdict)),
                  )}
                >
                  <VerdictDot verdict={quality.team.verdict} />
                  {te(`verdict.${quality.team.verdict || "insufficient_data"}`)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {quality.not_captured > 0 ? (
        <p className="mt-2 text-2xs text-muted-foreground">
          {te("notCaptured", { count: fmt.num(quality.not_captured) })}
        </p>
      ) : null}
    </Surface>
  );
}

function RankingRows({
  rows,
  fmt,
  muted,
  te,
  showClass,
}: {
  rows: RankedMember[];
  fmt: MetricsFmt;
  muted?: boolean;
  showClass: boolean;
  te: (key: string, values?: Record<string, string>) => string;
}) {
  return (
    <>
      {rows.map((row, index) => (
        <tr
          key={`${row.actor_kind}-${row.actor_id}`}
          className={cn("border-t border-border", muted && "text-muted-foreground")}
        >
          <td className="px-2 py-2 text-muted-foreground">{index + 1}</td>
          <td className="px-2 py-2">{row.display_name}</td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {fmt.num(row.resolved)}
          </td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {row.per_open_day === null ? fmt.na : fmt.rate(row.per_open_day, "")}
          </td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {row.per_online_hour === null
              ? fmt.na
              : fmt.rate(row.per_online_hour, te("perHourSuffix"))}
          </td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {row.revenue_cents === null
              ? fmt.na
              : fmt.money(row.revenue_cents, row.currency)}
          </td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {row.avg_ticket_cents === null
              ? fmt.na
              : fmt.money(row.avg_ticket_cents, row.currency)}
          </td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {row.avg_messages === null || row.avg_messages === undefined
              ? fmt.na
              : fmt.rate(row.avg_messages, "")}
          </td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {fmt.pct(row.pct_of_team_avg)}
          </td>
          {showClass ? (
            <td className="px-2 py-2 text-right">
              {row.class ? (
                <span
                  className={cn(
                    "text-2xs font-semibold uppercase tracking-wide",
                    toneTextClass(memberClassTone(row.class)),
                  )}
                >
                  {te(`memberClass.${row.class}`)}
                </span>
              ) : (
                <span className="text-2xs text-muted-foreground">
                  {te("notScored")}
                </span>
              )}
            </td>
          ) : (
            <td className="px-2 py-2" />
          )}
        </tr>
      ))}
    </>
  );
}

export function TeamRankingTable({
  ranking,
  loading,
  fmt,
  rankMetric,
  onRankMetricChange,
}: {
  ranking: OverviewTeamRanking | undefined;
  loading: boolean;
  fmt: MetricsFmt;
  rankMetric: string;
  onRankMetricChange: (value: string) => void;
}) {
  const { te } = useExecutiveTranslations();

  if (loading) return <ChartSkeleton height={260} />;
  if (!ranking) return <BlockUnavailable />;

  const options = ["resolved", "volume", "revenue_cents"];

  const header: ReactNode = (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-2xs text-muted-foreground">
        {te("rankedBy", { metric: te(`rankMetric.${ranking.rank_metric_key}`) })}
        {ranking.team_average !== null
          ? ` · ${te("teamAverage", { value: fmt.rate(ranking.team_average, "") })}`
          : ""}
        {` · ${te("minSample", { count: fmt.num(ranking.min_sample) })}`}
      </p>
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onRankMetricChange(option)}
            className={cn(
              "rounded-[--radius] px-2 py-1 text-2xs font-semibold",
              rankMetric === option
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {te(`rankMetric.${option}`)}
          </button>
        ))}
      </div>
    </div>
  );

  if (!ranking.available && ranking.members.length === 0) {
    return (
      <Surface>
        {header}
        <UnavailableNote
          message={te(`rankingReason.${ranking.reason || "no_team_rows"}`)}
        />
      </Surface>
    );
  }

  return (
    <Surface>
      {header}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">{te("operator")}</th>
              <th className="px-2 py-2 text-right">{te("resolvedCol")}</th>
              <th className="px-2 py-2 text-right" title={te("perDayHint")}>
                {te("perDayCol")}
              </th>
              <th className="px-2 py-2 text-right" title={te("perHourHint")}>
                {te("perHourCol")}
              </th>
              <th className="px-2 py-2 text-right">{te("revenueCol")}</th>
              <th className="px-2 py-2 text-right" title={te("avgTicketHint")}>
                {te("avgTicketCol")}
              </th>
              <th className="px-2 py-2 text-right" title={te("avgMessagesHint")}>
                {te("avgMessagesCol")}
              </th>
              <th className="px-2 py-2 text-right" title={te("pctOfAvgHint")}>
                {te("pctOfAvgCol")}
              </th>
              <th className="px-2 py-2 text-right">{te("classCol")}</th>
            </tr>
          </thead>
          <tbody>
            <RankingRows rows={ranking.members} fmt={fmt} te={te} showClass />
            <tr className="border-t-2 border-border font-semibold">
              <td className="px-2 py-2" />
              <td className="px-2 py-2">{te("teamTotal")}</td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {fmt.num(ranking.totals.resolved)}
              </td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {ranking.totals.per_open_day === null
                  ? fmt.na
                  : fmt.rate(ranking.totals.per_open_day, "")}
              </td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {ranking.totals.per_online_hour === null
                  ? fmt.na
                  : fmt.rate(ranking.totals.per_online_hour, te("perHourSuffix"))}
              </td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {ranking.totals.revenue_cents === null
                  ? fmt.na
                  : fmt.money(ranking.totals.revenue_cents, ranking.totals.currency)}
              </td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {ranking.totals.avg_ticket_cents === null
                  ? fmt.na
                  : fmt.money(
                      ranking.totals.avg_ticket_cents,
                      ranking.totals.currency,
                    )}
              </td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
              <td className="px-2 py-2" />
            </tr>

            {ranking.adjacent.length > 0 ? (
              <Fragment>
                <tr className="border-t border-border bg-muted/40">
                  <td
                    colSpan={10}
                    className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {te("adjacents")}
                  </td>
                </tr>
                <RankingRows
                  rows={ranking.adjacent}
                  fmt={fmt}
                  muted
                  te={te}
                  showClass={false}
                />
                <tr className="border-t border-border font-semibold text-muted-foreground">
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2">{te("adjacentTotal")}</td>
                  <td className="readout px-2 py-2 text-right tabular-nums">
                    {fmt.num(ranking.adjacent_totals.resolved)}
                  </td>
                  <td className="px-2 py-2" colSpan={7} />
                </tr>
              </Fragment>
            ) : null}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

export function verdictColorFor(verdict: Verdict | "" | undefined): string {
  return toneColor(verdictTone(verdict));
}

function ReworkRows({
  rows,
  fmt,
  muted,
  costAvailable,
  currency,
  te,
}: {
  rows: ReworkRow[];
  fmt: MetricsFmt;
  muted?: boolean;
  costAvailable: boolean;
  currency?: string;
  te: (key: string, values?: Record<string, string>) => string;
}) {
  return (
    <>
      {rows.map((row) => (
        <tr
          key={`${row.actor_kind}-${row.actor_id}`}
          className={cn("border-t border-border", muted && "text-muted-foreground")}
        >
          <td className="px-2 py-2">{row.display_name || te("unassignedRow")}</td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {fmt.num(row.finished)}
          </td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {fmt.num(row.reopened)}
          </td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {fmt.pct(row.reopen_rate)}
          </td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {fmt.num(row.templates)}
          </td>
          <td className="readout px-2 py-2 text-right tabular-nums">
            {costAvailable ? fmt.money(row.cost_micros / 10000, currency) : fmt.na}
          </td>
        </tr>
      ))}
    </>
  );
}

export function ReworkSection({
  rework,
  loading,
  fmt,
}: {
  rework: OverviewRework | undefined;
  loading: boolean;
  fmt: MetricsFmt;
}) {
  const { te } = useExecutiveTranslations();

  if (loading) return <ChartSkeleton height={200} />;
  if (!rework) return <BlockUnavailable />;

  if (!rework.available) {
    return (
      <Surface>
        <UnavailableNote
          message={te(`reworkReason.${rework.reason || "no_finished_closes"}`)}
        />
      </Surface>
    );
  }

  const hasUnassigned = rework.unassigned.finished > 0;

  return (
    <Surface>
      <p className="mb-2 text-2xs text-muted-foreground">{te("reworkHint")}</p>
      {!rework.cost_available ? (
        <p className="mb-2 rounded-[--radius] bg-muted px-3 py-2 text-2xs text-muted-foreground">
          {te(`reworkReason.${rework.cost_reason || "rework_cost_not_priced"}`)}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">{te("operator")}</th>
              <th className="px-2 py-2 text-right">{te("closes")}</th>
              <th className="px-2 py-2 text-right" title={te("reopenedHint")}>
                {te("reopenedCol")}
              </th>
              <th className="px-2 py-2 text-right">{te("reopenRateCol")}</th>
              <th className="px-2 py-2 text-right" title={te("reworkTemplatesHint")}>
                {te("reworkTemplatesCol")}
              </th>
              <th className="px-2 py-2 text-right" title={te("reworkCostHint")}>
                {te("reworkCostCol")}
              </th>
            </tr>
          </thead>
          <tbody>
            <ReworkRows
              rows={rework.rows}
              fmt={fmt}
              costAvailable={rework.cost_available}
              currency={rework.currency}
              te={te}
            />
            {hasUnassigned ? (
              <ReworkRows
                rows={[rework.unassigned]}
                fmt={fmt}
                muted
                costAvailable={rework.cost_available}
                currency={rework.currency}
                te={te}
              />
            ) : null}
            {rework.adjacent.length > 0 ? (
              <Fragment>
                <tr className="border-t border-border bg-muted/40">
                  <td
                    colSpan={6}
                    className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {te("adjacents")}
                  </td>
                </tr>
                <ReworkRows
                  rows={rework.adjacent}
                  fmt={fmt}
                  muted
                  costAvailable={rework.cost_available}
                  currency={rework.currency}
                  te={te}
                />
              </Fragment>
            ) : null}
            <tr className="border-t-2 border-border font-semibold">
              <td className="px-2 py-2">{te("teamTotal")}</td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {fmt.num(rework.team.finished)}
              </td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {fmt.num(rework.team.reopened)}
              </td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {fmt.pct(rework.team.reopen_rate)}
              </td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {fmt.num(rework.team.templates)}
              </td>
              <td className="readout px-2 py-2 text-right tabular-nums">
                {rework.cost_available
                  ? fmt.money(rework.team.cost_micros / 10000, rework.currency)
                  : fmt.na}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Surface>
  );
}
