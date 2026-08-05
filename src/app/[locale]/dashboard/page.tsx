"use client";

import {
  ArrowRight,
  ChartBar,
  ChatCircle,
  Robot,
  Users,
  Wallet,
  WhatsappLogo,
} from "@/components/icons";
import type {
  AttendantStats,
  WindowStats,
} from "@/lib/attendance/types";
import {
  getAttendanceStatsAction,
  getWindowStatsAction,
} from "@/app/actions/attendance";
import { useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Link from "next/link";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";
import { listWhatsAppCampaignsAction } from "@/app/actions/whatsapp-campaigns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
    },
  },
};


const STATUS_LABELS: Record<string, string> = {
  RUNNING: "Em execução",
  PAUSED: "Pausada",
  STOPPED: "Parada",
  COMPLETED: "Concluída",
};

/**
 * A campaign's state, as a lamp.
 *
 * Lit for the two states that mean the campaign is doing something, unlit for
 * the two that mean it stopped — with the word next to it, so the state never
 * rests on the pip alone.
 */
const STATUS_LAMP: Record<string, string | null> = {
  RUNNING: "var(--healthy)",
  COMPLETED: "var(--lamp)",
  PAUSED: null,
  STOPPED: null,
};

/**
 * One channel of the meter bridge.
 *
 * A console tells you the level before it tells you the number, so each meter
 * carries a scale track under its readout. The track only fills where a real
 * denominator exists — a count of open conversations has no ceiling, and
 * inventing one would be a lie drawn to scale. There it stays a plain rule.
 */
function Meter({
  legend,
  value,
  helper,
  level,
}: {
  legend: string;
  value: string;
  helper: string;
  level?: number | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="legend leading-[1.35] sm:truncate">{legend}</dt>
      <dd>
        <span className="readout mt-2.5 block text-[30px] font-semibold leading-none tracking-[-0.03em] text-foreground">
          {value}
        </span>
        <span aria-hidden className="mt-3.5 block h-[3px] w-full bg-border">
          {level != null ? (
            <span
              className="block h-full"
              style={{
                background: "hsl(var(--lamp))",
                width: `${Math.min(100, Math.max(0, level))}%`,
              }}
            />
          ) : null}
        </span>
        <span className="mt-2.5 block truncate text-[11px] text-muted-foreground">
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
          className="flex animate-pulse items-center gap-3 border-t border-border/50 py-3 first:border-t-0"
        >
          <span className="h-3 w-3 shrink-0 bg-border" />
          <span className="h-3 flex-1 bg-border" />
          <span className="h-3 w-16 shrink-0 bg-border" />
        </div>
      ))}
    </div>
  );
}

function UserDashboard() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { currentWorkspace, can, canAny, permissionsLoading } = useWorkspace();

  const [waCampaigns, setWaCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [attendants, setAttendants] = useState<AttendantStats[]>([]);
  const [windowStats, setWindowStats] = useState<WindowStats | null>(null);
  const [loading, setLoading] = useState(true);

  const canReadWaCampaigns =
    !permissionsLoading && canAny("whatsapp_campaigns");
  const canReadMembers = !permissionsLoading && can("members", "read");
  const canReadConversations = !permissionsLoading && canAny("conversations");
  const canReadPlans = !permissionsLoading && canAny("balance");

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
    }[] = [];

    if (canReadWaCampaigns) {
      list.push({
        legend: t("activeCampaigns"),
        value: String(runningWa.length).padStart(2, "0"),
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
      });
      list.push({
        legend: t("openWindows"),
        value: String(totalOpenWindows).padStart(2, "0"),
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
        <h2 className="text-[17px] font-semibold text-foreground">
          {t("noWorkspaceSelected")}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("noWorkspaceDescription")}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <motion.div variants={itemVariants}>
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
      </motion.div>

      {/*
        THE METER BRIDGE.

        Everything the operator checks before touching anything, on one strip:
        legend, level, figure. It replaces two rows of stat cards that between
        them nested three levels of border inside a fourth.
      */}
      {meters.length > 0 ? (
        <motion.section variants={itemVariants} className="well overflow-hidden">
          <header className="rule-engraved flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-muted px-4 py-2.5">
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span className="legend">{t("workspaceLegend")}</span>
              <span className="truncate text-sm font-semibold text-foreground">
                {currentWorkspace?.name ?? t("noWorkspaceSelected")}
              </span>
            </div>
            <span className="legend">{t("overview")}</span>
          </header>

          <dl className="grid grid-cols-2 lg:grid-cols-4">
            {meters.map((meter, index) => (
              <div
                key={meter.legend}
                className={cn(
                  "min-w-0 border-border px-4 py-4",
                  index % 2 === 1 && "border-l",
                  index >= 2 && "border-t",
                  index > 0 && "lg:border-l",
                  "lg:border-t-0",
                )}
              >
                <Meter {...meter} />
              </div>
            ))}
          </dl>
        </motion.section>
      ) : null}

      <motion.div
        variants={itemVariants}
        className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_296px]"
      >
        {/*
          THE LOG.

          Campaigns were cards holding cards: a bordered card per campaign, each
          containing two more bordered boxes for its two numbers. A log is rows,
          and rows let you read six campaigns' contact counts as one column.
        */}
        {canReadWaCampaigns ? (
          <section className="well overflow-hidden">
            <header className="rule-engraved flex items-center justify-between gap-3 bg-muted px-4 py-2.5">
              <div className="flex items-baseline gap-2.5">
                <p className="legend">{t("whatsappCampaigns")}</p>
                <span className="readout text-[11px] text-muted-foreground/60">
                  {String(waCampaigns.length).padStart(2, "0")}
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
                          className="border-t border-border/50 transition-colors hover:bg-muted"
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
                          <td className="max-w-[200px] truncate px-3 py-2.5 text-[12px] text-muted-foreground">
                            {campaign.templateName ?? t("log.noTemplate")}
                          </td>
                          <td className="readout px-3 py-2.5 text-right text-sm font-semibold text-foreground">
                            {formatNumber(campaign.metrics?.totalNumbers ?? 0)}
                          </td>
                          <td className="readout px-4 py-2.5 text-right text-[12px] text-muted-foreground">
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
                <p className="mt-1 text-[12px] text-muted-foreground">
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
            <header className="rule-engraved bg-muted px-4 py-2.5">
              <p className="legend">{t("quickActions.sectionTitle")}</p>
            </header>

            {quickActions.length > 0 ? (
              <ul>
                {quickActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <li
                      key={action.href}
                      className="border-t border-border/50 first:border-t-0"
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
                          <span className="block truncate text-[11px] text-muted-foreground">
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
              <p className="px-4 py-10 text-center text-[12px] text-muted-foreground">
                {t("noQuickActionsHint")}
              </p>
            )}
          </section>

          <section className="well overflow-hidden">
            <header className="rule-engraved bg-muted px-4 py-2.5">
              <p className="legend">{t("planBlock.legend")}</p>
            </header>
            <div className="px-4 py-4">
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
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
      </motion.div>
    </motion.div>
  );
}

export default function DashboardPage() {
  // Root dashboard is always the standard workspace overview for every role,
  // including platform admins. Admin financial view lives at /dashboard/admin.
  return <UserDashboard />;
}
