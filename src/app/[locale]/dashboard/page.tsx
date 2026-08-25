"use client";

import {
  ArrowRight,
  ChartBar,
  ChatCircle,
  CheckCircle,
  Clock,
  Hourglass,
  Pulse,
  Robot,
  Users,
  Wallet,
  WhatsappLogo,
} from "@/components/icons";
import type {
  AttendanceOverview,
  AttendantStats,
  WindowStats,
} from "@/lib/attendance/types";
import {
  getAttendanceOverviewAction,
  getAttendanceStatsAction,
  getWindowStatsAction,
} from "@/app/actions/attendance";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { vozRing } from "@/components/charts/vozko";
import { format, subDays } from "date-fns";
import { useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { GLYPH_PLATE } from "@/components/icons/glyph-plates";
import Link from "next/link";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";
import { listWhatsAppCampaignsAction } from "@/app/actions/whatsapp-campaigns";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";


const STATUS_LABELS: Record<string, string> = {
  RUNNING: "Em execução",
  PAUSED: "Pausada",
  STOPPED: "Parada",
  COMPLETED: "Concluída",
};

/**
 * A campaign's state, as a status dot.
 *
 * Lit for the two states that mean the campaign is doing something, unlit for
 * the two that mean it stopped — with the word next to it, so the state never
 * rests on the dot alone.
 *
 * `COMPLETED` used to draw `--lamp`, which is the brand hue. A finished
 * campaign is not an action to take, and spending the accent on it left the
 * strip with no colour that meant "this one wants you". It reads as settled
 * neutral now; only `RUNNING` earns a semantic colour.
 */
const STATUS_LAMP: Record<string, string | null> = {
  RUNNING: "var(--healthy)",
  COMPLETED: "var(--muted-foreground)",
  PAUSED: null,
  STOPPED: null,
};

/**
 * One workspace measure.
 *
 * Two things changed from the version this replaces, and both were reading
 * failures rather than taste.
 *
 * The track used to fill in `--lamp`, which resolves to the same value as
 * `--primary`. Every measure on the strip therefore rendered the same
 * saturated brand orange, so a response rate of 34% and one of 94% were the
 * same colour, and the accent — which is supposed to mean "commit" — was
 * spent four times before the operator touched anything. A rate now carries
 * its own semantic tone, and the brand hue is left to the actions.
 *
 * The track itself was a 3px hard-cornered bar: a VU meter drawn on a console
 * faceplate. It is a rounded 2px rule now, which is what a progress indicator
 * looks like in every system this product is measured against.
 *
 * A measure with no real denominator keeps an unfilled track. An open-window
 * count has no ceiling, and inventing one would be a lie drawn to scale.
 */
type MeterTone = "neutral" | "healthy" | "warning" | "critical";

const METER_TONE: Record<MeterTone, { fill: string; ink: string }> = {
  neutral: { fill: "bg-muted-foreground", ink: "text-foreground" },
  healthy: { fill: "bg-healthy", ink: "text-healthy-ink" },
  warning: { fill: "bg-warning", ink: "text-warning-ink" },
  critical: { fill: "bg-destructive", ink: "text-destructive-ink" },
};

/** A rate reads as a grade; a bare count has nothing to be graded against. */
function rateTone(level: number | null | undefined): MeterTone {
  if (level == null) return "neutral";
  if (level >= 75) return "healthy";
  if (level >= 40) return "warning";
  return "critical";
}

function Meter({
  legend,
  value,
  helper,
  level,
  tone = "neutral",
}: {
  legend: string;
  value: string;
  helper: string;
  level?: number | null;
  tone?: MeterTone;
}) {
  const t = METER_TONE[tone];

  return (
    <div className="min-w-0">
      <dt className="legend sm:truncate">{legend}</dt>
      <dd>
        {/* Tight to its label, generous before the track: the number belongs to
            the legend above it, not to the rule below it. */}
        <span
          className={cn(
            "readout font-display mt-1.5 block text-3xl font-semibold leading-none tracking-[-0.03em]",
            t.ink,
          )}
        >
          {value}
        </span>
        <span
          aria-hidden
          className="mt-4 block h-0.5 w-full overflow-hidden rounded-full bg-border"
        >
          {level != null ? (
            <span
              className={cn("block h-full rounded-full", t.fill)}
              style={{ width: `${Math.min(100, Math.max(0, level))}%` }}
            />
          ) : null}
        </span>
        <span className="mt-2 block truncate text-2xs text-muted-foreground">
          {helper}
        </span>
      </dd>
    </div>
  );
}

type QuickActionItem = {
  title: string;
  description: string;
  icon: typeof WhatsappLogo;
  href: string;
  /** Category ink for the glyph — colour on the mark, not a filled tile. */
  ink: string;
};

function LogSkeleton() {
  return (
    <div className="px-4 py-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3 border-t border-border py-3 first:border-t-0"
        >
          <span className="h-3 w-3 shrink-0 rounded-full bg-border" />
          <span className="h-3 flex-1 rounded-md bg-border" />
          <span className="h-3 w-16 shrink-0 rounded-md bg-border" />
        </div>
      ))}
    </div>
  );
}

/**
 * The 7-day attendance glance — the metrics page's own KPI vocabulary,
 * summarised on the landing screen. Reuses the `metricsOps` translations and
 * the product-wide glyph→plate colours so every figure here reads exactly the
 * way it reads on the full page it links to. Data is the overview the page
 * already fetches; nothing new is queried.
 */
function AttendanceGlance({
  overview,
  loading,
}: {
  overview: AttendanceOverview;
  loading: boolean;
}) {
  const t = useTranslations("dashboard");
  const tk = useTranslations("metricsOps.attendance.kpi");
  const st = useTranslations("metricsOps.attendance.status");
  const tl = useTranslations("metricsOps.attendance.labels");
  const tc = useTranslations("metricsOps.common");
  const locale = useLocale();
  const tag = locale === "pt" ? "pt-BR" : locale;

  const kpis = overview.kpis;
  const dist = overview.status_distribution;
  const num = (v: number | null | undefined) =>
    (v ?? 0).toLocaleString(tag);
  const mins = (v: number | null | undefined) =>
    v == null
      ? "—"
      : v < 1
        ? `${Math.round(v * 60)}s`
        : `${v.toLocaleString(tag, { maximumFractionDigits: 1 })} ${tc("minUnit")}`;

  const tiles = [
    {
      key: "finished",
      label: tk("finished"),
      value: num(kpis?.finished),
      icon: CheckCircle,
      plate: GLYPH_PLATE.CheckCircle,
    },
    {
      key: "ongoing",
      label: tk("ongoing"),
      value: num(kpis?.ongoing),
      icon: Pulse,
      plate: GLYPH_PLATE.Pulse,
    },
    {
      key: "pending",
      label: tk("pending"),
      value: num(kpis?.pending),
      icon: Hourglass,
      plate: GLYPH_PLATE.Hourglass,
    },
    {
      key: "new",
      label: tk("newContacts"),
      value: num(kpis?.new_contacts),
      icon: Users,
      plate: GLYPH_PLATE.Users,
    },
    {
      key: "tme",
      label: tk("avgWait"),
      value: mins(kpis?.avg_wait_mins ?? null),
      icon: Clock,
      plate: GLYPH_PLATE.Clock,
    },
  ];

  const total = dist?.total ?? 0;
  const slices =
    dist && total > 0
      ? [
          {
            key: "finished",
            name: st("finished"),
            value: dist.finished,
            color: "hsl(var(--healthy))",
          },
          {
            key: "ongoing",
            name: st("ongoing"),
            value: dist.ongoing,
            color: "hsl(var(--info))",
          },
          {
            key: "pending",
            name: st("pending"),
            value: dist.pending,
            color: "hsl(var(--warning))",
          },
        ].filter((s) => s.value > 0)
      : [];

  return (
    <section className="well overflow-hidden">
      <header className="rule-engraved flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="legend">{t("attendanceSection")}</span>
          <span className="truncate text-sm font-semibold text-foreground">
            {tl("last7d")}
          </span>
        </div>
        <Link
          href="/dashboard/attendance"
          className="legend text-primary-ink transition-colors hover:text-foreground"
        >
          {t("viewAll")}
        </Link>
      </header>

      <div
        className={cn(
          "grid gap-4 px-5 py-4",
          slices.length > 0 && "lg:grid-cols-[minmax(0,1fr)_240px]",
        )}
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {tiles.map((tile) => (
            <div
              key={tile.key}
              className="rounded-lg border border-border bg-card p-3 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius]",
                    tile.plate,
                  )}
                >
                  <tile.icon className="h-4 w-4" weight="fill" />
                </span>
                <p className="truncate text-2xs font-semibold text-muted-foreground">
                  {tile.label}
                </p>
              </div>
              <p className="readout font-display mt-2 truncate text-2xl font-semibold tracking-tight text-foreground">
                {loading ? "…" : tile.value}
              </p>
            </div>
          ))}
        </div>

        {slices.length > 0 ? (
          <div className="flex items-center gap-3">
            <div className="relative h-[132px] w-[132px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    {...vozRing(62, 50)}
                  >
                    {slices.map((s) => (
                      <Cell key={s.key} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0];
                      return (
                        <div className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
                          <span className="text-muted-foreground">
                            {String(p.name)}:{" "}
                          </span>
                          <span className="readout font-semibold text-foreground">
                            {num(Number(p.value))}
                          </span>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="readout font-display text-lg font-semibold leading-none text-foreground">
                  {num(total)}
                </span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {slices.map((s) => (
                <li
                  key={s.key}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="readout font-semibold text-foreground">
                    {num(s.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function UserDashboard() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { currentWorkspace, can, canAny, permissionsLoading } = useWorkspace();

  const [waCampaigns, setWaCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [attendants, setAttendants] = useState<AttendantStats[]>([]);
  const [windowStats, setWindowStats] = useState<WindowStats | null>(null);
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const canReadWaCampaigns =
    !permissionsLoading && canAny("whatsapp_campaigns");
  const canReadMembers = !permissionsLoading && can("members", "read");
  const canReadConversations = !permissionsLoading && canAny("conversations");
  const canReadPlans = !permissionsLoading && canAny("balance");
  const canReadAttendance = !permissionsLoading && can("attendance", "read");

  useEffect(() => {
    if (permissionsLoading) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const promises: Promise<void>[] = [];

      if (canReadWaCampaigns) {
        promises.push(
          listWhatsAppCampaignsAction(1, 500, "desc").then((r) => {
            if (!cancelled) setWaCampaigns(r.campaigns ?? []);
          }),
        );
      }
      if (canReadMembers) {
        promises.push(
          Promise.all([
            getAttendanceStatsAction(),
            getWindowStatsAction(),
          ]).then(([statsR, winR]) => {
            if (cancelled) return;
            setAttendants(statsR.attendants ?? []);
            setWindowStats(winR.stats ?? null);
          }),
        );
      }
      // The same 7-day overview the metrics page reads — the dashboard shows
      // the workspace's attendance shape out of the box instead of sending the
      // operator to a second screen for their first read of the day.
      if (canReadAttendance) {
        promises.push(
          getAttendanceOverviewAction({
            dateFrom: format(subDays(new Date(), 6), "yyyy-MM-dd"),
            dateTo: format(new Date(), "yyyy-MM-dd"),
          }).then((r) => {
            if (!cancelled && !r.error) setOverview(r.overview);
          }),
        );
      }

      await Promise.allSettled(promises);
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [
    permissionsLoading,
    canReadWaCampaigns,
    canReadMembers,
    canReadAttendance,
  ]);

  const runningWa = useMemo(
    () => waCampaigns.filter((c) => c.status === "RUNNING"),
    [waCampaigns],
  );
  const recentWa = useMemo(() => waCampaigns.slice(0, 6), [waCampaigns]);

  const aggregateRate = useMemo(() => {
    if (attendants.length === 0) return 0;
    const assigned = attendants.reduce((s, a) => s + a.assigned_count, 0);
    const responded = attendants.reduce((s, a) => s + a.responded_count, 0);
    if (assigned === 0) return 0;
    return Math.round((responded / assigned) * 100);
  }, [attendants]);

  const avgResponseTime = useMemo(() => {
    const valid = attendants.filter((a) => a.avg_response_time_mins > 0);
    if (valid.length === 0) return 0;
    return (
      Math.round(
        (valid.reduce((s, a) => s + a.avg_response_time_mins, 0) /
          valid.length) *
          10,
      ) / 10
    );
  }, [attendants]);

  const totalOpenWindows = windowStats?.total_open ?? 0;

  const formatNumber = (value: number) =>
    new Intl.NumberFormat(locale === "pt" ? "pt-BR" : locale).format(value);

  /**
   * The bridge reads four channels, and every one of them measures the
   * workspace. The old strip also metered "ações rápidas: 3" and "módulos
   * visíveis: 3" — the dashboard counting its own buttons and reporting it as
   * an operational figure.
   */
  const meters = useMemo(() => {
    const list: {
      legend: string;
      value: string;
      helper: string;
      level?: number | null;
      tone?: MeterTone;
    }[] = [];

    if (canReadWaCampaigns) {
      list.push({
        legend: t("activeCampaigns"),
        value: String(runningWa.length),
        helper:
          waCampaigns.length > 0
            ? t("ofTotalCampaigns", { total: waCampaigns.length })
            : t("noActiveNow"),
        level:
          waCampaigns.length > 0
            ? (runningWa.length / waCampaigns.length) * 100
            : null,
      });
    }

    if (canReadMembers) {
      list.push({
        legend: t("responseRate"),
        value: `${aggregateRate}%`,
        helper:
          attendants.length > 0
            ? t("attendantsCount", { count: attendants.length })
            : t("noConsolidatedAvg"),
        level: aggregateRate,
        // The only figure on the strip with a good and a bad direction.
        tone: attendants.length > 0 ? rateTone(aggregateRate) : "neutral",
      });
      list.push({
        legend: t("openWindows"),
        value: String(totalOpenWindows),
        helper: t("ongoingConversations"),
        level: null,
      });
      list.push({
        legend: t("avgResponseLabel"),
        value: avgResponseTime > 0 ? `${avgResponseTime} min` : "—",
        helper:
          avgResponseTime > 0
            ? t("avgResponsePerAttendant")
            : t("noConsolidatedAvg"),
        level: null,
      });
    }

    return list;
  }, [
    aggregateRate,
    attendants.length,
    avgResponseTime,
    canReadMembers,
    canReadWaCampaigns,
    runningWa.length,
    t,
    totalOpenWindows,
    waCampaigns.length,
  ]);

  const quickActions = useMemo(() => {
    const actions: QuickActionItem[] = [];

    if (canReadConversations) {
      actions.push({
        title: t("quickActions.liveChat.title"),
        description: t("quickActions.liveChat.description"),
        icon: ChatCircle,
        href: "/dashboard/live-chat",
        ink: "ink-2",
      });
    }
    if (can("whatsapp_campaigns", "create")) {
      actions.push({
        title: t("quickActions.newWhatsAppCampaign.title"),
        description: t("quickActions.newWhatsAppCampaign.description"),
        icon: WhatsappLogo,
        href: "/dashboard/whatsapp-campaigns/new",
        ink: "ink-1",
      });
    }
    if (can("agents", "create")) {
      actions.push({
        title: t("createAgent"),
        description: t("createAgentDescription"),
        icon: Robot,
        href: "/dashboard/agents/new",
        ink: "ink-3",
      });
    }
    return actions;
  }, [can, canReadConversations, t]);

  const formatDate = (s: string) => {
    try {
      return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale, {
        day: "2-digit",
        month: "short",
      }).format(new Date(s));
    } catch {
      return "-";
    }
  };

  if (!currentWorkspace && !permissionsLoading) {
    return (
      <div className="well mx-auto mt-8 max-w-2xl px-6 py-14 text-center">
        <Users
          className="mx-auto mb-4 h-10 w-10 text-muted-foreground"
          weight="duotone"
        />
        <h2 className="text-lg font-semibold text-foreground">
          {t("noWorkspaceSelected")}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("noWorkspaceDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <DashboardPageHeader
          actions={
            <>
              {canReadPlans ? (
                <Button
                  icon={<Wallet className="h-4 w-4" weight="fill" />}
                  iconVisible
                  link="/dashboard/plans"
                  newTab={false}
                  title={t("planBlock.action")}
                  variant="outline"
                />
              ) : null}
              {canReadConversations ? (
                <Button
                  icon={<ChatCircle className="h-4 w-4" weight="fill" />}
                  iconVisible
                  link="/dashboard/live-chat"
                  newTab={false}
                  title={t("openAttendance")}
                />
              ) : null}
            </>
          }
          badge={t("title")}
          description={
            currentWorkspace
              ? t("headerDescription", { workspace: currentWorkspace.name })
              : t("pageSubtitle")
          }
          icon={<ChartBar className="h-6 w-6" weight="fill" />}
        />
      </div>

      {/*
        THE METER BRIDGE.

        Everything the operator checks before touching anything, on one strip:
        legend, level, figure. It replaces two rows of stat cards that between
        them nested three levels of border inside a fourth.
      */}
      {meters.length > 0 ? (
        <section className="well overflow-hidden">
          <header className="rule-engraved flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3">
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span className="legend">{t("workspaceLegend")}</span>
              <span className="truncate text-sm font-semibold text-foreground">
                {currentWorkspace?.name ?? t("noWorkspaceSelected")}
              </span>
            </div>
            <span className="legend">{t("overview")}</span>
          </header>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-7 px-5 py-5 lg:grid-cols-4">
            {meters.map((meter) => (
              <div key={meter.legend} className="min-w-0">
                <Meter {...meter} />
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/*
        ATTENDANCE, OUT OF THE BOX.

        The same 7-day overview the metrics page charts, summarised where the
        operator lands: five colourful KPI tiles (the product-wide glyph→plate
        colours, so green means done here exactly as it does there) and the
        status donut with the slice total in its hole. The full page is one
        click away on the section header.
      */}
      {canReadAttendance && overview?.kpis ? (
        <AttendanceGlance overview={overview} loading={loading} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_296px]">
        {/*
          THE LOG.

          Campaigns were cards holding cards: a bordered card per campaign, each
          containing two more bordered boxes for its two numbers. A log is rows,
          and rows let you read six campaigns' contact counts as one column.
        */}
        {canReadWaCampaigns ? (
          <section className="well overflow-hidden">
            <header className="rule-engraved flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-baseline gap-2.5">
                <p className="legend">{t("whatsappCampaigns")}</p>
                <span className="readout text-2xs text-muted-foreground">
                  {waCampaigns.length}
                </span>
              </div>
              <Link
                href="/dashboard/whatsapp-campaigns"
                className="legend -my-2 flex min-h-[34px] items-center text-primary-ink transition-colors hover:text-foreground sm:my-0 sm:min-h-0"
              >
                {t("viewAll")}
              </Link>
            </header>

            {loading ? (
              <LogSkeleton />
            ) : recentWa.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <thead>
                    <tr className="rule-engraved">
                      <th className="legend px-4 py-2 font-semibold" scope="col">
                        {t("log.campaign")}
                      </th>
                      <th className="legend px-3 py-2 font-semibold" scope="col">
                        {t("log.template")}
                      </th>
                      <th
                        className="legend px-3 py-2 text-right font-semibold"
                        scope="col"
                      >
                        {t("log.contacts")}
                      </th>
                      <th
                        className="legend px-4 py-2 text-right font-semibold"
                        scope="col"
                      >
                        {t("log.created")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentWa.map((campaign) => {
                      const tone = STATUS_LAMP[campaign.status];

                      return (
                        <tr
                          key={campaign.id}
                          className="border-t border-border transition-colors hover:bg-muted"
                        >
                          <th
                            className="max-w-[220px] px-4 py-2.5 text-left font-normal"
                            scope="row"
                          >
                            <Link
                              className="flex items-center gap-2.5"
                              href={`/dashboard/whatsapp-campaigns/${campaign.id}`}
                            >
                              <span
                                aria-hidden
                                className={cn("lamp", !tone && "opacity-20")}
                                style={
                                  tone ? { background: `hsl(${tone})` } : undefined
                                }
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-foreground">
                                  {campaign.name}
                                </span>
                                <span className="legend mt-1 block">
                                  {STATUS_LABELS[campaign.status] ??
                                    campaign.status}
                                </span>
                              </span>
                            </Link>
                          </th>
                          <td className="max-w-[200px] truncate px-3 py-2.5 text-xs text-muted-foreground">
                            {campaign.templateName ?? t("log.noTemplate")}
                          </td>
                          <td className="readout px-3 py-2.5 text-right text-sm font-semibold text-foreground">
                            {formatNumber(campaign.metrics?.totalNumbers ?? 0)}
                          </td>
                          <td className="readout px-4 py-2.5 text-right text-xs text-muted-foreground">
                            {formatDate(campaign.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-14 text-center">
                <p className="text-sm font-semibold text-foreground">
                  {t("noCampaignsYet")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("log.emptyHint")}
                </p>
                {can("whatsapp_campaigns", "create") ? (
                  <Link
                    href="/dashboard/whatsapp-campaigns/new"
                    className="legend mt-2 inline-flex min-h-[34px] items-center gap-1.5 text-primary-ink transition-colors hover:text-foreground sm:mt-3 sm:min-h-0"
                  >
                    {t("log.emptyCta")}
                    <ArrowRight className="h-3 w-3" weight="bold" />
                  </Link>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        <div className="space-y-4">
          {/*
            THE PATCH PANEL. Destinations, as a list of labelled rows — not
            three same-size cards of icon plus heading plus body copy.
          */}
          <section className="well h-fit overflow-hidden">
            <header className="rule-engraved px-4 py-2.5">
              <p className="legend">{t("quickActions.sectionTitle")}</p>
            </header>

            {quickActions.length > 0 ? (
              <ul>
                {quickActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <li
                      key={action.href}
                      className="border-t border-border first:border-t-0"
                    >
                      <Link
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
                        href={action.href}
                      >
                        <Icon
                          className={cn("h-4 w-4 shrink-0", action.ink)}
                          weight="fill"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {action.title}
                          </span>
                          <span className="block truncate text-2xs text-muted-foreground">
                            {action.description}
                          </span>
                        </span>
                        <ArrowRight
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          weight="bold"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                {t("noQuickActionsHint")}
              </p>
            )}
          </section>

          <section className="well overflow-hidden">
            <header className="rule-engraved px-4 py-2.5">
              <p className="legend">{t("planBlock.legend")}</p>
            </header>
            <div className="px-4 py-4">
              <p className="text-base font-semibold tracking-[-0.01em] text-foreground">
                {t("planBlock.title")}
              </p>
              <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                {t("planBlock.description")}
              </p>
              {canReadPlans ? (
                <Button
                  className="mt-4 w-full"
                  icon={<Wallet className="h-4 w-4" weight="fill" />}
                  iconVisible
                  link="/dashboard/plans"
                  newTab={false}
                  title={t("planBlock.action")}
                  variant="outline"
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  // Root dashboard is always the standard workspace overview for every role,
  // including platform admins. Admin financial view lives at /dashboard/admin.
  return <UserDashboard />;
}
