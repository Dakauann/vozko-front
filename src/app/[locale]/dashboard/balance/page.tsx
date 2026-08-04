"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowsLeftRight,
  Calendar,
  Clock,
  CurrencyDollar,
  DownloadSimple,
  FunnelSimple,
  Lightning,
  Phone,
  Robot,
  Wallet,
  WhatsappLogo,
} from "@/components/icons";
import type {
  BalanceSummary,
  ListTransactionsParams,
  ResourceType,
  ServiceType,
  TransactionType,
} from "@/lib/balance/types";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  getMyBalanceAction,
  listMyTransactionsAction,
} from "@/app/actions/balance";
import { getApiBaseUrl } from "@/lib/api/browser-client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format, startOfMonth, subDays } from "date-fns";
import { getExchangeRateAction } from "@/app/actions/pricing";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";


type DatePreset =
  | "thisMonth"
  | "last7Days"
  | "last30Days"
  | "last90Days"
  | "allTime"
  | "custom";

function getDateRange(preset: Exclude<DatePreset, "custom">): {
  start: Date | null;
  end: Date;
} {
  const now = new Date();
  switch (preset) {
    case "thisMonth":
      return { start: startOfMonth(now), end: now };
    case "last7Days":
      return { start: subDays(now, 7), end: now };
    case "last30Days":
      return { start: subDays(now, 30), end: now };
    case "last90Days":
      return { start: subDays(now, 90), end: now };
    case "allTime":
      return { start: null, end: now };
  }
}

function toDateTimeLocal(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function formatMoneyValue(
  usdValue: number,
  exchangeRate: number,
  locale: string,
): string {
  const brlValue = usdValue * exchangeRate;
  return new Intl.NumberFormat(locale === "pt" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(brlValue);
}

function extractBRLFromDescription(description: string): number | null {
  const match = description.match(/R\$\s*([\d]+(?:[.,]\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getServiceMeta(serviceType: string) {
  switch (serviceType) {
    case "voice_call":
    case "voice_campaign":
      return { icon: Phone, color: "bg-muted text-muted-foreground" };
    case "ai":
      return { icon: Robot, color: "bg-muted text-muted-foreground" };
    case "whatsapp_campaign":
      return { icon: WhatsappLogo, color: "bg-healthy text-healthy-foreground" };
    case "top_up":
      return { icon: ArrowUp, color: "bg-healthy text-healthy-foreground" };
    case "manual_adjustment":
    case "admin_credit":
    case "admin_debit":
      return { icon: ArrowsLeftRight, color: "bg-warning text-warning-foreground" };
    default:
      return { icon: Lightning, color: "bg-gray-500 text-white" };
  }
}

interface NormalizedTransaction {
  id: string;
  workspace_id: string;
  resource_type: ResourceType;
  transaction_type: TransactionType;
  amount: number;
  description: string;
  service_type: string;
  reference_id?: string;
  created_at: string;
}


export default function BalancePage() {
  const t = useTranslations("balancePage");
  const locale = useLocale();

  const [summary, setSummary] = useState<BalanceSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(true);

  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("thisMonth");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const [error, setError] = useState<string | null>(null);

  const dateRange = useMemo<{ start: Date | null; end: Date }>(() => {
    if (datePreset === "custom") {
      return {
        start: customStart ? new Date(customStart) : null,
        end: customEnd ? new Date(customEnd) : new Date(),
      };
    }
    return getDateRange(datePreset);
  }, [datePreset, customStart, customEnd]);

  const handleDatePreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      setCustomStart("");
      setCustomEnd("");
    }
    setCurrentPage(1);
  }, []);

  const handleCustomStart = useCallback((value: string) => {
    setCustomStart(value);
    setDatePreset("custom");
    setCurrentPage(1);
  }, []);

  const handleCustomEnd = useCallback((value: string) => {
    setCustomEnd(value);
    setDatePreset("custom");
    setCurrentPage(1);
  }, []);

  const handleExport = useCallback(
    (format: "csv" | "xlsx") => {
      const params = new URLSearchParams();
      params.set("format", format);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (serviceFilter !== "all") params.set("serviceType", serviceFilter);
      if (dateRange.start)
        params.set("startDate", dateRange.start.toISOString());
      params.set("endDate", dateRange.end.toISOString());
      const qs = params.toString();
      window.open(
        `${getApiBaseUrl()}/user/balance/transactions/export?${qs}`,
        "_blank",
      );
    },
    [typeFilter, serviceFilter, dateRange],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSummary(true);
      try {
        const result = await getMyBalanceAction();
        if (cancelled) return;
        if (result.error) setError(result.error);
        else {
          setSummary(result.summary);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("An error occurred while loading balance.");
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    getExchangeRateAction().then((res) => {
      if (res.item) {
        setExchangeRate(res.item.priceMicros / 1_000_000);
      } else {
        setError(res.error ?? "Não foi possível obter a taxa de câmbio.");
      }
      setLoadingRate(false);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTx(true);
      try {
        const params: ListTransactionsParams = {
          page: currentPage,
          pageSize: 15,
        };
        if (typeFilter !== "all")
          params.transaction_type = typeFilter as TransactionType;
        if (serviceFilter !== "all")
          params.service_type = serviceFilter as ServiceType;
        if (dateRange.start) params.start_date = dateRange.start.toISOString();
        params.end_date = dateRange.end.toISOString();

        const result = await listMyTransactionsAction(params);
        console.log(result);
        if (cancelled) return;
        if (result.error && !error) setError(result.error);
        else {
          setTransactions(result.transactions as NormalizedTransaction[]);
          setTotalPages(result.meta.total_pages);
          setTotalItems(result.meta.total_items);
        }
      } catch {
        /* swallow */
      } finally {
        if (!cancelled) setLoadingTx(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPage, typeFilter, serviceFilter, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const moneyBalance = summary?.balances?.find(
    (b) => b.resource_type === "money",
  );

  const tableColumns = useMemo<DashboardTableColumn<NormalizedTransaction>[]>(
    () => [
      {
        key: "created_at",
        header: t("table.date"),
        render: (row) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDate(row.created_at, locale)}
          </span>
        ),
      },
      {
        key: "service_type",
        header: t("table.service"),
        render: (row) => {
          const meta = getServiceMeta(row.service_type);
          const Icon = meta.icon;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
                meta.color,
              )}
            >
              <Icon className="h-3.5 w-3.5" weight="bold" />
              {t(`serviceType.${row.service_type}`, {
                defaultValue: row.service_type.replace(/_/g, " "),
              } as never)}
            </span>
          );
        },
      },
      {
        key: "description",
        header: t("table.description"),
        render: (row) => (
          <p className="text-sm text-foreground max-w-[260px] truncate">
            {row.description || "—"}
          </p>
        ),
      },
      {
        key: "transaction_type",
        header: t("table.type"),
        render: (row) => {
          const isCredit = row.transaction_type === "credit";
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
                isCredit
                  ? "bg-healthy text-healthy-foreground"
                  : "bg-destructive text-destructive-foreground",
              )}
            >
              {isCredit ? (
                <ArrowUp className="h-3 w-3" weight="bold" />
              ) : (
                <ArrowDown className="h-3 w-3" weight="bold" />
              )}
              {t(`transactionType.${row.transaction_type}`)}
            </span>
          );
        },
      },
      {
        key: "amount",
        header: t("table.amount"),
        className: "text-right",
        render: (row) => {
          const isCredit = row.transaction_type === "credit";
          const topUpBRL =
            row.service_type === "top_up"
              ? extractBRLFromDescription(row.description)
              : null;
          const displayValue =
            topUpBRL != null
              ? new Intl.NumberFormat(locale === "pt" ? "pt-BR" : "en-US", {
                  style: "currency",
                  currency: "BRL",
                }).format(topUpBRL)
              : exchangeRate != null
                ? formatMoneyValue(row.amount, exchangeRate, locale)
                : "...";
          return (
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                isCredit ? "text-healthy" : "text-destructive",
              )}
            >
              {isCredit ? "+" : "-"}
              {displayValue}
            </span>
          );
        },
      },
    ],
    [t, exchangeRate, locale],
  );

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <DashboardPageHeader
          icon={<Wallet className="h-6 w-6" weight="fill" />}
          badge={t("header.badge")}
          description={t("header.description")}
        />
      </motion.div>

      {/* ── Transaction History ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <DashboardTable<NormalizedTransaction>
          stats={[
            {
              label: t("resource.money"),
              value:
                loadingSummary || loadingRate
                  ? "..."
                  : formatMoneyValue(
                      moneyBalance?.current_balance ?? 0,
                      exchangeRate!,
                      locale,
                    ),
              icon: (
                <CurrencyDollar
                  className="h-4 w-4 text-warning"
                  weight="fill"
                />
              ),
            },
            {
              label: t("card.credited"),
              value:
                loadingSummary || loadingRate || !moneyBalance
                  ? "..."
                  : formatMoneyValue(
                      moneyBalance.total_credited,
                      exchangeRate!,
                      locale,
                    ),
              icon: (
                <ArrowUp className="h-4 w-4 text-healthy" weight="bold" />
              ),
            },
            {
              label: t("card.debited"),
              value:
                loadingSummary || loadingRate || !moneyBalance
                  ? "..."
                  : formatMoneyValue(
                      moneyBalance.total_debited,
                      exchangeRate!,
                      locale,
                    ),
              icon: (
                <ArrowDown className="h-4 w-4 text-red-500" weight="bold" />
              ),
            },
          ]}
          data={transactions}
          columns={tableColumns}
          rowKey={(row) => row.id}
          loading={loadingTx}
          toolbar={
            <div className="flex flex-col gap-3 w-full">
              {/* Row 1: label + presets + dropdowns */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <FunnelSimple
                    className="h-5 w-5 text-muted-foreground"
                    weight="bold"
                  />
                  <span className="text-sm font-medium text-foreground">
                    {t("transactions.filters")}
                  </span>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-3 justify-end">
                  <div className="flex items-center gap-1.5">
                    <Calendar
                      className="h-4 w-4 text-muted-foreground"
                      weight="bold"
                    />
                    {(
                      [
                        "thisMonth",
                        "last7Days",
                        "last30Days",
                        "last90Days",
                        "allTime",
                      ] as DatePreset[]
                    ).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => handleDatePreset(preset)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                          datePreset === preset
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {t(`filter.${preset}`)}
                      </button>
                    ))}
                    <button
                      onClick={() => handleDatePreset("custom")}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                        datePreset === "custom"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {t("filter.custom")}
                    </button>
                  </div>
                  <ElevatedSelect
                    value={typeFilter}
                    onValueChange={(v) => {
                      setTypeFilter(v);
                      setCurrentPage(1);
                    }}
                    className="w-auto min-w-[140px]"
                  >
                    <ElevatedSelectItem value="all">
                      {t("filter.allTypes")}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="credit">
                      {t("transactionType.credit")}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="debit">
                      {t("transactionType.debit")}
                    </ElevatedSelectItem>
                  </ElevatedSelect>
                  <ElevatedSelect
                    value={serviceFilter}
                    onValueChange={(v) => {
                      setServiceFilter(v);
                      setCurrentPage(1);
                    }}
                    className="w-auto min-w-[160px]"
                  >
                    <ElevatedSelectItem value="all">
                      {t("filter.allServices")}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="voice_campaign">
                      {t("serviceType.voice_campaign")}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="voice_call">
                      {t("serviceType.voice_call")}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="ai">
                      {t("serviceType.ai")}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="whatsapp_campaign">
                      {t("serviceType.whatsapp_campaign")}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="top_up">
                      {t("serviceType.top_up")}
                    </ElevatedSelectItem>
                    <ElevatedSelectItem value="manual_adjustment">
                      {t("serviceType.manual_adjustment")}
                    </ElevatedSelectItem>
                  </ElevatedSelect>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                        <DownloadSimple className="h-3.5 w-3.5" weight="bold" />
                        {t("export.label")}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExport("csv")}>
                        {t("export.csv")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                        {t("export.xlsx")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Row 2: Custom date/time range */}
              {datePreset === "custom" && (
                <div className="flex flex-wrap items-center gap-3">
                  <Clock
                    className="h-4 w-4 text-muted-foreground"
                    weight="bold"
                  />
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="customStart"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("filter.from")}
                    </label>
                    <input
                      id="customStart"
                      type="datetime-local"
                      value={customStart}
                      onChange={(e) => handleCustomStart(e.target.value)}
                      className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="customEnd"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("filter.to")}
                    </label>
                    <input
                      id="customEnd"
                      type="datetime-local"
                      value={customEnd}
                      max={toDateTimeLocal(new Date())}
                      onChange={(e) => handleCustomEnd(e.target.value)}
                      className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>
          }
          pagination={{
            currentPage,
            totalPages,
            pageSize: 15,
            totalItems,
            onPageChange: setCurrentPage,
          }}
          paginationText={{
            showing: t("pagination.page"),
            of: t("pagination.of"),
            items: t("transactions.total"),
          }}
          emptyState={
            error
              ? {
                  icon: (
                    <Wallet className="h-7 w-7 text-destructive" weight="fill" />
                  ),
                  title: t("error.title"),
                  description: error,
                }
              : {
                  icon: (
                    <Wallet
                      className="h-7 w-7 text-muted-foreground/40"
                      weight="duotone"
                    />
                  ),
                  title: t("transactions.empty"),
                }
          }
        />
      </motion.div>
    </motion.main>
  );
}
