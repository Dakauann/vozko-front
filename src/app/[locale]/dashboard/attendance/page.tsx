"use client";

import {
  ArrowClockwise,
  Buildings,
  ChartBar,
  ChartPie,
  CheckCircle,
  Clock,
  DownloadSimple,
  FlowArrow,
  Headset,
  Hourglass,
  Kanban,
  Lightning,
  PhoneIncoming,
  Pulse,
  Robot,
  Stack,
  Timer,
  TrendUp,
  UserCircle,
  UserMinus,
  Users,
  WhatsappLogo,
} from "@/components/icons";
import { GLYPH_PLATE } from "@/components/icons/glyph-plates";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  CompareBars,
  Meter,
  ProgressRing,
  SplitFlow,
  VOZ_SERIES,
  vozGrid,
  vozXAxis,
  vozYAxis,
} from "@/components/charts/vozko";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { format, subDays } from "date-fns";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";

import type {
  AttendanceOverview,
  ChannelSlice,
  DepartmentRow,
  MemberRow,
  OverviewAI,
  OverviewFinishedBySource,
  OverviewFRT,
  OverviewKPIs,
  OverviewLive,
  OverviewMessaging,
  OverviewOccupancy,
  OverviewQueue,
  OverviewReopen,
  OverviewStages,
  StageFunnelGroup,
  StatusDistribution,
} from "@/lib/attendance/types";
import { getAttendanceOverviewAction } from "@/app/actions/attendance";
import { listMembersAction } from "@/app/actions/workspace";
import { buildAttendanceOverviewCsv } from "@/lib/attendance/csv-export";
import { downloadCsv } from "@/lib/browser/download";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import { fetchDepartments } from "@/lib/department/client";
import type { Department } from "@/lib/department/types";
import type { WorkspaceMember } from "@/lib/workspace/types";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { cn } from "@/lib/utils";
import { ChannelTile, channelPlate } from "@/components/channels/channel-tile";
import { useWorkspace } from "@/contexts/workspace-context";
import { useLocale, useTranslations } from "next-intl";
import {
  BlockChart,
  GroupedBlockChart,
  RadialProfileChart,
} from "@/components/charts/composition-charts";
import { WaffleChart } from "@/components/charts/dense-charts";
import { TeamResponseChart } from "@/components/charts/team-response-chart";
import { entityColorIndex, share } from "@/lib/charts/data";

/* ── Chart colours ────────────────────────────────────────────────── */

/* Token-driven, not hex: the previous values were Tailwind-default hexes that
   ignored both the design system's validated series palette and dark mode
   entirely — a green from one system beside an indigo from another. Status
   encodings (finished / ongoing / pending) take the STATUS tokens, which is
   what they measure; volume takes the series tokens. Both re-resolve when the
   theme flips. */
const COLORS = {
  signal: "hsl(var(--chart-1))",
  finished: "hsl(var(--healthy))",
  ongoing: "hsl(var(--info))",
  pending: "hsl(var(--warning))",
  open: "hsl(var(--chart-4))",
  closeHuman: "hsl(var(--healthy))",
  closeAI: "hsl(var(--chart-5))",
  closeSystem: "hsl(var(--warning))",
} as const;

const LOCALE_TAG: Record<string, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
};

type DatePreset = "7d" | "30d" | "90d" | "custom";

/* ── Locale-aware formatters ─────────────────────────────────────── */

function useMetricsFmt() {
  const locale = useLocale();
  const tc = useTranslations("metricsOps.common");
  const tag = LOCALE_TAG[locale] ?? "en-US";
  const na = tc("na");
  const minUnit = tc("minUnit");
  const dayUnit = tc("dayUnit");
  return useMemo(
    () => ({
      na,
      num: (v: number | null | undefined) => {
        if (v === null || v === undefined) return "0";
        return v.toLocaleString(tag);
      },
      mins: (v: number | null | undefined) => {
        if (v === null || v === undefined) return na;
        if (v < 1) return `${Math.round(v * 60)}s`;
        return `${v.toLocaleString(tag, { maximumFractionDigits: 1 })} ${minUnit}`;
      },
      // Whole days below one, so "0,3d in this stage" reads as "arrived today"
      // rather than as a suspiciously precise fraction of a day.
      days: (v: number | null | undefined) => {
        if (v === null || v === undefined) return na;
        const digits = v < 10 ? 1 : 0;
        return `${v.toLocaleString(tag, { maximumFractionDigits: digits })}${dayUnit}`;
      },
      pct: (v: number | null | undefined) => {
        if (v === null || v === undefined) return na;
        return `${v.toLocaleString(tag, { maximumFractionDigits: 1 })}%`;
      },
    }),
    [tag, na, minUnit, dayUnit],
  );
}

function usePresenceLabel() {
  const tc = useTranslations("metricsOps.common");
  return useCallback(
    (p: string) => {
      if (p === "online") return tc("online");
      if (p === "on_call") return tc("onCall");
      return tc("offline");
    },
    [tc],
  );
}

function useActorKindLabel() {
  const tc = useTranslations("metricsOps.common");
  return useCallback(
    (kind: string) => (kind === "ai" ? tc("ai") : tc("human")),
    [tc],
  );
}

/* ── Shell pieces ─────────────────────────────────────────────────── */

function Surface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[--radius] border border-border bg-card p-3",
        className,
      )}
      style={{ boxShadow: softSurfaceShadow }}
    >
      {children}
    </section>
  );
}

function SectionTitle({
  icon,
  iconBg,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius]",
            iconBg,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function EmptyChart({
  icon,
  message,
  height = 220,
}: {
  icon: ReactNode;
  message: string;
  height?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-muted-foreground"
      style={{ height }}
    >
      <div className="mb-2 opacity-40">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-[--radius] bg-muted"
      style={{ height }}
      aria-hidden
    />
  );
}

/* ── KPI strip ────────────────────────────────────────────────────── */

type KpiDef = {
  key: string;
  label: string;
  short: string;
  value: string;
  hint: string;
  icon: typeof CheckCircle;
  bg: string;
  muted?: boolean;
  visual?: ReactNode;
};

function KpiStrip({
  kpis,
  loading,
  scoped,
}: {
  kpis: OverviewKPIs | undefined;
  loading: boolean;
  /**
   * Whether a CONVERSATION-scoped filter (department, member, channel or
   * campaign) is active.
   *
   * Only the new-leads tile reads it. Every other number here narrows with
   * those filters; that one counts CRM contacts, which carry no department,
   * assignee or channel until they have a conversation, so it deliberately
   * answers to the date range alone. Saying so ON the tile matters, because a
   * number that visibly refuses to move while its seven neighbours drop reads
   * as a bug, and the explanation was sitting in a hover title nobody opens.
   */
  scoped: boolean;
}) {
  const t = useTranslations("metricsOps.attendance.kpi");
  const tc = useTranslations("metricsOps.common");
  const fmt = useMetricsFmt();
  const cards: KpiDef[] = [
    {
      key: "finished",
      label: t("finished"),
      short: t("finishedShort"),
      value: loading ? tc("loading") : fmt.num(kpis?.finished),
      hint: t("finishedHint"),
      icon: CheckCircle,
      bg: GLYPH_PLATE.CheckCircle,
      visual: <ProgressRing value={share(kpis?.finished ?? 0, (kpis?.finished ?? 0) + (kpis?.ongoing ?? 0) + (kpis?.pending ?? 0))} label={t("finished")} size={34} strokeWidth={4} color={COLORS.finished}><span /></ProgressRing>,
    },
    {
      key: "ongoing",
      label: t("ongoing"),
      short: t("ongoingShort"),
      value: loading ? tc("loading") : fmt.num(kpis?.ongoing),
      hint: t("ongoingHint"),
      icon: Pulse,
      bg: GLYPH_PLATE.Pulse,
      visual: <ProgressRing value={share(kpis?.ongoing ?? 0, (kpis?.finished ?? 0) + (kpis?.ongoing ?? 0) + (kpis?.pending ?? 0))} label={t("ongoing")} size={34} strokeWidth={4} color={COLORS.ongoing}><span /></ProgressRing>,
    },
    {
      key: "pending",
      label: t("pending"),
      short: t("pendingShort"),
      value: loading ? tc("loading") : fmt.num(kpis?.pending),
      hint: t("pendingHint"),
      icon: Hourglass,
      bg: GLYPH_PLATE.Hourglass,
      visual: <ProgressRing value={share(kpis?.pending ?? 0, (kpis?.finished ?? 0) + (kpis?.ongoing ?? 0) + (kpis?.pending ?? 0))} label={t("pending")} size={34} strokeWidth={4} color={COLORS.pending}><span /></ProgressRing>,
    },
    {
      key: "unassigned",
      label: t("unassigned"),
      short: t("unassignedShort"),
      value: loading ? tc("loading") : fmt.num(kpis?.unassigned_backlog),
      hint: t("unassignedHint"),
      icon: UserMinus,
      bg: "tile-fault",
    },
    {
      key: "new",
      label: t("newLeads"),
      short: scoped ? t("newLeadsUnscoped") : t("newLeadsShort"),
      value: loading ? tc("loading") : fmt.num(kpis?.new_leads),
      hint: t("newLeadsHint"),
      icon: Users,
      bg: GLYPH_PLATE.Users,
    },
    {
      key: "tme",
      label: t("avgWait"),
      short: t("avgWaitShort"),
      value: loading ? tc("loading") : fmt.mins(kpis?.avg_wait_mins ?? null),
      hint: t("avgWaitHint"),
      icon: Clock,
      bg: GLYPH_PLATE.Clock,
    },
    {
      key: "tma",
      label: t("avgHandle"),
      short: t("avgHandleShort"),
      value: loading ? tc("loading") : fmt.mins(kpis?.avg_handle_mins ?? null),
      hint: t("avgHandleHint"),
      icon: Timer,
      bg: GLYPH_PLATE.Timer,
    },
    {
      key: "frt",
      label: t("frt"),
      short: t("frtShort"),
      value: loading ? tc("loading") : fmt.mins(kpis?.avg_frt_mins ?? null),
      hint: t("frtHint"),
      icon: Lightning,
      bg: GLYPH_PLATE.Lightning,
    },
  ];

  const shell = kpis?.shell_backlog ?? 0;
  const totalScoped = kpis?.total_scoped ?? 0;
  const entriesCreated = kpis?.entries_created ?? 0;

  return (
    <div className="space-y-2.5">
      {/* Eight operations KPIs as a colourful tile row. The instrument strip
          this replaces reported eight integers in one grey band — correct,
          and invisible. Each KPI now carries its glyph on its OWN plate from
          the product-wide glyph→plate table, so the colour is a learnable
          mark (green = done, amber = time, red = fault), the number is the
          biggest thing on the tile, and the whole row reads at a squint. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        {cards.map((c) => (
          <div
            key={c.key}
            title={c.hint}
            className="rounded-lg border border-border bg-card p-3 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius]",
                  c.bg,
                )}
              >
                <c.icon className="h-4 w-4" weight="fill" />
              </span>
              <p className="truncate text-2xs font-semibold text-muted-foreground">
                {c.label}
              </p>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-1">
            <p className="readout truncate font-display text-2xl font-semibold tracking-tight text-foreground">
              {c.value}
            </p>
            {!loading ? c.visual : null}
            </div>
            <p className="truncate text-2xs text-muted-foreground">{c.short}</p>
          </div>
        ))}
      </div>

      {/* Campaign shells: not real chats, kept out of primary KPIs */}
      {!loading && shell > 0 ? (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[--radius] border border-dashed border-border bg-muted px-3 py-2 text-xs text-muted-foreground"
          title={t("shellHint")}
        >
          <span className="font-semibold text-muted-foreground">
            {t("shellLabel")}
          </span>
          <span className="tabular-nums text-foreground">
            {fmt.num(shell)}{" "}
            <span className="font-normal text-muted-foreground">
              {t("shellShort")}
            </span>
          </span>
          {totalScoped > 0 ? (
            <span className="tabular-nums">
              {t("shellOfScoped", {
                shells: fmt.num(shell),
                total: fmt.num(totalScoped),
              })}
            </span>
          ) : null}
          {entriesCreated > 0 ? (
            <span className="tabular-nums">
              {t("entriesCreated", { count: fmt.num(entriesCreated) })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Brand colour per channel, for the share bar only.
 *
 * Not for the tile behind the glyph: one neutral ground with the identity in the
 * mark is the system rule, and a grid of saturated blocks is what it replaced.
 * The bar is a measurement, so colour there is carrying data rather than
 * decorating a container.
 */
const CHANNEL_BAR: Record<string, string> = {
  whatsapp: "#25d366",
  // Brand teal distinguishes the unofficial transport from WhatsApp green
  // and follows the dashboard's light and dark themes.
  unofficial_whatsapp: "hsl(var(--chart-1))",
  instagram: "#e1306c",
  telegram: "#229ed9",
  voice: "#8b5cf6",
};

/** Display name per channel, falling back to the key only for a channel we have
 * genuinely never heard of rather than for every one we simply forgot. */
function channelLabel(channel: string, tc: (key: string) => string): string {
  switch (channel) {
    case "whatsapp":
      return tc("whatsapp");
    case "unofficial_whatsapp":
      return tc("unofficialWhatsapp");
    case "instagram":
      return tc("instagram");
    case "telegram":
      return tc("telegram");
    case "voice":
      return tc("voice");
    default:
      return channel;
  }
}

/**
 * Channel composition: block area is conversation count, with stable channel
 * colours and exact counts/shares in the legend and accessible data table.
 */
function ChannelMixChart({
  mix,
  loading,
}: {
  mix: ChannelSlice[] | undefined;
  loading: boolean;
}) {
  const tc = useTranslations("metricsOps.common");
  const tl = useTranslations("metricsOps.attendance.labels");
  const data = useMemo(() => {
    if (!mix?.length) return [];
    return [...mix]
      .sort((a, b) => b.count - a.count)
      .map((c) => ({
        key: c.channel,
        // A ternary chain that ended in the RAW KEY, so every channel added
        // after WhatsApp and voice rendered "telegram" verbatim to the
        // operator on a muted tile carrying a telephone glyph.
        name: channelLabel(c.channel, tc),
        value: c.count,
        pct: c.pct,
        bar: CHANNEL_BAR[c.channel] ?? "hsl(var(--muted-foreground))",
      }));
  }, [mix, tc]);
  const blocks = useMemo(() => data.map((item) => ({ key: item.key, label: item.name, value: item.value, color: item.bar })), [data]);

  if (loading) return <ChartSkeleton height={180} />;
  if (!data.some((item) => item.value > 0)) return <EmptyChart icon={<ChartPie className="h-8 w-8" weight="fill" />} message={tl("noChannelMix")} height={180} />;
  return <BlockChart data={blocks} label={tl("channelTotalConversations")} height={160} />;
}

function SectionLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The operational blocks.
 *
 * These were fourteen bordered boxes each holding one number. That is not a
 * dashboard, it is a spreadsheet with rounded corners, and it broke the page
 * shapes rule this product already wrote down for itself: none of them draws a
 * box around a number. Four numbers in four boxes also cannot be COMPARED
 * without the reader doing the arithmetic, which is the one job a chart exists
 * to do for them.
 *
 * Every block below now picks its form from the job its data does:
 *
 *   first response   four magnitudes on one scale     -> CompareBars
 *   messages         two directions of one exchange   -> SplitFlow
 *   reopen           one ratio against its whole      -> Meter
 *   templates        one share, plus raw volume       -> Meter + readouts
 *   AI               one population split by outcome  -> WaffleChart
 */
function ExtendedOpsPanels({
  overview,
  loading,
}: {
  overview: AttendanceOverview | null;
  loading: boolean;
}) {
  const ts = useTranslations("metricsOps.attendance.sections");
  const tl = useTranslations("metricsOps.attendance.labels");
  const tc = useTranslations("metricsOps.common");
  const fmt = useMetricsFmt();
  const frt: OverviewFRT | undefined = overview?.frt;
  const ai: OverviewAI | undefined = overview?.ai;
  const msg: OverviewMessaging | undefined = overview?.messaging;
  const reopen: OverviewReopen | undefined = overview?.reopen;

  const templateShare = (() => {
    const templates = msg?.template_messages ?? 0;
    const outboundTotal = (msg?.avg_outbound ?? 0) * (msg?.conversations_with_messages ?? 0);
    if (!outboundTotal || !msg?.available) return null;
    return Math.min(100, (templates / outboundTotal) * 100);
  })();

  return (
    <div className="space-y-3">
      <div>
        <SectionLabel title={ts("times")} subtitle={ts("timesSub")} />
        <div className="grid gap-3 xl:grid-cols-12">
          <Surface className="xl:col-span-6">
            <SectionTitle
              icon={<Lightning className="h-4 w-4" weight="fill" />}
              iconBg={GLYPH_PLATE.Lightning}
              title={ts("frtTitle")}
              subtitle={ts("frtSub")}
            />
            {loading ? (
              <ChartSkeleton height={150} />
            ) : !frt?.available ? (
              <EmptyChart
                icon={<Lightning className="h-8 w-8" weight="fill" />}
                message={tl("noDataPeriod")}
                height={150}
              />
            ) : (
              /* Minutes on one shared scale, so "the AI answers in seconds and
                 people in minutes" is a shape rather than a subtraction. The
                 overall average is the emphasis; the rest is context. */
              <CompareBars
                emphasisKey="avg"
                rows={[
                  {
                    key: "avg",
                    label: tl("overallAvg"),
                    value: frt.avg_mins,
                    display: fmt.mins(frt.avg_mins),
                    hint: tl("basedOnSessions", { count: fmt.num(frt.sample_count) }),
                  },
                  {
                    key: "median",
                    label: tl("median"),
                    value: frt.median_mins,
                    display: fmt.mins(frt.median_mins),
                  },
                  {
                    key: "human",
                    label: tl("people"),
                    value: frt.human_avg_mins,
                    display: fmt.mins(frt.human_avg_mins),
                    hint: tl("sessionsCount", { count: fmt.num(frt.human_samples) }),
                    color: "hsl(var(--chart-2))",
                  },
                  {
                    key: "ai",
                    label: tc("ai"),
                    value: frt.ai_avg_mins,
                    display: fmt.mins(frt.ai_avg_mins),
                    hint: tl("sessionsCount", { count: fmt.num(frt.ai_samples) }),
                    color: "hsl(var(--chart-5))",
                  },
                ]}
              />
            )}
          </Surface>

          <Surface className="xl:col-span-3">
            <SectionTitle
              icon={<ChartBar className="h-4 w-4" weight="fill" />}
              iconBg={GLYPH_PLATE.ChartBar}
              title={ts("messages")}
              subtitle={ts("messagesSub")}
            />
            {loading ? (
              <ChartSkeleton height={130} />
            ) : !msg?.available ? (
              <EmptyChart
                icon={<ChartBar className="h-8 w-8" weight="fill" />}
                message={tl("noDataPeriod")}
                height={130}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xs font-semibold text-muted-foreground">
                    {tl("avgPerConversation")}
                  </span>
                  <span className="readout font-display text-xl font-semibold text-foreground">
                    {fmt.num(msg.avg_messages_per_conversation ?? 0)}
                  </span>
                </div>
                {/* Inbound and outbound are one exchange with a direction, so
                    they grow from a shared middle. Which way it leans is the
                    finding; two separate numbers hid it. */}
                <SplitFlow
                  left={{
                    label: tl("fromCustomer"),
                    value: msg.avg_inbound ?? 0,
                    display: fmt.num(msg.avg_inbound ?? 0),
                  }}
                  right={{
                    label: tl("fromTeam"),
                    value: msg.avg_outbound ?? 0,
                    display: fmt.num(msg.avg_outbound ?? 0),
                  }}
                />
                <p className="text-2xs text-muted-foreground">
                  {tl("conversationsWithMessages", {
                    count: fmt.num(msg.conversations_with_messages),
                  })}
                  {msg.avg_messages_all_scoped != null &&
                  msg.avg_messages_all_scoped !== msg.avg_messages_per_conversation
                    ? ` · ${tl("avgIncludingShells", {
                        avg: fmt.num(msg.avg_messages_all_scoped),
                      })}`
                    : ""}
                </p>
              </div>
            )}
          </Surface>

          <Surface className="xl:col-span-3">
            <SectionTitle
              icon={<Pulse className="h-4 w-4" weight="fill" />}
              iconBg={GLYPH_PLATE.Pulse}
              title={ts("reopen")}
              subtitle={ts("reopenSub")}
            />
            {loading ? (
              <ChartSkeleton height={130} />
            ) : !reopen?.available ? (
              <EmptyChart
                icon={<Pulse className="h-8 w-8" weight="fill" />}
                message={tl("noReopenHistory")}
                height={130}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xs font-semibold text-muted-foreground">
                    {tl("reopenPct")}
                  </span>
                  <span
                    className={cn(
                      "readout font-display text-xl font-semibold",
                      (reopen.reopen_rate ?? 0) >= 15
                        ? "text-warning-ink"
                        : "text-foreground",
                    )}
                  >
                    {reopen.reopen_rate != null ? fmt.pct(reopen.reopen_rate) : fmt.na}
                  </span>
                </div>
                {/* A ratio against its whole is a track, so the unreopened
                    remainder is visible rather than implied. */}
                <Meter
                  value={reopen.reopen_rate ?? 0}
                  color={
                    (reopen.reopen_rate ?? 0) >= 15
                      ? "hsl(var(--warning))"
                      : "hsl(var(--chart-1))"
                  }
                  size="lg"
                  label={tl("reopenPct")}
                />
                <p className="text-2xs text-muted-foreground">
                  {tl("reopenedOfFinished", {
                    reopened: fmt.num(reopen.reopened_count),
                    finished: fmt.num(reopen.finished_count ?? reopen.finished_event_count),
                  })}
                </p>
              </div>
            )}
          </Surface>
        </div>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-3">
      {/* Compact companion panels: templates, channel composition and AI outcomes. */}
      <div>
        <SectionLabel title={ts("templates")} subtitle={ts("templatesSub")} />
        <Surface>
          <SectionTitle
            icon={<WhatsappLogo className="h-4 w-4" weight="fill" />}
            iconBg={channelPlate("whatsapp")}
            title={ts("templatesTitle")}
            subtitle={ts("templatesTitleSub")}
          />
          {loading ? (
            <ChartSkeleton height={110} />
          ) : (
            <div className="grid gap-3">
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xs font-semibold text-muted-foreground">
                    {tl("templateShareOfOutbound")}
                  </span>
                  <span className="readout font-display text-xl font-semibold text-foreground">
                    {templateShare != null ? fmt.pct(templateShare) : fmt.na}
                  </span>
                </div>
                <Meter
                  value={templateShare ?? 0}
                  color="hsl(var(--chart-4))"
                  size="lg"
                  className="mt-2"
                  label={tl("templateShareOfOutbound")}
                />
                <p className="mt-1.5 text-2xs text-muted-foreground">
                  {tl("templateShareHint")}
                </p>
              </div>
              <div className="min-w-0">
                <CompareBars
                  rows={[
                    {
                      key: "sent",
                      label: tl("templatesSent"),
                      value: msg?.template_messages ?? 0,
                      display: fmt.num(msg?.template_messages ?? 0),
                      hint: tl("templatesSentHint"),
                      color: "hsl(var(--chart-4))",
                    },
                    {
                      key: "convs",
                      label: tl("conversationsWithTemplateLabel"),
                      value: msg?.conversations_with_template ?? 0,
                      display: fmt.num(msg?.conversations_with_template ?? 0),
                      color: "hsl(var(--chart-2))",
                    },
                  ]}
                />
                <p className="mt-2 text-2xs text-muted-foreground">
                  {tl("avgTemplate")}:{" "}
                  <strong className="readout tabular-nums text-foreground">
                    {msg?.avg_template != null ? fmt.num(msg.avg_template) : fmt.na}
                  </strong>{" "}
                  · {tl("avgTemplateHint")}
                </p>
              </div>
            </div>
          )}
        </Surface>
      </div>

      <div>
        <SectionLabel title={ts("channels")} subtitle={ts("channelsSub")} />
        <Surface>
          <SectionTitle
            icon={<ChartPie className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.ChartPie}
            title={ts("channelsUsed")}
            subtitle={ts("channelsUsedSub")}
          />
          <ChannelMixChart mix={overview?.channel_mix} loading={loading} />
        </Surface>
      </div>

      <div>
        <SectionLabel title={ts("ai")} subtitle={ts("aiSub")} />
        <Surface>
          <SectionTitle
            icon={<Robot className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.Robot}
            title={ts("aiTitle")}
            subtitle={ts("aiTitleSub")}
          />
          {loading ? (
            <ChartSkeleton height={110} />
          ) : !ai?.available ? (
            <EmptyChart
              icon={<Robot className="h-8 w-8" weight="fill" />}
              message={tl("noDataPeriod")}
              height={110}
            />
          ) : (
            <div className="grid gap-3">
              {/* One session population split by outcome; square allocation
                  is approximate, and the legend preserves exact counts. */}
              <div className="min-w-0">
                <WaffleChart
                  label={ts("aiTitle")}
                  data={[
                    {
                      key: "contained",
                      label: tl("resolvedByAi"),
                      value: ai.contained,
                      color: "hsl(var(--healthy))",
                    },
                    {
                      key: "handed",
                      label: tl("handedToHuman"),
                      value: ai.handed_off,
                      color: "hsl(var(--chart-2))",
                    },
                    {
                      key: "abandoned",
                      label: tl("aiAbandoned"),
                      value: ai.abandoned,
                      color: "hsl(var(--warning))",
                    },
                    {
                      key: "open",
                      label: tl("stillActive"),
                      value: ai.open_sessions,
                      color: "hsl(var(--muted-foreground) / 0.55)",
                    },
                  ]}
                />
                <p className="mt-2 text-2xs text-muted-foreground">
                  {tl("aiSessions")}:{" "}
                  <strong className="readout tabular-nums text-foreground">
                    {fmt.num(ai.sessions)}
                  </strong>
                </p>
              </div>
              {/* Rates retain the server's denominators and sample counts. */}
              <div className="min-w-0">
                <CompareBars
                  rows={[
                    {
                      key: "containment",
                      label: tl("aiContainmentRate"),
                      value: ai.containment_rate,
                      display: fmt.pct(ai.containment_rate),
                      hint: tl("withoutHuman", { count: fmt.num(ai.contained) }),
                      color: "hsl(var(--healthy))",
                    },
                    {
                      key: "handoff",
                      label: tl("aiHandoffRate"),
                      value: ai.handoff_rate,
                      display: fmt.pct(ai.handoff_rate),
                      hint: tl("transfers", { count: fmt.num(ai.handed_off) }),
                      color: "hsl(var(--chart-2))",
                    },
                  ]}
                />
              </div>
            </div>
          )}
        </Surface>
      </div>
      </div>
    </div>
  );
}

/* ── Charts ───────────────────────────────────────────────────────── */

function HourlyVolumeChart({
  hourly,
  loading,
}: {
  hourly: AttendanceOverview["hourly"] | undefined;
  loading: boolean;
}) {
  const tc = useTranslations("metricsOps.common");
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();
  const data = useMemo(
    () =>
      (hourly ?? Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))).map(
        (p) => ({
          label: `${String(p.hour).padStart(2, "0")}h`,
          conversas: p.count,
          hour: p.hour,
        }),
      ),
    [hourly],
  );
  const total = data.reduce((s, d) => s + d.conversas, 0);
  const peak = useMemo(() => {
    if (!total) return null;
    return data.reduce((best, d) =>
      d.conversas > best.conversas ? d : best,
    );
  }, [data, total]);

  const config: ChartConfig = {
    conversas: { label: tl("conversationsLabel"), color: COLORS.signal },
  };

  if (loading) return <ChartSkeleton height={240} />;
  if (total === 0) {
    return (
      <EmptyChart
        icon={<ChartBar className="h-9 w-9" weight="fill" />}
        message={tl("noConversationVolume")}
        height={240}
      />
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {tc("total")}:{" "}
          <strong className="tabular-nums text-foreground">{fmt.num(total)}</strong>
        </span>
        {peak ? (
          <span>
            {tc("peak")}:{" "}
            <strong className="tabular-nums text-foreground">
              {peak.label} ({fmt.num(peak.conversas)})
            </strong>
          </span>
        ) : null}
      </div>
      <ChartContainer config={config} className="h-[240px] w-full">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          {/* One hue, faded toward the baseline — sequential stays one hue.
              The peak hour flips to amber AND is named in the strip above, so
              the emphasis never rests on colour alone. */}
          <defs>
            <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" />
              <stop offset="100%" stopColor="hsl(var(--chart-1) / 0.45)" />
            </linearGradient>
          </defs>
          <CartesianGrid {...vozGrid} />
          <XAxis dataKey="label" interval={2} {...vozXAxis} />
          <YAxis allowDecimals={false} {...vozYAxis} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const h = payload?.[0]?.payload?.label;
                  return h ? tl("hourBand", { label: h }) : "";
                }}
                formatter={(value) => (
                  <span className="font-semibold tabular-nums">
                    {fmt.num(Number(value))} {tl("conversations")}
                  </span>
                )}
              />
            }
          />
          <Bar dataKey="conversas" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((d) => (
              <Cell
                key={d.hour}
                fill={
                  peak && d.hour === peak.hour
                    ? "hsl(var(--chart-3))"
                    : "url(#hourlyGrad)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

/** Compact close-source cell for tables (manual · IA · silence). Counts only. */
function CloseOriginCell({
  human,
  ai,
  system,
}: {
  human?: number;
  ai?: number;
  system?: number;
}) {
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();
  const h = human ?? 0;
  const a = ai ?? 0;
  const s = system ?? 0;
  if (h + a + s === 0) {
    return (
      <span className="text-xs tabular-nums text-muted-foreground">—</span>
    );
  }
  return (
    <div
      className="inline-flex flex-col items-end gap-0.5"
      title={tl("closeOriginTitle", {
        human: fmt.num(h),
        ai: fmt.num(a),
        system: fmt.num(s),
      })}
    >
      <span className="tabular-nums text-sm font-semibold text-foreground">
        {fmt.num(h)}
        <span className="mx-0.5 font-normal text-muted-foreground">/</span>
        {fmt.num(s)}
      </span>
      <span className="text-2xs leading-none text-muted-foreground">
        {tl("closeOriginHint")}
      </span>
      {a > 0 ? (
        <span className="text-2xs leading-none text-muted-foreground">
          {tl("closeOriginAi", { count: fmt.num(a) })}
        </span>
      ) : null}
    </div>
  );
}

function StatusCompositionChart({
  dist,
  bySource,
  loading,
}: {
  dist: StatusDistribution | undefined;
  bySource?: OverviewFinishedBySource | undefined;
  loading: boolean;
}) {
  const st = useTranslations("metricsOps.attendance.status");
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();
  const total = dist?.total ?? 0;
  const slices = useMemo(() => {
    if (!dist || total === 0) return [];
    /* Short names on purpose. The long forms are written for a table header
       and a tooltip; drawn around a ring they ran off both edges at phone
       width, and in the legend all three truncated to "Conversas …". */
    return [
      {
        key: "finished",
        name: st("finishedShort"),
        value: dist.finished,
        color: COLORS.finished,
      },
      {
        key: "ongoing",
        name: st("ongoingShort"),
        value: dist.ongoing,
        color: COLORS.ongoing,
      },
      {
        key: "pending",
        name: st("pendingShort"),
        value: dist.pending,
        color: COLORS.pending,
      },
    ].filter((s) => s.value > 0);
  }, [dist, total, st]);

  const resolutionRate =
    total > 0 && dist ? Math.round((dist.finished / total) * 1000) / 10 : null;

  /* The radial profile the audience screen uses, on the same three states.
     Distance from the centre is the share on an explicit common 0-100% axis,
     so the three are compared by LENGTH against a printed scale rather than by
     judging the angle of a wedge, which people read badly. The hole of the old
     donut carried the total; it now sits beside the chart as a real figure. */
  const profile = useMemo(
    () => slices.map((s) => ({ key: s.key, label: s.name, value: s.value, color: s.color })),
    [slices],
  );

  if (loading) return <ChartSkeleton height={240} />;
  if (!slices.length) {
    return (
      <EmptyChart
        icon={<ChartPie className="h-9 w-9" weight="fill" />}
        message={tl("noStatusData")}
        height={240}
      />
    );
  }

  return (
    <div className="grid min-h-[240px] grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(160px,0.95fr)]">
      {/* The audience screen's radial profile, on the same three states. The
          donut it replaces asked the reader to judge three angles; here each
          state is a bar from a common centre against a printed 0-100% scale,
          so they compare by length. The total the hole used to carry is the
          figure beside the chart, which is where a number belongs. */}
      <div className="min-w-0">
        <RadialProfileChart
          data={profile}
          total={total}
          label={tl("conversationsLabel")}
        />
        {/* Its own string. denseCharts.radialHint says "comentários
            analisados", which is the audience screen's subject, not this
            panel's. */}
        <p className="mt-1 text-2xs text-muted-foreground">{tl("statusRadialHint")}</p>
      </div>

      <div className="space-y-2.5">
        <div className="rounded-[--radius] border border-border bg-background px-3 py-2">
          <p className="text-2xs font-semibold text-muted-foreground">
            {tl("pctFinished")}
          </p>
          <p className="mt-0.5 font-display text-2xl font-semibold tabular-nums text-foreground">
            {fmt.pct(resolutionRate)}
          </p>
          <p className="text-2xs text-muted-foreground">
            {tl("ofConversations", {
              finished: fmt.num(dist?.finished),
              total: fmt.num(total),
            })}
          </p>
        </div>
        {/* The per-state counts and shares used to be repeated here as a bar
            list. RadialProfileChart carries its own legend with both, so this
            column keeps only what the chart does NOT say: the headline rate,
            and how the finished ones were closed. */}
        {!loading ? <OverallCloseOriginNote bySource={bySource} /> : null}
      </div>
    </div>
  );
}

/** Overall close origin, filter-scoped; pct from counts (never double-scale). */
function OverallCloseOriginNote({
  bySource,
}: {
  bySource: OverviewFinishedBySource | undefined;
}) {
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();
  if (!bySource?.available || !bySource.total) return null;
  const h = bySource.human ?? 0;
  const a = bySource.ai ?? 0;
  const s = bySource.system ?? 0;
  const sum = h + a + s || bySource.total;
  const pct = (n: number) =>
    sum > 0
      ? `${((n / sum) * 100).toLocaleString(undefined, {
          maximumFractionDigits: 1,
        })}%`
      : "0%";
  return (
    <div className="mt-3 rounded-[--radius] border border-border bg-background px-3 py-2.5">
      <p className="text-2xs font-semibold text-muted-foreground">
        {tl("closeOriginCol")}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 tabular-nums text-foreground">
          <span
            className="h-1.5 w-1.5 rounded-full bg-healthy"
            aria-hidden
          />
          {tl("closedByHuman")}:{" "}
          <strong className="font-semibold">{fmt.num(h)}</strong>
          <span className="text-muted-foreground">({pct(h)})</span>
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums text-foreground">
          <span
            className="h-1.5 w-1.5 rounded-full bg-warning"
            aria-hidden
          />
          {tl("closedBySilence")}:{" "}
          <strong className="font-semibold">{fmt.num(s)}</strong>
          <span className="text-muted-foreground">({pct(s)})</span>
        </span>
        {a > 0 ? (
          <span className="inline-flex items-center gap-1.5 tabular-nums text-foreground">
            <span
              className="h-1.5 w-1.5 rounded-full bg-muted"
              aria-hidden
            />
            {tl("closedByAI")}:{" "}
            <strong className="font-semibold">{fmt.num(a)}</strong>
            <span className="text-muted-foreground">({pct(a)})</span>
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-2xs text-muted-foreground">
        {tl("closeOriginOverallHint")}
      </p>
    </div>
  );
}

/**
 * Departments as blocks, sized by the work they carry.
 *
 * This was a horizontal stacked bar capped at eight rows. A treemap is the
 * right form for the question the panel actually asks — "who is carrying the
 * load" — because departments are NOMINAL: they have no order, so area is a
 * fairer encoding than a ranked axis, and a long tail of small departments
 * stays visible as small blocks instead of falling off the cap.
 *
 * The status split the stack used to carry is not lost: the detail table
 * beside this one prints finished / ongoing / waiting per department with
 * exact numbers, which is where a three-way breakdown is read anyway.
 *
 * Colour follows the DEPARTMENT, hashed from its id, so filtering the page
 * never repaints the survivors — a reader who learned "Cobrança is the indigo
 * one" keeps that.
 */
function DepartmentStackedChart({
  rows,
  loading,
}: {
  rows: DepartmentRow[] | undefined;
  loading: boolean;
}) {
  const tc = useTranslations("metricsOps.common");
  const tl = useTranslations("metricsOps.attendance.labels");
  const noDept = tc("noDepartment");

  const blocks = useMemo(() => {
    if (!rows?.length) return [];
    return [...rows]
      .map((r) => ({
        key: r.department_id || "__none",
        label: (r.department_name || "").trim() || noDept,
        value: r.finished + r.ongoing + r.pending,
        color: VOZ_SERIES[entityColorIndex(r.department_id || "__none")],
      }))
      .filter((b) => b.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [rows, noDept]);

  if (loading) return <ChartSkeleton height={260} />;
  if (!blocks.length) {
    return (
      <EmptyChart
        icon={<Buildings className="h-9 w-9" weight="fill" />}
        message={tl("noDepartmentsInSlice")}
        height={260}
      />
    );
  }

  return (
    <div>
      <BlockChart data={blocks} label={tc("department")} height={220} />
      <p className="mt-1 text-2xs text-muted-foreground">{tl("deptBlockHint")}</p>
    </div>
  );
}

function TeamChart({ rows, loading }: { rows: MemberRow[] | undefined; loading: boolean }) {
  const t = useTranslations("denseCharts");
  const [view, setView] = useState<"performance" | "load">("performance");
  const hasMeasured = rows?.some((row) => row.avg_response_mins !== null && row.resolved + row.open + row.pending > 0);
  if (loading) return <ChartSkeleton height={280} />;
  if (!hasMeasured) return <TeamResolutionChart rows={rows} loading={loading} />;
  return <div className="space-y-2">
    <ElevatedPillToggle aria-label={t("responseMap")} value={view} onChange={setView} options={[{ value: "performance", label: t("performance") }, { value: "load", label: t("load") }]} />
    {view === "performance" ? <TeamResponseChart rows={rows ?? []} /> : <TeamResolutionChart rows={rows} loading={loading} />}
  </div>;
}

function TeamResolutionChart({
  rows,
  loading,
}: {
  rows: MemberRow[] | undefined;
  loading: boolean;
}) {
  const st = useTranslations("metricsOps.attendance.status");
  const tc = useTranslations("metricsOps.common");
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();
  const actorKindLabel = useActorKindLabel();
  const resolvedLabel = tl("resolvedCol");
  const ongoingLabel = st("ongoing");
  const pendingLabel = st("pending");

  const data = useMemo(() => {
    if (!rows?.length) return [];
    return [...rows]
      .map((m) => ({
        name:
          m.display_name.length > 16
            ? `${m.display_name.slice(0, 14)}…`
            : m.display_name,
        fullName: m.display_name,
        resolvidas: m.resolved,
        em_andamento: m.open,
        aguardando: m.pending,
        total: m.resolved + m.open + m.pending,
        taxa: m.resolution_pct,
        tmr: m.avg_response_mins,
        kind: m.actor_kind,
      }))
      .sort((a, b) => b.resolvidas - a.resolvidas || b.taxa - a.taxa)
      .slice(0, 10);
  }, [rows]);

  if (loading) return <ChartSkeleton height={280} />;
  if (!data.length) {
    return (
      <EmptyChart
        icon={<Users className="h-9 w-9" weight="fill" />}
        message={tl("noAgentsLoad")}
        height={280}
      />
    );
  }

  const chartH = Math.max(220, data.length * 32 + 56);
  const legendH = 24;
  const margin = { top: 28, bottom: 4 };
  const plotH = chartH - legendH - margin.top - margin.bottom;
  const slotH = data.length > 0 ? plotH / data.length : 0;

  return (
    <div style={{ height: chartH }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 28, right: 44, left: 4, bottom: 4 }}
          barCategoryGap={6}
        >
          <CartesianGrid {...vozGrid} vertical horizontal={false} />
          <XAxis type="number" allowDecimals={false} {...vozXAxis} />
          <YAxis type="category" dataKey="name" {...vozYAxis} width={100} />
          <Tooltip
            cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as (typeof data)[0];
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                  <p className="mb-1 font-semibold text-foreground">
                    {row.fullName}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({actorKindLabel(row.kind)})
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {resolvedLabel}:{" "}
                    <span className="font-medium text-foreground">
                      {fmt.num(row.resolvidas)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {ongoingLabel}:{" "}
                    <span className="font-medium text-foreground">
                      {fmt.num(row.em_andamento)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {pendingLabel}:{" "}
                    <span className="font-medium text-foreground">
                      {fmt.num(row.aguardando)}
                    </span>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {tl("resolutionResponseHint", {
                      pct: fmt.pct(row.taxa),
                      time: fmt.mins(row.tmr),
                    })}
                  </p>
                </div>
              );
            }}
          />
          <Legend
            verticalAlign="top"
            align="left"
            height={24}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ paddingBottom: 4, display: "flex", gap: 12 }}
            formatter={(v) => (
              <span className="mr-4 text-2xs text-muted-foreground">{v}</span>
            )}
          />
          <Bar
            dataKey="resolvidas"
            name={resolvedLabel}
            stackId="t"
            fill={COLORS.finished}
            barSize={14}
          />
          <Bar
            dataKey="em_andamento"
            name={ongoingLabel}
            stackId="t"
            fill={COLORS.open}
            barSize={14}
          />
          <Bar
            dataKey="aguardando"
            name={pendingLabel}
            stackId="t"
            fill={COLORS.pending}
            radius={[0, 4, 4, 0]}
            barSize={14}
          />
        </BarChart>
      </ResponsiveContainer>
      <div
        className="pointer-events-none absolute top-0 right-0 flex flex-col items-end"
        style={{ height: chartH, paddingTop: legendH + margin.top, paddingBottom: margin.bottom }}
      >
        {data.map((d, i) => (
          <div
            key={`total-${d.fullName}`}
            className="flex items-center justify-end pr-1 text-2xs font-semibold tabular-nums text-foreground"
            style={{ height: slotH }}
          >
            {fmt.num(d.total)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tables ───────────────────────────────────────────────────────── */

function DepartmentDetailTable({
  rows,
  loading,
}: {
  rows: DepartmentRow[] | undefined;
  loading: boolean;
}) {
  const tc = useTranslations("metricsOps.common");
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();

  if (loading) return <ChartSkeleton height={160} />;
  if (!rows?.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {tl("noDepartmentData")}
      </p>
    );
  }

  const sorted = [...rows].sort(
    (a, b) =>
      b.finished +
      b.ongoing +
      b.pending -
      (a.finished + a.ongoing + a.pending),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-2xs font-semibold text-muted-foreground">
            <th className="px-2 py-2">{tc("department")}</th>
            <th className="px-2 py-2 text-right" title={tl("waitColTitle")}>
              {tc("wait")}
            </th>
            <th className="px-2 py-2 text-right" title={tl("durationColTitle")}>
              {tc("duration")}
            </th>
            <th className="px-2 py-2 text-right">{tl("finishedCol")}</th>
            <th
              className="px-2 py-2 text-right"
              title={tl("closeOriginColTitle")}
            >
              {tl("closeOriginCol")}
            </th>
            <th className="px-2 py-2 text-right">{tl("ongoingCol")}</th>
            <th className="px-2 py-2 text-right">{tl("pendingCol")}</th>
            <th className="px-2 py-2 text-right">{tl("totalCol")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const total = r.finished + r.ongoing + r.pending;
            return (
              <tr
                key={r.department_id || r.department_name}
                className="border-b border-border last:border-0"
              >
                <td className="px-2 py-2.5 font-medium text-foreground">
                  {r.department_name || tc("noDepartment")}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                  {fmt.mins(r.avg_wait_mins)}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                  {fmt.mins(r.avg_handle_mins)}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-healthy-ink">
                  {fmt.num(r.finished)}
                </td>
                <td className="px-2 py-2.5 text-right">
                  <CloseOriginCell
                    human={r.finished_human}
                    ai={r.finished_ai}
                    system={r.finished_system}
                  />
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-foreground">
                  {fmt.num(r.ongoing)}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-warning-ink">
                  {fmt.num(r.pending)}
                </td>
                <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-foreground">
                  {fmt.num(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TeamDetailTable({
  rows,
  loading,
}: {
  rows: MemberRow[] | undefined;
  loading: boolean;
}) {
  const tc = useTranslations("metricsOps.common");
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();
  const actorKindLabel = useActorKindLabel();
  const presenceLabel = usePresenceLabel();

  if (loading) return <ChartSkeleton height={200} />;
  if (!rows?.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {tl("noAgentsHint")}
      </p>
    );
  }

  const sorted = [...rows].sort(
    (a, b) => b.resolved - a.resolved || b.resolution_pct - a.resolution_pct,
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-2xs font-semibold text-muted-foreground">
            <th className="px-2 py-2">{tl("agentCol")}</th>
            <th className="px-2 py-2">{tc("type")}</th>
            <th className="px-2 py-2">{tc("status")}</th>
            <th
              className="px-2 py-2 text-right"
              title={tl("responseColTitle")}
            >
              {tc("response")}
            </th>
            <th
              className="px-2 py-2 text-right"
              title={tl("resolutionColTitle")}
            >
              {tl("resolutionCol")}
            </th>
            <th className="px-2 py-2 text-right">{tl("ongoingCol")}</th>
            <th className="px-2 py-2 text-right">{tl("pendingCol")}</th>
            <th className="px-2 py-2 text-right">{tl("resolvedCol")}</th>
            <th className="px-2 py-2 text-right">{tl("totalCol")}</th>
            <th
              className="px-2 py-2 text-right"
              title={tl("closeOriginColTitle")}
            >
              {tl("closeOriginCol")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr
              key={m.actor_id}
              className="border-b border-border last:border-0"
            >
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      // The product-wide plates: AI wears the automation
                      // series, humans the organisation series — and each
                      // plate carries its own measured glyph ink.
                      m.actor_kind === "ai" ? "tile-5" : "tile-2",
                    )}
                  >
                    {m.actor_kind === "ai" ? (
                      <Robot className="h-3 w-3" weight="fill" />
                    ) : (
                      <UserCircle className="h-3 w-3" weight="fill" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {m.display_name}
                    </p>
                    {m.email ? (
                      <p className="truncate text-2xs text-muted-foreground">
                        {m.email}
                      </p>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-2 py-2.5">
                {/* White-on-amber measured 2.4:1 — the exact pair the token
                    system exists to prevent. The chip takes the plate recipe:
                    an opaque fill with its own measured foreground. */}
                <span
                  className={cn(
                    "inline-flex rounded-[--radius] px-2 py-0.5 text-2xs font-semibold",
                    m.actor_kind === "ai" ? "tile-5" : "tile-2",
                  )}
                >
                  {actorKindLabel(m.actor_kind)}
                </span>
              </td>
              <td className="px-2 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      m.presence === "online"
                        ? "bg-healthy"
                        : m.presence === "on_call"
                          ? "bg-muted"
                          : "bg-muted",
                    )}
                  />
                  {presenceLabel(m.presence)}
                </span>
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                {fmt.mins(m.avg_response_mins)}
              </td>
              <td className="px-2 py-2.5 text-right">
                <span className="inline-flex items-center justify-end gap-1.5">
                  <span
                    className="hidden h-1 w-10 overflow-hidden rounded-full bg-muted sm:inline-block"
                    aria-hidden
                  >
                    <span
                      className="block h-full rounded-full bg-healthy"
                      style={{
                        width: `${Math.min(100, Math.max(0, m.resolution_pct))}%`,
                      }}
                    />
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {fmt.pct(m.resolution_pct)}
                  </span>
                </span>
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums">
                {fmt.num(m.open)}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums text-warning-ink">
                {fmt.num(m.pending)}
              </td>
              <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-healthy-ink">
                {fmt.num(m.resolved)}
              </td>
              <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-foreground">
                {fmt.num(m.resolved + m.open + m.pending)}
              </td>
              <td className="px-2 py-2.5 text-right">
                {m.actor_kind === "ai" ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                   ,
                  </span>
                ) : (
                  <CloseOriginCell
                    human={m.finished_human}
                    ai={m.finished_ai}
                    system={m.finished_system}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Funnels and stages ───────────────────────────────────────────────
   Where the period's conversations are sitting, and how long they have been
   sitting there.

   Grouped by funnel, never flat. Duplicate stage names across funnels are the
   normal case in this product (five production workspaces carry more than one
   conversation funnel), so a flat list would add "Agendamento" from a dead
   funnel to "Agendamento" from the live one and show a number belonging to
   neither.

   Colour carries exactly one meaning each, and nothing here is decoration:
     chart-1                volume of engaged conversations (charts lead with
                            the brand)
     warning                the stalled share of that volume, the actionable
                            part, and the only thing amber ever means here
     chart-2                a funnel's share of the workspace: a different
                            entity from a stage, so a different series slot
     healthy / destructive  the funnel's own won and lost outcomes
     the stage's own hex    as a square mark only, so the operator reads the
                            chips they already know from the kanban without
                            arbitrary user colour driving the chart
─────────────────────────────────────────────────────────────────────── */

/**
 * The bar palette, and it reads as one sentence down the funnel: brand green
 * while a lead is in flight, amber for the part of that volume which has
 * stalled, then the outcome's own token at the two stages a funnel ends in.
 *
 * A won stage rendered in the in-flight colour made the end of the path look
 * like more of the middle of it, and a lost stage looked like healthy volume.
 * Amber stays unambiguous because it is only ever the trailing segment of a
 * bar, and it is always labelled beneath it.
 */
const STAGE_BAR = "hsl(var(--chart-1))";
const STAGE_BAR_WON = "hsl(var(--healthy))";
const STAGE_BAR_LOST = "hsl(var(--destructive))";
const STAGE_BAR_STALLED = "hsl(var(--warning))";
const FUNNEL_BAR = "hsl(var(--chart-2))";

function stageBarColor(isWon: boolean, isLost: boolean): string {
  if (isWon) return STAGE_BAR_WON;
  if (isLost) return STAGE_BAR_LOST;
  return STAGE_BAR;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** The stage's own kanban colour as a small square: the board's trace-pad
 * shape, and the one place arbitrary user colour is allowed in this panel.
 * Won and lost override it, because an outcome outranks a decoration. */
function StageMark({
  color,
  isWon,
  isLost,
}: {
  color?: string;
  isWon: boolean;
  isLost: boolean;
}) {
  const fill = isWon
    ? "hsl(var(--healthy))"
    : isLost
      ? "hsl(var(--destructive))"
      : color && HEX.test(color.trim())
        ? color.trim()
        : "hsl(var(--muted-foreground))";
  return (
    <span
      aria-hidden
      className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-[2px]"
      style={{ backgroundColor: fill }}
    />
  );
}

/** One legend/readout pair engraved on the panel. No box: a number in this
 * product does not get a card drawn around it. */
function StageReadout({
  label,
  value,
  tone = "default",
  title,
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "muted";
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5" title={title}>
      <span className="text-2xs font-semibold text-muted-foreground">{label}</span>
      <span
        className={cn(
          "readout text-sm font-semibold tabular-nums",
          tone === "warning"
            ? "text-warning-ink"
            : tone === "muted"
              ? "text-muted-foreground"
              : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Coverage, then the funnel league — and the league IS the picker.
 *
 * A separate control for choosing a funnel would have been a second thing to
 * read carrying none of its own information. Selecting a row here drives the
 * ladder beside it, and the row still shows everything it showed before.
 */
function StageCoveragePanel({
  stages,
  loading,
  activeFunnelId,
  onSelectFunnel,
}: {
  stages: OverviewStages | undefined;
  loading: boolean;
  activeFunnelId: string | null;
  onSelectFunnel: (id: string) => void;
}) {
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();

  if (loading) return <ChartSkeleton height={300} />;
  if (!stages?.available) {
    return (
      <EmptyChart
        icon={<Kanban className="h-9 w-9" weight="fill" />}
        message={tl("noStageData")}
        height={300}
      />
    );
  }

  const inScope = stages.staged_engaged + stages.unstaged_engaged;
  const coveragePct = inScope > 0 ? (stages.staged_engaged / inScope) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <ProgressRing
          value={coveragePct}
          label={tl("coverageRing")}
          size={96}
          strokeWidth={9}
          color={STAGE_BAR}
        />
        <div className="min-w-0 flex-1 divide-y divide-border">
          <StageReadout
            label={tl("stagedCol")}
            value={fmt.num(stages.staged_engaged)}
            title={tl("engagedColTitle")}
          />
          <StageReadout
            label={tl("unstagedCol")}
            value={fmt.num(stages.unstaged_engaged)}
            tone="muted"
            title={tl("unstagedHint")}
          />
          <StageReadout
            label={tl("stuckCol")}
            value={fmt.num(stages.stuck)}
            tone={stages.stuck > 0 ? "warning" : "muted"}
            title={tl("stuckColTitle")}
          />
        </div>
      </div>

      <ul className="-mx-1.5 space-y-0.5">
        {stages.funnels.map((f) => {
          const active = f.funnel_id === activeFunnelId;
          const name = f.funnel_name || tl("noFunnel");
          return (
            <li key={f.funnel_id || "__none"}>
              {/* Selection is a real ground plus a mark, never a tint of the
                  brand hue under ink of the same hue. */}
              <button
                type="button"
                onClick={() => onSelectFunnel(f.funnel_id)}
                aria-pressed={active}
                title={f.funnel_id ? undefined : tl("noFunnelHint")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[--radius] px-1.5 py-2 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-muted" : "hover:bg-accent-hover",
                )}
              >
                <span className={cn("lamp", !active && "opacity-0")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-xs text-foreground",
                        active ? "font-semibold" : "font-medium",
                      )}
                    >
                      {name}
                    </span>
                    <span className="readout shrink-0 text-xs font-semibold tabular-nums text-foreground">
                      {fmt.num(f.engaged)}
                    </span>
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, f.pct_of_staged))}%`,
                          backgroundColor: FUNNEL_BAR,
                        }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right text-2xs tabular-nums text-muted-foreground">
                      {fmt.pct(f.pct_of_staged)}
                    </span>
                    {f.stuck > 0 ? (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 text-2xs font-semibold tabular-nums text-warning-ink"
                        title={tl("stuckColTitle")}
                      >
                        <Hourglass className="h-3 w-3" weight="fill" aria-hidden />
                        {fmt.num(f.stuck)}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The selected funnel, read in its own order.
 *
 * Position ascending, not volume descending: a funnel sorted by size stops
 * being a path, and "where do they stop moving" is only answerable when the
 * stages sit in the order leads actually travel them. The longest bar still
 * says which stage holds the most.
 */
function StageLadder({
  funnel,
  loading,
}: {
  funnel: StageFunnelGroup | undefined;
  loading: boolean;
}) {
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();

  if (loading) return <ChartSkeleton height={300} />;
  if (!funnel?.stages?.length) {
    return (
      <EmptyChart
        icon={<FlowArrow className="h-9 w-9" weight="fill" />}
        message={tl("noStageData")}
        height={300}
      />
    );
  }

  // Bars compare engaged against engaged. Shells are a chip on the row rather
  // than an extension of the bar: one 3.000-contact import would otherwise
  // flatten every real stage beside it into a hairline.
  const maxEngaged = funnel.stages.reduce((m, s) => Math.max(m, s.engaged), 0);
  const peakId =
    funnel.stages.length >= 3 && maxEngaged > 0
      ? funnel.stages.reduce((a, b) => (b.engaged > a.engaged ? b : a)).stage_id
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-xs text-muted-foreground">
          {tl("funnelSummary", {
            engaged: fmt.num(funnel.engaged),
            pct: fmt.pct(funnel.pct_of_staged),
          })}
        </p>
        {funnel.stuck > 0 ? (
          <p className="readout text-xs font-semibold tabular-nums text-warning-ink">
            {tl("funnelStuck", { count: fmt.num(funnel.stuck) })}
          </p>
        ) : null}
      </div>

      <ul className="space-y-3.5">
        {funnel.stages.map((s) => {
          const width = maxEngaged > 0 ? (s.engaged / maxEngaged) * 100 : 0;
          // The stalled share sits INSIDE the same bar, at its trailing end:
          // stalled conversations are part of the volume, and a second bar
          // beside it would invite reading them as extra.
          const stalled = Math.min(s.stuck, s.engaged);
          const stalledPct = s.engaged > 0 ? (stalled / s.engaged) * 100 : 0;
          const showOldest =
            s.avg_days_in_stage !== null &&
            s.oldest_days_in_stage !== null &&
            s.oldest_days_in_stage > s.avg_days_in_stage + 1;
          return (
            <li key={s.stage_id} className="flex items-start gap-2">
              <StageMark color={s.color} isWon={s.is_won} isLost={s.is_lost} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex min-w-0 items-baseline gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {s.stage_name}
                    </span>
                    {s.is_won ? (
                      <span className="shrink-0 text-2xs font-semibold text-healthy-ink">
                        {tl("wonStage")}
                      </span>
                    ) : null}
                    {s.is_lost ? (
                      <span className="shrink-0 text-2xs font-semibold text-destructive-ink">
                        {tl("lostStage")}
                      </span>
                    ) : null}
                    {s.stage_id === peakId ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-[--radius] bg-muted px-1.5 py-0.5 text-2xs font-semibold text-foreground">
                        <TrendUp className="h-3 w-3" weight="bold" aria-hidden />
                        {tl("peakStage")}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-baseline gap-2">
                    <span className="readout text-sm font-semibold tabular-nums text-foreground">
                      {fmt.num(s.engaged)}
                    </span>
                    <span className="w-11 text-right text-2xs tabular-nums text-muted-foreground">
                      {fmt.pct(s.pct_of_funnel)}
                    </span>
                  </div>
                </div>

                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="flex h-full overflow-hidden rounded-full transition-[width] duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, width))}%` }}
                  >
                    <span
                      className="h-full"
                      style={{
                        width: `${100 - stalledPct}%`,
                        backgroundColor: stageBarColor(s.is_won, s.is_lost),
                      }}
                    />
                    {stalled > 0 ? (
                      <span
                        className="h-full"
                        style={{
                          width: `${stalledPct}%`,
                          backgroundColor: STAGE_BAR_STALLED,
                          borderLeft:
                            stalledPct < 100 ? "1px solid hsl(var(--card))" : undefined,
                        }}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-muted-foreground">
                  {s.avg_days_in_stage !== null ? (
                    <span
                      className="inline-flex items-center gap-1 tabular-nums"
                      title={tl("parkedColTitle")}
                    >
                      <Timer className="h-3 w-3" weight="fill" aria-hidden />
                      {tl("parkedCol")} {fmt.days(s.avg_days_in_stage)}
                      {showOldest
                        ? ` · ${tl("oldestInStage", { days: fmt.days(s.oldest_days_in_stage) })}`
                        : ""}
                    </span>
                  ) : null}
                  {stalled > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 font-semibold tabular-nums text-warning-ink"
                      title={tl("stuckColTitle")}
                    >
                      <Hourglass className="h-3 w-3" weight="fill" aria-hidden />
                      {tl("stageStuck", { count: fmt.num(stalled) })}
                      {/* The parentheses are drawn here, once. Carrying a pair
                          inside the string too printed "(over 7d (default))". */}
                      <span className="font-normal">
                        {`(${
                          s.rot_days_set
                            ? tl("stuckAfter", { days: s.stuck_after_days })
                            : tl("stuckAfterDefault", { days: s.stuck_after_days })
                        })`}
                      </span>
                    </span>
                  ) : null}
                  {s.shell > 0 ? (
                    <span className="tabular-nums" title={tl("shellColTitle")}>
                      {tl("stageShell", { count: fmt.num(s.shell) })}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="pt-0.5 text-2xs text-muted-foreground">{tl("stageMeasuredNow")}</p>
    </div>
  );
}
/**
 * Every funnel and every stage at once, as area.
 *
 * This was a hand-rolled Marimekko, kept because a treemap scrambles stage
 * ORDER. In the running product that argument did not survive contact: the
 * ladder panel beside this one already reads one funnel IN ORDER, with names,
 * dwell and stalled counts, so order was never this panel's job. What this
 * panel owes is "where is everything", and it was failing at it — a funnel
 * holding nine conversations rendered as four unlabelled blocks reading
 * "3 4 1 1", which is not information.
 *
 * It is now the same nested treemap the audience screen uses. The funnel name
 * rides a band over its own region, so a stage name that exists in two funnels
 * ("em atendimento" is in most of them) is never ambiguous, and the blocks
 * stay comparable by area across funnels.
 */
function StageBlocks({
  stages,
  loading,
}: {
  stages: OverviewStages | undefined;
  loading: boolean;
}) {
  const tl = useTranslations("metricsOps.attendance.labels");

  const groups = useMemo(() => {
    if (!stages?.funnels?.length) return [];
    return stages.funnels
      .filter((f) => f.engaged > 0)
      .map((f, fi) => {
        const hue = `var(--chart-${(fi % 5) + 1})`;
        const cells = f.stages.filter((s) => s.engaged > 0);
        return {
          key: f.funnel_id || "__none",
          label: f.funnel_name || tl("noFunnel"),
          color: `hsl(${hue} / 0.18)`,
          children: cells.map((s, si) => ({
            key: s.stage_id,
            label: s.stage_name,
            value: s.engaged,
            // Hue identifies the funnel; the step within it follows the
            // stage's POSITION, which is ordered, so the ramp is legal and
            // does not double-encode the area.
            color: s.is_won
              ? "hsl(var(--healthy))"
              : s.is_lost
                ? "hsl(var(--destructive))"
                : `hsl(${hue} / ${(1 - (si / Math.max(1, cells.length - 1)) * 0.55).toFixed(2)})`,
          })),
        };
      })
      .filter((g) => g.children.length > 0);
  }, [stages, tl]);

  if (loading) return <ChartSkeleton height={260} />;
  if (!groups.length) {
    return (
      <EmptyChart
        icon={<Stack className="h-9 w-9" weight="fill" />}
        message={tl("noStageData")}
        height={260}
      />
    );
  }

  return (
    <div>
      <GroupedBlockChart groups={groups} label={tl("stageCol")} height={260} />
      {/* Its own copy. denseCharts.blockHint says "comentários classificados",
          which is the audience screen's subject, not this panel's. */}
      <p className="mt-1 text-2xs text-muted-foreground">{tl("stageBlockHint")}</p>
    </div>
  );
}

/**
 * Every funnel and every stage, as one reconcilable ledger.
 *
 * The funnel is a group header rather than a repeated cell — the same optgroup
 * shape the inbox stage filter took — so a stage is never read without the
 * funnel that owns it, and the unstaged remainder closes the arithmetic.
 */
function StageDetailTable({
  stages,
  loading,
}: {
  stages: OverviewStages | undefined;
  loading: boolean;
}) {
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();

  if (loading) return <ChartSkeleton height={200} />;
  if (!stages?.available || !stages.funnels.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {tl("noStageDataHint")}
      </p>
    );
  }

  return (
    /* Capped and scrolled. A workspace with several funnels lists every stage
       of every one of them, which ran to dozens of rows and pushed the panels
       under it off the screen. The head stays pinned so a row scrolled into
       view still has its column names. */
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border-strong text-2xs font-semibold text-muted-foreground">
            <th className="px-2 py-2">{tl("stageCol")}</th>
            <th className="px-2 py-2 text-right" title={tl("engagedColTitle")}>
              {tl("engagedCol")}
            </th>
            <th className="px-2 py-2 text-right" title={tl("shellColTitle")}>
              {tl("shellCol")}
            </th>
            <th className="px-2 py-2 text-right" title={tl("shareColTitle")}>
              {tl("shareCol")}
            </th>
            <th className="px-2 py-2 text-right" title={tl("parkedColTitle")}>
              {tl("parkedCol")}
            </th>
            <th className="px-2 py-2 text-right" title={tl("stuckColTitle")}>
              {tl("stuckCol")}
            </th>
          </tr>
        </thead>
        <tbody>
          {stages.funnels.map((f) => (
            <Fragment key={f.funnel_id || "__none"}>
              {/* A real step, not a half-alpha one: on graphite a muted band at
                  60% collapses back into the card and the group vanishes. */}
              <tr className="bg-muted">
                <th
                  scope="row"
                  className="px-2 py-1.5 text-2xs font-semibold text-muted-foreground"
                  title={f.funnel_id ? undefined : tl("noFunnelHint")}
                >
                  {f.funnel_name || tl("noFunnel")}
                </th>
                <td className="readout px-2 py-1.5 text-right text-2xs font-semibold tabular-nums text-foreground">
                  {fmt.num(f.engaged)}
                </td>
                <td className="px-2 py-1.5 text-right text-2xs tabular-nums text-muted-foreground">
                  {f.shell > 0 ? fmt.num(f.shell) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right text-2xs tabular-nums text-muted-foreground">
                  {fmt.pct(f.pct_of_staged)}
                </td>
                <td className="px-2 py-1.5" />
                <td
                  className={cn(
                    "px-2 py-1.5 text-right text-2xs font-semibold tabular-nums",
                    f.stuck > 0 ? "text-warning-ink" : "text-muted-foreground",
                  )}
                >
                  {f.stuck > 0 ? fmt.num(f.stuck) : "—"}
                </td>
              </tr>
              {f.stages.map((s) => (
                <tr key={s.stage_id} className="border-b border-border hover:bg-muted">
                  <td className="px-2 py-2.5">
                    <span className="flex items-start gap-2">
                      <StageMark color={s.color} isWon={s.is_won} isLost={s.is_lost} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {s.stage_name}
                        </span>
                        {s.is_won || s.is_lost ? (
                          <span
                            className={cn(
                              "text-2xs font-semibold",
                              s.is_won ? "text-healthy-ink" : "text-destructive-ink",
                            )}
                          >
                            {s.is_won ? tl("wonStage") : tl("lostStage")}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-foreground">
                    {fmt.num(s.engaged)}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                    {s.shell > 0 ? fmt.num(s.shell) : "—"}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                    {fmt.pct(s.pct_of_funnel)}
                  </td>
                  <td
                    className="px-2 py-2.5 text-right tabular-nums text-muted-foreground"
                    title={
                      s.oldest_days_in_stage !== null
                        ? tl("oldestInStage", { days: fmt.days(s.oldest_days_in_stage) })
                        : undefined
                    }
                  >
                    {s.avg_days_in_stage !== null ? fmt.days(s.avg_days_in_stage) : fmt.na}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-2.5 text-right font-semibold tabular-nums",
                      s.stuck > 0 ? "text-warning-ink" : "text-muted-foreground",
                    )}
                    title={
                      s.rot_days_set
                        ? tl("stuckAfter", { days: s.stuck_after_days })
                        : tl("stuckAfterDefault", { days: s.stuck_after_days })
                    }
                  >
                    {s.stuck > 0 ? fmt.num(s.stuck) : "—"}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
          {stages.unstaged_engaged > 0 || stages.unstaged_shell > 0 ? (
            <tr className="border-t border-border-strong">
              <th
                scope="row"
                className="px-2 py-2.5 text-left font-medium text-muted-foreground"
                title={tl("unstagedHint")}
              >
                {tl("unstagedCol")}
              </th>
              <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-muted-foreground">
                {fmt.num(stages.unstaged_engaged)}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                {stages.unstaged_shell > 0 ? fmt.num(stages.unstaged_shell) : "—"}
              </td>
              <td className="px-2 py-2.5" />
              <td className="px-2 py-2.5" />
              <td className="px-2 py-2.5" />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** The section. Owns exactly one thing: which funnel the ladder is showing. */
function StageDistributionSection({
  stages,
  loading,
}: {
  stages: OverviewStages | undefined;
  loading: boolean;
}) {
  const ts = useTranslations("metricsOps.attendance.sections");
  const [pickedFunnelId, setPickedFunnelId] = useState<string | null>(null);

  const funnels = stages?.funnels ?? [];
  // Derived during render, not reset in an effect: when a filter change removes
  // the funnel that was open, the ladder falls back to the busiest one on the
  // same paint instead of flashing empty first.
  const activeFunnelId = funnels.some((f) => f.funnel_id === pickedFunnelId)
    ? pickedFunnelId
    : (funnels[0]?.funnel_id ?? null);
  const activeFunnel = funnels.find((f) => f.funnel_id === activeFunnelId);

  return (
    <div>
      <SectionLabel title={ts("stages")} subtitle={ts("stagesSub")} />
      <div className="grid gap-3 xl:grid-cols-12">
        <Surface className="xl:col-span-4">
          <SectionTitle
            icon={<Kanban className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.Kanban}
            title={ts("stageCoverage")}
            subtitle={ts("stageCoverageSub")}
          />
          <StageCoveragePanel
            stages={stages}
            loading={loading}
            activeFunnelId={activeFunnelId}
            onSelectFunnel={setPickedFunnelId}
          />
        </Surface>

        <Surface className="xl:col-span-8">
          <SectionTitle
            icon={<FlowArrow className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.FlowArrow}
            title={ts("stageChart")}
            subtitle={ts("stageChartSub")}
          />
          <StageLadder funnel={activeFunnel} loading={loading} />
        </Surface>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-12">
        {/* All funnels at once, as area. The ladder above reads one funnel in
            depth; this is the only view that answers "where is everything". */}
        <Surface className="min-w-0 xl:col-span-5">
          <SectionTitle
            icon={<Kanban className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.Kanban}
            title={ts("stageMosaic")}
            subtitle={ts("stageMosaicSub")}
          />
          <StageBlocks stages={stages} loading={loading} />
        </Surface>

        {/* min-w-0: a grid item defaults to min-width:auto, so the table's own
            min-w-[640px] would push the whole column past the viewport instead
            of scrolling inside its overflow container. It did, by 282px. */}
        <Surface className="min-w-0 xl:col-span-7">
          <SectionTitle
            icon={<Stack className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.Stack}
            title={ts("stageTable")}
            subtitle={ts("stageTableSub")}
          />
          <StageDetailTable stages={stages} loading={loading} />
        </Surface>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function AttendanceOpsPage() {
  const { currentWorkspace, can, permissionsLoading } = useWorkspace();
  const t = useTranslations("metricsOps.attendance");
  const ts = useTranslations("metricsOps.attendance.sections");
  const tc = useTranslations("metricsOps.common");
  const tl = useTranslations("metricsOps.attendance.labels");
  const tg = useTranslations("metricsOps.attendance.glossary");
  const texp = useTranslations("metricsOps.export");
  // Shared with the tables below, so the export cannot drift from the screen.
  const actorKindLabel = useActorKindLabel();
  const presenceLabel = usePresenceLabel();
  const fmt = useMetricsFmt();
  // Matches backend: GET /attendance/* → attendance:read
  const canRead = !permissionsLoading && can("attendance", "read");
  const searchParams = useSearchParams();
  // Deep-link / monitor: ?campaignId=&campaignType=whatsapp|voice
  const campaignId = searchParams.get("campaignId") || undefined;
  const campaignType =
    searchParams.get("campaignType") === "voice" ||
    searchParams.get("campaignType") === "whatsapp"
      ? searchParams.get("campaignType")!
      : undefined;

  const [preset, setPreset] = useState<DatePreset>("7d");
  const [dateFrom, setDateFrom] = useState(() =>
    format(subDays(new Date(), 6), "yyyy-MM-dd"),
  );
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [departmentId, setDepartmentId] = useState("all");
  const [memberId, setMemberId] = useState("all");
  const [channel, setChannel] = useState("all");
  const [includeAi, setIncludeAi] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDepartments().then((r) => {
      if (!cancelled) setDepartments(r.departments ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    let cancelled = false;
    listMembersAction(currentWorkspace.id).then((r) => {
      if (!cancelled) setMembers(r.members ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id]);

  const applyPreset = useCallback((p: DatePreset) => {
    setPreset(p);
    if (p === "custom") return;
    const days = p === "7d" ? 6 : p === "30d" ? 29 : 89;
    setDateFrom(format(subDays(new Date(), days), "yyyy-MM-dd"));
    setDateTo(format(new Date(), "yyyy-MM-dd"));
  }, []);

  const load = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const r = await getAttendanceOverviewAction({
      dateFrom,
      dateTo,
      departmentId: departmentId === "all" ? undefined : departmentId,
      memberId: memberId === "all" ? undefined : memberId,
      channel: channel === "all" ? undefined : channel,
      campaignId,
      campaignType,
      includeAi,
    });
    if (r.error) {
      setError(r.error);
      setOverview(null);
    } else {
      setOverview(r.overview);
    }
    setLoading(false);
  }, [
    canRead,
    dateFrom,
    dateTo,
    departmentId,
    memberId,
    channel,
    campaignId,
    campaignType,
    includeAi,
  ]);

  useEffect(() => {
    if (permissionsLoading) return;
    void load();
  }, [permissionsLoading, load]);

  // Export reads the overview already in state: no second query, and the file
  // is guaranteed to be the numbers on screen rather than whatever a re-fetch
  // would have returned a moment later.
  const exportCsv = useCallback(() => {
    if (!overview) return;
    const { csvText, filename } = buildAttendanceOverviewCsv({
      overview,
      t: (key) => texp(key),
      // The dashboard's own label functions, so the file says exactly what the
      // screen says instead of leaking enum keys like "unofficial_whatsapp".
      display: {
        channel: (c) => channelLabel(c, tc),
        actorKind: actorKindLabel,
        presence: presenceLabel,
      },
      filters: {
        dateFrom,
        dateTo,
        // Resolved to names here, where the option lists live: an id in the
        // file's header is unreadable by the time anyone opens it.
        departmentLabel:
          departmentId === "all"
            ? tc("all")
            : (departments.find((d) => d.id === departmentId)?.name ?? departmentId),
        memberLabel:
          memberId === "all"
            ? tc("all")
            : (() => {
                const m = members.find((x) => x.userId === memberId);
                return m ? m.username || m.email : memberId;
              })(),
        channelLabel: channel === "all" ? tc("all") : tc(channel),
        includeAi,
        campaignId,
        campaignType,
        workspaceName: currentWorkspace?.name,
      },
    });
    downloadCsv(csvText, filename);
  }, [
    overview,
    texp,
    tc,
    actorKindLabel,
    presenceLabel,
    dateFrom,
    dateTo,
    departmentId,
    departments,
    memberId,
    members,
    channel,
    includeAi,
    campaignId,
    campaignType,
    currentWorkspace?.name,
  ]);

  const kpis = overview?.kpis;
  // Primary header count = engaged conversations (real threads with messages).
  const total =
    kpis?.engaged ??
    (kpis?.finished ?? 0) + (kpis?.ongoing ?? 0) + (kpis?.pending ?? 0);
  const periodLabel =
    preset === "custom"
      ? tl("customRange", { from: dateFrom, to: dateTo })
      : preset === "7d"
        ? tl("last7d")
        : preset === "30d"
          ? tl("last30d")
          : tl("last90d");

  return (
    <div className="space-y-3">
      {/* Page head on the canvas, Azure-style: trail, title, then the command
          bar carrying export/refresh as flat commands. The filter row sits
          directly below it, unboxed — a filter bar is chrome, not content,
          and boxing it made the whole head one heavy card. */}
      <div>
        <DashboardPageHeader
          badge={campaignId ? t("badgeCampaign") : t("badge")}
          description={
            currentWorkspace
              ? campaignId
                ? t("descCampaign", { name: currentWorkspace.name })
                : t("desc", { name: currentWorkspace.name })
              : tc("selectWorkspace")
          }
          icon={<ChartBar className="h-6 w-6" weight="fill" />}
          actions={
            <>
              {/* Disabled until the overview has actually loaded: exporting
                  a half-populated dashboard would produce a file of zeros
                  indistinguishable from a genuinely empty period. */}
              <Button
                icon={<DownloadSimple className="h-4 w-4" weight="bold" />}
                iconVisible
                title={texp("button")}
                variant="command"
                onClick={exportCsv}
                disabled={loading || !overview}
              >
                <span className="max-sm:sr-only">{texp("button")}</span>
              </Button>
              <Button
                icon={<ArrowClockwise className="h-4 w-4" weight="bold" />}
                iconVisible
                title={tc("refresh")}
                variant="command"
                onClick={() => void load()}
                disabled={loading}
              />
            </>
          }
        />

        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-2xs font-semibold text-muted-foreground">
                {tc("period")}
              </p>
              <ElevatedPillToggle
                aria-label={tc("period")}
                size="md"
                value={preset}
                onChange={(v) => applyPreset(v as DatePreset)}
                options={[
                  { value: "7d", label: tc("days7") },
                  { value: "30d", label: tc("days30") },
                  { value: "90d", label: tc("days90") },
                  { value: "custom", label: tc("custom") },
                ]}
              />
              {preset === "custom" ? (
                <div className="mt-2 grid max-w-md grid-cols-2 gap-2">
                  <ElevatedDatePicker
                    id="ops-date-from"
                    label={tc("start")}
                    value={dateFrom}
                    onChange={setDateFrom}
                  />
                  <ElevatedDatePicker
                    id="ops-date-to"
                    label={tc("end")}
                    value={dateTo}
                    onChange={setDateTo}
                  />
                </div>
              ) : null}
            </div>

            <div className="w-full lg:w-[160px]">
              <ElevatedSelect
                label={tc("department")}
                value={departmentId}
                onValueChange={setDepartmentId}
                placeholder={tc("all")}
              >
                <ElevatedSelectItem value="all">{tc("all")}</ElevatedSelectItem>
                {departments.map((d) => (
                  <ElevatedSelectItem key={d.id} value={d.id}>
                    {d.name}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>

            <div className="w-full lg:w-[180px]">
              <ElevatedSelect
                label={tc("member")}
                value={memberId}
                onValueChange={setMemberId}
                placeholder={tc("all")}
              >
                <ElevatedSelectItem value="all">{tc("all")}</ElevatedSelectItem>
                {members.map((m) => (
                  <ElevatedSelectItem key={m.userId} value={m.userId}>
                    {m.username || m.email}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>

            <div className="w-full lg:w-[150px]">
              <ElevatedSelect
                label={tc("channel")}
                value={channel}
                onValueChange={setChannel}
                placeholder={tc("all")}
              >
                <ElevatedSelectItem value="all">{tc("all")}</ElevatedSelectItem>
                {/* Every channel that can appear in the mix above, or the
                    filter silently cannot reach half the data it charts. Real
                    brand marks rather than a generic glyph: the two WhatsApp
                    transports are otherwise indistinguishable in a dropdown. */}
                <ElevatedSelectItem value="whatsapp">
                  <span className="inline-flex items-center gap-1.5">
                    <ChannelTile channel="whatsapp" size="sm" className="h-5 w-5" />
                    {tc("whatsapp")}
                  </span>
                </ElevatedSelectItem>
                <ElevatedSelectItem value="unofficial_whatsapp">
                  <span className="inline-flex items-center gap-1.5">
                    <ChannelTile channel="unofficial_whatsapp" size="sm" className="h-5 w-5" />
                    {tc("unofficialWhatsapp")}
                  </span>
                </ElevatedSelectItem>
                <ElevatedSelectItem value="instagram">
                  <span className="inline-flex items-center gap-1.5">
                    <ChannelTile channel="instagram" size="sm" className="h-5 w-5" />
                    {tc("instagram")}
                  </span>
                </ElevatedSelectItem>
                <ElevatedSelectItem value="telegram">
                  <span className="inline-flex items-center gap-1.5">
                    <ChannelTile channel="telegram" size="sm" className="h-5 w-5" />
                    {tc("telegram")}
                  </span>
                </ElevatedSelectItem>
              </ElevatedSelect>
            </div>

            <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-[--radius] border border-border bg-card px-3 text-sm lg:shrink-0">
              <input
                type="checkbox"
                checked={includeAi}
                onChange={(e) => setIncludeAi(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-primary-ink focus:ring-ring"
              />
              <span className="whitespace-nowrap font-medium text-foreground">
                {tl("showAi")}
              </span>
            </label>
          </div>

          {/* Context chips */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-[--radius] bg-muted px-2.5 py-1 font-medium text-foreground">
              {periodLabel}
            </span>
            <span className="rounded-[--radius] bg-muted px-2.5 py-1">
              {loading
                ? tc("loading")
                : tl("conversationsInSlice", { count: fmt.num(total) })}
            </span>
            {!loading && (kpis?.shell_backlog ?? 0) > 0 ? (
              <span
                className="rounded-[--radius] bg-muted px-2.5 py-1"
                title={tl("shellChipHint")}
              >
                {tl("shellChip", { count: fmt.num(kpis?.shell_backlog) })}
              </span>
            ) : null}
            <span className="rounded-[--radius] bg-muted px-2.5 py-1">
              {loading
                ? tc("loading")
                : tl("agentsCount", {
                    count: fmt.num(overview?.by_member?.length),
                  })}
            </span>
            <span className="rounded-[--radius] bg-muted px-2.5 py-1">
              {loading
                ? tc("loading")
                : tl("departmentsCount", {
                    count: fmt.num(overview?.by_department?.length),
                  })}
            </span>
          </div>

          <div className="mt-4">
            <KpiStrip
              kpis={kpis}
              loading={loading}
              scoped={
                departmentId !== "all" ||
                memberId !== "all" ||
                channel !== "all" ||
                Boolean(campaignId)
              }
            />
          </div>

          {error ? (
            <div className="mt-3 rounded-[--radius] border border-border bg-muted px-3 py-2 text-sm text-destructive-ink">
              {error}
            </div>
          ) : null}
      </div>

      {!canRead && !permissionsLoading ? (
        <div>
          <Surface className="py-12 text-center">
            <Users
              className="mx-auto mb-3 h-10 w-10 text-muted-foreground"
              weight="duotone"
            />
            <h2 className="font-display text-base font-semibold tracking-[0.01em] text-foreground">
              {tc("noPermission")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tc("noPermissionDesc")}
            </p>
          </Surface>
        </div>
      ) : (
        <>
          <div>
            <SectionLabel title={ts("volume")} subtitle={ts("volumeSub")} />
            <div className="grid gap-3 xl:grid-cols-12">
              <Surface className="xl:col-span-7">
                <SectionTitle
                  icon={<ChartBar className="h-4 w-4" weight="fill" />}
                  iconBg={GLYPH_PLATE.ChartBar}
                  title={ts("hourly")}
                  subtitle={ts("hourlySub")}
                />
                <HourlyVolumeChart
                  hourly={overview?.hourly}
                  loading={loading}
                />
              </Surface>

              <Surface className="xl:col-span-5">
                <SectionTitle
                  icon={<ChartPie className="h-4 w-4" weight="fill" />}
                  iconBg={GLYPH_PLATE.ChartPie}
                  title={ts("status")}
                  subtitle={ts("statusSub")}
                />
                <StatusCompositionChart
                  dist={overview?.status_distribution}
                  bySource={overview?.finished_by_source}
                  loading={loading}
                />
              </Surface>
            </div>
          </div>

          <div>
            <ExtendedOpsPanels overview={overview} loading={loading} />
          </div>

          {/* Placed before the department and team sections deliberately: those
              answer "who handled it", this one answers "where did it stop",
              which is the question a manager arrives with. */}
          <StageDistributionSection
            stages={overview?.stages}
            loading={loading}
          />

          <div>
            <SectionLabel
              title={ts("departments")}
              subtitle={ts("departmentsSub")}
            />
            <div className="grid gap-3 xl:grid-cols-12">
              <Surface className="xl:col-span-5">
                <SectionTitle
                  icon={<Buildings className="h-4 w-4" weight="fill" />}
                  iconBg={GLYPH_PLATE.Buildings}
                  title={ts("deptChart")}
                  subtitle={ts("deptChartSub")}
                />
                <DepartmentStackedChart
                  rows={overview?.by_department}
                  loading={loading}
                />
              </Surface>

              <Surface className="xl:col-span-7">
                <SectionTitle
                  icon={<Buildings className="h-4 w-4" weight="fill" />}
                  iconBg={GLYPH_PLATE.Buildings}
                  title={ts("deptTable")}
                  subtitle={ts("deptTableSub")}
                />
                <DepartmentDetailTable
                  rows={overview?.by_department}
                  loading={loading}
                />
              </Surface>
            </div>
          </div>

          <div>
            <SectionLabel title={ts("team")} subtitle={ts("teamSub")} />
            <div className="grid gap-3 xl:grid-cols-12">
              <Surface className="xl:col-span-5">
                <SectionTitle
                  icon={<Users className="h-4 w-4" weight="fill" />}
                  iconBg={GLYPH_PLATE.Users}
                  title={ts("teamRank")}
                  subtitle={ts("teamRankSub")}
                />
                <TeamChart
                  rows={overview?.by_member}
                  loading={loading}
                />
              </Surface>

              <Surface className="xl:col-span-7">
                <SectionTitle
                  icon={<Users className="h-4 w-4" weight="fill" />}
                  iconBg={GLYPH_PLATE.Users}
                  title={ts("teamDetail")}
                  subtitle={ts("teamDetailSub")}
                />
                <TeamDetailTable
                  rows={overview?.by_member}
                  loading={loading}
                />
              </Surface>
            </div>
          </div>

          <div>
            <Surface className="!py-3">
              <p className="mb-2 text-2xs font-semibold text-muted-foreground">
                {tc("glossaryTitle")}
              </p>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                <p>
                  <strong className="text-foreground">{tg("avgWait")}</strong> ·{" "}
                  {tg("avgWaitDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("avgHandle")}</strong> ·{" "}
                  {tg("avgHandleDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("frt")}</strong> ·{" "}
                  {tg("frtDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("aiResolved")}</strong>{" "}
                  · {tg("aiResolvedDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("unassigned")}</strong> ·{" "}
                  {tg("unassignedDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("engaged")}</strong> ·{" "}
                  {tg("engagedDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("shell")}</strong> ·{" "}
                  {tg("shellDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("reopen")}</strong> ·{" "}
                  {tg("reopenDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("resolution")}</strong>{" "}
                  · {tg("resolutionDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("stageParked")}</strong>{" "}
                  · {tg("stageParkedDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("stageStuck")}</strong>{" "}
                  · {tg("stageStuckDesc")}
                </p>
              </div>
            </Surface>
          </div>
        </>
      )}
    </div>
  );
}
