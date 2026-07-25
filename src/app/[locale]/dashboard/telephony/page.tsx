"use client";

import {
  ArrowClockwise,
  ChartBar,
  ChartPie,
  CheckCircle,
  Clock,
  Headset,
  Lightning,
  Phone,
  PhoneCall,
  PhoneIncoming,
  Pulse,
  Robot,
  Timer,
  Users,
  Warning,
} from "@phosphor-icons/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { format, subDays } from "date-fns";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import type {
  HumanSeat,
  SeatState,
  TelephonyBoard,
  TelephonyDisposition,
  TelephonyKPIs,
  TelephonyMemberRow,
  TelephonyOverview,
  TelephonyTypeSlice,
} from "@/lib/telephony/types";
import {
  getTelephonyBoardAction,
  getTelephonyOverviewAction,
} from "@/app/actions/telephony";
import { listMembersAction } from "@/app/actions/workspace";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import type { WorkspaceMember } from "@/lib/workspace/types";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/contexts/workspace-context";
import { useTranslations } from "next-intl";

/* ── Design tokens (Quiet Infrastructure — same as Desempenho) ───── */

const COLORS = {
  signal: "#2463eb",
  answered: "#22c55e",
  failed: "#ef4444",
  abandoned: "#f59e0b",
  inbound: "#06b6d4",
  outbound: "#8b5cf6",
  ai: "#f59e0b",
  free: "#22c55e",
  busy: "#f43f5e",
} as const;

type DatePreset = "7d" | "30d" | "90d" | "custom";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "0";
  return v.toLocaleString("pt-BR");
}
function fmtMins(v: number | null | undefined): string {
  if (v === null || v === undefined) return "n/d";
  if (v < 1) return `${Math.round(v * 60)}s`;
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`;
}
function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "n/d";
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

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
        "rounded-[20px] border border-border/70 bg-card/90 p-4 md:p-5",
        className,
      )}
      style={{ boxShadow: softSurfaceShadow }}
    >
      {children}
    </section>
  );
}

function SectionLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
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
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white",
            iconBg,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h3>
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
      className="animate-pulse rounded-xl bg-muted/50"
      style={{ height }}
      aria-hidden
    />
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
        "rounded-xl border border-border/60 bg-background/70 px-3 py-2.5",
        muted && "opacity-70",
      )}
      title={hint}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function callTypeLabel(t: string): string {
  switch (t) {
    case "crm":
      return "Discador (humano)";
    case "trunk_inbound":
      return "Entrante (tronco)";
    case "trunk_outbound":
      return "Sainte (tronco)";
    default:
      return t;
  }
}

function seatStyle(state: SeatState): {
  tile: string;
  label: string;
  ring: string;
} {
  switch (state) {
    case "on_call":
      return { tile: "bg-rose-500", label: "Em chamada", ring: "ring-rose-200" };
    case "ringing":
      return { tile: "bg-amber-500", label: "Tocando", ring: "ring-amber-200" };
    case "wrap_up":
      return { tile: "bg-sky-500", label: "Pós-atendimento", ring: "ring-sky-200" };
    case "free":
      return { tile: "bg-emerald-500", label: "Livre", ring: "ring-emerald-200" };
    default:
      return { tile: "bg-slate-400", label: "Offline", ring: "ring-slate-200" };
  }
}

/* ── KPI strip (same pattern as Desempenho) ──────────────────────── */

type KpiDef = {
  key: string;
  label: string;
  short: string;
  value: string;
  hint: string;
  icon: typeof CheckCircle;
  bg: string;
};

function KpiStrip({
  kpis,
  loading,
}: {
  kpis: TelephonyKPIs | undefined;
  loading: boolean;
}) {
  const t = useTranslations("metricsOps.telephony.kpi");
  const tc = useTranslations("metricsOps.common");
  const cards: KpiDef[] = [
    {
      key: "total",
      label: t("total"),
      short: t("totalShort"),
      value: loading ? tc("loading") : fmtNum(kpis?.total_calls),
      hint: t("total"),
      icon: PhoneCall,
      bg: "bg-primary",
    },
    {
      key: "answered",
      label: t("answered"),
      short: t("answeredShort"),
      value: loading ? tc("loading") : fmtNum(kpis?.answered),
      hint: t("answered"),
      icon: CheckCircle,
      bg: "bg-emerald-500",
    },
    {
      key: "connect",
      label: t("connect"),
      short: t("connectShort"),
      value: loading ? tc("loading") : fmtPct(kpis?.connect_rate ?? null),
      hint: t("connect"),
      icon: Pulse,
      bg: "bg-teal-500",
    },
    {
      key: "sl",
      label: t("sl"),
      short: t("slShort"),
      value: loading ? tc("loading") : fmtPct(kpis?.service_level_pct ?? null),
      hint: t("sl"),
      icon: Lightning,
      bg: "bg-indigo-500",
    },
    {
      key: "fail",
      label: t("failed"),
      short: t("failedShort"),
      value: loading
        ? tc("loading")
        : fmtNum((kpis?.failed ?? 0) + (kpis?.abandoned ?? 0)),
      hint: t("failed"),
      icon: Warning,
      bg: "bg-amber-500",
    },
    {
      key: "ring",
      label: t("ring"),
      short: t("ringShort"),
      value: loading ? tc("loading") : fmtMins(kpis?.avg_ring_mins ?? null),
      hint: t("ring"),
      icon: Clock,
      bg: "bg-cyan-600",
    },
    {
      key: "talk",
      label: t("talk"),
      short: t("talkShort"),
      value: loading ? tc("loading") : fmtMins(kpis?.avg_talk_mins ?? null),
      hint: t("talk"),
      icon: Timer,
      bg: "bg-violet-500",
    },
    {
      key: "aht",
      label: t("aht"),
      short: t("ahtShort"),
      value: loading ? tc("loading") : fmtMins(kpis?.avg_aht_mins ?? null),
      hint: t("aht"),
      icon: Headset,
      bg: "bg-slate-700",
    },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.key}
            className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </p>
                <p className="mt-1 truncate text-xl font-semibold tabular-nums text-foreground">
                  {c.value}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {c.short}
                </p>
              </div>
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                  c.bg,
                )}
              >
                <Icon className="h-3.5 w-3.5 text-white" weight="fill" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Charts ──────────────────────────────────────────────────────── */

function HourlyChart({
  hourly,
  loading,
}: {
  hourly: { hour: number; count: number }[] | undefined;
  loading: boolean;
}) {
  const data = useMemo(
    () =>
      (hourly ?? Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))).map(
        (p) => ({
          label: `${String(p.hour).padStart(2, "0")}h`,
          chamadas: p.count,
        }),
      ),
    [hourly],
  );
  const config: ChartConfig = {
    chamadas: { label: "Chamadas", color: COLORS.signal },
  };
  if (loading) return <ChartSkeleton height={240} />;
  const has = data.some((d) => d.chamadas > 0);
  if (!has) {
    return (
      <EmptyChart
        icon={<ChartBar className="h-8 w-8" weight="fill" />}
        message="Sem chamadas no período"
        height={240}
      />
    );
  }
  return (
    <ChartContainer config={config} className="h-[240px] w-full">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e7ef" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={10}
          interval={2}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={10}
          allowDecimals={false}
          width={36}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(v) => (
                <span className="font-semibold tabular-nums">
                  {fmtNum(Number(v))} chamadas
                </span>
              )}
            />
          }
        />
        <Bar
          dataKey="chamadas"
          fill="var(--color-chamadas)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ChartContainer>
  );
}

function DirectionTypeMix({
  directions,
  types,
  loading,
}: {
  directions: { direction: string; count: number; pct: number }[] | undefined;
  types: TelephonyTypeSlice[] | undefined;
  loading: boolean;
}) {
  const dirData = useMemo(
    () =>
      (directions ?? []).map((d) => ({
        key: d.direction,
        name: d.direction === "inbound" ? "Entrantes" : "Saintes",
        value: d.count,
        pct: d.pct,
        color: d.direction === "inbound" ? COLORS.inbound : COLORS.outbound,
      })),
    [directions],
  );
  const typeList = types ?? [];
  if (loading) return <ChartSkeleton height={220} />;
  if (!dirData.length && !typeList.length) {
    return (
      <EmptyChart
        icon={<ChartPie className="h-8 w-8" weight="fill" />}
        message="Sem mix no período"
        height={220}
      />
    );
  }
  return (
    <div className="space-y-3">
      {dirData.length > 0 ? (
        <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_1fr]">
          <ChartContainer
            config={{
              Entrantes: { label: "Entrantes", color: COLORS.inbound },
              Saintes: { label: "Saintes", color: COLORS.outbound },
            }}
            className="mx-auto h-[160px] w-full max-w-[180px]"
          >
            <PieChart>
              <Pie
                data={dirData}
                dataKey="value"
                nameKey="name"
                innerRadius={42}
                outerRadius={68}
                paddingAngle={2}
                cornerRadius={4}
                strokeWidth={2}
                stroke="hsl(var(--background))"
              >
                {dirData.map((d) => (
                  <Cell key={d.key} fill={d.color} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
          <ul className="space-y-2">
            {dirData.map((d) => (
              <li key={d.key} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    {d.name}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {fmtNum(d.value)} ({fmtPct(d.pct)})
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {typeList.length > 0 ? (
        <ul className="space-y-2 border-t border-border/60 pt-3">
          {typeList.map((t) => (
            <li key={t.type} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {callTypeLabel(t.type)}
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {fmtNum(t.count)} ({fmtPct(t.pct)})
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, t.pct)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DispositionChart({
  rows,
  loading,
}: {
  rows: TelephonyDisposition[] | undefined;
  loading: boolean;
}) {
  if (loading) return <ChartSkeleton height={200} />;
  if (!rows?.length) {
    return (
      <EmptyChart
        icon={<ChartBar className="h-8 w-8" weight="fill" />}
        message="Sem desfechos no período"
        height={200}
      />
    );
  }
  const data = rows.slice(0, 8).map((r) => ({
    name: r.label || r.code,
    value: r.count,
    pct: r.pct,
  }));
  return (
    <ChartContainer
      config={{ value: { label: "Chamadas", color: COLORS.signal } }}
      className="h-[220px] w-full"
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e1e7ef" />
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={10} />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tickLine={false}
          axisLine={false}
          fontSize={10}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(v, _n, item) => (
                <span className="font-semibold tabular-nums">
                  {fmtNum(Number(v))} · {fmtPct(item?.payload?.pct)}
                </span>
              )}
            />
          }
        />
        <Bar dataKey="value" fill={COLORS.signal} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ChartContainer>
  );
}

/** Outcome pie: answered / failed / abandoned (like status composition on Desempenho). */
function OutcomeCompositionChart({
  kpis,
  loading,
}: {
  kpis: TelephonyKPIs | undefined;
  loading: boolean;
}) {
  const data = useMemo(() => {
    if (!kpis) return [];
    const rows = [
      { key: "answered", name: "Chamadas atendidas", value: kpis.answered, color: COLORS.answered },
      { key: "failed", name: "Falhas", value: kpis.failed, color: COLORS.failed },
      {
        key: "abandoned",
        name: "Abandonadas",
        value: kpis.abandoned,
        color: COLORS.abandoned,
      },
    ].filter((r) => r.value > 0);
    const total = rows.reduce((s, r) => s + r.value, 0);
    return rows.map((r) => ({
      ...r,
      pct: total > 0 ? Math.round((r.value / total) * 1000) / 10 : 0,
    }));
  }, [kpis]);
  if (loading) return <ChartSkeleton height={200} />;
  if (!data.length) {
    return (
      <EmptyChart
        icon={<ChartPie className="h-8 w-8" weight="fill" />}
        message="Sem resultados no período"
        height={200}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_1fr]">
      <ChartContainer
        config={{
          Atendidas: { label: "Chamadas atendidas", color: COLORS.answered },
          Falhas: { label: "Falhas", color: COLORS.failed },
          Abandonadas: { label: "Abandonadas", color: COLORS.abandoned },
        }}
        className="mx-auto h-[180px] w-full max-w-[200px]"
      >
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={2}
            cornerRadius={4}
            strokeWidth={2}
            stroke="hsl(var(--background))"
          >
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
        </PieChart>
      </ChartContainer>
      <ul className="space-y-2">
        {data.map((d) => (
          <li key={d.key} className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                {d.name}
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {fmtNum(d.value)} ({fmtPct(d.pct)})
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${d.pct}%`, backgroundColor: d.color }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Queue funnel bars (enqueued → connected → abandoned). */
function QueueFunnelChart({
  queue,
  loading,
}: {
  queue: TelephonyOverview["queue"] | undefined;
  loading: boolean;
}) {
  const data = useMemo(() => {
    if (!queue?.available) return [];
    return [
      { name: "Entraram", value: queue.enqueued, color: COLORS.signal },
      { name: "Atendidas da fila", value: queue.connected, color: COLORS.answered },
      { name: "Abandonaram", value: queue.abandoned, color: COLORS.abandoned },
      { name: "Overflow", value: queue.overflow, color: COLORS.outbound },
      { name: "Fila cheia", value: queue.queue_full, color: COLORS.failed },
    ].filter((r) => r.value > 0);
  }, [queue]);
  if (loading) return <ChartSkeleton height={180} />;
  if (!data.length) {
    return (
      <EmptyChart
        icon={<PhoneIncoming className="h-8 w-8" weight="fill" />}
        message="Sem eventos de fila no período"
        height={160}
      />
    );
  }
  return (
    <ChartContainer
      config={{ value: { label: "Eventos", color: COLORS.signal } }}
      className="h-[200px] w-full"
    >
      <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e7ef" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} />
        <YAxis tickLine={false} axisLine={false} fontSize={10} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Occupancy vs idle dual bars. */
function OccupancyChart({
  occ,
  loading,
}: {
  occ: TelephonyOverview["occupancy"] | undefined;
  loading: boolean;
}) {
  const data = useMemo(() => {
    if (!occ?.available) return [];
    return [
      {
        name: "Ocupação",
        valor: occ.team_occupancy_pct ?? 0,
        fill: COLORS.busy,
      },
      {
        name: "Ociosidade",
        valor: occ.team_idle_pct ?? 0,
        fill: COLORS.free,
      },
      {
        name: "Média agente",
        valor: occ.avg_occupancy_pct ?? 0,
        fill: COLORS.signal,
      },
    ];
  }, [occ]);
  if (loading) return <ChartSkeleton height={180} />;
  if (!data.length) {
    return (
      <EmptyChart
        icon={<Users className="h-8 w-8" weight="fill" />}
        message="Sem presença no período"
        height={160}
      />
    );
  }
  return (
    <ChartContainer
      config={{ valor: { label: "%", color: COLORS.signal } }}
      className="h-[200px] w-full"
    >
      <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e7ef" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={10}
          width={32}
          domain={[0, 100]}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(v) => (
                <span className="font-semibold tabular-nums">{fmtPct(Number(v))}</span>
              )}
            />
          }
        />
        <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function TimesChart({
  kpis,
  loading,
}: {
  kpis: TelephonyKPIs | undefined;
  loading: boolean;
}) {
  const data = useMemo(() => {
    if (!kpis) return [];
    const mins = [
      { name: "Até atender", valor: kpis.avg_ring_mins },
      { name: "Tempo de conversa", valor: kpis.avg_talk_mins },
      { name: "AHT", valor: kpis.avg_aht_mins },
    ];
    return mins
      .filter((m) => m.valor != null && m.valor > 0)
      .map((m) => ({ name: m.name, min: m.valor as number }));
  }, [kpis]);
  if (loading) return <ChartSkeleton height={180} />;
  if (!data.length) {
    return (
      <EmptyChart
        icon={<Timer className="h-8 w-8" weight="fill" />}
        message="Sem tempos médios no período"
        height={160}
      />
    );
  }
  return (
    <ChartContainer
      config={{ min: { label: "Minutos", color: COLORS.signal } }}
      className="h-[200px] w-full"
    >
      <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e7ef" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} />
        <YAxis tickLine={false} axisLine={false} fontSize={10} width={36} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(v) => (
                <span className="font-semibold tabular-nums">
                  {fmtMins(Number(v))}
                </span>
              )}
            />
          }
        />
        <Bar dataKey="min" fill={COLORS.signal} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ChartContainer>
  );
}

function MemberTable({
  rows,
  names,
  loading,
}: {
  rows: TelephonyMemberRow[] | undefined;
  names: Record<string, string>;
  loading: boolean;
}) {
  if (loading) return <ChartSkeleton height={200} />;
  if (!rows?.length) {
    return (
      <EmptyChart
        icon={<Users className="h-8 w-8" weight="fill" />}
        message="Sem ligações humanas com agente no período"
        height={180}
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-3 font-semibold">Atendente</th>
            <th className="pb-2 pr-3 font-semibold">Chamadas</th>
            <th className="pb-2 pr-3 font-semibold">Chamadas atendidas</th>
            <th className="pb-2 pr-3 font-semibold">Conexão</th>
            <th className="pb-2 pr-3 font-semibold">NS</th>
            <th className="pb-2 pr-3 font-semibold">Tempo de conversa</th>
            <th className="pb-2 pr-3 font-semibold">Ocupação</th>
            <th className="pb-2 font-semibold">Ociosidade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.user_id}
              className="border-b border-border/40 last:border-0"
            >
              <td className="py-2.5 pr-3 font-medium text-foreground">
                {names[r.user_id] || r.user_id.slice(0, 8)}
              </td>
              <td className="py-2.5 pr-3 tabular-nums">{fmtNum(r.total_calls)}</td>
              <td className="py-2.5 pr-3 tabular-nums">{fmtNum(r.answered)}</td>
              <td className="py-2.5 pr-3 tabular-nums">{fmtPct(r.connect_rate)}</td>
              <td className="py-2.5 pr-3 tabular-nums">
                {fmtPct(r.service_level_pct ?? null)}
              </td>
              <td className="py-2.5 pr-3 tabular-nums">
                {fmtMins(r.avg_talk_mins)}
              </td>
              <td className="py-2.5 pr-3 tabular-nums">
                {fmtPct(r.occupancy_pct ?? null)}
              </td>
              <td className="py-2.5 tabular-nums">
                {fmtPct(r.idle_pct ?? null)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemberRankingChart({
  rows,
  names,
  loading,
}: {
  rows: TelephonyMemberRow[] | undefined;
  names: Record<string, string>;
  loading: boolean;
}) {
  const data = useMemo(() => {
    return (rows ?? []).slice(0, 10).map((r) => ({
      name: names[r.user_id] || r.user_id.slice(0, 8),
      atendidas: r.answered,
      total: r.total_calls,
    }));
  }, [rows, names]);
  if (loading) return <ChartSkeleton height={220} />;
  if (!data.length) {
    return (
      <EmptyChart
        icon={<Users className="h-8 w-8" weight="fill" />}
        message="Sem ranking no período"
        height={200}
      />
    );
  }
  return (
    <ChartContainer
      config={{
        atendidas: { label: "Chamadas atendidas", color: COLORS.answered },
        total: { label: "Total de chamadas", color: COLORS.signal },
      }}
      className="h-[240px] w-full"
    >
      <BarChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e7ef" />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          fontSize={10}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={50}
        />
        <YAxis tickLine={false} axisLine={false} fontSize={10} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="atendidas" fill={COLORS.answered} radius={[4, 4, 0, 0]} maxBarSize={20} />
        <Bar dataKey="total" fill={COLORS.signal} radius={[4, 4, 0, 0]} maxBarSize={20} opacity={0.35} />
      </BarChart>
    </ChartContainer>
  );
}

/* ── Live board ──────────────────────────────────────────────────── */

function HumanSeatCard({ seat }: { seat: HumanSeat }) {
  const style = seatStyle(seat.state);
  const name = seat.username || seat.user_id.slice(0, 8);
  const initial = (name.charAt(0) || "?").toUpperCase();
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-2xl border border-border/70 bg-background/70 px-2.5 py-3 text-center shadow-sm ring-2 ring-offset-1 ring-offset-background",
        style.ring,
      )}
      title={`${name} · ${style.label}`}
    >
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white",
          style.tile,
        )}
      >
        {initial}
      </div>
      <p className="w-full truncate text-xs font-semibold text-foreground">
        {name}
      </p>
      <p className="text-[10px] font-medium text-muted-foreground">
        {style.label}
      </p>
    </div>
  );
}

function LiveBoardPanel({
  board,
  loading,
}: {
  board: TelephonyBoard | null;
  loading: boolean;
}) {
  const cap = board?.capacity;
  const used = cap?.used ?? 0;
  const max = cap?.max ?? 0;
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  const barColor =
    pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-primary";

  return (
    <Surface>
      <SectionTitle
        icon={<Headset className="h-4 w-4" weight="fill" />}
        iconBg="bg-emerald-600"
        title="Painel ao vivo"
        subtitle="Concorrência em tempo real (Redis · sem SQL)"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Ao vivo
          </span>
        }
      />
      <div className="mb-4 rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-foreground">Canais em uso</span>
          <span className="tabular-nums text-muted-foreground">
            {loading && !board
              ? "…"
              : `${fmtNum(used)} / ${max > 0 ? fmtNum(max) : "—"}`}
            {max > 0 ? (
              <span className="ml-1 text-xs">({fmtPct(pct)})</span>
            ) : null}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${max > 0 ? pct : 0}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatBlock label="Conectados" value={fmtNum(board?.online)} />
          <StatBlock label="Livres" value={fmtNum(board?.free)} />
          <StatBlock label="Em chamada" value={fmtNum(board?.in_call)} />
          <StatBlock label="Tocando" value={fmtNum(board?.ringing)} />
          <StatBlock
            label="Fila agora"
            value={fmtNum(board?.queue?.depth)}
            muted={!board?.queue?.available}
          />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Humanos
          </p>
          {(board?.humans?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguém no discador agora
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(board?.humans ?? []).map((s) => (
                <HumanSeatCard key={s.user_id} seat={s} />
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            IA de voz
          </p>
          {(board?.ai?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma IA ativa no momento
            </p>
          ) : (
            <div className="space-y-2">
              {(board?.ai ?? []).map((a) => (
                <div
                  key={a.agent_id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 px-3 py-2"
                >
                  <span className="text-sm font-medium text-foreground">
                    {a.name || a.agent_id.slice(0, 8)}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {fmtNum(a.active)}
                    {a.max > 0 ? ` / ${fmtNum(a.max)}` : ""} ativas
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function TelephonyPage() {
  const { currentWorkspace, can, permissionsLoading } = useWorkspace();
  const t = useTranslations("metricsOps.telephony");
  const ts = useTranslations("metricsOps.telephony.sections");
  const tc = useTranslations("metricsOps.common");
  const tg = useTranslations("metricsOps.telephony.glossary");
  // Matches backend: GET /telephony/* → attendance:read (metrics RBAC, not dialer:use)
  const canRead = !permissionsLoading && can("attendance", "read");
  const searchParams = useSearchParams();

  const [preset, setPreset] = useState<DatePreset>("7d");
  const [dateFrom, setDateFrom] = useState(
    format(subDays(new Date(), 6), "yyyy-MM-dd"),
  );
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [direction, setDirection] = useState("all");
  const [callType, setCallType] = useState("all");
  const [memberId, setMemberId] = useState("all");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [overview, setOverview] = useState<TelephonyOverview | null>(null);
  const [board, setBoard] = useState<TelephonyBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const memberNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of members) {
      map[m.userId] = m.username || m.email || m.userId;
    }
    return map;
  }, [members]);

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
    const r = await getTelephonyOverviewAction({
      dateFrom,
      dateTo,
      direction: direction === "all" ? undefined : direction,
      callType: callType === "all" ? undefined : callType,
      memberId: memberId === "all" ? undefined : memberId,
      serviceLevelSeconds: 20,
    });
    if (r.error) setError(r.error);
    setOverview(r.overview);
    setLoading(false);
  }, [canRead, dateFrom, dateTo, direction, callType, memberId]);

  const loadBoard = useCallback(async () => {
    if (!canRead) {
      setBoardLoading(false);
      return;
    }
    setBoardLoading(true);
    const r = await getTelephonyBoardAction();
    if (!r.error) setBoard(r.board);
    setBoardLoading(false);
  }, [canRead]);

  useEffect(() => {
    if (permissionsLoading) return;
    void load();
    void loadBoard();
  }, [permissionsLoading, load, loadBoard]);

  useEffect(() => {
    if (permissionsLoading || !canRead) return;
    const boardId = window.setInterval(() => void loadBoard(), 5000);
    const histId = window.setInterval(() => void load(), 30000);
    return () => {
      window.clearInterval(boardId);
      window.clearInterval(histId);
    };
  }, [permissionsLoading, canRead, load, loadBoard]);

  const kpis = overview?.kpis;
  const queue = overview?.queue;
  const occ = overview?.occupancy;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <motion.div variants={itemVariants}>
        <Surface>
          <DashboardPageHeader
            badge={t("badge")}
            description={
              currentWorkspace
                ? t("desc", { name: currentWorkspace.name })
                : tc("selectWorkspace")
            }
            icon={<Phone className="h-6 w-6" weight="fill" />}
            actions={
              <Button
                icon={<ArrowClockwise className="h-4 w-4" weight="bold" />}
                iconVisible
                title={tc("refresh")}
                variant="outline"
                onClick={() => {
                  void load();
                  void loadBoard();
                }}
                disabled={loading}
              />
            }
          />

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/60 p-3 lg:flex-row lg:items-end lg:gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                    id="tel-date-from"
                    label="Início"
                    value={dateFrom}
                    onChange={setDateFrom}
                  />
                  <ElevatedDatePicker
                    id="tel-date-to"
                    label="Fim"
                    value={dateTo}
                    onChange={setDateTo}
                  />
                </div>
              ) : null}
            </div>
            <div className="w-full lg:w-[150px]">
              <ElevatedSelect
                label="Direção"
                value={direction}
                onValueChange={setDirection}
              >
                <ElevatedSelectItem value="all">Todas</ElevatedSelectItem>
                <ElevatedSelectItem value="inbound">Entrantes</ElevatedSelectItem>
                <ElevatedSelectItem value="outbound">Saintes</ElevatedSelectItem>
              </ElevatedSelect>
            </div>
            <div className="w-full lg:w-[180px]">
              <ElevatedSelect
                label="Tipo"
                value={callType}
                onValueChange={setCallType}
              >
                <ElevatedSelectItem value="all">Todos</ElevatedSelectItem>
                <ElevatedSelectItem value="crm">Discador humano</ElevatedSelectItem>
                <ElevatedSelectItem value="trunk_inbound">
                  Entrante (tronco)
                </ElevatedSelectItem>
                <ElevatedSelectItem value="trunk_outbound">
                  Sainte (tronco)
                </ElevatedSelectItem>
                <ElevatedSelectItem value="workflow">Workflow</ElevatedSelectItem>
              </ElevatedSelect>
            </div>
            <div className="w-full lg:w-[180px]">
              <ElevatedSelect
                label="Atendente"
                value={memberId}
                onValueChange={setMemberId}
              >
                <ElevatedSelectItem value="all">Todos</ElevatedSelectItem>
                {members.map((m) => (
                  <ElevatedSelectItem key={m.userId} value={m.userId}>
                    {m.username || m.email || m.userId.slice(0, 8)}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>
          </div>

          {error ? (
            <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <KpiStrip kpis={kpis} loading={loading} />

          {/* Secondary KPI row: transfers, short abandons, in/out */}
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <StatBlock
              label="Entrantes"
              value={loading ? "…" : fmtNum(kpis?.inbound)}
            />
            <StatBlock
              label="Saintes"
              value={loading ? "…" : fmtNum(kpis?.outbound)}
            />
            <StatBlock
              label="Transferências"
              value={loading ? "…" : fmtNum(kpis?.transfers)}
              hint="eventos transfer_completed"
            />
            <StatBlock
              label="Desligou rápido"
              value={loading ? "…" : fmtNum(kpis?.short_abandons)}
              hint="Chamada com menos de 6s após atender"
            />
            <StatBlock
              label="Humanas (CDR)"
              value={
                loading
                  ? "…"
                  : fmtNum(
                      (kpis?.human_crm_calls ?? 0) +
                        (kpis?.trunk_inbound ?? 0) +
                        (kpis?.trunk_outbound ?? 0),
                    )
              }
            />
          </div>
        </Surface>
      </motion.div>

      {!canRead && !permissionsLoading ? (
        <motion.div variants={itemVariants}>
          <Surface className="py-12 text-center">
            <Phone className="mx-auto mb-3 h-10 w-10 text-slate-300" weight="duotone" />
            <h2 className="text-base font-semibold text-foreground">
              {tc("noPermission")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("noPermissionDesc")}
            </p>
          </Surface>
        </motion.div>
      ) : (
        <>
          <motion.div variants={itemVariants}>
            <SectionLabel
              title={ts("live")}
              subtitle={ts("liveSub")}
            />
            <LiveBoardPanel board={board} loading={boardLoading} />
          </motion.div>

          {/* Mirror Desempenho: volume + composition side by side */}
          <motion.div variants={itemVariants}>
            <SectionLabel
              title={ts("volume")}
              subtitle={ts("volumeSub")}
            />
            <div className="grid gap-4 xl:grid-cols-12">
              <Surface className="xl:col-span-7">
                <SectionTitle
                  icon={<ChartBar className="h-4 w-4" weight="fill" />}
                  iconBg="bg-primary"
                  title={ts("hourly")}
                  subtitle={ts("hourlySub")}
                />
                <HourlyChart hourly={overview?.hourly} loading={loading} />
              </Surface>
              <Surface className="xl:col-span-5">
                <SectionTitle
                  icon={<ChartPie className="h-4 w-4" weight="fill" />}
                  iconBg="bg-emerald-500"
                  title={ts("outcome")}
                  subtitle={ts("outcomeSub")}
                />
                <OutcomeCompositionChart kpis={kpis} loading={loading} />
              </Surface>
            </div>
          </motion.div>

          {/* Tempos + serviço (plain language) */}
          <motion.div variants={itemVariants}>
            <SectionLabel
              title={ts("times")}
              subtitle={ts("timesSub")}
            />
            <div className="grid gap-4 xl:grid-cols-12">
              <Surface className="xl:col-span-5">
                <SectionTitle
                  icon={<Timer className="h-4 w-4" weight="fill" />}
                  iconBg="bg-teal-600"
                  title={ts("avgTimes")}
                  subtitle={ts("avgTimesSub")}
                />
                <TimesChart kpis={kpis} loading={loading} />
              </Surface>
              <Surface className="xl:col-span-4">
                <SectionTitle
                  icon={<Lightning className="h-4 w-4" weight="fill" />}
                  iconBg="bg-indigo-500"
                  title={ts("speed")}
                  subtitle={ts("speedSub")}
                />
                <div className="grid grid-cols-1 gap-2">
                  <StatBlock
                    label="No prazo (20s)"
                    value={loading ? "…" : fmtPct(kpis?.service_level_pct ?? null)}
                    hint="Percentual atendido em até 20s"
                  />
                  <StatBlock
                    label="Quantidade no prazo"
                    value={loading ? "…" : fmtNum(kpis?.answered_within_sl)}
                  />
                  <StatBlock
                    label="Taxa de conexão"
                    value={loading ? "…" : fmtPct(kpis?.connect_rate ?? null)}
                    hint="Chamadas atendidas ÷ total de tentativas"
                  />
                </div>
              </Surface>
              <Surface className="xl:col-span-3">
                <SectionTitle
                  icon={<ChartPie className="h-4 w-4" weight="fill" />}
                  iconBg="bg-violet-500"
                  title={ts("dirType")}
                  subtitle={ts("dirTypeSub")}
                />
                <DirectionTypeMix
                  directions={overview?.by_direction}
                  types={overview?.by_type}
                  loading={loading}
                />
              </Surface>
            </div>
          </motion.div>

          {/* Fila + equipe livre vs ocupada */}
          <motion.div variants={itemVariants}>
            <SectionLabel
              title={ts("queue")}
              subtitle={ts("queueSub")}
            />
            <div className="grid gap-4 xl:grid-cols-12">
              <Surface className="xl:col-span-6">
                <SectionTitle
                  icon={<PhoneIncoming className="h-4 w-4" weight="fill" />}
                  iconBg="bg-cyan-600"
                  title={ts("queueTitle")}
                  subtitle={ts("queueTitleSub")}
                />
                <QueueFunnelChart queue={queue} loading={loading} />
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatBlock
                    label="Espera média"
                    value={fmtMins(queue?.avg_asa_mins ?? null)}
                    muted={!queue?.available}
                  />
                  <StatBlock
                    label="No prazo (fila)"
                    value={
                      queue?.available
                        ? fmtPct(queue.service_level_pct ?? null)
                        : "n/d"
                    }
                    muted={!queue?.available}
                  />
                  <StatBlock
                    label="% que desligou"
                    value={
                      queue?.available ? fmtPct(queue.abandon_rate) : "n/d"
                    }
                    muted={!queue?.available}
                  />
                  <StatBlock
                    label="Pior espera"
                    value={fmtMins(queue?.max_wait_mins ?? null)}
                    muted={!queue?.available}
                  />
                </div>
              </Surface>
              <Surface className="xl:col-span-6">
                <SectionTitle
                  icon={<Users className="h-4 w-4" weight="fill" />}
                  iconBg="bg-slate-700"
                  title={ts("occupancy")}
                  subtitle={ts("occupancySub")}
                />
                <OccupancyChart occ={occ} loading={loading} />
                {occ?.available ? (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Com base em {fmtNum(occ.agents_sampled)} pessoas no período
                  </p>
                ) : null}
              </Surface>
            </div>
          </motion.div>

          {/* Equipe — same pattern as Desempenho team section */}
          <motion.div variants={itemVariants}>
            <SectionLabel
              title={ts("team")}
              subtitle={ts("teamSub")}
            />
            <div className="grid gap-4 xl:grid-cols-12">
              <Surface className="xl:col-span-5">
                <SectionTitle
                  icon={<Users className="h-4 w-4" weight="fill" />}
                  iconBg="bg-blue-500"
                  title={ts("teamRank")}
                  subtitle={ts("teamRankSub")}
                />
                <MemberRankingChart
                  rows={overview?.by_member}
                  names={memberNames}
                  loading={loading}
                />
              </Surface>
              <Surface className="xl:col-span-7">
                <SectionTitle
                  icon={<Users className="h-4 w-4" weight="fill" />}
                  iconBg="bg-blue-500"
                  title={ts("teamDetail")}
                  subtitle={ts("teamDetailSub")}
                />
                <MemberTable
                  rows={overview?.by_member}
                  names={memberNames}
                  loading={loading}
                />
              </Surface>
            </div>
          </motion.div>

          {/* Motivos de fim — secondary detail */}
          <motion.div variants={itemVariants}>
            <SectionLabel
              title={ts("dispositions")}
              subtitle={ts("dispositionsSub")}
            />
            <Surface>
              <DispositionChart
                rows={overview?.dispositions}
                loading={loading}
              />
            </Surface>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Surface className="!py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {tc("glossaryTitle")}
              </p>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                <p>
                  <strong className="text-foreground">{tg("connect")}</strong> ·{" "}
                  {tg("connectDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("onTime")}</strong> ·{" "}
                  {tg("onTimeDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("avgWait")}</strong> ·{" "}
                  {tg("avgWaitDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("talk")}</strong> ·{" "}
                  {tg("talkDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("idle")}</strong> ·{" "}
                  {tg("idleDesc")}
                </p>
                <p>
                  <strong className="text-foreground">{tg("aiResolved")}</strong>{" "}
                  · {tg("aiResolvedDesc")}
                </p>
              </div>
            </Surface>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
