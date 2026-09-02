"use client";

import {
  ArrowClockwise,
  Buildings,
  ChartBar,
  ChartPie,
  CheckCircle,
  Clock,
  DownloadSimple,
  Headset,
  Hourglass,
  Info,
  Lightning,
  Phone,
  PhoneIncoming,
  Pulse,
  Robot,
  Timer,
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
  Pie,
  PieChart,
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
import { vozGrid, vozRing, vozXAxis, vozYAxis } from "@/components/charts/vozko";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { format, subDays } from "date-fns";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
      pct: (v: number | null | undefined) => {
        if (v === null || v === undefined) return na;
        return `${v.toLocaleString(tag, { maximumFractionDigits: 1 })}%`;
      },
    }),
    [tag, na, minUnit],
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
        "rounded-[--radius] border border-border bg-card p-4 md:p-5",
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
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius]",
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
    },
    {
      key: "ongoing",
      label: t("ongoing"),
      short: t("ongoingShort"),
      value: loading ? tc("loading") : fmt.num(kpis?.ongoing),
      hint: t("ongoingHint"),
      icon: Pulse,
      bg: GLYPH_PLATE.Pulse,
    },
    {
      key: "pending",
      label: t("pending"),
      short: t("pendingShort"),
      value: loading ? tc("loading") : fmt.num(kpis?.pending),
      hint: t("pendingHint"),
      icon: Hourglass,
      bg: GLYPH_PLATE.Hourglass,
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
            <p className="readout mt-2 truncate font-display text-2xl font-semibold tracking-tight text-foreground">
              {c.value}
            </p>
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

function StatBlock({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[--radius] border border-border bg-background px-3 py-2.5",
        muted && "opacity-70",
      )}
      title={hint}
    >
      <p className="text-2xs font-semibold text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 line-clamp-2 text-2xs text-muted-foreground">
          {hint}
        </p>
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
  // The two transports share a brand and must not share a bar: an operator
  // reading a 50/50 split has to see WHICH WhatsApp half is which.
  unofficial_whatsapp: "#7d8f86",
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

function ChannelMixChart({
  mix,
  loading,
}: {
  mix: ChannelSlice[] | undefined;
  loading: boolean;
}) {
  const tc = useTranslations("metricsOps.common");
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();
  const data = useMemo(() => {
    if (!mix?.length) return [];
    return mix.map((c) => ({
      key: c.channel,
      // A ternary chain that ended in the RAW KEY, so every channel added after
      // WhatsApp and voice rendered "telegram" and "unofficial_whatsapp"
      // verbatim to the operator, on a muted tile carrying a telephone glyph.
      name: channelLabel(c.channel, tc),
      value: c.count,
      pct: c.pct,
      // The bar keeps the brand colour, which is what makes two rows tellable
      // apart at a glance. The PLATE does not: DESIGN.md §9 keeps one neutral
      // ground and puts the identity in the mark, and the brand marks carry
      // their own real colours.
      bar: CHANNEL_BAR[c.channel] ?? "hsl(var(--muted-foreground))",
    }));
  }, [mix, tc]);
  const total = data.reduce((s, d) => s + d.value, 0);

  if (loading) return <ChartSkeleton height={160} />;
  if (!data.length) {
    return (
      <EmptyChart
        icon={<ChartPie className="h-8 w-8" weight="fill" />}
        message={tl("noChannelMix")}
        height={160}
      />
    );
  }

  // Horizontal comparison cards beat a pie for two channels: exact counts and
  // share read faster, and the bars scale cleanly when one channel dominates.
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {tl("channelTotalConversations")}
        </p>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {fmt.num(total)}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.map((d) => {
          return (
            <div
              key={d.key}
              className="rounded-[--radius] border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ChannelTile channel={d.key} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {d.name}
                    </p>
                    <p className="text-2xs text-muted-foreground">
                      {fmt.pct(d.pct)} {tl("ofPeriodConversations")}
                    </p>
                  </div>
                </div>
                <p className="font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {fmt.num(d.value)}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, d.pct))}%`,
                    backgroundColor: d.bar,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
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

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel title={ts("times")} subtitle={ts("timesSub")} />
        <div className="grid gap-4 xl:grid-cols-12">
          <Surface className="xl:col-span-6">
            <SectionTitle
              icon={<Lightning className="h-4 w-4" weight="fill" />}
              iconBg={GLYPH_PLATE.Lightning}
              title={ts("frtTitle")}
              subtitle={ts("frtSub")}
            />
            {loading ? (
              <ChartSkeleton height={140} />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <StatBlock
                  label={tl("overallAvg")}
                  value={fmt.mins(frt?.avg_mins ?? null)}
                  hint={
                    frt?.available
                      ? tl("basedOnSessions", {
                          count: fmt.num(frt.sample_count),
                        })
                      : tl("noDataPeriod")
                  }
                  muted={!frt?.available}
                />
                <StatBlock
                  label={tl("median")}
                  value={fmt.mins(frt?.median_mins ?? null)}
                  muted={!frt?.available}
                />
                <StatBlock
                  label={tl("people")}
                  value={fmt.mins(frt?.human_avg_mins ?? null)}
                  hint={tl("sessionsCount", {
                    count: fmt.num(frt?.human_samples),
                  })}
                  muted={!frt?.human_samples}
                />
                <StatBlock
                  label={tc("ai")}
                  value={fmt.mins(frt?.ai_avg_mins ?? null)}
                  hint={tl("sessionsCount", {
                    count: fmt.num(frt?.ai_samples),
                  })}
                  muted={!frt?.ai_samples}
                />
              </div>
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
              <ChartSkeleton height={120} />
            ) : (
              <div className="grid grid-cols-1 gap-2">
                <StatBlock
                  label={tl("avgPerConversation")}
                  value={
                    msg?.available
                      ? fmt.num(msg.avg_messages_per_conversation ?? 0)
                      : fmt.na
                  }
                  hint={tl("conversationsWithMessages", {
                    count: fmt.num(msg?.conversations_with_messages),
                  })}
                  muted={!msg?.available}
                />
                {msg?.avg_messages_all_scoped != null &&
                msg.conversations_with_messages > 0 &&
                msg.avg_messages_all_scoped !==
                  msg.avg_messages_per_conversation ? (
                  <p className="px-1 text-2xs text-muted-foreground">
                    {tl("avgIncludingShells", {
                      avg: fmt.num(msg.avg_messages_all_scoped),
                    })}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <StatBlock
                    label={tl("fromCustomer")}
                    value={
                      msg?.available ? fmt.num(msg.avg_inbound ?? 0) : fmt.na
                    }
                    muted={!msg?.available}
                  />
                  <StatBlock
                    label={tl("fromTeam")}
                    value={
                      msg?.available ? fmt.num(msg.avg_outbound ?? 0) : fmt.na
                    }
                    muted={!msg?.available}
                  />
                </div>
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
              <ChartSkeleton height={120} />
            ) : (
              <div className="grid grid-cols-1 gap-2">
                <StatBlock
                  label={tl("reopenPct")}
                  value={
                    reopen?.available && reopen.reopen_rate != null
                      ? fmt.pct(reopen.reopen_rate)
                      : fmt.na
                  }
                  hint={
                    reopen?.available
                      ? tl("reopenedOfFinished", {
                          reopened: fmt.num(reopen.reopened_count),
                          finished: fmt.num(
                            reopen.finished_count ??
                              reopen.finished_event_count,
                          ),
                        })
                      : tl("noReopenHistory")
                  }
                  muted={!reopen?.available}
                />
                <StatBlock
                  label={tc("quantity")}
                  value={fmt.num(reopen?.reopened_count)}
                  hint={
                    (reopen?.finished_event_count ?? 0) > 0 &&
                    reopen?.finished_count != null &&
                    reopen.finished_event_count !== reopen.finished_count
                      ? tl("finishedEventsTelemetry", {
                          count: fmt.num(reopen.finished_event_count),
                        })
                      : undefined
                  }
                  muted={!reopen?.available}
                />
              </div>
            )}
          </Surface>
        </div>
      </div>

      {/* Dedicated template volume block: was easy to miss inside Messages. */}
      <div>
        <SectionLabel
          title={ts("templates")}
          subtitle={ts("templatesSub")}
        />
        <Surface>
          <SectionTitle
            icon={<WhatsappLogo className="h-4 w-4" weight="fill" />}
            iconBg={channelPlate("whatsapp")}
            title={ts("templatesTitle")}
            subtitle={ts("templatesTitleSub")}
          />
          {loading ? (
            <ChartSkeleton height={100} />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatBlock
                label={tl("templatesSent")}
                value={fmt.num(msg?.template_messages ?? 0)}
                hint={tl("templatesSentHint")}
                muted={!(msg?.template_messages ?? 0)}
              />
              <StatBlock
                label={tl("conversationsWithTemplateLabel")}
                value={fmt.num(msg?.conversations_with_template ?? 0)}
                hint={tl("conversationsWithTemplate", {
                  count: fmt.num(msg?.conversations_with_template ?? 0),
                })}
                muted={!(msg?.conversations_with_template ?? 0)}
              />
              <StatBlock
                label={tl("avgTemplate")}
                value={
                  msg?.avg_template != null
                    ? fmt.num(msg.avg_template)
                    : fmt.na
                }
                hint={tl("avgTemplateHint")}
                muted={msg?.avg_template == null || msg.avg_template === 0}
              />
              <StatBlock
                label={tl("templateShareOfOutbound")}
                value={(() => {
                  const templates = msg?.template_messages ?? 0;
                  const outboundAvg = msg?.avg_outbound ?? 0;
                  const withMsgs = msg?.conversations_with_messages ?? 0;
                  const outboundTotal = outboundAvg * withMsgs;
                  if (!outboundTotal || !msg?.available) return fmt.na;
                  return fmt.pct((templates / outboundTotal) * 100);
                })()}
                hint={tl("templateShareHint")}
                muted={!(msg?.template_messages ?? 0)}
              />
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
            <ChartSkeleton height={120} />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatBlock
                label={tl("aiSessions")}
                value={fmt.num(ai?.sessions)}
                muted={!ai?.available}
              />
              <StatBlock
                label={tl("stillActive")}
                value={fmt.num(ai?.open_sessions)}
                muted={!ai?.available}
              />
              <StatBlock
                label={tl("resolvedByAi")}
                value={ai?.available ? fmt.pct(ai.containment_rate) : fmt.na}
                hint={tl("withoutHuman", {
                  count: fmt.num(ai?.contained),
                })}
                muted={!ai?.available}
              />
              <StatBlock
                label={tl("handedToHuman")}
                value={ai?.available ? fmt.pct(ai.handoff_rate) : fmt.na}
                hint={tl("transfers", {
                  count: fmt.num(ai?.handed_off),
                })}
                muted={!ai?.available}
              />
            </div>
          )}
        </Surface>
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
    return [
      {
        key: "finished",
        name: st("finished"),
        value: dist.finished,
        color: COLORS.finished,
      },
      {
        key: "ongoing",
        name: st("ongoing"),
        value: dist.ongoing,
        color: COLORS.ongoing,
      },
      {
        key: "pending",
        name: st("pending"),
        value: dist.pending,
        color: COLORS.pending,
      },
    ].filter((s) => s.value > 0);
  }, [dist, total, st]);

  const resolutionRate =
    total > 0 && dist ? Math.round((dist.finished / total) * 1000) / 10 : null;

  const config: ChartConfig = {
    finished: { label: st("finished"), color: COLORS.finished },
    ongoing: { label: st("ongoing"), color: COLORS.ongoing },
    pending: { label: st("pending"), color: COLORS.pending },
  };

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
      <ChartContainer config={config} className="mx-auto h-[200px] w-full max-w-[220px]">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            {...vozRing(78, 66)}
          >
            {slices.map((s) => (
              <Cell key={s.key} fill={s.color} />
            ))}
          </Pie>
          {/* The hole earns its keep: the slice total lives in the centre, so
              the donut reads as "N conversations, composed like this" without
              a trip to the side panel. */}
          <text
            x="50%"
            y="46%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground font-display text-xl font-semibold"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {fmt.num(total)}
          </text>
          <text
            x="50%"
            y="57%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[hsl(var(--muted-foreground))] text-[10px] font-medium"
          >
            {tl("conversations")}
          </text>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="name"
                formatter={(value, name) => {
                  const n = Number(value);
                  const pct = total > 0 ? ((n / total) * 100).toFixed(1) : "0";
                  return (
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{String(name)}</span>
                      <span className="font-semibold tabular-nums">
                        {fmt.num(n)} ({pct}%)
                      </span>
                    </div>
                  );
                }}
              />
            }
          />
        </PieChart>
      </ChartContainer>

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
        <ul className="space-y-2">
          {slices.map((s) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            return (
              <li key={s.key}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {fmt.num(s.value)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: s.color }}
                  />
                </div>
                <p className="mt-0.5 text-right text-2xs tabular-nums text-muted-foreground">
                  {tl("pctOfTotal", { pct: pct.toFixed(1) })}
                </p>
              </li>
            );
          })}
        </ul>
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

function DepartmentStackedChart({
  rows,
  loading,
}: {
  rows: DepartmentRow[] | undefined;
  loading: boolean;
}) {
  const st = useTranslations("metricsOps.attendance.status");
  const tc = useTranslations("metricsOps.common");
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();
  const finishedLabel = st("finished");
  const ongoingLabel = st("ongoing");
  const pendingLabel = st("pending");
  const noDept = tc("noDepartment");

  const data = useMemo(() => {
    if (!rows?.length) return [];
    return [...rows]
      .map((r) => {
        const fullName = (r.department_name || "").trim() || noDept;
        return {
          name: fullName.length > 18 ? `${fullName.slice(0, 16)}…` : fullName,
          fullName,
          concluidas: r.finished,
          em_andamento: r.ongoing,
          aguardando: r.pending,
          total: r.finished + r.ongoing + r.pending,
          tme: r.avg_wait_mins,
          tma: r.avg_handle_mins,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [rows, noDept]);

  if (loading) return <ChartSkeleton height={260} />;
  if (!data.length) {
    return (
      <EmptyChart
        icon={<Buildings className="h-9 w-9" weight="fill" />}
        message={tl("noDepartmentsInSlice")}
        height={260}
      />
    );
  }

  const chartH = Math.max(200, data.length * 36 + 48);

  return (
    <div style={{ height: chartH }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 28, right: 12, left: 4, bottom: 4 }}
          barCategoryGap={8}
        >
          <CartesianGrid {...vozGrid} vertical horizontal={false} />
          <XAxis type="number" allowDecimals={false} {...vozXAxis} />
          <YAxis type="category" dataKey="name" {...vozYAxis} width={118} />
          <Tooltip
            cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as (typeof data)[0];
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                  <p className="mb-1.5 font-semibold text-foreground">
                    {row.fullName}
                  </p>
                  <p className="text-muted-foreground">
                    {finishedLabel}:{" "}
                    <span className="font-medium text-foreground">
                      {fmt.num(row.concluidas)}
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
                    {tl("waitDurationHint", {
                      wait: fmt.mins(row.tme),
                      duration: fmt.mins(row.tma),
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
            dataKey="concluidas"
            name={finishedLabel}
            stackId="s"
            fill={COLORS.finished}
            radius={[0, 0, 0, 0]}
            barSize={16}
          />
          <Bar
            dataKey="em_andamento"
            name={ongoingLabel}
            stackId="s"
            fill={COLORS.ongoing}
            barSize={16}
          />
          <Bar
            dataKey="aguardando"
            name={pendingLabel}
            stackId="s"
            fill={COLORS.pending}
            radius={[0, 4, 4, 0]}
            barSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
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
    <div className="space-y-4">
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
            <div className="grid gap-4 xl:grid-cols-12">
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

          <div>
            <SectionLabel
              title={ts("departments")}
              subtitle={ts("departmentsSub")}
            />
            <div className="grid gap-4 xl:grid-cols-12">
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
            <div className="grid gap-4 xl:grid-cols-12">
              <Surface className="xl:col-span-5">
                <SectionTitle
                  icon={<Users className="h-4 w-4" weight="fill" />}
                  iconBg={GLYPH_PLATE.Users}
                  title={ts("teamRank")}
                  subtitle={ts("teamRankSub")}
                />
                <TeamResolutionChart
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
              </div>
            </Surface>
          </div>
        </>
      )}
    </div>
  );
}
