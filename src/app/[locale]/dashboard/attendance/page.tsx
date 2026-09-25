"use client";

import {
  ArrowClockwise,
  Buildings,
  ChartBar,
  ChartLineUp,
  ChartPie,
  CheckCircle,
  Clock,
  ClockCounterClockwise,
  FlowArrow,
  Headset,
  Hourglass,
  Kanban,
  Lightning,
  CurrencyDollar,
  DotsThree,
  SlidersHorizontal,
  PaperPlaneTilt,
  PhoneIncoming,
  Pulse,
  Robot,
  SealCheck,
  Target,
  Timer,
  TrendUp,
  UserCircle,
  UserMinus,
  Users,
  UsersThree,
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
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type {
  AttendanceOverview,
  AttendanceOverviewParams,
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
import { useQueryClient } from "@tanstack/react-query";
import { useAttendanceSection } from "@/hooks/use-attendance-section";
import { useInView } from "@/hooks/use-in-view";
import { attendanceSectionsKey } from "@/lib/attendance/sections";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { useReportJob } from "@/hooks/use-report-job";
import { useToast } from "@/hooks/use-toast";
import type { AttendanceReportParams, ReportFormat } from "@/lib/reports/types";
import { ExportMenuItems } from "@/components/reports/export-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listMembersAction } from "@/app/actions/workspace";
import { listWhatsAppCampaignsAction } from "@/app/actions/whatsapp-campaigns";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";
import { dispatchReportsKey } from "@/lib/whatsapp-campaigns/dispatch-report";
import { DispatchReportChapter } from "@/components/dashboard/attendance/dispatch-report";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import { fetchDepartments } from "@/lib/department/client";
import type { Department } from "@/lib/department/types";
import type { WorkspaceMember } from "@/lib/workspace/types";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { cn } from "@/lib/utils";
import { ChannelTile } from "@/components/channels/channel-tile";
import { useWorkspace } from "@/contexts/workspace-context";
import { useLocale, useTranslations } from "next-intl";
import { WaffleChart } from "@/components/charts/dense-charts";
import { DonutBreakdown } from "@/components/charts/donut-breakdown";
import { ShareRows } from "@/components/charts/share-rows";
import { TeamResponseChart } from "@/components/charts/team-response-chart";
import { entityColorIndex, share } from "@/lib/charts/data";
import {
  ATTENDANCE_COLORS as COLORS,
  LOCALE_TAG,
  ChartSkeleton,
  Chapter,
  EmptyChart,
  SectionTitle,
  Surface,
  useActorKindLabel,
  useMetricsFmt,
  usePresenceLabel,
} from "@/components/dashboard/attendance/primitives";
import {
  BacklogXraySection,
  PeriodProgressStrip,
  ProjectionGrid,
  QualitySection,
  RevenueCard,
  ReworkSection,
  TeamRankingTable,
  TrendSection,
} from "@/components/dashboard/attendance/executive-panels";
import { TargetsDialog } from "@/components/dashboard/attendance/targets-dialog";
import { AttendanceAssistant } from "@/components/dashboard/attendance/attendance-assistant";
import type { ChatView } from "@/lib/aichat/types";

const ATTENDANCE_EXPORT_FORMATS: readonly ReportFormat[] = ["csv", "pdf"];

type DatePreset = "7d" | "30d" | "90d" | "custom";

const DEFAULT_TARGET_CURRENCY = "BRL";


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
  scoped: boolean;
}) {
  const t = useTranslations("metricsOps.attendance.kpi");
  const ts = useTranslations("metricsOps.attendance.sections");
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
      visual: <ProgressRing value={share(kpis?.finished ?? 0, (kpis?.finished ?? 0) + (kpis?.ongoing ?? 0) + (kpis?.pending ?? 0))} label={t("finished")} size={36} strokeWidth={4} color={COLORS.finished}><span /></ProgressRing>,
    },
    {
      key: "ongoing",
      label: t("ongoing"),
      short: t("ongoingShort"),
      value: loading ? tc("loading") : fmt.num(kpis?.ongoing),
      hint: t("ongoingHint"),
      icon: Pulse,
      bg: GLYPH_PLATE.Pulse,
      visual: <ProgressRing value={share(kpis?.ongoing ?? 0, (kpis?.finished ?? 0) + (kpis?.ongoing ?? 0) + (kpis?.pending ?? 0))} label={t("ongoing")} size={36} strokeWidth={4} color={COLORS.ongoing}><span /></ProgressRing>,
    },
    {
      key: "pending",
      label: t("pending"),
      short: t("pendingShort"),
      value: loading ? tc("loading") : fmt.num(kpis?.pending),
      hint: t("pendingHint"),
      icon: Hourglass,
      bg: GLYPH_PLATE.Hourglass,
      visual: <ProgressRing value={share(kpis?.pending ?? 0, (kpis?.finished ?? 0) + (kpis?.ongoing ?? 0) + (kpis?.pending ?? 0))} label={t("pending")} size={36} strokeWidth={4} color={COLORS.pending}><span /></ProgressRing>,
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

  const volume = cards.filter((c) => !TIME_KPIS.has(c.key));
  const times = cards.filter((c) => TIME_KPIS.has(c.key));

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
      <KpiGroup title={ts("volume")} cards={volume} loading={loading} />
      <KpiGroup title={ts("times")} cards={times} loading={loading} />
    </div>
  );
}

const TIME_KPIS = new Set(["tme", "tma", "frt"]);

function KpiGroup({
  title,
  cards,
  loading,
}: {
  title: string;
  cards: KpiDef[];
  loading: boolean;
}) {
  return (
    <section aria-label={title} className="min-w-0">
      <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{title}</h3>
      <dl
        className={cn(
          "grid gap-px overflow-hidden rounded-[--radius] border border-border bg-border",
          "grid-cols-2 [&>*:last-child:nth-child(odd)]:col-span-2",
          cards.length > 3
            ? "sm:grid-cols-5 sm:[&>*:last-child:nth-child(odd)]:col-span-1"
            : "sm:grid-cols-3 sm:[&>*:last-child:nth-child(odd)]:col-span-1",
        )}
        style={{ boxShadow: softSurfaceShadow }}
      >
        {cards.map((c) => (
          <div key={c.key} title={c.hint} className="min-w-0 bg-card px-4 py-3">
            <dt className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius]",
                  c.bg,
                )}
              >
                <c.icon className="h-4 w-4" weight="fill" />
              </span>
              <span className="truncate text-xs font-semibold text-muted-foreground">
                {c.label}
              </span>
            </dt>
            <dd className="mt-2 flex items-center justify-between gap-1">
              <span className="readout truncate font-display text-[1.75rem] leading-none font-semibold tracking-tight text-foreground">
                {c.value}
              </span>
              {!loading ? c.visual : null}
            </dd>
            <dd className="mt-1.5 truncate text-xs text-muted-foreground">{c.short}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const CHANNEL_BAR: Record<string, string> = {
  whatsapp: "#25d366",
  unofficial_whatsapp: "hsl(var(--chart-1))",
  instagram: "#e1306c",
  telegram: "#229ed9",
  voice: "#8b5cf6",
};

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
  const slices = useMemo(() => {
    if (!mix?.length) return [];
    return [...mix]
      .sort((a, b) => b.count - a.count)
      .map((c) => ({
        key: c.channel,
        label: channelLabel(c.channel, tc),
        value: c.count,
        color: CHANNEL_BAR[c.channel] ?? "hsl(var(--muted-foreground))",
      }));
  }, [mix, tc]);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (loading) return <ChartSkeleton height={260} />;
  if (total === 0) return <EmptyChart icon={<ChartPie className="h-8 w-8" weight="fill" />} message={tl("noChannelMix")} height={260} />;
  return (
    <DonutBreakdown
      slices={slices}
      total={total}
      centerValue={fmt.num(total)}
      centerLabel={tl("channelTotalConversations")}
      formatValue={fmt.num}
      formatShare={fmt.pct}
    />
  );
}

function FrtPanel({
  frt,
  loading,
}: {
  frt: OverviewFRT | undefined;
  loading: boolean;
}) {
  const tl = useTranslations("metricsOps.attendance.labels");
  const tc = useTranslations("metricsOps.common");
  const fmt = useMetricsFmt();

  if (loading) return <ChartSkeleton height={150} />;
  if (!frt?.available) {
    return (
      <EmptyChart
        icon={<Lightning className="h-8 w-8" weight="fill" />}
        message={tl("noDataPeriod")}
        height={150}
      />
    );
  }
  return (
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
  );
}

// A headline readout shared by the single-number panels: label left, figure
// right on one baseline, so every panel in a chapter reads the same way.
function PanelReadout({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-2xs font-semibold text-muted-foreground">{label}</span>
      <span
        className={cn(
          "readout font-display text-xl font-semibold tabular-nums",
          tone === "warning" ? "text-warning-ink" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function MessagesPanel({
  msg,
  loading,
}: {
  msg: OverviewMessaging | undefined;
  loading: boolean;
}) {
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();

  if (loading) return <ChartSkeleton height={130} />;
  if (!msg?.available) {
    return (
      <EmptyChart
        icon={<ChartBar className="h-8 w-8" weight="fill" />}
        message={tl("noDataPeriod")}
        height={130}
      />
    );
  }
  return (
    <div className="space-y-3">
      <PanelReadout
        label={tl("avgPerConversation")}
        value={fmt.num(msg.avg_messages_per_conversation ?? 0)}
      />
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
      </p>
    </div>
  );
}

function ReopenPanel({
  reopen,
  loading,
}: {
  reopen: OverviewReopen | undefined;
  loading: boolean;
}) {
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();

  if (loading) return <ChartSkeleton height={130} />;
  if (!reopen?.available) {
    return (
      <EmptyChart
        icon={<Pulse className="h-8 w-8" weight="fill" />}
        message={tl("noReopenHistory")}
        height={130}
      />
    );
  }
  const high = (reopen.reopen_rate ?? 0) >= 15;
  return (
    <div className="space-y-3">
      <PanelReadout
        label={tl("reopenPct")}
        value={reopen.reopen_rate != null ? fmt.pct(reopen.reopen_rate) : fmt.na}
        tone={high ? "warning" : "default"}
      />
      <Meter
        value={reopen.reopen_rate ?? 0}
        color={high ? "hsl(var(--warning))" : "hsl(var(--chart-1))"}
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
  );
}

function TemplatesPanel({
  msg,
  loading,
}: {
  msg: OverviewMessaging | undefined;
  loading: boolean;
}) {
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();

  const templateShare = (() => {
    const templates = msg?.template_messages ?? 0;
    const outboundTotal = (msg?.avg_outbound ?? 0) * (msg?.conversations_with_messages ?? 0);
    if (!outboundTotal || !msg?.available) return null;
    return Math.min(100, (templates / outboundTotal) * 100);
  })();

  if (loading) return <ChartSkeleton height={110} />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
      <div className="min-w-0">
        <PanelReadout
          label={tl("templateShareOfOutbound")}
          value={templateShare != null ? fmt.pct(templateShare) : fmt.na}
        />
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
  );
}

function AiPanel({
  ai,
  loading,
}: {
  ai: OverviewAI | undefined;
  loading: boolean;
}) {
  const ts = useTranslations("metricsOps.attendance.sections");
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useMetricsFmt();

  if (loading) return <ChartSkeleton height={110} />;
  if (!ai?.available) {
    return (
      <EmptyChart
        icon={<Robot className="h-8 w-8" weight="fill" />}
        message={tl("noDataPeriod")}
        height={110}
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
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
  );
}

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

  if (loading) return <ChartSkeleton height={260} />;
  if (total === 0) {
    return (
      <EmptyChart
        icon={<ChartBar className="h-9 w-9" weight="fill" />}
        message={tl("noConversationVolume")}
        height={260}
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
      <ChartContainer config={config} className="h-[260px] w-full">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
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
  const resolutionRate =
    total > 0 && dist ? Math.round((dist.finished / total) * 1000) / 10 : null;

  if (loading) return <ChartSkeleton height={260} />;
  if (!dist || total === 0) {
    return (
      <EmptyChart
        icon={<ChartPie className="h-9 w-9" weight="fill" />}
        message={tl("noStatusData")}
        height={260}
      />
    );
  }

  return (
    <div className="space-y-3">
      <DonutBreakdown
        slices={[
          { key: "finished", label: st("finishedShort"), value: dist.finished, color: COLORS.finished },
          { key: "ongoing", label: st("ongoingShort"), value: dist.ongoing, color: COLORS.ongoing },
          { key: "pending", label: st("pendingShort"), value: dist.pending, color: COLORS.pending },
        ]}
        total={total}
        centerValue={fmt.num(total)}
        centerLabel={tl("conversationsLabel")}
        formatValue={fmt.num}
        formatShare={fmt.pct}
      />
      <div className="border-t border-border pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{tl("pctFinished")}</span>
          <span className="readout font-display text-xl font-semibold tabular-nums text-foreground">
            {fmt.pct(resolutionRate)}
          </span>
        </div>
        <p className="text-2xs text-muted-foreground">
          {tl("ofConversations", { finished: fmt.num(dist.finished), total: fmt.num(total) })}
        </p>
      </div>
      <OverallCloseOriginNote bySource={bySource} />
    </div>
  );
}

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
    <div className="border-t border-border pt-3">
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

  const fmt = useMetricsFmt();
  const total = blocks.reduce((sum, block) => sum + block.value, 0);

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

  return <ShareRows rows={blocks} total={total} formatValue={fmt.num} formatShare={fmt.pct} />;
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
                      <span className="font-normal">
                        {`(${
                          s.rot_days_set
                            ? tl("stuckAfter", { days: s.stuck_after_days })
                            : tl("stuckAfterDefault", { days: s.stuck_after_days })
                        })`}
                      </span>
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
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border-strong text-2xs font-semibold text-muted-foreground">
            <th className="px-2 py-2">{tl("stageCol")}</th>
            <th className="px-2 py-2 text-right" title={tl("engagedColTitle")}>
              {tl("engagedCol")}
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
          {stages.unstaged_engaged > 0 ? (
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
  const activeFunnelId = funnels.some((f) => f.funnel_id === pickedFunnelId)
    ? pickedFunnelId
    : (funnels[0]?.funnel_id ?? null);
  const activeFunnel = funnels.find((f) => f.funnel_id === activeFunnelId);

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-12">
        <Surface className="xl:col-span-4">
          <SectionTitle title={ts("stageCoverage")} subtitle={ts("stageCoverageSub")} />
          <StageCoveragePanel
            stages={stages}
            loading={loading}
            activeFunnelId={activeFunnelId}
            onSelectFunnel={setPickedFunnelId}
          />
        </Surface>

        <Surface className="xl:col-span-8">
          <SectionTitle title={ts("stageChart")} subtitle={ts("stageChartSub")} />
          <StageLadder funnel={activeFunnel} loading={loading} />
        </Surface>
      </div>

      <Surface className="min-w-0">
        <SectionTitle title={ts("stageTable")} subtitle={ts("stageTableSub")} />
        <StageDetailTable stages={stages} loading={loading} />
      </Surface>
    </>
  );
}


export default function AttendanceOpsPage() {
  const { currentWorkspace, can, permissionsLoading } = useWorkspace();
  const t = useTranslations("metricsOps.attendance");
  const ts = useTranslations("metricsOps.attendance.sections");
  const tc = useTranslations("metricsOps.common");
  const tl = useTranslations("metricsOps.attendance.labels");
  const tg = useTranslations("metricsOps.attendance.glossary");
  const texp = useTranslations("metricsOps.export");
  const { toast } = useToast();
  const { running: exporting, request: requestReport } = useReportJob({
    onQueued: () => {
      toast({ title: texp("queuedTitle"), description: texp("queuedBody") });
    },
  });
  const te = useTranslations("metricsOps.attendance.executive");
  const td = useTranslations("metricsOps.attendance.dispatch");
  const actorKindLabel = useActorKindLabel();
  const presenceLabel = usePresenceLabel();
  const fmt = useMetricsFmt();
  const canRead = !permissionsLoading && can("attendance", "read");
  const canWriteTargets =
    !permissionsLoading && can("attendance_targets", "update");
  const canAsk = canRead && can("ai_chat", "create");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId") || undefined;
  const campaignType =
    searchParams.get("campaignType") === "whatsapp"
      ? searchParams.get("campaignType")!
      : undefined;
  const pathname = usePathname();
  const canReadCampaigns = !permissionsLoading && can("whatsapp_campaigns", "read");
  const canReadAnalysis = !permissionsLoading && can("analysis", "read");
  const dispatchCampaignId = campaignType === "whatsapp" ? campaignId : undefined;
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const selectCampaign = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === "all") {
        params.delete("campaignId");
        params.delete("campaignType");
      } else {
        params.set("campaignId", id);
        params.set("campaignType", "whatsapp");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

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
  const [rankMetric, setRankMetric] = useState("resolved");
  const [targetsOpen, setTargetsOpen] = useState(false);
  const queryClient = useQueryClient();

  const sectionParams = useMemo<AttendanceOverviewParams>(
    () => ({
      dateFrom,
      dateTo,
      departmentId: departmentId === "all" ? undefined : departmentId,
      memberId: memberId === "all" ? undefined : memberId,
      channel: channel === "all" ? undefined : channel,
      campaignId,
      campaignType,
      includeAi,
      rankMetric,
    }),
    [dateFrom, dateTo, departmentId, memberId, channel, campaignId, campaignType, includeAi, rankMetric],
  );

  const [trendRef, trendInView] = useInView<HTMLElement>();
  const [backlogRef, backlogInView] = useInView<HTMLElement>();
  const [stagesRef, stagesInView] = useInView<HTMLElement>();
  const [departmentsRef, departmentsInView] = useInView<HTMLElement>();
  const [rankingRef, rankingInView] = useInView<HTMLElement>();
  const [membersRef, membersInView] = useInView<HTMLElement>();

  const summaryQuery = useAttendanceSection("summary", sectionParams, { enabled: canRead });
  const trendQuery = useAttendanceSection("trend", sectionParams, { enabled: canRead && trendInView });
  const backlogQuery = useAttendanceSection("backlog", sectionParams, { enabled: canRead && backlogInView });
  const stagesQuery = useAttendanceSection("stages", sectionParams, { enabled: canRead && stagesInView });
  const teamQuery = useAttendanceSection("team", sectionParams, {
    enabled: canRead && (departmentsInView || rankingInView || membersInView),
  });

  const summary = summaryQuery.data;
  const team = teamQuery.data;
  const loading = summaryQuery.isPending;
  const targetCurrency =
    summary?.revenue?.currencies?.[0]?.currency ?? DEFAULT_TARGET_CURRENCY;

  const workspaceId = currentWorkspace?.id;
  const conversions = summary?.revenue?.available
    ? summary.revenue.currencies.reduce((total, row) => total + row.won_count, 0)
    : null;

  const refreshSections = useCallback(() => {
    if (!workspaceId) return;
    void queryClient.invalidateQueries({ queryKey: attendanceSectionsKey(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: dispatchReportsKey(workspaceId) });
  }, [queryClient, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !canReadCampaigns) return;
    let cancelled = false;
    listWhatsAppCampaignsAction(1, 100, "desc", workspaceId).then((r) => {
      if (!cancelled) setCampaigns((r.campaigns ?? []).filter((c) => c.type !== "organic"));
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, canReadCampaigns]);

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

  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = [
    departmentId !== "all",
    memberId !== "all",
    channel !== "all",
    Boolean(dispatchCampaignId),
    !includeAi,
  ].filter(Boolean).length;
  const clearFilters = useCallback(() => {
    setDepartmentId("all");
    setMemberId("all");
    setChannel("all");
    setIncludeAi(true);
    selectCampaign("all");
  }, [selectCampaign]);

  const applyPreset = useCallback((p: DatePreset) => {
    setPreset(p);
    if (p === "custom") {
      setFiltersOpen(true);
      return;
    }
    const days = p === "7d" ? 6 : p === "30d" ? 29 : 89;
    setDateFrom(format(subDays(new Date(), days), "yyyy-MM-dd"));
    setDateTo(format(new Date(), "yyyy-MM-dd"));
  }, []);

  const exportReport = useCallback(async (format: ReportFormat) => {
    if (!summary) return;
    const outcome = await requestReport({
      kind: "attendance_overview",
      format,
      locale,
      params: {
        dateFrom,
        dateTo,
        departmentId: departmentId === "all" ? undefined : departmentId,
        memberId: memberId === "all" ? undefined : memberId,
        channel: channel === "all" ? undefined : channel,
        campaignId,
        campaignType,
        includeAi,
        rankMetric,
        workspaceName: currentWorkspace?.name,
        departmentLabel:
          departmentId === "all"
            ? tc("all")
            : (departments.find((d) => d.id === departmentId)?.name ?? departmentId),
        memberLabel:
          memberId === "all"
            ? tc("all")
            : (() => {
                const member = members.find((x) => x.userId === memberId);
                return member ? member.username || member.email : memberId;
              })(),
        channelLabel: channel === "all" ? tc("all") : tc(channel),
      } satisfies AttendanceReportParams,
    });

    if (outcome.status === "done") {
      toast({ title: texp("ready") });
      return;
    }
    toast({
      title: texp("failed"),
      description:
        outcome.status === "failed"
          ? texp(`failure.${outcome.job.failureCode ?? "render_failed"}`)
          : outcome.error,
      variant: "destructive",
    });
  }, [
    summary,
    requestReport,
    toast,
    locale,
    texp,
    tc,
    dateFrom,
    dateTo,
    departmentId,
    departments,
    memberId,
    members,
    channel,
    includeAi,
    rankMetric,
    campaignId,
    campaignType,
    currentWorkspace?.name,
  ]);

  const kpis = summary?.kpis;
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

  const assistantView = useMemo<ChatView>(
    () => ({
      surface: "attendance",
      dateFrom,
      dateTo,
      departmentId: departmentId === "all" ? undefined : departmentId,
      memberId: memberId === "all" ? undefined : memberId,
      channel: channel === "all" ? undefined : channel,
      campaignId,
      campaignType,
      includeAi,
    }),
    [dateFrom, dateTo, departmentId, memberId, channel, campaignId, campaignType, includeAi],
  );
  const ta = useTranslations("metricsOps.attendance.assistant");
  const selectedMember = members.find((m) => m.userId === memberId);
  const assistantScope = {
    period: periodLabel,
    department:
      departmentId === "all"
        ? ta("allDepartments")
        : (departments.find((d) => d.id === departmentId)?.name ?? departmentId),
    member:
      memberId === "all"
        ? ta("allMembers")
        : (selectedMember?.username || selectedMember?.email || memberId),
    channel: channel === "all" ? ta("allChannels") : tc(channel),
    campaign: campaignId ? (campaigns.find((c) => c.id === campaignId)?.name ?? campaignId) : undefined,
  };

  return (
    <div className="space-y-6">
      <div>
        <DashboardPageHeader
          layout="inline"
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

              <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                <PopoverTrigger asChild>
                  <Button
                    icon={<SlidersHorizontal className="h-4 w-4" weight="bold" />}
                    iconVisible
                    title={activeFilters > 0 ? `${tc("filters")} (${activeFilters})` : tc("filters")}
                    variant={activeFilters > 0 ? "secondary" : "command"}
                  />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(92vw,22rem)] space-y-2.5 p-3">
                  {preset === "custom" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <ElevatedDatePicker id="ops-date-from" label={tc("start")} value={dateFrom} onChange={setDateFrom} />
                      <ElevatedDatePicker id="ops-date-to" label={tc("end")} value={dateTo} onChange={setDateTo} />
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
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

                    <ElevatedSelect
                      label={tc("channel")}
                      value={channel}
                      onValueChange={setChannel}
                      placeholder={tc("all")}
                    >
                      <ElevatedSelectItem value="all">{tc("all")}</ElevatedSelectItem>
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

                    {canReadCampaigns && campaigns.length > 0 ? (
                      <ElevatedSelect
                        label={td("campaignFilter")}
                        value={dispatchCampaignId ?? "all"}
                        onValueChange={selectCampaign}
                        placeholder={td("allCampaigns")}
                      >
                        <ElevatedSelectItem value="all">{td("allCampaigns")}</ElevatedSelectItem>
                        {campaigns.map((c) => (
                          <ElevatedSelectItem key={c.id} value={c.id}>
                            {c.name}
                          </ElevatedSelectItem>
                        ))}
                      </ElevatedSelect>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={includeAi}
                        onChange={(e) => setIncludeAi(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-border text-primary-ink focus:ring-ring"
                      />
                      <span className="whitespace-nowrap font-medium text-foreground">{tl("showAi")}</span>
                    </label>
                    <Button
                      variant="ghost"
                      title={tc("clearFilters")}
                      onClick={clearFilters}
                      disabled={activeFilters === 0}
                    />
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                icon={<ArrowClockwise className="h-4 w-4" weight="bold" />}
                iconVisible
                aria-label={tc("refresh")}
                variant="command"
                onClick={refreshSections}
                disabled={loading}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    icon={<DotsThree className="h-4 w-4" weight="bold" />}
                    iconVisible
                    aria-label={exporting ? texp("preparing") : tc("moreActions")}
                    variant="command"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[14rem]">
                  {canWriteTargets ? (
                    <>
                      <DropdownMenuItem onSelect={() => setTargetsOpen(true)} className="flex cursor-pointer items-center gap-2.5">
                        <Target className="h-4 w-4 shrink-0" weight="bold" />
                        <span className="text-sm">{te("targetsTitle")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <ExportMenuItems
                    formats={ATTENDANCE_EXPORT_FORMATS}
                    onSelect={(format) => void exportReport(format)}
                    disabled={exporting || loading || !summary}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />

        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
          <span className="font-semibold text-foreground">{periodLabel}</span>
          <span aria-hidden>·</span>
          <span>{loading ? tc("loading") : tl("conversationsInSlice", { count: fmt.num(total) })}</span>
          {team ? (
            <>
              <span aria-hidden>·</span>
              <span>{tl("agentsCount", { count: fmt.num(team.by_member?.length) })}</span>
              <span aria-hidden>·</span>
              <span>{tl("departmentsCount", { count: fmt.num(team.by_department?.length) })}</span>
            </>
          ) : null}
          {!loading && summary?.generated_at ? (
            <>
              <span aria-hidden>·</span>
              <span title={summary.generated_at}>
                {te("generatedAt", {
                  at: new Date(summary.generated_at).toLocaleString(LOCALE_TAG[locale] ?? "en-US"),
                })}
              </span>
            </>
          ) : null}
        </p>

          <div className="mt-3">
            <SectionState query={summaryQuery}>
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
            </SectionState>
          </div>
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
          {canReadCampaigns && (channel === "all" || channel === "whatsapp") ? (
            <DispatchReportChapter
              campaignId={dispatchCampaignId}
              departmentId={departmentId === "all" ? undefined : departmentId}
              dateFrom={dateFrom}
              dateTo={dateTo}
              conversions={conversions}
              canReadAnalysis={canReadAnalysis}
              onSelectCampaign={selectCampaign}
            />
          ) : null}

          <Chapter
            id="att-tactical"
            icon={<Target className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.Target}
            title={ts("tactical")}
            subtitle={ts("tacticalSub")}
          >
            <SectionState query={summaryQuery}>
              <PeriodProgressStrip
                period={summary?.period}
                standing={summary?.standing}
                loading={loading}
                fmt={fmt}
                onConfigureSchedule={() =>
                  router.push(`/${locale}/dashboard/workspace`)
                }
              />
              <ProjectionGrid
                projections={summary?.projections}
                loading={loading}
                fmt={fmt}
                currency={targetCurrency}
                onEditTargets={
                  canWriteTargets ? () => setTargetsOpen(true) : undefined
                }
              />
            </SectionState>
          </Chapter>

          <Chapter
            id="att-money"
            icon={<CurrencyDollar className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.CurrencyDollar}
            title={ts("money")}
            subtitle={ts("moneySub")}
          >
            <SectionState query={summaryQuery}>
              <RevenueCard revenue={summary?.revenue} loading={loading} fmt={fmt} />
            </SectionState>
          </Chapter>

          <Chapter
            id="att-history"
            ref={trendRef}
            icon={<ChartLineUp className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.ChartLineUp}
            title={ts("history")}
            subtitle={ts("historySub")}
          >
            <SectionState query={trendQuery}>
              <TrendSection
                trend={trendQuery.data?.trend}
                loading={trendQuery.isPending}
                fmt={fmt}
                currency={targetCurrency}
              />
            </SectionState>
          </Chapter>

          <Chapter
            id="att-volume"
            icon={<ChartBar className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.ChartBar}
            title={ts("volume")}
            subtitle={ts("volumeSub")}
          >
            <SectionState query={summaryQuery}>
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-12">
                <Surface className="lg:col-span-2 xl:col-span-6">
                  <SectionTitle title={ts("hourly")} subtitle={ts("hourlySub")} />
                  <HourlyVolumeChart hourly={summary?.hourly} loading={loading} />
                </Surface>
                <Surface className="xl:col-span-3">
                  <SectionTitle title={ts("status")} subtitle={ts("statusSub")} />
                  <StatusCompositionChart
                    dist={summary?.status_distribution}
                    bySource={summary?.finished_by_source}
                    loading={loading}
                  />
                </Surface>
                <Surface className="xl:col-span-3">
                  <SectionTitle title={ts("channelsUsed")} subtitle={ts("channelsUsedSub")} />
                  <ChannelMixChart mix={summary?.channel_mix} loading={loading} />
                </Surface>
              </div>
            </SectionState>
          </Chapter>

          <Chapter
            id="att-quality"
            icon={<SealCheck className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.SealCheck}
            title={ts("quality")}
            subtitle={ts("qualitySub")}
          >
            <SectionState query={summaryQuery}>
              <div className="grid items-start gap-3 xl:grid-cols-12">
                <Surface className="xl:col-span-3">
                  <SectionTitle title={ts("reopen")} subtitle={ts("reopenSub")} />
                  <ReopenPanel reopen={summary?.reopen} loading={loading} />
                </Surface>
                <div className="min-w-0 xl:col-span-9">
                  <QualitySection
                    quality={summary?.quality}
                    loading={loading}
                    fmt={fmt}
                    onConfigure={
                      currentWorkspace?.id
                        ? () => router.push(`/${locale}/dashboard/workspace`)
                        : undefined
                    }
                  />
                </div>
              </div>
            </SectionState>
          </Chapter>

          <div className="grid gap-6 xl:grid-cols-3 xl:gap-3">
            <Chapter
              id="att-times"
              icon={<Timer className="h-4 w-4" weight="fill" />}
              iconBg={GLYPH_PLATE.Timer}
              title={ts("times")}
              subtitle={ts("timesSub")}
            >
              <SectionState query={summaryQuery}>
                <Surface className="flex-1">
                  <SectionTitle title={ts("frtTitle")} subtitle={ts("frtSub")} />
                  <FrtPanel frt={summary?.frt} loading={loading} />
                </Surface>
              </SectionState>
            </Chapter>

            <Chapter
              id="att-ai"
              icon={<Robot className="h-4 w-4" weight="fill" />}
              iconBg={GLYPH_PLATE.Robot}
              title={ts("ai")}
              subtitle={ts("aiSub")}
            >
              <SectionState query={summaryQuery}>
                <Surface className="flex-1">
                  <SectionTitle title={ts("aiTitle")} subtitle={ts("aiTitleSub")} />
                  <AiPanel ai={summary?.ai} loading={loading} />
                </Surface>
              </SectionState>
            </Chapter>

            <Chapter
              id="att-messaging"
              icon={<PaperPlaneTilt className="h-4 w-4" weight="fill" />}
              iconBg={GLYPH_PLATE.PaperPlaneTilt}
              title={ts("messaging")}
              subtitle={ts("messagingSub")}
            >
              <SectionState query={summaryQuery}>
                <Surface>
                  <SectionTitle title={ts("messages")} subtitle={ts("messagesSub")} />
                  <MessagesPanel msg={summary?.messaging} loading={loading} />
                </Surface>
                <Surface className="flex-1">
                  <SectionTitle title={ts("templates")} subtitle={ts("templatesSub")} />
                  <TemplatesPanel msg={summary?.messaging} loading={loading} />
                </Surface>
              </SectionState>
            </Chapter>
          </div>

          <Chapter
            id="att-backlog"
            ref={backlogRef}
            icon={<Hourglass className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.Hourglass}
            title={ts("backlog")}
            subtitle={ts("backlogSub")}
            meta={
              backlogQuery.data?.backlog_xray?.available
                ? te("backlogTotal", { count: fmt.num(backlogQuery.data.backlog_xray.total) })
                : undefined
            }
          >
            <SectionState query={backlogQuery}>
              <BacklogXraySection
                backlog={backlogQuery.data?.backlog_xray}
                loading={backlogQuery.isPending}
                fmt={fmt}
                channelLabel={(c) => channelLabel(c, tc)}
                showTotal={false}
              />
            </SectionState>
          </Chapter>

          <Chapter
            id="att-stages"
            ref={stagesRef}
            icon={<Kanban className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.Kanban}
            title={ts("stages")}
            subtitle={ts("stagesSub")}
          >
            <SectionState query={stagesQuery}>
              <StageDistributionSection
                stages={stagesQuery.data?.stages}
                loading={stagesQuery.isPending}
              />
            </SectionState>
          </Chapter>

          <Chapter
            id="att-departments"
            ref={departmentsRef}
            icon={<Buildings className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.Buildings}
            title={ts("departments")}
            subtitle={ts("departmentsSub")}
          >
            <SectionState query={teamQuery}>
              <div className="grid gap-3 xl:grid-cols-12">
                <Surface className="xl:col-span-4">
                  <SectionTitle title={ts("deptChart")} subtitle={ts("deptChartSub")} />
                  <DepartmentStackedChart
                    rows={team?.by_department}
                    loading={teamQuery.isPending}
                  />
                </Surface>
                <Surface className="xl:col-span-8">
                  <SectionTitle title={ts("deptTable")} subtitle={ts("deptTableSub")} />
                  <DepartmentDetailTable
                    rows={team?.by_department}
                    loading={teamQuery.isPending}
                  />
                </Surface>
              </div>
            </SectionState>
          </Chapter>

          <Chapter
            id="att-team-xray"
            ref={rankingRef}
            icon={<Pulse className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.Pulse}
            title={ts("teamXray")}
            subtitle={ts("teamXraySub")}
          >
            <SectionState query={teamQuery}>
              <TeamRankingTable
                ranking={team?.team_ranking}
                loading={teamQuery.isPending}
                fmt={fmt}
                rankMetric={rankMetric}
                onRankMetricChange={setRankMetric}
              />
            </SectionState>
          </Chapter>

          <Chapter
            id="att-team"
            ref={membersRef}
            icon={<UsersThree className="h-4 w-4" weight="fill" />}
            iconBg={GLYPH_PLATE.UsersThree}
            title={ts("team")}
            subtitle={ts("teamSub")}
          >
            <SectionState query={teamQuery}>
              <div className="grid gap-3 xl:grid-cols-12">
                <Surface className="xl:col-span-4">
                  <SectionTitle title={ts("teamRank")} subtitle={ts("teamRankSub")} />
                  <TeamChart rows={team?.by_member} loading={teamQuery.isPending} />
                </Surface>
                <Surface className="xl:col-span-8">
                  <SectionTitle title={ts("teamDetail")} subtitle={ts("teamDetailSub")} />
                  <TeamDetailTable
                    rows={team?.by_member}
                    loading={teamQuery.isPending}
                  />
                </Surface>
              </div>
            </SectionState>
          </Chapter>


          {/*
          <div>
            <SectionLabel
              icon={<ClockCounterClockwise className="h-4 w-4" weight="fill" />}
              iconBg={GLYPH_PLATE.ClockCounterClockwise}
              title={ts("rework")}
              subtitle={ts("reworkSub")}
            />
            <ReworkSection
              rework={overview?.rework}
              loading={loading}
              fmt={fmt}
            />
          </div>
          */}
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

      {canWriteTargets ? (
        <TargetsDialog
          open={targetsOpen}
          onOpenChange={setTargetsOpen}
          period={dateTo.slice(0, 7)}
          defaultCurrency={targetCurrency}
          projections={summary?.projections}
          scope={
            memberId !== "all"
              ? {
                  scope: "member",
                  scopeId: memberId,
                  scopeLabel:
                    members.find((m) => m.userId === memberId)?.username ??
                    memberId,
                }
              : departmentId !== "all"
                ? {
                    scope: "department",
                    scopeId: departmentId,
                    scopeLabel:
                      departments.find((d) => d.id === departmentId)?.name ??
                      departmentId,
                  }
                : {
                    scope: "workspace",
                    scopeLabel: currentWorkspace?.name ?? tc("all"),
                  }
          }
          onSaved={refreshSections}
        />
      ) : null}
      {canAsk ? (
        <AttendanceAssistant
          view={assistantView}
          scope={assistantScope}
        />
      ) : null}
    </div>
  );
}
