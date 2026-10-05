"use client";

import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { useLocale, useTranslations } from "next-intl";

import {
  ChatsCircle,
  CheckCircle,
  Clock,
  Headset,
  Lightning,
  PlugsConnected,
} from "@/components/icons";
import { GLYPH_PLATE } from "@/components/icons/glyph-plates";
import { DataChart } from "@/components/charts/dense-charts";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import {
  ATTENDANCE_COLORS,
  ChartSkeleton,
  KpiGroup,
  PresenceBadge,
  SectionNotice,
  SectionTitle,
  StatLine,
  Surface,
  localeTagFor,
  useMetricsFmt,
  type KpiTile,
} from "@/components/dashboard/attendance/primitives";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { useMemberActivity } from "@/hooks/use-member-activity";
import { SectionError } from "@/lib/analytics/section-query";
import {
  MEMBER_ACTIVITY_OUT_OF_SCOPE,
  formatHoursMinutes,
  heatmapCells,
  receivedTotal,
  sessionBar,
  type MemberActivityDay,
  type MemberActivityReport,
  type MemberActivitySession,
  type MemberActivitySubject,
} from "@/lib/attendance/member-activity";
import { presetRange, type PeriodPreset } from "@/lib/attendance/period";
import { cn } from "@/lib/utils";

const HOUR_MARKS = [0, 6, 12, 18, 24];
const SUNDAY_UTC = Date.UTC(2023, 0, 1, 12);
const DAY_MS = 24 * 3_600_000;

interface MemberActivitySheetProps {
  subject: MemberActivitySubject | null;
  name?: string;
  presence?: string;
  onOpenChange: (open: boolean) => void;
}

export function MemberActivitySheet({ subject, name, presence, onOpenChange }: MemberActivitySheetProps) {
  const t = useTranslations("metricsOps.attendance.memberActivity");
  const tc = useTranslations("metricsOps.common");
  const [preset, setPreset] = useState<PeriodPreset>("7d");
  const period = useMemo(() => presetRange(preset), [preset]);
  const query = useMemberActivity(subject, period);
  const report = query.data;
  const outOfScope = query.error instanceof SectionError && query.error.status === MEMBER_ACTIVITY_OUT_OF_SCOPE;
  const title = subject?.mode === "self" ? t("myTitle") : (name ?? report?.work?.display_name ?? t("title"));
  const shownPresence = presence ?? report?.work?.presence;

  return (
    <ElevatedSheet open={subject !== null} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full overflow-y-auto sm:max-w-[760px]">
        <div className="flex flex-col gap-5 pb-6">
          <ElevatedSheetHeader>
            <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
              <div className="min-w-0">
                <ElevatedSheetTitle className="truncate">{title}</ElevatedSheetTitle>
                <ElevatedSheetDescription>
                  {report ? t("timezone", { timezone: report.timezone }) : t("subtitle")}
                </ElevatedSheetDescription>
                {shownPresence ? (
                  <div className="mt-1.5">
                    <PresenceBadge presence={shownPresence} />
                  </div>
                ) : null}
              </div>
              <ElevatedPillToggle
                aria-label={tc("period")}
                value={preset}
                onChange={(value) => setPreset(value as PeriodPreset)}
                options={[
                  { value: "7d", label: tc("days7") },
                  { value: "30d", label: tc("days30") },
                  { value: "90d", label: tc("days90") },
                ]}
              />
            </div>
          </ElevatedSheetHeader>

          <div className="flex flex-col gap-4 px-6">
            {outOfScope ? (
              <SectionNotice tone="warning" title={t("outOfScope")} message={t("outOfScopeHint")} />
            ) : (
              <SectionState query={query}>
                {query.isPending || !report ? <ChartSkeleton height={320} /> : <ActivityBody report={report} />}
              </SectionState>
            )}
          </div>
        </div>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

function ActivityBody({ report }: { report: MemberActivityReport }) {
  const t = useTranslations("metricsOps.attendance.memberActivity");
  const fmt = useMetricsFmt();
  const minUnit = useTranslations("metricsOps.common")("minUnit");
  const received = receivedTotal(report.received);
  const work = report.work;

  const presenceTiles: KpiTile[] = [
    {
      key: "connected",
      label: t("kpi.connected"),
      short: t("kpi.connectedShort"),
      value: formatHoursMinutes(report.connected_ms, minUnit),
      hint: t("note"),
      icon: PlugsConnected,
      bg: GLYPH_PLATE.PlugsConnected,
    },
    {
      key: "onCall",
      label: t("kpi.onCall"),
      short: t("kpi.onCallShort"),
      value: formatHoursMinutes(report.on_call_ms, minUnit),
      hint: t("kpi.onCallShort"),
      icon: Headset,
      bg: GLYPH_PLATE.Pulse,
    },
    {
      key: "usualStart",
      label: t("kpi.usualStart"),
      short: t("kpi.usualStartShort"),
      value: report.usual_start ?? fmt.na,
      hint: t("kpi.usualStartShort"),
      icon: Clock,
      bg: GLYPH_PLATE.Clock,
    },
  ];

  const workTiles: KpiTile[] = [
    {
      key: "received",
      label: t("kpi.received"),
      short: t("kpi.receivedShort", { count: fmt.num(report.received_while_offline) }),
      value: fmt.num(received),
      hint: t("kpi.receivedHint"),
      icon: ChatsCircle,
      bg: report.received_while_offline > 0 ? "tile-fault" : GLYPH_PLATE.ChatsCircle,
    },
    {
      key: "resolved",
      label: t("kpi.resolved"),
      short: t("kpi.resolvedShort"),
      value: work ? fmt.num(work.resolved) : fmt.na,
      hint: t("kpi.resolvedShort"),
      icon: CheckCircle,
      bg: GLYPH_PLATE.CheckCircle,
    },
    {
      key: "frt",
      label: t("kpi.frt"),
      short: t("kpi.frtShort"),
      value: fmt.mins(work?.avg_response_mins ?? null),
      hint: t("kpi.frtShort"),
      icon: Lightning,
      bg: GLYPH_PLATE.Lightning,
    },
  ];

  return (
    <>
      <p className="rounded-[--radius] bg-muted px-3 py-2 text-xs text-muted-foreground">{t("note")}</p>
      <KpiGroup title={t("groups.presence")} cards={presenceTiles} loading={false} />
      <KpiGroup title={t("groups.work")} cards={workTiles} loading={false} />
      {report.received_while_offline > 0 ? (
        <SectionNotice
          tone="warning"
          title={t("offlineNotice.title", { count: fmt.num(report.received_while_offline) })}
          message={t("offlineNotice.message")}
        />
      ) : null}
      <Surface>
        <SectionTitle title={t("timeline.title")} subtitle={t("timeline.subtitle", { timezone: report.timezone })} />
        <DayTimeline days={report.days} timezone={report.timezone} />
      </Surface>
      <Surface>
        <SectionTitle title={t("heatmap.title")} subtitle={t("heatmap.subtitle")} />
        <WeekHeatmap grid={report.heatmap_minutes} />
      </Surface>
      {received > 0 ? (
        <Surface>
          <SectionTitle title={t("receivedBy")} />
          <ReceivedBreakdown received={report.received} />
        </Surface>
      ) : null}
    </>
  );
}

function DayTimeline({ days, timezone }: { days: MemberActivityDay[]; timezone: string }) {
  const t = useTranslations("metricsOps.attendance.memberActivity");
  const minUnit = useTranslations("metricsOps.common")("minUnit");
  const tag = localeTagFor(useLocale());
  const dayLabel = useMemo(
    () => new Intl.DateTimeFormat(tag, { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }),
    [tag],
  );

  if (days.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t("timeline.empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-end gap-2 text-2xs text-muted-foreground">
        <span />
        <div className="relative h-3">
          {HOUR_MARKS.map((hour) => (
            <span
              key={hour}
              className="absolute -translate-x-1/2 tabular-nums first:translate-x-0 last:-translate-x-full"
              style={{ left: `${(hour / 24) * 100}%` }}
            >
              {hour}h
            </span>
          ))}
        </div>
        <span className="text-right">{t("timeline.connected")}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {days.map((day) => (
          <DayRow
            key={day.date}
            day={day}
            timezone={timezone}
            label={dayLabel.format(new Date(`${day.date}T12:00:00Z`))}
            connected={formatHoursMinutes(day.connected_ms, minUnit)}
          />
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-2xs text-muted-foreground">
        <LegendSwatch color={ATTENDANCE_COLORS.signal} label={t("timeline.connected")} />
        <LegendSwatch color={ATTENDANCE_COLORS.ongoing} label={t("timeline.onCall")} />
      </div>
    </div>
  );
}

function DayRow({ day, timezone, label, connected }: { day: MemberActivityDay; timezone: string; label: string; connected: string }) {
  const t = useTranslations("metricsOps.attendance.memberActivity");
  const sessions = day.sessions ?? [];
  const flags = day.flags ?? [];
  const live = sessions.some((session) => session.open);

  return (
    <li className="flex flex-col gap-1">
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-center gap-2">
        <span className="truncate text-xs font-medium capitalize text-foreground">{label}</span>
        <div className="relative h-5 overflow-hidden rounded-[--radius] bg-muted" role="list" aria-label={label}>
          {HOUR_MARKS.slice(1, -1).map((hour) => (
            <span key={hour} aria-hidden className="absolute inset-y-0 w-px bg-border" style={{ left: `${(hour / 24) * 100}%` }} />
          ))}
          {sessions.map((session) => (
            <SessionSegment key={session.start} session={session} day={day.date} timezone={timezone} />
          ))}
        </div>
        <span className="readout text-right text-xs tabular-nums text-muted-foreground">{connected}</span>
      </div>
      {live || flags.length > 0 ? (
        <div className="ml-[6rem] flex flex-wrap gap-1">
          {live ? <Chip tone="healthy">{t("timeline.connectedNow")}</Chip> : null}
          {flags.map((flag) => (
            <Chip key={flag} tone={flag === "no_presence" ? "muted" : "warning"}>
              {t(`flags.${flag}`)}
            </Chip>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function SessionSegment({ session, day, timezone }: { session: MemberActivitySession; day: string; timezone: string }) {
  const t = useTranslations("metricsOps.attendance.memberActivity");
  const minUnit = useTranslations("metricsOps.common")("minUnit");
  const tag = localeTagFor(useLocale());
  const bar = sessionBar(session, day, timezone);
  const time = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  const dayTime = new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: timezone });
  const start = time.format(new Date(session.start));
  const span = session.open
    ? t("timeline.sessionOpen", { start })
    : t("timeline.session", { start, end: (bar.crossesMidnight ? dayTime : time).format(new Date(session.end)) });
  const tooltip =
    session.on_call_ms > 0 ? `${span} · ${t("timeline.sessionOnCall", { onCall: formatHoursMinutes(session.on_call_ms, minUnit) })}` : span;

  if (bar.widthPct <= 0) return null;

  return (
    <span
      role="listitem"
      title={tooltip}
      aria-label={tooltip}
      className={cn("absolute inset-y-0.5 overflow-hidden rounded-sm", session.open && "ring-2 ring-healthy ring-offset-1 ring-offset-muted")}
      style={{ left: `${bar.offsetPct}%`, width: `max(${bar.widthPct}%, 2px)`, backgroundColor: ATTENDANCE_COLORS.signal }}
    >
      {bar.onCallShare > 0 ? (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1.5"
          style={{ width: `${bar.onCallShare * 100}%`, backgroundColor: ATTENDANCE_COLORS.ongoing }}
        />
      ) : null}
    </span>
  );
}

function Chip({ tone, children }: { tone: "healthy" | "warning" | "muted"; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-[--radius] px-2 py-0.5 text-2xs font-semibold",
        tone === "healthy" && "bg-healthy/15 text-healthy-ink",
        tone === "warning" && "bg-warning/15 text-warning-ink",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function useWeekdayLabels(): string[] {
  const tag = localeTagFor(useLocale());
  return useMemo(() => {
    const format = new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, weekday) => format.format(new Date(SUNDAY_UTC + weekday * DAY_MS)));
  }, [tag]);
}

function WeekHeatmap({ grid }: { grid: number[][] }) {
  const t = useTranslations("metricsOps.attendance.memberActivity");
  const weekdays = useWeekdayLabels();
  const cells = useMemo(() => heatmapCells(grid), [grid]);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, hour) => String(hour)), []);

  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 8, top: 8, bottom: 20, containLabel: true },
      xAxis: { type: "category", data: hours, splitLine: { show: false }, axisTick: { show: false }, axisLine: { show: false } },
      yAxis: { type: "category", data: weekdays, inverse: true, splitLine: { show: false }, axisTick: { show: false }, axisLine: { show: false } },
      tooltip: {
        formatter: (params: unknown) => {
          const [hour, weekday, minutes] = (params as { value: [number, number, number] }).value;
          return t("heatmap.cell", { weekday: weekdays[weekday], hour, minutes });
        },
      },
      series: [
        {
          type: "scatter",
          symbol: "roundRect",
          symbolSize: [14, 14],
          data: cells.map((cell) => ({
            value: [cell.hour, cell.weekday, cell.minutes],
            itemStyle: {
              color: cell.minutes > 0 ? `hsl(var(--chart-1) / ${(0.15 + 0.85 * cell.intensity).toFixed(2)})` : "hsl(var(--muted))",
            },
          })),
        },
      ],
    }),
    [cells, hours, weekdays, t],
  );

  return (
    <DataChart
      option={option}
      label={t("heatmap.title")}
      height={220}
      columns={[t("heatmap.weekday"), t("heatmap.hour"), t("heatmap.minutes")]}
      rows={cells.filter((cell) => cell.minutes > 0).map((cell) => [weekdays[cell.weekday], `${cell.hour}h`, cell.minutes])}
    />
  );
}

function ReceivedBreakdown({ received }: { received: Record<string, number> }) {
  const tt = useTranslations("crmContactPanel.activity.details");
  const fmt = useMetricsFmt();
  const rows = Object.entries(received).sort((a, b) => b[1] - a[1]);
  return (
    <div className="divide-y divide-border">
      {rows.map(([trigger, count]) => (
        <StatLine key={trigger} label={tt.has(`trigger.${trigger}`) ? tt(`trigger.${trigger}`) : trigger} value={fmt.num(count)} />
      ))}
    </div>
  );
}
