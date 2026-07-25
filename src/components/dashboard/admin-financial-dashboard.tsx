"use client";

import {
  Area,
  AreaChart,
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
  getAdminOverviewAction,
  getPlanContractionsAction,
  getProfitReportAction,
  type AdminOverview,
  type AnalyticsGranularity,
  type GetAdminOverviewParams,
  type PlanContraction,
  type PlanContractionsReport,
  type ProfitReport,
  type RecentSpending,
  type WorkspaceFinancialSnapshot,
} from "@/app/actions/analytics";
import { getExchangeRateAction } from "@/app/actions/pricing";
import {
  ArrowClockwise,
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  Certificate,
  ChartBar,
  ChartLine,
  ChartPie,
  CurrencyDollar,
  DownloadSimple,
  Info,
  Lightning,
  Package,
  Receipt,
  Spinner,
  TrendUp,
  Users,
  Vault,
  Wallet,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import { cn } from "@/lib/utils";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useAuth } from "@/contexts/auth-context";

type DatePreset = "7d" | "30d" | "90d" | "custom";
type WorkspaceSortKey =
  | "revenue"
  | "profit"
  | "cost"
  | "current_balance"
  | "period_credits"
  | "workspace_name"
  | "tx_count"
  | "last_transaction_at";

const SEARCH_DEBOUNCE_MS = 300;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

const SORT_OPTIONS: Array<{ key: WorkspaceSortKey; label: string }> = [
  { key: "revenue", label: "Maior gasto" },
  { key: "profit", label: "Maior lucro" },
  { key: "current_balance", label: "Maior saldo" },
  { key: "period_credits", label: "Mais créditos" },
  { key: "workspace_name", label: "Nome" },
];

const PRESET_LABELS: Record<DatePreset, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  custom: "Personalizado",
};

const SERVICE_LABELS: Record<string, string> = {
  whatsapp_campaign: "WhatsApp Campaign",
  voice_campaign: "Voice Campaign",
  voice_call: "Voice Call",
  ai: "AI / LLM",
  manual_adjustment: "Ajuste manual",
  top_up: "Recarga",
};

const SERVICE_COLORS: Record<string, string> = {
  whatsapp_campaign: "#22c55e",
  voice_campaign: "#8b5cf6",
  voice_call: "#3b82f6",
  ai: "#ec4899",
  manual_adjustment: "#64748b",
  top_up: "#06b6d4",
};

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: "Mensal",
  annual: "Anual",
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  cancelled: "Cancelada",
  expired: "Expirada",
};

const SUBSCRIPTION_STATUS_CLASSES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  cancelled: "bg-rose-500/10 text-rose-700",
  expired: "bg-muted text-muted-foreground",
};

function serviceLabel(key: string) {
  return SERVICE_LABELS[key] ?? key.replace(/_/g, " ");
}

function billingCycleLabel(key: string) {
  return BILLING_CYCLE_LABELS[key] ?? key;
}

function serviceColor(key: string, index: number) {
  const fallback = ["#6366f1", "#f97316", "#14b8a6", "#e11d48", "#a855f7"];
  return SERVICE_COLORS[key] ?? fallback[index % fallback.length];
}

function getRecommendedGranularity(preset: DatePreset): AnalyticsGranularity {
  switch (preset) {
    case "7d":
      return "day";
    case "30d":
      return "day";
    case "90d":
      return "week";
    default:
      return "day";
  }
}

function getPresetRange(preset: Exclude<DatePreset, "custom">) {
  const now = new Date();
  switch (preset) {
    case "7d":
      return { start: subDays(now, 7), end: now };
    case "90d":
      return { start: subDays(now, 90), end: now };
    default:
      return { start: subDays(now, 30), end: now };
  }
}

function formatBRL(valueMicros: number, exchangeRate: number) {
  const brl = (valueMicros / 1_000_000) * exchangeRate;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(brl);
}

function formatCompactBRL(valueMicros: number, exchangeRate: number) {
  const brl = (valueMicros / 1_000_000) * exchangeRate;
  if (Math.abs(brl) < 1000) {
    return formatBRL(valueMicros, exchangeRate);
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(brl);
}

function formatBRLDirect(brlMicros: number) {
  const brl = brlMicros / 1_000_000;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(brl);
}

function formatCompactBRLDirect(brlMicros: number) {
  const brl = brlMicros / 1_000_000;
  if (Math.abs(brl) < 1000) {
    return formatBRLDirect(brlMicros);
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(brl);
}

function txBRL(
  usdMicros: number,
  exchangeRateMicros: number,
  fallbackRate: number,
) {
  if (exchangeRateMicros > 0) {
    return (usdMicros * exchangeRateMicros) / 1_000_000 / 1_000_000;
  }
  return (usdMicros / 1_000_000) * fallbackRate;
}

function formatTxBRL(
  usdMicros: number,
  exchangeRateMicros: number,
  fallbackRate: number,
) {
  const brl = txBRL(usdMicros, exchangeRateMicros, fallbackRate);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(brl);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatShortDate(value?: string | null) {
  if (!value) return "-";
  return format(new Date(value), "dd MMM, HH:mm");
}

function formatPeriodLabel(
  timestamp: string,
  granularity: AnalyticsGranularity,
) {
  const date = new Date(timestamp);
  switch (granularity) {
    case "hour":
      return format(date, "dd/MM HH:mm");
    case "week":
      return format(date, "dd MMM");
    case "month":
      return format(date, "MMM yy");
    default:
      return format(date, "dd MMM");
  }
}

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function MetricCard({
  title,
  value,
  detail,
  tooltip,
  icon: Icon,
  accentClass = "bg-primary",
  loading,
}: {
  title: string;
  value: string;
  detail?: string;
  tooltip?: string;
  icon: Icon;
  accentClass?: string;
  loading?: boolean;
}) {
  return (
    <ElevatedContainer
      className="group relative overflow-hidden border border-border/70 bg-card/90 p-5"
      style={{ boxShadow: softSurfaceShadow }}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1", accentClass)} />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {title}
            </p>
            {tooltip ? (
              <div className="relative">
                <Info
                  className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help peer"
                  weight="fill"
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md opacity-0 transition-opacity peer-hover:opacity-100">
                  {tooltip}
                </div>
              </div>
            ) : null}
          </div>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-8 w-32 rounded bg-border" />
              <div className="h-4 w-40 rounded bg-border" />
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              {detail ? (
                <p className="text-sm text-muted-foreground">{detail}</p>
              ) : null}
            </>
          )}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl text-white",
            accentClass,
          )}
        >
          <Icon className="h-5 w-5" weight="fill" />
        </div>
      </div>
    </ElevatedContainer>
  );
}



export default function AdminFinancialDashboard() {
  const { logout } = useAuth();
  const initialRange = useMemo(() => getPresetRange("30d"), []);

  const [datePreset, setDatePresetRaw] = useState<DatePreset>("30d");
  const [granularity, setGranularity] = useState<AnalyticsGranularity>("day");

  const setDatePreset = (preset: DatePreset) => {
    setDatePresetRaw(preset);
    if (preset !== "custom") {
      setGranularity(getRecommendedGranularity(preset));
    }
  };

  const [customStartDate, setCustomStartDate] = useState(
    format(initialRange.start, "yyyy-MM-dd"),
  );
  const [customEndDate, setCustomEndDate] = useState(
    format(initialRange.end, "yyyy-MM-dd"),
  );
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [debouncedWorkspaceSearch, setDebouncedWorkspaceSearch] = useState("");
  const [workspacePage, setWorkspacePage] = useState(1);
  const [workspaceSortBy, setWorkspaceSortBy] =
    useState<WorkspaceSortKey>("revenue");
  const [workspaceSortOrder, setWorkspaceSortOrder] = useState<"asc" | "desc">(
    "desc",
  );
  const [refreshToken, setRefreshToken] = useState(0);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [profitReport, setProfitReport] = useState<ProfitReport | null>(null);
  const [planContractions, setPlanContractions] =
    useState<PlanContractionsReport | null>(null);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getExchangeRateAction().then((res) => {
      if (res.item?.priceMicros) {
        setExchangeRate(res.item.priceMicros / 1_000_000);
      }
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWorkspaceSearch(workspaceSearch.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [workspaceSearch]);

  const effectiveRange = useMemo(() => {
    let start: Date;
    let end: Date;

    if (datePreset !== "custom") {
      const presetRange = getPresetRange(datePreset);
      start = startOfDay(presetRange.start);
      end = endOfDay(presetRange.end);
    } else {
      start = customStartDate
        ? startOfDay(new Date(`${customStartDate}T00:00:00`))
        : startOfDay(initialRange.start);
      end = customEndDate
        ? endOfDay(new Date(`${customEndDate}T00:00:00`))
        : endOfDay(initialRange.end);
    }

    return {
      start,
      end,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [
    customEndDate,
    customStartDate,
    datePreset,
    initialRange.end,
    initialRange.start,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const commonRange = {
        startDate: effectiveRange.startDate,
        endDate: effectiveRange.endDate,
      };

      const overviewParams: GetAdminOverviewParams = {
        ...commonRange,
        search: debouncedWorkspaceSearch || undefined,
        page: workspacePage,
        pageSize: 10,
        sortBy: workspaceSortBy,
        sortOrder: workspaceSortOrder,
        recentLimit: 15,
      };

      const [overviewResult, profitResult, contractionsResult] =
        await Promise.all([
          getAdminOverviewAction(overviewParams),
          getProfitReportAction({
            ...commonRange,
            granularity,
          }),
          getPlanContractionsAction({
            ...commonRange,
            granularity,
            recentLimit: 15,
          }),
        ]);

      if (cancelled) return;

      if (
        overviewResult.expired ||
        profitResult.expired ||
        contractionsResult.expired
      ) {
        await logout();
        return;
      }

      setOverview(overviewResult.data ?? null);
      setProfitReport(profitResult.data ?? null);
      setPlanContractions(contractionsResult.data ?? null);
      setError(
        overviewResult.error ||
          profitResult.error ||
          contractionsResult.error ||
          null,
      );
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [
    debouncedWorkspaceSearch,
    effectiveRange.endDate,
    effectiveRange.startDate,
    granularity,
    logout,
    refreshToken,
    workspacePage,
    workspaceSortBy,
    workspaceSortOrder,
  ]);


  const profitSeries = useMemo(() => {
    if (!profitReport?.timeSeries?.length) return [];
    return profitReport.timeSeries.map((bucket) => {
      const revBRL = bucket.totals.revenueBRLMicros / 1_000_000;
      const costBRL = bucket.totals.costBRLMicros / 1_000_000;
      const profitBRL = bucket.totals.profitBRLMicros / 1_000_000;
      return {
        formattedTime: formatPeriodLabel(bucket.periodStart, granularity),
        receita: Number(revBRL.toFixed(2)),
        custo: Number(costBRL.toFixed(2)),
        lucro: Number(profitBRL.toFixed(2)),
      };
    });
  }, [granularity, profitReport]);

  const profitChartConfig = useMemo<ChartConfig>(
    () => ({
      receita: { label: "Receita", color: "#16a34a" },
      custo: { label: "Custo", color: "#ef4444" },
      lucro: { label: "Lucro", color: "#3b82f6" },
    }),
    [],
  );


  const serviceRevenuePie = useMemo(() => {
    if (!profitReport?.byService?.length) return [];
    return profitReport.byService
      .filter(
        (s) =>
          s.totals.revenueMicros > 0 && s.serviceType !== "manual_adjustment",
      )
      .map((s, i) => ({
        name: serviceLabel(s.serviceType),
        value: Number((s.totals.revenueBRLMicros / 1_000_000).toFixed(2)),
        color: serviceColor(s.serviceType, i),
        fill: serviceColor(s.serviceType, i),
      }));
  }, [profitReport]);

  const pieChartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    serviceRevenuePie.forEach((item) => {
      config[item.name] = { label: item.name, color: item.color };
    });
    return config;
  }, [serviceRevenuePie]);

  const serviceProfitBar = useMemo(() => {
    if (!profitReport?.byService?.length) return [];
    return profitReport.byService
      .filter(
        (s) =>
          s.totals.profitMicros !== 0 && s.serviceType !== "manual_adjustment",
      )
      .sort((a, b) => b.totals.profitMicros - a.totals.profitMicros)
      .map((s, i) => ({
        name: serviceLabel(s.serviceType),
        value: Number((s.totals.profitBRLMicros / 1_000_000).toFixed(2)),
        color: serviceColor(s.serviceType, i),
        fill: serviceColor(s.serviceType, i),
      }));
  }, [profitReport]);

  const barChartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    serviceProfitBar.forEach((item) => {
      config[item.name] = { label: item.name, color: item.color };
    });
    config["value"] = { label: "Lucro" };
    return config;
  }, [serviceProfitBar]);


  const contractionsSeries = useMemo(() => {
    if (!planContractions?.timeSeries?.length) return [];
    return planContractions.timeSeries.map((bucket) => ({
      formattedTime: formatPeriodLabel(bucket.periodStart, granularity),
      contratacoes: bucket.count,
    }));
  }, [granularity, planContractions]);

  const contractionsChartConfig = useMemo<ChartConfig>(
    () => ({ contratacoes: { label: "Contratações", color: "#2463eb" } }),
    [],
  );

  const recentContractions = planContractions?.recent ?? [];

  const recentTransactions = overview?.recentSpendings ?? [];


  const productUsage = overview?.productUsage;


  const rankingRows = overview?.workspaceSnapshots.items ?? [];
  const workspaceMeta = overview?.workspaceSnapshots;


  const manualAdjustment = useMemo(() => {
    const entry = profitReport?.byService?.find(
      (s) => s.serviceType === "manual_adjustment",
    );
    return {
      revenueMicros: entry?.totals.revenueMicros ?? 0,
      costMicros: entry?.totals.costMicros ?? 0,
      profitMicros: entry?.totals.profitMicros ?? 0,
      revenueBRLMicros: entry?.totals.revenueBRLMicros ?? 0,
      costBRLMicros: entry?.totals.costBRLMicros ?? 0,
      profitBRLMicros: entry?.totals.profitBRLMicros ?? 0,
      txCount: entry?.totals.txCount ?? 0,
    };
  }, [profitReport]);

  const totalPlatformRevenueBRL =
    (profitReport?.totals.revenueBRLMicros ?? 0) -
    manualAdjustment.revenueBRLMicros;
  const totalPlatformCostBRL =
    (profitReport?.totals.costBRLMicros ?? 0) - manualAdjustment.costBRLMicros;
  const totalPlatformProfitBRL =
    (profitReport?.totals.profitBRLMicros ?? 0) -
    manualAdjustment.profitBRLMicros;
  const operationalMarginPct =
    totalPlatformRevenueBRL > 0
      ? (totalPlatformProfitBRL / totalPlatformRevenueBRL) * 100
      : 0;
  const totalPeriodCreditsBRL = overview?.totalPeriodCreditsBRLMicros ?? 0;
  const totalPeriodRefundsBRL = overview?.totalPeriodRefundsBRLMicros ?? 0;
  const carryOverBRL = Math.max(
    0,
    totalPlatformRevenueBRL - totalPeriodCreditsBRL,
  );

  const workspaceColumns = useMemo<
    DashboardTableColumn<WorkspaceFinancialSnapshot>[]
  >(
    () => [
      {
        header: "Área de Trabalho",
        key: "workspace",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">
              {row.workspaceName}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.lastTransactionAt
                ? `Última atividade: ${formatShortDate(row.lastTransactionAt)}`
                : "Sem movimentação"}
            </p>
          </div>
        ),
      },
      {
        header: "Saldo atual",
        key: "balance",
        render: (row) => (
          <span
            className={cn(
              "text-sm font-bold tabular-nums",
              row.currentBalanceMicros > 0
                ? "text-foreground"
                : "text-rose-600",
            )}
          >
            {formatBRL(row.currentBalanceMicros, exchangeRate)}
          </span>
        ),
      },
      {
        header: "Receita (período)",
        key: "revenue",
        render: (row) => (
          <span className="text-sm font-medium tabular-nums text-emerald-600">
            {formatBRLDirect(row.revenueBRLMicros)}
          </span>
        ),
      },
      {
        header: "Custo (período)",
        key: "cost",
        render: (row) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatBRLDirect(row.costBRLMicros)}
          </span>
        ),
      },
      {
        header: "Lucro",
        key: "profit",
        render: (row) => (
          <div>
            <p
              className={cn(
                "text-sm font-bold tabular-nums",
                row.profitMicros >= 0 ? "text-foreground" : "text-rose-600",
              )}
            >
              {formatBRLDirect(row.profitBRLMicros)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatPercent(row.marginPct)} margem
            </p>
          </div>
        ),
      },
      {
        header: "Transações",
        key: "txCount",
        render: (row) => (
          <span className="text-sm tabular-nums text-foreground">
            {row.txCount.toLocaleString()}
          </span>
        ),
      },
    ],
    [exchangeRate],
  );

  const exportWorkspacesCSV = useCallback(() => {
    if (!rankingRows.length) return;
    const period = `${format(effectiveRange.start, "yyyy-MM-dd")}_${format(effectiveRange.end, "yyyy-MM-dd")}`;
    const headers = [
      "Área de Trabalho",
      "Saldo atual (BRL)",
      "Receita (BRL)",
      "Custo (BRL)",
      "Lucro (BRL)",
      "Margem %",
      "Transações",
      "Última atividade",
    ];
    const rows = rankingRows.map((r) => [
      r.workspaceName,
      ((r.currentBalanceMicros / 1_000_000) * exchangeRate).toFixed(2),
      (r.revenueBRLMicros / 1_000_000).toFixed(2),
      (r.costBRLMicros / 1_000_000).toFixed(2),
      (r.profitBRLMicros / 1_000_000).toFixed(2),
      r.marginPct.toFixed(1),
      String(r.txCount),
      r.lastTransactionAt
        ? format(new Date(r.lastTransactionAt), "yyyy-MM-dd HH:mm")
        : "",
    ]);
    downloadCSV(`workspaces_${period}.csv`, headers, rows);
  }, [rankingRows, exchangeRate, effectiveRange]);

  const exportTransactionsCSV = useCallback(() => {
    if (!recentTransactions.length) return;
    const period = `${format(effectiveRange.start, "yyyy-MM-dd")}_${format(effectiveRange.end, "yyyy-MM-dd")}`;
    const headers = [
      "Data",
      "Área de Trabalho",
      "Serviço",
      "Descrição",
      "Valor (BRL)",
      "Custo (BRL)",
      "Lucro (BRL)",
    ];
    const rows = recentTransactions.map((tx) => [
      tx.createdAt ? format(new Date(tx.createdAt), "yyyy-MM-dd HH:mm:ss") : "",
      tx.workspaceName,
      serviceLabel(tx.serviceType),
      tx.description || "",
      txBRL(tx.amountMicros, tx.exchangeRateMicros, exchangeRate).toFixed(2),
      txBRL(tx.costMicros, tx.exchangeRateMicros, exchangeRate).toFixed(2),
      txBRL(tx.profitMicros, tx.exchangeRateMicros, exchangeRate).toFixed(2),
    ]);
    downloadCSV(`transacoes_${period}.csv`, headers, rows);
  }, [recentTransactions, exchangeRate, effectiveRange]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* â”€â”€ Header + Period filters â”€â”€ */}
      <motion.div variants={itemVariants}>
        <ElevatedContainer
          className="border border-border/70 bg-card/90 p-5 md:p-6"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <DashboardPageHeader
            actions={
              <Button
                icon={<ArrowClockwise className="h-4 w-4" weight="bold" />}
                iconVisible
                onClick={() => setRefreshToken((c) => c + 1)}
                title="Atualizar"
                variant="outline"
              />
            }
            badge="Painel Administrativo"
            description={`Receita, custo e saldo de todas as áreas de trabalho. Valores em BRL com câmbio histórico por transação. Saldo atual: R$ ${exchangeRate.toFixed(2)}.`}
            icon={<ChartBar className="h-6 w-6" weight="fill" />}
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase text-primary">
                Período analisado
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {PRESET_LABELS[datePreset]}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {`${format(effectiveRange.start, "dd MMM yyyy")} → ${format(effectiveRange.end, "dd MMM yyyy")}`}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Granularidade
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {granularity === "day"
                  ? "Dia"
                  : granularity === "week"
                    ? "Semana"
                    : "Mês"}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Áreas de Trabalho
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {workspaceMeta?.total_items?.toLocaleString() ?? "0"}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Transações
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {(profitReport?.totals.txCount ?? 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Period selector */}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
            <ElevatedPillToggle
              size="md"
              value={datePreset}
              onChange={setDatePreset}
              options={(
                ["7d", "30d", "90d", "custom"] as DatePreset[]
              ).map((preset) => ({
                value: preset,
                label: PRESET_LABELS[preset],
              }))}
            />

            {datePreset === "custom" && (
              <div className="flex items-center gap-2">
                <ElevatedDatePicker
                  id="admin-start"
                  label="Início"
                  value={customStartDate}
                  onChange={setCustomStartDate}
                  inputClassName="min-w-[150px]"
                />
                <ElevatedDatePicker
                  id="admin-end"
                  label="Fim"
                  value={customEndDate}
                  onChange={setCustomEndDate}
                  inputClassName="min-w-[150px]"
                  minDate={
                    customStartDate
                      ? new Date(`${customStartDate}T00:00:00`)
                      : undefined
                  }
                />
              </div>
            )}

            <div className="ml-auto">
              <ElevatedPillToggle
                size="md"
                value={granularity}
                onChange={setGranularity}
                aria-label="Granularidade"
                options={(
                  [
                    { value: "day" as const, label: "Dia" },
                    { value: "week" as const, label: "Semana" },
                    { value: "month" as const, label: "Mês" },
                  ] satisfies Array<{
                    value: AnalyticsGranularity;
                    label: string;
                  }>
                )}
              />
            </div>
          </div>
        </ElevatedContainer>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div variants={itemVariants}>
          <ElevatedContainer className="border border-red-600 bg-red-500 p-4 text-sm text-white">
            {error}
          </ElevatedContainer>
        </motion.div>
      )}

      {/* â”€â”€ Metric cards â”€â”€ */}
      <motion.div
        variants={itemVariants}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <MetricCard
          title="Receita operacional"
          value={formatCompactBRLDirect(totalPlatformRevenueBRL)}
          detail={`${((profitReport?.totals.txCount ?? 0) - manualAdjustment.txCount).toLocaleString()} transações`}
          tooltip="Receita líquida: serviços consumidos menos estornos. Exclui recargas e ajustes manuais. Pode exceder créditos quando há saldo pré-existente de períodos anteriores."
          icon={TrendUp}
          loading={loading}
        />
        <MetricCard
          title="Custo operacional"
          value={formatCompactBRLDirect(totalPlatformCostBRL)}
          detail="custo de provedores agregado"
          tooltip="Custo real pago aos provedores (Meta, operadoras) pelo uso consumido no período."
          icon={CurrencyDollar}
          loading={loading}
        />
        <MetricCard
          title="Lucro operacional"
          value={formatCompactBRLDirect(totalPlatformProfitBRL)}
          detail={`margem ${formatPercent(operationalMarginPct)}`}
          tooltip="Lucro líquido: receita menos custo, já descontados os estornos de serviço."
          icon={Wallet}
          loading={loading}
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <MetricCard
          title="Créditos recebidos"
          value={formatCompactBRLDirect(totalPeriodCreditsBRL)}
          detail="assinaturas + recargas no período"
          tooltip="Pagamentos reais confirmados (assinaturas e recargas). Exclui estornos de serviço e estornos de recarga."
          icon={Receipt}
          accentClass="bg-cyan-600"
          loading={loading}
        />
        <MetricCard
          title="Saldo pré-existente consumido"
          value={formatCompactBRLDirect(carryOverBRL)}
          detail="depositado antes do período"
          tooltip="Parte da receita originada de saldos que foram depositados antes do início do período selecionado."
          icon={Vault}
          accentClass="bg-amber-600"
          loading={loading}
        />
        <MetricCard
          title="Áreas de Trabalho"
          value={`${workspaceMeta?.total_items?.toLocaleString() ?? "0"}`}
          detail="com movimentação rastreada"
          icon={Users}
          loading={loading}
        />
      </motion.div>

      {/*  Reembolsos (isolated)  */}
      {!loading && totalPeriodRefundsBRL > 0 && (
        <motion.div variants={itemVariants}>
          <ElevatedContainer
            className="border border-amber-500/40 border-dashed bg-amber-500/5 p-4"
            style={{ boxShadow: softSurfaceShadow }}
          >
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <ArrowClockwise
                  className="h-4 w-4 text-amber-600"
                  weight="bold"
                />
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Reembolsos (já descontados da receita e do lucro)
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Estornos de serviço no período
                </p>
                <p className="text-sm font-bold tabular-nums text-amber-700">
                  −{formatBRLDirect(totalPeriodRefundsBRL)}
                </p>
              </div>
            </div>
          </ElevatedContainer>
        </motion.div>
      )}

      {/*  Ajuste manual (isolated)  */}
      {!loading && manualAdjustment.txCount > 0 && (
        <motion.div variants={itemVariants}>
          <ElevatedContainer
            className="border border-border/70 border-dashed bg-muted/30 p-4"
            style={{ boxShadow: softSurfaceShadow }}
          >
            <div className="flex flex-wrap items-center gap-6">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Ajuste manual (excluído da receita operacional)
              </p>
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Receita</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {formatBRLDirect(manualAdjustment.revenueBRLMicros)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Custo</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {formatBRLDirect(manualAdjustment.costBRLMicros)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lucro</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {formatBRLDirect(manualAdjustment.profitBRLMicros)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Transações</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {manualAdjustment.txCount.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </ElevatedContainer>
        </motion.div>
      )}
      {/* â”€â”€ Revenue vs Cost chart â”€â”€ */}
      <motion.div variants={itemVariants}>
        <ElevatedContainer
          className="border border-border/70 bg-card/90 p-5"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Evolução financeira
              </p>
              <h2 className="text-lg font-bold text-foreground">
                Receita × Custo × Lucro (BRL)
              </h2>
            </div>
            <p className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {PRESET_LABELS[datePreset]}
            </p>
          </div>

          {loading ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 340 }}
            >
              <Spinner className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : profitSeries.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center text-muted-foreground"
              style={{ height: 340 }}
            >
              <ChartLine className="h-12 w-12 mb-2 text-slate-300" />
              <p>Sem dados financeiros para o período selecionado</p>
            </div>
          ) : (
            <ChartContainer
              config={profitChartConfig}
              className="h-[340px] w-full"
            >
              <AreaChart
                data={profitSeries}
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
              >
                <defs>
                  {(["receita", "custo", "lucro"] as const).map((key) => (
                    <linearGradient
                      key={key}
                      id={`gradient-fin-${key}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={`var(--color-${key})`}
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="50%"
                        stopColor={`var(--color-${key})`}
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="100%"
                        stopColor={`var(--color-${key})`}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="formattedTime"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(v) =>
                    new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      notation: "compact",
                    }).format(v)
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">
                            {profitChartConfig[name as string]?.label ?? name}
                          </span>
                          <span className="font-bold tabular-nums">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(value as number)}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  type="monotoneX"
                  dataKey="receita"
                  stroke="var(--color-receita)"
                  strokeWidth={2.5}
                  fill="url(#gradient-fin-receita)"
                  dot={false}
                />
                <Area
                  type="monotoneX"
                  dataKey="custo"
                  stroke="var(--color-custo)"
                  strokeWidth={2.5}
                  fill="url(#gradient-fin-custo)"
                  dot={false}
                />
                <Area
                  type="monotoneX"
                  dataKey="lucro"
                  stroke="var(--color-lucro)"
                  strokeWidth={2.5}
                  fill="url(#gradient-fin-lucro)"
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </ElevatedContainer>
      </motion.div>
      {/*, Revenue by service (Pie) + Profit by service (Bar), */}
      <motion.div variants={itemVariants} className="grid gap-4 lg:grid-cols-2">
        <ElevatedContainer
          className="border border-border/70 bg-card/90 p-5"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="mb-2 flex items-center gap-2">
            <ChartPie className="h-4 w-4 text-emerald-500" weight="fill" />
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Receita por produto
            </p>
          </div>
          {loading ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 280 }}
            >
              <Spinner className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : serviceRevenuePie.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center text-muted-foreground"
              style={{ height: 280 }}
            >
              <ChartPie
                className="h-12 w-12 mb-2 text-slate-300"
                weight="fill"
              />
              <p>Sem dados de receita por serviço</p>
            </div>
          ) : (
            <ChartContainer
              config={pieChartConfig}
              className="h-[280px] w-full"
            >
              <PieChart>
                <Pie
                  data={serviceRevenuePie}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  cornerRadius={6}
                  strokeWidth={2}
                  stroke="hsl(var(--background))"
                >
                  {serviceRevenuePie.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      nameKey="name"
                      formatter={(value) => (
                        <span className="font-bold tabular-nums">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(value as number)}
                        </span>
                      )}
                    />
                  }
                />
              </PieChart>
            </ChartContainer>
          )}
          {!loading && serviceRevenuePie.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              {serviceRevenuePie.map((item) => {
                const total = serviceRevenuePie.reduce(
                  (s, i) => s + i.value,
                  0,
                );
                const pct = total > 0 ? (item.value / total) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {item.name}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-foreground">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(item.value)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({formatPercent(pct)})
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ElevatedContainer>

        <ElevatedContainer
          className="border border-border/70 bg-card/90 p-5"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="mb-2 flex items-center gap-2">
            <ChartBar className="h-4 w-4 text-blue-500" weight="fill" />
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Lucro por produto
            </p>
          </div>
          {loading ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 280 }}
            >
              <Spinner className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : serviceProfitBar.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center text-muted-foreground"
              style={{ height: 280 }}
            >
              <ChartBar
                className="h-12 w-12 mb-2 text-slate-300"
                weight="fill"
              />
              <p>Sem dados de lucro por serviço</p>
            </div>
          ) : (
            <ChartContainer
              config={barChartConfig}
              className="h-[280px] w-full"
            >
              <BarChart
                data={serviceProfitBar}
                margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="4 4" vertical={false} />
                <XAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(v) =>
                    new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      notation: "compact",
                    }).format(v)
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="font-bold tabular-nums">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(value as number)}
                        </span>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="value"
                  name="Lucro"
                  radius={[8, 8, 0, 0]}
                  barSize={28}
                >
                  {serviceProfitBar.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
          {!loading && serviceProfitBar.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              {serviceProfitBar.map((item) => {
                const total = serviceProfitBar.reduce(
                  (s, i) => s + Math.abs(i.value),
                  0,
                );
                const pct =
                  total > 0 ? (Math.abs(item.value) / total) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {item.name}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-foreground">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(item.value)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({formatPercent(pct)})
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ElevatedContainer>
      </motion.div>

      {/*, Product usage summary, */}
      {!loading && productUsage && productUsage.byService.length > 0 && (
        <motion.div variants={itemVariants}>
          <ElevatedContainer
            className="border border-border/70 bg-card/90 p-5"
            style={{ boxShadow: softSurfaceShadow }}
          >
            <div className="mb-4 flex items-center gap-2">
              <Package className="h-4 w-4 text-violet-500" weight="fill" />
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Uso por produto
                </p>
                <p className="text-sm font-bold text-foreground">
                  Volume de transações no período
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {productUsage.byService.map((metric) => (
                <div
                  key={metric.key}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3"
                >
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white"
                    style={{
                      backgroundColor: serviceColor(metric.key, 0),
                    }}
                  >
                    <Lightning className="h-4 w-4" weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-muted-foreground">
                      {serviceLabel(metric.key)}
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {metric.count.toLocaleString("pt-BR")}
                    </p>
                    {metric.revenueBRLMicros != null &&
                      metric.revenueBRLMicros > 0 && (
                        <p className="text-xs text-emerald-600 font-medium">
                          {formatBRLDirect(metric.revenueBRLMicros)}
                        </p>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </ElevatedContainer>
        </motion.div>
      )}

      {/*, Plan contractions, */}
      <motion.div variants={itemVariants} className="grid gap-4 lg:grid-cols-2">
        <ElevatedContainer
          className="border border-border/70 bg-card/90 p-5"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white">
                <Certificate className="h-4 w-4" weight="fill" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Contratações de plano
                </p>
                <p className="text-sm font-bold text-foreground">
                  Assinaturas iniciadas no período
                </p>
              </div>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary tabular-nums">
              {(planContractions?.totalCount ?? 0).toLocaleString("pt-BR")} no
              total
            </span>
          </div>

          {loading ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 260 }}
            >
              <Spinner className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : contractionsSeries.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center text-muted-foreground"
              style={{ height: 260 }}
            >
              <CalendarCheck className="h-12 w-12 mb-2 text-slate-300" />
              <p>Sem contratações no período selecionado</p>
            </div>
          ) : (
            <ChartContainer
              config={contractionsChartConfig}
              className="h-[260px] w-full"
            >
              <BarChart
                data={contractionsSeries}
                margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="formattedTime"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="font-bold tabular-nums">
                          {(value as number).toLocaleString("pt-BR")}{" "}
                          contratações
                        </span>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="contratacoes"
                  name="Contratações"
                  fill="var(--color-contratacoes)"
                  radius={[8, 8, 0, 0]}
                  barSize={28}
                />
              </BarChart>
            </ChartContainer>
          )}

          {!loading &&
            (planContractions?.byBillingCycle.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-3 border-t border-border/60 pt-3">
                {planContractions?.byBillingCycle.map((item) => (
                  <div key={item.key} className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      {billingCycleLabel(item.key)}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-foreground">
                      {item.count.toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            )}
        </ElevatedContainer>

        <ElevatedContainer
          className="border border-border/70 bg-card/90 p-5"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="mb-4 flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" weight="fill" />
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Contratações recentes
            </p>
          </div>

          {loading ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 260 }}
            >
              <Spinner className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : recentContractions.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center text-muted-foreground"
              style={{ height: 260 }}
            >
              <Certificate
                className="h-12 w-12 mb-2 text-slate-300"
                weight="fill"
              />
              <p>Nenhuma contratação recente</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">Área de Trabalho</th>
                    <th className="pb-3 pr-4">Plano</th>
                    <th className="pb-3 pr-4">Ciclo</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentContractions.map((row: PlanContraction) => (
                    <tr
                      key={row.subscriptionId}
                      className="group hover:bg-muted/30"
                    >
                      <td className="py-3 pr-4">
                        <p className="text-sm font-medium text-foreground truncate max-w-[160px]">
                          {row.workspaceName}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-sm text-foreground">
                        {row.planName}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {billingCycleLabel(row.billingCycle)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                            SUBSCRIPTION_STATUS_CLASSES[row.status] ??
                              "bg-muted text-muted-foreground",
                          )}
                        >
                          {SUBSCRIPTION_STATUS_LABELS[row.status] ?? row.status}
                        </span>
                      </td>
                      <td className="py-3 text-right whitespace-nowrap text-xs text-muted-foreground">
                        {formatShortDate(row.contractedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ElevatedContainer>
      </motion.div>

      {/*, Recent transactions (debits & credits), */}
      {!loading && recentTransactions.length > 0 && (
        <motion.div variants={itemVariants}>
          <ElevatedContainer
            className="border border-border/70 bg-card/90 p-5"
            style={{ boxShadow: softSurfaceShadow }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500 text-white">
                  <Receipt className="h-4 w-4" weight="fill" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Movimentações recentes
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    Últimos débitos e créditos
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {recentTransactions.length} transações
                </span>
                <button
                  type="button"
                  onClick={exportTransactionsCSV}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  <DownloadSimple
                    className="h-3.5 w-3.5 text-primary"
                    weight="bold"
                  />
                  CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">Data</th>
                    <th className="pb-3 pr-4">Área de Trabalho</th>
                    <th className="pb-3 pr-4">Serviço</th>
                    <th className="pb-3 pr-4">Descrição</th>
                    <th className="pb-3 pr-4 text-right">Valor</th>
                    <th className="pb-3 pr-4 text-right">Custo</th>
                    <th className="pb-3 text-right">Lucro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentTransactions.map((tx: RecentSpending) => (
                    <tr
                      key={tx.transactionId}
                      className="group hover:bg-muted/30"
                    >
                      <td className="py-3 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                        {formatShortDate(tx.createdAt)}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-sm font-medium text-foreground truncate max-w-[160px]">
                          {tx.workspaceName}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                          style={{
                            backgroundColor: serviceColor(tx.serviceType, 0),
                          }}
                        >
                          {serviceLabel(tx.serviceType)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground truncate max-w-[200px]">
                        {tx.description || "—"}
                      </td>
                      <td className="py-3 pr-4 text-right whitespace-nowrap">
                        <span
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            tx.amountMicros < 0
                              ? "text-rose-600"
                              : "text-emerald-600",
                          )}
                        >
                          {tx.amountMicros < 0 ? "-" : "+"}
                          {formatTxBRL(
                            Math.abs(tx.amountMicros),
                            tx.exchangeRateMicros,
                            exchangeRate,
                          )}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                        {formatTxBRL(
                          tx.costMicros,
                          tx.exchangeRateMicros,
                          exchangeRate,
                        )}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <span
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            tx.profitMicros >= 0
                              ? "text-foreground"
                              : "text-rose-600",
                          )}
                        >
                          {formatTxBRL(
                            tx.profitMicros,
                            tx.exchangeRateMicros,
                            exchangeRate,
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ElevatedContainer>
        </motion.div>
      )}
      {/* â”€â”€ Workspace table â”€â”€ */}
      <motion.div variants={itemVariants}>
        <DashboardTable
          data={rankingRows}
          columns={workspaceColumns}
          rowKey={(row) => row.workspaceId}
          loading={loading && !overview}
          caption="Ranking de áreas de trabalho por período selecionado. Todos os valores em BRL."
          stats={[
            {
              label: "Áreas de Trabalho",
              value: workspaceMeta?.total_items?.toLocaleString() ?? "0",
              icon: <Users className="h-4 w-4" weight="fill" />,
            },
            {
              label: "Página",
              value: `${workspaceMeta?.page ?? 1}/${workspaceMeta?.total_pages ?? 1}`,
              icon: <ChartBar className="h-4 w-4" weight="fill" />,
            },
          ]}
          toolbar={
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <ElevatedInput
                value={workspaceSearch}
                onChange={(e) => {
                  setWorkspaceSearch(e.target.value);
                  setWorkspacePage(1);
                }}
                variant="search"
                placeholder="Buscar áreas de trabalho por nome"
                className="w-full lg:max-w-sm"
              />

              <div className="flex flex-wrap items-center gap-2">
                <ElevatedPillToggle
                  value={workspaceSortBy}
                  onChange={(key) => {
                    setWorkspaceSortBy(key);
                    setWorkspacePage(1);
                  }}
                  aria-label="Ordenar áreas de trabalho"
                  options={SORT_OPTIONS.map((option) => ({
                    value: option.key,
                    label: option.label,
                  }))}
                />
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceSortOrder((c) =>
                      c === "desc" ? "asc" : "desc",
                    );
                    setWorkspacePage(1);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  {workspaceSortOrder === "desc" ? (
                    <ArrowDown
                      className="h-3.5 w-3.5 text-primary"
                      weight="bold"
                    />
                  ) : (
                    <ArrowUp
                      className="h-3.5 w-3.5 text-primary"
                      weight="bold"
                    />
                  )}
                  Ordem
                </button>
                <button
                  type="button"
                  onClick={exportWorkspacesCSV}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  <DownloadSimple
                    className="h-3.5 w-3.5 text-primary"
                    weight="bold"
                  />
                  CSV
                </button>
              </div>
            </div>
          }
          emptyState={{
            icon: <Users className="h-8 w-8 text-slate-300" weight="fill" />,
            title: "Nenhuma área de trabalho encontrada",
            description: "Tente outro termo de busca ou ajuste a ordenação.",
          }}
          pagination={
            workspaceMeta
              ? {
                  currentPage: workspaceMeta.page,
                  totalPages: Math.max(workspaceMeta.total_pages, 1),
                  pageSize: workspaceMeta.page_size,
                  totalItems: workspaceMeta.total_items,
                  onPageChange: setWorkspacePage,
                }
              : undefined
          }
          paginationText={{
            showing: "Mostrando",
            of: "de",
            items: "áreas de trabalho",
          }}
        />
      </motion.div>
    </motion.div>
  );
}
