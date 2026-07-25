"use client";

import {
  ArrowsInSimple,
  ArrowsOut,
  Buildings,
  CaretDown,
  ChartBar,
  ChartPie,
  CheckCircle,
  CircleNotch,
  Clock,
  Headset,
  Hourglass,
  Lightning,
  Phone,
  PhoneCall,
  Pulse,
  Robot,
  Timer,
  UserMinus,
  Users,
  Warning,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { format, subDays } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import ElevatedButton from "@/components/elevated-design/button";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";

import type {
  AttendanceOverview,
  DepartmentRow,
  MemberRow,
  StatusDistribution,
} from "@/lib/attendance/types";
import type {
  TelephonyMemberRow,
  TelephonyOverview,
} from "@/lib/telephony/types";
import type { CampaignType } from "@/lib/conversations/types";
import type { Department } from "@/lib/department/types";
import type { WorkspaceMember } from "@/lib/workspace/types";
import { getAttendanceOverviewAction } from "@/app/actions/attendance";
import { getTelephonyOverviewAction } from "@/app/actions/telephony";
import { listMembersAction } from "@/app/actions/workspace";
import { fetchDepartments } from "@/lib/department/client";
import { useWorkspace } from "@/contexts/workspace-context";
import { cn } from "@/lib/utils";
import {
  softSurfaceShadow,
  softSurfaceWithInset,
} from "@/components/elevated-design/shadow-presets";

/** Quiet Infrastructure tokens (product register). */
const COLORS = {
  signal: "#2463eb",
  finished: "#22c55e",
  ongoing: "#2463eb",
  pending: "#f59e0b",
} as const;

const POLL_MS = 30_000;
const MIN_HEIGHT_PCT = 48;
const MAX_HEIGHT_PCT = 100;
const DEFAULT_HEIGHT_PCT = 100;

const LOCALE_TAG: Record<string, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
};

type DatePreset = "7d" | "30d" | "90d";
type OpsMode = "attendance" | "telephony";

type OpsFilterOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

/** Compact elevated select for the dense ops toolbar (Quiet Infrastructure). */
function OpsFilterSelect({
  value,
  onValueChange,
  label,
  options,
  className,
  contentClassName,
}: {
  value: string;
  onValueChange: (v: string) => void;
  label: string;
  options: OpsFilterOption[];
  className?: string;
  contentClassName?: string;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <ElevatedSelect
      value={value}
      onValueChange={onValueChange}
      contentClassName={contentClassName}
      trigger={
        <button
          type="button"
          title={`${label}: ${selected?.label ?? ""}`}
          aria-label={label}
          className={cn(
            "inline-flex h-8 max-w-[180px] items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors",
            "hover:border-foreground/20",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            className,
          )}
          style={{ boxShadow: softSurfaceWithInset }}
        >
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className="min-w-0 truncate text-foreground">
            {selected?.label ?? "…"}
          </span>
          <CaretDown
            className="h-3 w-3 shrink-0 text-muted-foreground opacity-70"
            weight="bold"
          />
        </button>
      }
    >
      {options.map((opt) => (
        <ElevatedSelectItem
          key={opt.value}
          value={opt.value}
          icon={opt.icon}
          iconStyled={false}
        >
          {opt.label}
        </ElevatedSelectItem>
      ))}
    </ElevatedSelect>
  );
}

/** Width bands: hold the preferred multi-col layout until truly narrow. */
type WidthBand = "wide" | "mid" | "stack";
/** Height bands: shrink charts/padding before stacking sections. */
type HeightBand = "roomy" | "tight" | "cramped";

export type LiveOpsPanelProps = {
  open: boolean;
  onClose: () => void;
  campaignType?: CampaignType;
};

function useElementSize(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const [size, setSize] = useState({ w: 1280, h: 720 });
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({
        w: Math.max(0, Math.round(rect.width)),
        h: Math.max(0, Math.round(rect.height)),
      });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    return () => ro.disconnect();
  }, [ref, enabled]);
  return size;
}

function resolveWidthBand(w: number): WidthBand {
  // Prefer keeping columns; only stack on phone-ish widths.
  if (w < 620) return "stack";
  if (w < 960) return "mid";
  return "wide";
}

function resolveHeightBand(h: number): HeightBand {
  if (h < 480) return "cramped";
  if (h < 640) return "tight";
  return "roomy";
}

function chartHeights(band: HeightBand) {
  if (band === "cramped") {
    return { hourly: 88, status: 96, dept: 100, team: 120 };
  }
  if (band === "tight") {
    return { hourly: 112, status: 120, dept: 120, team: 140 };
  }
  return { hourly: 150, status: 150, dept: 160, team: 180 };
}

function useFmt() {
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

function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col rounded-xl border border-border/70 bg-card p-2.5 sm:p-3",
        className,
      )}
      style={{ boxShadow: softSurfaceShadow }}
    >
      {children}
    </section>
  );
}

function CardHead({
  icon,
  iconBg,
  title,
  subtitle,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-2 flex min-w-0 items-center gap-2">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white",
          iconBg,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-xs font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {subtitle ? (
          <p className="truncate text-[10px] leading-snug text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Skeleton({ h = 120 }: { h?: number }) {
  return (
    <div
      className="animate-pulse rounded-xl bg-muted/50"
      style={{ height: h }}
      aria-hidden
    />
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className="min-w-0 rounded-lg border border-border/60 bg-muted/40 px-2 py-1.5"
      title={hint}
    >
      <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums tracking-tight text-foreground sm:text-base">
        {value}
      </p>
    </div>
  );
}

function HourlyChart({
  hourly,
  loading,
  height = 150,
}: {
  hourly: AttendanceOverview["hourly"] | undefined;
  loading: boolean;
  height?: number;
}) {
  const tl = useTranslations("metricsOps.attendance.labels");
  const tc = useTranslations("metricsOps.common");
  const fmt = useFmt();
  const data = useMemo(
    () =>
      (hourly ?? Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))).map(
        (p) => ({
          label: `${String(p.hour).padStart(2, "0")}h`,
          conversas: p.count,
        }),
      ),
    [hourly],
  );
  const total = data.reduce((s, d) => s + d.conversas, 0);
  const peak = useMemo(() => {
    if (!total) return null;
    return data.reduce((b, d) => (d.conversas > b.conversas ? d : b));
  }, [data, total]);
  const config: ChartConfig = {
    conversas: { label: tl("conversationsLabel"), color: COLORS.signal },
  };

  if (loading) return <Skeleton h={height} />;
  if (!total) {
    return (
      <p className="py-10 text-center text-xs text-muted-foreground">
        {tl("noConversationVolume")}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
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
      <ChartContainer
        config={config}
        className="aspect-auto w-full"
        style={{ height }}
      >
        <BarChart data={data} margin={{ top: 2, right: 2, left: -18, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={9}
            interval={3}
            tick={{ fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={9}
            allowDecimals={false}
            width={28}
            tick={{ fill: "hsl(var(--muted-foreground))" }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => (
                  <span className="font-semibold tabular-nums">
                    {fmt.num(Number(value))}
                  </span>
                )}
              />
            }
          />
          <Bar
            dataKey="conversas"
            fill="var(--color-conversas)"
            radius={[3, 3, 0, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function StatusChart({
  dist,
  loading,
  height = 150,
}: {
  dist: StatusDistribution | undefined;
  loading: boolean;
  height?: number;
}) {
  const st = useTranslations("metricsOps.attendance.status");
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useFmt();
  const total = dist?.total ?? 0;
  const slices = useMemo(() => {
    if (!dist || !total) return [];
    return [
      { key: "f", name: st("finished"), value: dist.finished, color: COLORS.finished },
      { key: "o", name: st("ongoing"), value: dist.ongoing, color: COLORS.ongoing },
      { key: "p", name: st("pending"), value: dist.pending, color: COLORS.pending },
    ].filter((s) => s.value > 0);
  }, [dist, total, st]);
  const rate =
    total > 0 && dist
      ? Math.round((dist.finished / total) * 1000) / 10
      : null;
  const config: ChartConfig = {
    f: { label: st("finished"), color: COLORS.finished },
  };

  if (loading) return <Skeleton h={height} />;
  if (!slices.length) {
    return (
      <p className="py-10 text-center text-xs text-muted-foreground">
        {tl("noStatusData")}
      </p>
    );
  }

  const pie = Math.min(128, Math.max(88, height - 8));
  const outer = Math.round(pie * 0.38);
  const inner = Math.round(pie * 0.27);

  return (
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(88px,112px)_minmax(0,1fr)]">
      <ChartContainer
        config={config}
        className="mx-auto aspect-auto max-w-full"
        style={{ height: pie, width: pie }}
      >
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={inner}
            outerRadius={outer}
            paddingAngle={2}
            strokeWidth={2}
            stroke="hsl(var(--background))"
          >
            {slices.map((s) => (
              <Cell key={s.key} fill={s.color} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
        </PieChart>
      </ChartContainer>
      <div className="min-w-0 space-y-1.5">
        <div className="rounded-lg border border-border/60 bg-muted/40 px-2 py-1.5">
          <p className="text-[9px] font-semibold uppercase text-muted-foreground">
            {tl("pctFinished")}
          </p>
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {fmt.pct(rate)}
          </p>
        </div>
        {slices.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <div key={s.key} className="min-w-0">
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="truncate">{s.name}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {fmt.num(s.value)}
                </span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: s.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeptChart({
  rows,
  loading,
  height = 160,
}: {
  rows: DepartmentRow[] | undefined;
  loading: boolean;
  height?: number;
}) {
  const st = useTranslations("metricsOps.attendance.status");
  const tc = useTranslations("metricsOps.common");
  const tl = useTranslations("metricsOps.attendance.labels");
  const noDept = tc("noDepartment");
  const data = useMemo(() => {
    if (!rows?.length) return [];
    return [...rows]
      .map((r) => {
        const full = (r.department_name || "").trim() || noDept;
        return {
          name: full.length > 14 ? `${full.slice(0, 12)}…` : full,
          concluidas: r.finished,
          em_andamento: r.ongoing,
          aguardando: r.pending,
          total: r.finished + r.ongoing + r.pending,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [rows, noDept]);

  if (loading) return <Skeleton h={height} />;
  if (!data.length) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        {tl("noDepartmentData")}
      </p>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          barCategoryGap={6}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="hsl(var(--border))"
          />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={88}
            tickLine={false}
            axisLine={false}
            fontSize={10}
            tick={{ fill: "hsl(var(--foreground))" }}
          />
          <Bar dataKey="concluidas" stackId="a" fill={COLORS.finished} name={st("finished")} />
          <Bar dataKey="em_andamento" stackId="a" fill={COLORS.ongoing} name={st("ongoing")} />
          <Bar
            dataKey="aguardando"
            stackId="a"
            fill={COLORS.pending}
            name={st("pending")}
            radius={[0, 3, 3, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DirectionMix({
  slices,
  loading,
  height = 150,
}: {
  slices: { direction: string; count: number; pct: number }[] | undefined;
  loading: boolean;
  height?: number;
}) {
  const t = useTranslations("liveChat.opsDashboard");
  const fmt = useFmt();
  const data = useMemo(() => {
    if (!slices?.length) return [];
    return slices.map((s) => ({
      key: s.direction,
      name:
        s.direction === "inbound"
          ? t("inbound")
          : s.direction === "outbound"
            ? t("outbound")
            : s.direction,
      value: s.count,
      pct: s.pct,
      color:
        s.direction === "inbound"
          ? COLORS.finished
          : s.direction === "outbound"
            ? COLORS.ongoing
            : COLORS.pending,
    }));
  }, [slices, t]);
  const total = data.reduce((a, d) => a + d.value, 0);
  if (loading) return <Skeleton h={height} />;
  if (!data.length || !total) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        {t("inbound")} / {t("outbound")}: 0
      </p>
    );
  }
  const pie = Math.min(128, Math.max(88, height - 8));
  return (
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(88px,112px)_minmax(0,1fr)]">
      <ChartContainer
        config={{ v: { label: "v", color: COLORS.signal } }}
        className="mx-auto aspect-auto max-w-full"
        style={{ height: pie, width: pie }}
      >
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={Math.round(pie * 0.27)}
            outerRadius={Math.round(pie * 0.38)}
            paddingAngle={2}
            strokeWidth={2}
            stroke="hsl(var(--background))"
          >
            {data.map((s) => (
              <Cell key={s.key} fill={s.color} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
        </PieChart>
      </ChartContainer>
      <div className="min-w-0 space-y-1.5">
        {data.map((s) => (
          <div key={s.key} className="min-w-0">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {fmt.num(s.value)} · {fmt.pct(s.pct)}
              </span>
            </div>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${s.pct}%`, backgroundColor: s.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamRank({
  rows,
  loading,
  maxRows = 8,
  variant = "attendance",
}: {
  rows: MemberRow[] | undefined;
  loading: boolean;
  maxRows?: number;
  variant?: "attendance" | "telephony";
}) {
  const st = useTranslations("metricsOps.attendance.status");
  const telL = useTranslations("metricsOps.telephony.labels");
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useFmt();
  const finishedLabel =
    variant === "telephony" ? telL("answered") : st("finished");
  const data = useMemo(() => {
    if (!rows?.length) return [];
    return [...rows]
      .map((r) => ({
        name:
          (r.display_name || r.email || r.actor_id).length > 16
            ? `${(r.display_name || r.email || r.actor_id).slice(0, 14)}…`
            : r.display_name || r.email || r.actor_id,
        resolved: r.resolved,
        open: r.open,
        pending: r.pending,
        total: r.resolved + r.open + r.pending,
      }))
      .sort((a, b) => b.resolved - a.resolved)
      .slice(0, maxRows);
  }, [rows, maxRows]);

  if (loading) return <Skeleton h={Math.max(100, maxRows * 22)} />;
  if (!data.length) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        {variant === "telephony" ? telL("noRanking") : tl("noAgentsHint")}
      </p>
    );
  }

  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d.name} className="space-y-0.5">
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="truncate font-medium text-foreground">{d.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {fmt.num(d.resolved)} {finishedLabel.toLowerCase()}
            </span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(d.resolved / max) * 100}%` }}
            />
            <div
              className="h-full bg-blue-500"
              style={{ width: `${(d.open / max) * 100}%` }}
            />
            <div
              className="h-full bg-amber-500"
              style={{ width: `${(d.pending / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamTable({
  rows,
  loading,
  variant = "attendance",
}: {
  rows: MemberRow[] | undefined;
  loading: boolean;
  variant?: "attendance" | "telephony";
}) {
  const st = useTranslations("metricsOps.attendance.status");
  const telL = useTranslations("metricsOps.telephony.labels");
  const tc = useTranslations("metricsOps.common");
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useFmt();
  const isTel = variant === "telephony";
  const colFinished = isTel ? telL("answered") : st("finished");
  const colOpen = isTel ? telL("failed") : st("ongoing");
  const colPending = isTel ? telL("abandoned") : st("pending");
  const colPct = isTel ? telL("connectCol") : "%";
  const colTime = isTel ? telL("talkCol") : tc("response");
  const presence = useCallback(
    (p: string) => {
      if (p === "online") return tc("online");
      if (p === "on_call") return tc("onCall");
      return tc("offline");
    },
    [tc],
  );

  if (loading) return <Skeleton h={180} />;
  if (!rows?.length) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        {isTel ? telL("noHumanAgentCalls") : tl("noAgentsHint")}
      </p>
    );
  }

  const sorted = [...rows]
    .sort((a, b) => b.resolution_pct - a.resolution_pct)
    .slice(0, 10);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[10px]">
        <thead>
          <tr className="border-b border-border/60 text-muted-foreground">
            <th className="px-1.5 py-1 font-semibold">
              {isTel ? telL("agentCol") : tl("agentCol")}
            </th>
            {!isTel ? (
              <th className="px-1.5 py-1 font-semibold">{tc("status")}</th>
            ) : null}
            <th className="px-1.5 py-1 text-right font-semibold">
              {colFinished}
            </th>
            <th className="px-1.5 py-1 text-right font-semibold">{colOpen}</th>
            <th className="px-1.5 py-1 text-right font-semibold">
              {colPending}
            </th>
            <th className="px-1.5 py-1 text-right font-semibold">{colPct}</th>
            <th className="px-1.5 py-1 text-right font-semibold">{colTime}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.actor_id}
              className="border-b border-border/40 last:border-0"
            >
              <td className="max-w-[120px] truncate px-1.5 py-1 font-medium text-foreground">
                {r.display_name || r.email || r.actor_id}
              </td>
              {!isTel ? (
                <td className="px-1.5 py-1 text-muted-foreground">
                  {presence(r.presence)}
                </td>
              ) : null}
              <td className="px-1.5 py-1 text-right tabular-nums text-foreground">
                {fmt.num(r.resolved)}
              </td>
              <td className="px-1.5 py-1 text-right tabular-nums text-foreground">
                {fmt.num(r.open)}
              </td>
              <td className="px-1.5 py-1 text-right tabular-nums text-foreground">
                {fmt.num(r.pending)}
              </td>
              <td className="px-1.5 py-1 text-right tabular-nums text-foreground">
                {fmt.pct(r.resolution_pct)}
              </td>
              <td className="px-1.5 py-1 text-right tabular-nums text-foreground">
                {fmt.mins(r.avg_response_mins)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeptTable({
  rows,
  loading,
}: {
  rows: DepartmentRow[] | undefined;
  loading: boolean;
}) {
  const tc = useTranslations("metricsOps.common");
  const tl = useTranslations("metricsOps.attendance.labels");
  const fmt = useFmt();
  const noDept = tc("noDepartment");

  if (loading) return <Skeleton h={140} />;
  if (!rows?.length) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        {tl("noDepartmentData")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[10px]">
        <thead>
          <tr className="border-b border-border/60 text-muted-foreground">
            <th className="px-1.5 py-1 font-semibold">{tc("department")}</th>
            <th className="px-1.5 py-1 text-right font-semibold">
              {tc("wait")}
            </th>
            <th className="px-1.5 py-1 text-right font-semibold">
              {tc("duration")}
            </th>
            <th className="px-1.5 py-1 text-right font-semibold">
              {tl("finishedCol")}
            </th>
          </tr>
        </thead>
        <tbody>
          {[...rows]
            .sort((a, b) => b.finished - a.finished)
            .map((r) => (
              <tr
                key={r.department_id || r.department_name}
                className="border-b border-border/40 last:border-0"
              >
                <td className="max-w-[140px] truncate px-1.5 py-1 font-medium text-foreground">
                  {(r.department_name || "").trim() || noDept}
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">
                  {fmt.mins(r.avg_wait_mins)}
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">
                  {fmt.mins(r.avg_handle_mins)}
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">
                  {fmt.num(r.finished)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LiveOpsPanel({
  open,
  onClose,
  campaignType,
}: LiveOpsPanelProps) {
  const t = useTranslations("liveChat.opsDashboard");
  const tc = useTranslations("metricsOps.common");
  const tk = useTranslations("metricsOps.attendance.kpi");
  const ts = useTranslations("metricsOps.attendance.sections");
  const tl = useTranslations("metricsOps.attendance.labels");
  const telKpi = useTranslations("metricsOps.telephony.kpi");
  const telS = useTranslations("metricsOps.telephony.sections");
  const fmt = useFmt();
  const { currentWorkspace, can, permissionsLoading } = useWorkspace();

  /**
   * Telephony mode: workspace owner/admin (and platform admin) always can via
   * `can()`, or any member with attendance:read (same RBAC as /telephony/*).
   */
  const canUseTelephonyMode =
    !permissionsLoading && can("attendance", "read");

  const [opsMode, setOpsMode] = useState<OpsMode>("attendance");
  const [preset, setPreset] = useState<DatePreset>("7d");
  const [departmentId, setDepartmentId] = useState("all");
  const [memberId, setMemberId] = useState("all");
  const [channel, setChannel] = useState("all");
  const [direction, setDirection] = useState("all");
  const [callType, setCallType] = useState("all");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [telOverview, setTelOverview] = useState<TelephonyOverview | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [heightPct, setHeightPct] = useState(DEFAULT_HEIGHT_PCT);
  /** True = cover the entire browser viewport (fixed inset-0). */
  const [fullscreen, setFullscreen] = useState(false);
  const dragRef = useRef<{ startY: number; startPct: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodySize = useElementSize(bodyRef, open);
  const widthBand = resolveWidthBand(bodySize.w);
  const heightBand = resolveHeightBand(bodySize.h);
  const heights = chartHeights(heightBand);
  const teamRows = heightBand === "cramped" ? 5 : heightBand === "tight" ? 6 : 8;
  const dense = heightBand !== "roomy";

  const effectiveMode: OpsMode =
    canUseTelephonyMode && opsMode === "telephony" ? "telephony" : "attendance";

  const range = useMemo(() => {
    const days = preset === "7d" ? 6 : preset === "30d" ? 29 : 89;
    return {
      dateFrom: format(subDays(new Date(), days), "yyyy-MM-dd"),
      dateTo: format(new Date(), "yyyy-MM-dd"),
    };
  }, [preset]);

  const memberNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of members) {
      map[m.userId] = m.username || m.email || m.userId;
    }
    return map;
  }, [members]);

  const departmentOptions = useMemo<OpsFilterOption[]>(
    () => [
      { value: "all", label: tc("all") },
      ...departments.map((d) => ({ value: d.id, label: d.name })),
    ],
    [departments, tc],
  );

  const memberOptions = useMemo<OpsFilterOption[]>(
    () => [
      { value: "all", label: tc("all") },
      ...members.map((m) => ({
        value: m.userId,
        label: m.username || m.email || m.userId,
      })),
    ],
    [members, tc],
  );

  const channelOptions = useMemo<OpsFilterOption[]>(
    () => [
      { value: "all", label: tc("all") },
      {
        value: "whatsapp",
        label: tc("whatsapp"),
        icon: <WhatsappLogo className="h-3.5 w-3.5" weight="fill" />,
      },
      {
        value: "voice",
        label: tc("phone"),
        icon: <Phone className="h-3.5 w-3.5" weight="fill" />,
      },
    ],
    [tc],
  );

  const directionOptions = useMemo<OpsFilterOption[]>(
    () => [
      { value: "all", label: tc("all") },
      { value: "inbound", label: t("inbound") },
      { value: "outbound", label: t("outbound") },
    ],
    [t, tc],
  );

  const callTypeOptions = useMemo<OpsFilterOption[]>(
    () => [
      { value: "all", label: tc("all") },
      { value: "crm", label: t("typeCrm") },
      { value: "trunk_inbound", label: t("typeTrunkIn") },
      { value: "trunk_outbound", label: t("typeTrunkOut") },
      { value: "workflow", label: t("typeWorkflow") },
    ],
    [t, tc],
  );

  useEffect(() => {
    if (!canUseTelephonyMode && opsMode === "telephony") {
      setOpsMode("attendance");
    }
  }, [canUseTelephonyMode, opsMode]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchDepartments().then((r) => {
      if (!cancelled) setDepartments(r.departments ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !currentWorkspace?.id) return;
    let cancelled = false;
    listMembersAction(currentWorkspace.id).then((r) => {
      if (!cancelled) setMembers(r.members ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, currentWorkspace?.id]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      if (effectiveMode === "telephony") {
        const r = await getTelephonyOverviewAction({
          dateFrom: range.dateFrom,
          dateTo: range.dateTo,
          direction: direction === "all" ? undefined : direction,
          callType: callType === "all" ? undefined : callType,
          memberId: memberId === "all" ? undefined : memberId,
          serviceLevelSeconds: 20,
        });
        if (r.error) {
          setError(r.error);
          if (!opts?.silent) setTelOverview(null);
        } else {
          setTelOverview(r.overview);
          setLastUpdated(new Date());
        }
      } else {
        const r = await getAttendanceOverviewAction({
          dateFrom: range.dateFrom,
          dateTo: range.dateTo,
          departmentId: departmentId === "all" ? undefined : departmentId,
          memberId: memberId === "all" ? undefined : memberId,
          channel: channel === "all" ? undefined : channel,
          campaignType,
          includeAi: true,
        });
        if (r.error) {
          setError(r.error);
          if (!opts?.silent) setOverview(null);
        } else {
          setOverview(r.overview);
          setLastUpdated(new Date());
        }
      }

      setLoading(false);
      setRefreshing(false);
    },
    [
      effectiveMode,
      range.dateFrom,
      range.dateTo,
      departmentId,
      memberId,
      channel,
      direction,
      callType,
      campaignType,
    ],
  );

  useEffect(() => {
    if (!open) {
      setFullscreen(false);
      return;
    }
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => {
      void load({ silent: true });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (fullscreen) setFullscreen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, fullscreen]);

  useEffect(() => {
    if (!open || !fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, fullscreen]);

  const onResizePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (fullscreen) return;
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startPct: heightPct };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (fullscreen || !dragRef.current || !panelRef.current?.parentElement) {
      return;
    }
    const available = panelRef.current.parentElement.clientHeight || 1;
    const deltaY = e.clientY - dragRef.current.startY;
    const deltaPct = (deltaY / Math.max(1, available)) * 100;
    const next = Math.min(
      MAX_HEIGHT_PCT,
      Math.max(MIN_HEIGHT_PCT, dragRef.current.startPct + deltaPct),
    );
    setHeightPct(next);
  };

  const onResizePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const toggleFullscreen = () => {
    setFullscreen((v) => {
      const next = !v;
      if (next) setHeightPct(MAX_HEIGHT_PCT);
      return next;
    });
  };

  const kpis = overview?.kpis;
  const telKpis = telOverview?.kpis;
  const engaged =
    effectiveMode === "telephony"
      ? (telKpis?.total_calls ?? 0)
      : (kpis?.engaged ??
        (kpis?.finished ?? 0) + (kpis?.ongoing ?? 0) + (kpis?.pending ?? 0));

  const empty =
    loading && !(effectiveMode === "telephony" ? telOverview : overview);

  const attendanceKpiCards = [
    {
      key: "finished",
      label: tk("finished"),
      value: empty ? "…" : fmt.num(kpis?.finished),
      icon: CheckCircle,
      bg: "bg-emerald-500",
    },
    {
      key: "ongoing",
      label: tk("ongoing"),
      value: empty ? "…" : fmt.num(kpis?.ongoing),
      icon: Pulse,
      bg: "bg-blue-500",
    },
    {
      key: "pending",
      label: tk("pending"),
      value: empty ? "…" : fmt.num(kpis?.pending),
      icon: Hourglass,
      bg: "bg-amber-500",
    },
    {
      key: "unassigned",
      label: tk("unassigned"),
      value: empty ? "…" : fmt.num(kpis?.unassigned_backlog),
      icon: UserMinus,
      bg: "bg-rose-500",
    },
    {
      key: "new",
      label: tk("newContacts"),
      value: empty ? "…" : fmt.num(kpis?.new_contacts),
      icon: Users,
      bg: "bg-violet-500",
    },
    {
      key: "wait",
      label: tk("avgWait"),
      value: empty ? "…" : fmt.mins(kpis?.avg_wait_mins ?? null),
      icon: Clock,
      bg: "bg-teal-500",
    },
    {
      key: "handle",
      label: tk("avgHandle"),
      value: empty ? "…" : fmt.mins(kpis?.avg_handle_mins ?? null),
      icon: Timer,
      bg: "bg-primary",
    },
    {
      key: "frt",
      label: tk("frt"),
      value: empty ? "…" : fmt.mins(kpis?.avg_frt_mins ?? null),
      icon: Lightning,
      bg: "bg-indigo-500",
    },
  ] as const;

  const telephonyKpiCards = [
    {
      key: "total",
      label: telKpi("total"),
      value: empty ? "…" : fmt.num(telKpis?.total_calls),
      icon: PhoneCall,
      bg: "bg-primary",
    },
    {
      key: "answered",
      label: telKpi("answered"),
      value: empty ? "…" : fmt.num(telKpis?.answered),
      icon: CheckCircle,
      bg: "bg-emerald-500",
    },
    {
      key: "connect",
      label: telKpi("connect"),
      value: empty ? "…" : fmt.pct(telKpis?.connect_rate ?? null),
      icon: Pulse,
      bg: "bg-teal-500",
    },
    {
      key: "sl",
      label: telKpi("sl"),
      value: empty ? "…" : fmt.pct(telKpis?.service_level_pct ?? null),
      icon: Lightning,
      bg: "bg-indigo-500",
    },
    {
      key: "fail",
      label: telKpi("failed"),
      value: empty
        ? "…"
        : fmt.num((telKpis?.failed ?? 0) + (telKpis?.abandoned ?? 0)),
      icon: Warning,
      bg: "bg-amber-500",
    },
    {
      key: "ring",
      label: telKpi("ring"),
      value: empty ? "…" : fmt.mins(telKpis?.avg_ring_mins ?? null),
      icon: Clock,
      bg: "bg-cyan-600",
    },
    {
      key: "talk",
      label: telKpi("talk"),
      value: empty ? "…" : fmt.mins(telKpis?.avg_talk_mins ?? null),
      icon: Timer,
      bg: "bg-violet-500",
    },
    {
      key: "aht",
      label: telKpi("aht"),
      value: empty ? "…" : fmt.mins(telKpis?.avg_aht_mins ?? null),
      icon: Headset,
      bg: "bg-slate-700",
    },
  ] as const;

  const kpiCards =
    effectiveMode === "telephony" ? telephonyKpiCards : attendanceKpiCards;

  const channelMix = overview?.channel_mix ?? [];
  const frt = overview?.frt;
  const msg = overview?.messaging;
  const reopen = overview?.reopen;
  const ai = overview?.ai;
  const live =
    effectiveMode === "telephony" ? telOverview?.live : overview?.live;
  const telQueue = telOverview?.queue;
  const telOcc = telOverview?.occupancy;
  const telMembers = telOverview?.by_member ?? [];

  const telMemberAsRank: MemberRow[] = useMemo(
    () =>
      telMembers.map((m: TelephonyMemberRow) => ({
        actor_id: m.user_id,
        actor_kind: "human",
        display_name: memberNames[m.user_id] || m.user_id,
        presence: "online",
        avg_response_mins: m.avg_talk_mins,
        rating: null,
        resolution_pct: m.connect_rate,
        open: m.failed,
        pending: m.abandoned,
        resolved: m.answered,
      })),
    [telMembers, memberNames],
  );

  if (!open) return null;

  const shellClass = fullscreen
    ? "fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background"
    : "absolute inset-x-0 top-0 z-40 flex flex-col overflow-hidden border-b border-border/80 bg-background shadow-lg";

  const shellStyle = fullscreen
    ? undefined
    : { height: `${heightPct}%` as const };

  return (
    <div
      ref={panelRef}
      className={shellClass}
      style={shellStyle}
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
    >
      {/* Toolbar: identity · mode · period · actions / filters · live */}
      <header className="shrink-0 border-b border-border/70 bg-card px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
            <ChartBar className="h-4 w-4" weight="fill" />
          </div>
          <div className="min-w-0 max-w-[180px]">
            <p className="truncate text-sm font-semibold text-foreground">
              {t("title")}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {t(
                effectiveMode === "telephony"
                  ? "subtitleTelephony"
                  : "subtitle",
                {
                  count: fmt.num(engaged),
                  poll: String(POLL_MS / 1000),
                },
              )}
            </p>
          </div>

          {canUseTelephonyMode ? (
            <ElevatedPillToggle
              aria-label={t("modeLabel")}
              size="md"
              value={effectiveMode}
              onChange={(v) => setOpsMode(v as OpsMode)}
              options={[
                {
                  value: "attendance",
                  label: t("modeAttendance"),
                  icon: (
                    <Headset
                      className="h-3.5 w-3.5"
                      weight={
                        effectiveMode === "attendance" ? "fill" : "regular"
                      }
                    />
                  ),
                },
                {
                  value: "telephony",
                  label: t("modeTelephony"),
                  icon: (
                    <PhoneCall
                      className="h-3.5 w-3.5"
                      weight={
                        effectiveMode === "telephony" ? "fill" : "regular"
                      }
                    />
                  ),
                },
              ]}
            />
          ) : null}

          <ElevatedPillToggle
            aria-label={tc("period")}
            size="md"
            value={preset}
            onChange={setPreset}
            options={[
              { value: "7d", label: tc("days7") },
              { value: "30d", label: tc("days30") },
              { value: "90d", label: tc("days90") },
            ]}
          />

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {lastUpdated ? (
              <span className="hidden text-[10px] text-muted-foreground xl:inline">
                {t("updatedAt", {
                  time: lastUpdated.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }),
                })}
              </span>
            ) : null}

            {(refreshing || loading) && (
              <CircleNotch
                className="h-4 w-4 animate-spin text-primary"
                weight="bold"
              />
            )}

            <ElevatedButton
              type="button"
              variant={fullscreen ? "primary" : "outline-subtle"}
              size="icon"
              className="min-w-0"
              aria-label={fullscreen ? t("restore") : t("maximize")}
              aria-pressed={fullscreen}
              onClick={toggleFullscreen}
              icon={
                fullscreen ? (
                  <ArrowsInSimple className="h-4 w-4" weight="bold" />
                ) : (
                  <ArrowsOut className="h-4 w-4" weight="bold" />
                )
              }
              iconVisible
            />

            <ElevatedButton
              type="button"
              variant="outline-subtle"
              size="icon"
              className="min-w-0"
              aria-label={t("close")}
              onClick={onClose}
              icon={<X className="h-4 w-4" weight="bold" />}
              iconVisible
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {effectiveMode === "attendance" ? (
            <OpsFilterSelect
              label={tc("department")}
              value={departmentId}
              onValueChange={setDepartmentId}
              options={departmentOptions}
            />
          ) : (
            <OpsFilterSelect
              label={t("direction")}
              value={direction}
              onValueChange={setDirection}
              options={directionOptions}
            />
          )}

          <OpsFilterSelect
            label={tc("member")}
            value={memberId}
            onValueChange={setMemberId}
            options={memberOptions}
          />

          {effectiveMode === "attendance" ? (
            <OpsFilterSelect
              label={tc("channel")}
              value={channel}
              onValueChange={setChannel}
              options={channelOptions}
            />
          ) : (
            <OpsFilterSelect
              label={t("callType")}
              value={callType}
              onValueChange={setCallType}
              options={callTypeOptions}
              className="max-w-[200px]"
            />
          )}

          {live?.has_data ? (
            <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
              <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                {tc("online")} {fmt.num(live.online)}
              </span>
              <span className="rounded-full bg-blue-500 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                {tc("onCall")} {fmt.num(live.in_call)}
              </span>
              <span className="rounded-full bg-slate-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                {t("freeAgents")} {fmt.num(live.free)}
              </span>
            </div>
          ) : null}
        </div>
      </header>

      {/* Height/width-aware body: keep preferred columns until extreme sizes. */}
      <div
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-muted/25"
      >
        <div
          className={cn(
            "mx-auto flex w-full flex-col",
            dense ? "gap-1.5 p-1.5 sm:p-2" : "gap-2 p-2 sm:gap-2.5 sm:p-3",
            fullscreen ? "max-w-[1800px] lg:p-4" : "max-w-none",
            // When roomy, fill panel height so layout "owns" the vertical space.
            heightBand === "roomy" && widthBand !== "stack"
              ? "min-h-full"
              : null,
          )}
        >
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {/* KPI strip: keep 8-up as long as mid/wide */}
          <div
            className={cn(
              "grid shrink-0 gap-1.5",
              widthBand === "wide" && "grid-cols-8",
              widthBand === "mid" && "grid-cols-4",
              widthBand === "stack" && "grid-cols-2 sm:grid-cols-4",
            )}
          >
            {kpiCards.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.key}
                  className={cn(
                    "min-w-0 rounded-xl border border-border/70 bg-card",
                    dense ? "px-1.5 py-1.5" : "px-2 py-2 sm:px-2.5",
                  )}
                  style={{ boxShadow: softSurfaceShadow }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {c.label}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 truncate font-semibold tabular-nums text-foreground",
                          dense ? "text-sm" : "text-base sm:text-lg",
                        )}
                      >
                        {c.value}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded-md text-white sm:rounded-lg",
                        dense ? "h-5 w-5" : "h-6 w-6 sm:h-7 sm:w-7",
                        c.bg,
                      )}
                    >
                      <Icon
                        className={dense ? "h-2.5 w-2.5" : "h-3 w-3 sm:h-3.5 sm:w-3.5"}
                        weight="fill"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {effectiveMode === "attendance" && (kpis?.shell_backlog ?? 0) > 0 ? (
            <p className="shrink-0 text-[10px] text-muted-foreground">
              {tk("shellLabel")}: {fmt.num(kpis?.shell_backlog)} ·{" "}
              {tk("entriesCreated", {
                count: fmt.num(kpis?.entries_created ?? 0),
              })}
            </p>
          ) : null}

          {/* Volume + status/direction: stay side-by-side from mid up */}
          <div
            className={cn(
              "grid gap-2",
              widthBand === "stack" ? "grid-cols-1" : "grid-cols-12",
              dense ? "gap-1.5" : "sm:gap-2.5",
            )}
          >
            <Card
              className={widthBand === "stack" ? undefined : "col-span-7"}
            >
              <CardHead
                icon={<ChartBar className="h-3.5 w-3.5" weight="fill" />}
                iconBg="bg-primary"
                title={
                  effectiveMode === "telephony" ? telS("hourly") : ts("hourly")
                }
                subtitle={
                  dense
                    ? undefined
                    : effectiveMode === "telephony"
                      ? telS("hourlySub")
                      : ts("hourlySub")
                }
              />
              <HourlyChart
                hourly={
                  effectiveMode === "telephony"
                    ? telOverview?.hourly
                    : overview?.hourly
                }
                loading={empty}
                height={heights.hourly}
              />
            </Card>
            <Card
              className={widthBand === "stack" ? undefined : "col-span-5"}
            >
              <CardHead
                icon={<ChartPie className="h-3.5 w-3.5" weight="fill" />}
                iconBg="bg-emerald-500"
                title={
                  effectiveMode === "telephony" ? telS("dirType") : ts("status")
                }
                subtitle={
                  dense
                    ? undefined
                    : effectiveMode === "telephony"
                      ? telS("dirTypeSub")
                      : ts("statusSub")
                }
              />
              {effectiveMode === "telephony" ? (
                <DirectionMix
                  slices={telOverview?.by_direction}
                  loading={empty}
                  height={heights.status}
                />
              ) : (
                <StatusChart
                  dist={overview?.status_distribution}
                  loading={empty}
                  height={heights.status}
                />
              )}
            </Card>
          </div>

          {effectiveMode === "attendance" ? (
            <>
              {/* Secondary metrics */}
              <div
                className={cn(
                  "grid gap-2",
                  dense ? "gap-1.5" : "sm:gap-2.5",
                  widthBand === "wide" && "grid-cols-5",
                  widthBand === "mid" && "grid-cols-3",
                  widthBand === "stack" && "grid-cols-1 sm:grid-cols-2",
                )}
              >
                <Card>
                  <CardHead
                    icon={<Lightning className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-indigo-500"
                    title={ts("frtTitle")}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <Stat
                      label={tl("overallAvg")}
                      value={fmt.mins(frt?.avg_mins ?? null)}
                    />
                    <Stat
                      label={tl("median")}
                      value={fmt.mins(frt?.median_mins ?? null)}
                    />
                    <Stat
                      label={tl("people")}
                      value={fmt.mins(frt?.human_avg_mins ?? null)}
                    />
                    <Stat
                      label={tc("ai")}
                      value={fmt.mins(frt?.ai_avg_mins ?? null)}
                    />
                  </div>
                </Card>
                <Card>
                  <CardHead
                    icon={<ChartBar className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-teal-600"
                    title={ts("messages")}
                  />
                  <div className="grid grid-cols-1 gap-1.5">
                    <Stat
                      label={tl("avgPerConversation")}
                      value={
                        msg?.available
                          ? fmt.num(msg.avg_messages_per_conversation ?? 0)
                          : fmt.na
                      }
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <Stat
                        label={tl("fromCustomer")}
                        value={
                          msg?.available ? fmt.num(msg.avg_inbound ?? 0) : fmt.na
                        }
                      />
                      <Stat
                        label={tl("fromTeam")}
                        value={
                          msg?.available
                            ? fmt.num(msg.avg_outbound ?? 0)
                            : fmt.na
                        }
                      />
                    </div>
                  </div>
                </Card>
                <Card>
                  <CardHead
                    icon={<Pulse className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-orange-500"
                    title={ts("reopen")}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <Stat
                      label={tl("reopenPct")}
                      value={
                        reopen?.available && reopen.reopen_rate != null
                          ? fmt.pct(reopen.reopen_rate)
                          : fmt.na
                      }
                    />
                    <Stat
                      label={tc("quantity")}
                      value={fmt.num(reopen?.reopened_count)}
                    />
                  </div>
                </Card>
                <Card>
                  <CardHead
                    icon={
                      <WhatsappLogo className="h-3.5 w-3.5" weight="fill" />
                    }
                    iconBg="bg-[#25d366]"
                    title={ts("templatesTitle")}
                  />
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    <Stat
                      label={tl("templatesSent")}
                      value={fmt.num(msg?.template_messages ?? 0)}
                    />
                    <Stat
                      label={tl("conversationsWithTemplateLabel")}
                      value={fmt.num(msg?.conversations_with_template ?? 0)}
                    />
                    <Stat
                      label={tl("avgTemplate")}
                      value={
                        msg?.avg_template != null
                          ? fmt.num(msg.avg_template)
                          : fmt.na
                      }
                    />
                  </div>
                </Card>
                <Card>
                  <CardHead
                    icon={<Phone className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-emerald-600"
                    title={ts("channelsUsed")}
                  />
                  <div className="space-y-2">
                    {channelMix.length === 0 && !empty ? (
                      <p className="text-xs text-muted-foreground">
                        {tl("noChannelMix")}
                      </p>
                    ) : (
                      channelMix.map((c) => (
                        <div key={c.channel} className="min-w-0">
                          <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px]">
                            <span className="truncate font-medium text-foreground">
                              {c.channel === "whatsapp"
                                ? tc("whatsapp")
                                : c.channel === "voice"
                                  ? tc("voice")
                                  : c.channel}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {fmt.num(c.count)} · {fmt.pct(c.pct)}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, c.pct)}%`,
                                backgroundColor:
                                  c.channel === "whatsapp"
                                    ? "#25d366"
                                    : "#8b5cf6",
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>

              <div
                className={cn(
                  "grid gap-2",
                  dense ? "gap-1.5" : "sm:gap-2.5",
                  widthBand === "stack" ? "grid-cols-1" : "grid-cols-12",
                )}
              >
                <Card
                  className={widthBand === "stack" ? undefined : "col-span-3"}
                >
                  <CardHead
                    icon={<Robot className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-amber-500"
                    title={ts("aiTitle")}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <Stat
                      label={tl("aiSessions")}
                      value={fmt.num(ai?.sessions)}
                    />
                    <Stat
                      label={tl("stillActive")}
                      value={fmt.num(ai?.open_sessions)}
                    />
                    <Stat
                      label={tl("resolvedByAi")}
                      value={
                        ai?.available ? fmt.pct(ai.containment_rate) : fmt.na
                      }
                    />
                    <Stat
                      label={tl("handedToHuman")}
                      value={ai?.available ? fmt.pct(ai.handoff_rate) : fmt.na}
                    />
                  </div>
                </Card>
                <Card
                  className={widthBand === "stack" ? undefined : "col-span-5"}
                >
                  <CardHead
                    icon={<Buildings className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-violet-500"
                    title={ts("deptChart")}
                  />
                  <DeptChart
                    rows={overview?.by_department}
                    loading={empty}
                    height={heights.dept}
                  />
                </Card>
                <Card
                  className={widthBand === "stack" ? undefined : "col-span-4"}
                >
                  <CardHead
                    icon={<Buildings className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-violet-500"
                    title={ts("deptTable")}
                  />
                  <DeptTable
                    rows={overview?.by_department}
                    loading={empty}
                  />
                </Card>
              </div>

              <div
                className={cn(
                  "grid gap-2",
                  dense ? "gap-1.5" : "sm:gap-2.5",
                  widthBand === "stack" ? "grid-cols-1" : "grid-cols-12",
                )}
              >
                <Card
                  className={widthBand === "stack" ? undefined : "col-span-5"}
                >
                  <CardHead
                    icon={<Users className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-blue-500"
                    title={ts("teamRank")}
                    subtitle={dense ? undefined : ts("teamRankSub")}
                  />
                  <TeamRank
                    rows={overview?.by_member}
                    loading={empty}
                    maxRows={teamRows}
                  />
                </Card>
                <Card
                  className={widthBand === "stack" ? undefined : "col-span-7"}
                >
                  <CardHead
                    icon={<Users className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-blue-500"
                    title={ts("teamDetail")}
                    subtitle={dense ? undefined : ts("teamDetailSub")}
                  />
                  <TeamTable rows={overview?.by_member} loading={empty} />
                </Card>
              </div>
            </>
          ) : (
            <>
              {/* Telephony secondary strip */}
              <div
                className={cn(
                  "grid gap-2",
                  dense ? "gap-1.5" : "sm:gap-2.5",
                  widthBand === "wide" && "grid-cols-4",
                  widthBand === "mid" && "grid-cols-2",
                  widthBand === "stack" && "grid-cols-1 sm:grid-cols-2",
                )}
              >
                <Card>
                  <CardHead
                    icon={<Timer className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-violet-500"
                    title={telS("avgTimes")}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <Stat
                      label={telKpi("ring")}
                      value={fmt.mins(telKpis?.avg_ring_mins ?? null)}
                    />
                    <Stat
                      label={telKpi("talk")}
                      value={fmt.mins(telKpis?.avg_talk_mins ?? null)}
                    />
                    <Stat
                      label={telKpi("aht")}
                      value={fmt.mins(telKpis?.avg_aht_mins ?? null)}
                    />
                    <Stat
                      label={telKpi("hold")}
                      value={fmt.mins(telKpis?.avg_hold_mins ?? null)}
                    />
                  </div>
                </Card>
                <Card>
                  <CardHead
                    icon={<Lightning className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-indigo-500"
                    title={telS("speed")}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <Stat
                      label={telKpi("sl")}
                      value={fmt.pct(telKpis?.service_level_pct ?? null)}
                    />
                    <Stat
                      label={telKpi("withinSl")}
                      value={fmt.num(telKpis?.answered_within_sl)}
                    />
                    <Stat
                      label={telKpi("inbound")}
                      value={fmt.num(telKpis?.inbound)}
                    />
                    <Stat
                      label={telKpi("outbound")}
                      value={fmt.num(telKpis?.outbound)}
                    />
                  </div>
                </Card>
                <Card>
                  <CardHead
                    icon={<Hourglass className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-amber-500"
                    title={telS("queueTitle")}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <Stat
                      label={t("queueEnqueued")}
                      value={fmt.num(telQueue?.enqueued)}
                    />
                    <Stat
                      label={t("queueConnected")}
                      value={fmt.num(telQueue?.connected)}
                    />
                    <Stat
                      label={t("queueAbandoned")}
                      value={fmt.num(telQueue?.abandoned)}
                    />
                    <Stat
                      label={t("queueAsa")}
                      value={fmt.mins(telQueue?.avg_asa_mins ?? null)}
                    />
                  </div>
                </Card>
                <Card>
                  <CardHead
                    icon={<Headset className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-slate-700"
                    title={telS("occupancy")}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <Stat
                      label={t("occTeam")}
                      value={fmt.pct(telOcc?.team_occupancy_pct ?? null)}
                    />
                    <Stat
                      label={t("occIdle")}
                      value={fmt.pct(telOcc?.team_idle_pct ?? null)}
                    />
                    <Stat
                      label={tc("online")}
                      value={fmt.num(live?.online)}
                    />
                    <Stat
                      label={t("freeAgents")}
                      value={fmt.num(live?.free)}
                    />
                  </div>
                </Card>
              </div>

              <div
                className={cn(
                  "grid gap-2",
                  dense ? "gap-1.5" : "sm:gap-2.5",
                  widthBand === "stack" ? "grid-cols-1" : "grid-cols-12",
                )}
              >
                <Card
                  className={widthBand === "stack" ? undefined : "col-span-12"}
                >
                  <CardHead
                    icon={<Users className="h-3.5 w-3.5" weight="fill" />}
                    iconBg="bg-blue-500"
                    title={telS("teamRank")}
                    subtitle={dense ? undefined : telS("teamRankSub")}
                  />
                  <TeamRank
                    rows={telMemberAsRank}
                    loading={empty}
                    maxRows={teamRows}
                    variant="telephony"
                  />
                </Card>
              </div>

              <Card>
                <CardHead
                  icon={<Users className="h-3.5 w-3.5" weight="fill" />}
                  iconBg="bg-blue-500"
                  title={telS("teamDetail")}
                  subtitle={dense ? undefined : telS("teamDetailSub")}
                />
                <TeamTable
                  rows={telMemberAsRank}
                  loading={empty}
                  variant="telephony"
                />
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Resize only in docked mode */}
      {!fullscreen ? (
        <div
          className="group flex h-3 shrink-0 cursor-ns-resize items-center justify-center border-t border-border/70 bg-card touch-none"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
          role="separator"
          aria-orientation="horizontal"
          aria-label={t("resize")}
          title={t("resize")}
        >
          <div className="h-1 w-12 rounded-full bg-border transition group-hover:bg-primary/50" />
        </div>
      ) : null}
    </div>
  );
}
