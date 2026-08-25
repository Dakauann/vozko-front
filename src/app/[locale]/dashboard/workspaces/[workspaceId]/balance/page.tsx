"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Barcode,
  Check,
  CheckCircle,
  CircleNotch,
  CopySimple,
  CurrencyDollar,
  Eye,
  FunnelSimple,
  Hourglass,
  Invoice as InvoiceIcon,
  PixLogo,
  Wallet,
  Warning,
  XCircle,
} from "@/components/icons";
import type { Icon } from "@/components/icons";
import type {
  BalanceSummary,
  ListTransactionsParams,
  ResourceType,
  ServiceType,
  TransactionType,
} from "@/lib/balance/types";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import {
  adminCreateBalanceAction,
  adminCreateInvoiceAction,
  adminDebitResourceAction,
  adminGetFullSummaryAction,
  adminGetInvoiceAction,
  adminListInvoicesAction,
  adminListTransactionsAction,
} from "@/app/actions/balance";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { getExchangeRateAction } from "@/app/actions/pricing";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";


const SERVICE_TYPE_OPTIONS: ServiceType[] = [
  "manual_adjustment",
  "top_up",
  "whatsapp_campaign",
  "voice_campaign",
  "voice_call",
  "ai",
];

function formatMoneyValue(usdValue: number, exchangeRate: number): string {
  const brlValue = usdValue * exchangeRate;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(brlValue);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

const INVOICE_STATUS_CONFIG: Record<
  InvoiceStatus,
  { icon: Icon; className: string }
> = {
  PENDING: {
    icon: Hourglass,
    className: "text-warning-foreground bg-warning border-warning",
  },
  PAID: {
    icon: Check,
    className: "text-healthy-foreground bg-healthy border-healthy",
  },
  OVERDUE: {
    icon: Warning,
    className: "text-destructive-foreground bg-destructive border-destructive",
  },
  CANCELLED: {
    icon: XCircle,
    className: "text-white bg-[hsl(var(--plate-neutral))] border-transparent",
  },
  REFUNDED: {
    icon: ArrowDown,
    className: "text-muted-foreground bg-muted border-info",
  },
  EXPIRED: {
    icon: XCircle,
    className: "text-white bg-[hsl(var(--plate-neutral))] border-transparent",
  },
};

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


export default function AdminWorkspaceBalancePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const t = useTranslations("adminBalancePage");
  const { toast } = useToast();

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

  const [showForm, setShowForm] = useState<"invoice" | "debit" | null>(null);
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formBillingType, setFormBillingType] = useState<"PIX" | "BOLETO">(
    "PIX",
  );
  const [formServiceType, setFormServiceType] =
    useState<ServiceType>("manual_adjustment");
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceTotalPages, setInvoiceTotalPages] = useState(1);
  const [invoiceTotal, setInvoiceTotal] = useState(0);

  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [previewBoletoUrl, setPreviewBoletoUrl] = useState<string | null>(null);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const result = await adminGetFullSummaryAction(workspaceId);
      if (result.error) {
        if (
          result.error.includes("404") ||
          result.error.includes("not found") ||
          result.error.includes("Not Found")
        ) {
          const createResult = await adminCreateBalanceAction({
            workspaceId: workspaceId,
          });
          if (createResult.error) {
            setError(createResult.error);
          } else {
            const refetch = await adminGetFullSummaryAction(workspaceId);
            if (!refetch.error) setSummary(refetch.summary);
          }
        } else {
          setError(result.error);
        }
      } else {
        setSummary(result.summary);
      }
    } catch {
      setError("An error occurred while loading balance.");
    } finally {
      setLoadingSummary(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

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

  const fetchTransactions = useCallback(async () => {
    setLoadingTx(true);
    try {
      const txParams: ListTransactionsParams = {
        page: currentPage,
        pageSize: 15,
      };
      if (typeFilter !== "all")
        txParams.transaction_type = typeFilter as TransactionType;

      const result = await adminListTransactionsAction(workspaceId, txParams);
      if (result.error) {
        if (
          !result.error.includes("404") &&
          !result.error.includes("not found")
        ) {
          setError(result.error);
        }
      } else {
        setTransactions(result.transactions as NormalizedTransaction[]);
        setTotalPages(result.meta.total_pages);
        setTotalItems(result.meta.total_items);
      }
    } catch {
      /* swallow */
    } finally {
      setLoadingTx(false);
    }
  }, [currentPage, typeFilter, workspaceId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const fetchInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const result = await adminListInvoicesAction(
        workspaceId,
        invoicePage,
        15,
      );
      if (!result.error) {
        setInvoices(result.invoices);
        setInvoiceTotalPages(result.totalPages);
        setInvoiceTotal(result.total);
      }
    } catch {
      /* swallow */
    } finally {
      setLoadingInvoices(false);
    }
  }, [workspaceId, invoicePage]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const pollRef = useRef(false);
  useEffect(() => {
    if (!viewInvoice || viewInvoice.status !== "PENDING") return;
    pollRef.current = true;

    const poll = async () => {
      while (pollRef.current) {
        await new Promise((r) => setTimeout(r, 4000));
        if (!pollRef.current) break;
        try {
          const result = await adminGetInvoiceAction(
            workspaceId,
            viewInvoice.id,
          );
          if (result.invoice?.status === "PAID") {
            setPaymentConfirmed(true);
            fetchSummary();
            fetchTransactions();
            fetchInvoices();
            break;
          }
        } catch {
          /* ignore */
        }
      }
    };
    poll();
    return () => {
      pollRef.current = false;
    };
  }, [
    viewInvoice,
    workspaceId,
    fetchSummary,
    fetchTransactions,
    fetchInvoices,
  ]);

  useEffect(() => {
    if (!paymentConfirmed) return;
    const timeout = setTimeout(() => {
      setViewInvoice(null);
      setPaymentConfirmed(false);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [paymentConfirmed]);

  const handleSubmitOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseFloat(formAmount);
    if (!amount || amount <= 0) {
      toast({ title: t("form.error.invalidAmount"), variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      if (showForm === "invoice") {
        const result = await adminCreateInvoiceAction(workspaceId, {
          amountBrl: amount,
          billingType: formBillingType,
          description: formDescription || undefined,
        });

        if (result.error) {
          toast({
            title: t("form.error.operationFailed"),
            description: result.error,
            variant: "destructive",
          });
        } else if (result.invoice) {
          setViewInvoice(result.invoice);
          setPaymentConfirmed(false);
          setPixCopied(false);
          setShowForm(null);
          setFormAmount("");
          setFormDescription("");
          fetchInvoices();
        }
      } else if (showForm === "debit") {
        if (loadingRate || exchangeRate == null) {
          toast({
            title: "Exchange rate not loaded yet",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }

        const payload = {
          resource_type: "money" as const,
          amount: amount / exchangeRate, // BRL input → USD for API
          service_type: formServiceType,
          description: formDescription || undefined,
        };

        const result = await adminDebitResourceAction(workspaceId, payload);

        if (result.error) {
          toast({
            title: t("form.error.operationFailed"),
            description: result.error,
            variant: "destructive",
          });
        } else {
          toast({
            title: t("form.success.debit"),
            description: t("form.success.description"),
          });
          setShowForm(null);
          setFormAmount("");
          setFormDescription("");
          fetchSummary();
          fetchTransactions();
        }
      }
    } catch {
      toast({ title: t("form.error.operationFailed"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const moneyBalance = summary?.balances?.find(
    (b) => b.resource_type === "money",
  );

  const tableColumns = useMemo<DashboardTableColumn<NormalizedTransaction>[]>(
    () => [
      {
        key: "description",
        header: t("transactions.title"),
        render: (row) => (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg">
              <CurrencyDollar
                className="h-4 w-4 text-warning-ink"
                weight="fill"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground truncate">
                {row.description || t("resource.money")}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(row.created_at)}
                {row.service_type &&
                  ` · ${row.service_type.replace(/_/g, " ")}`}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "amount",
        header: t("card.credited") + " / " + t("card.debited"),
        className: "text-right",
        render: (row) => {
          const isCredit = row.transaction_type === "credit";
          return (
            <div className="flex items-center gap-2 justify-end">
              {isCredit ? (
                <ArrowUp className="h-4 w-4 text-healthy-ink" weight="bold" />
              ) : (
                <ArrowDown className="h-4 w-4 text-destructive-ink" weight="bold" />
              )}
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  isCredit ? "text-healthy-ink" : "text-destructive-ink",
                )}
              >
                {isCredit ? "+" : "-"}
                {formatMoneyValue(row.amount, exchangeRate!)}
              </span>
            </div>
          );
        },
      },
    ],
    [t, exchangeRate],
  );

  const invoiceColumns = useMemo<DashboardTableColumn<Invoice>[]>(
    () => [
      {
        key: "date",
        header: t("invoices.date"),
        render: (row) => (
          <div className="flex flex-col">
            <span className="text-sm text-foreground">
              {formatDate(row.createdAt)}
            </span>
            {row.description && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {row.description}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "amountBRL",
        header: t("invoices.amount"),
        className: "text-right",
        render: (row) => (
          <span className="text-sm font-medium text-foreground tabular-nums">
            {formatBRL(row.amountBRL)}
          </span>
        ),
      },
      {
        key: "method",
        header: t("invoices.method"),
        className: "text-center",
        render: (row) =>
          row.billingType === "PIX" ? (
            <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-healthy-ink">
              <PixLogo className="h-3.5 w-3.5" weight="bold" />
              PIX
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Barcode className="h-3.5 w-3.5" weight="bold" />
              Boleto
            </div>
          ),
      },
      {
        key: "status",
        header: t("invoices.status"),
        className: "text-center",
        render: (row) => {
          const cfg = INVOICE_STATUS_CONFIG[row.status];
          const StatusIcon = cfg.icon;
          return (
            <div className="flex justify-center">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[--radius] border px-2.5 py-0.5 text-xs font-medium",
                  cfg.className,
                )}
              >
                <StatusIcon className="h-3 w-3" weight="bold" />
                {t(`invoices.statusLabels.${row.status}`)}
              </span>
            </div>
          );
        },
      },
      {
        key: "actions",
        header: "",
        className: "w-[100px]",
        render: (row) => (
          <div className="flex items-center justify-center gap-1">
            {row.status === "PENDING" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewInvoice(row);
                  setPaymentConfirmed(false);
                  setPixCopied(false);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={t("invoices.viewPayment")}
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            )}
            {row.billingType === "PIX" &&
              row.pixCopy &&
              row.status === "PENDING" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard
                      .writeText(row.pixCopy ?? "")
                      .then(() => {
                        setCopiedInvoiceId(row.id);
                        setTimeout(() => setCopiedInvoiceId(null), 2000);
                      })
                      .catch(() => {});
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title={t("invoices.copyPix")}
                >
                  {copiedInvoiceId === row.id ? (
                    <Check
                      className="h-3.5 w-3.5 text-healthy-ink"
                      weight="bold"
                    />
                  ) : (
                    <CopySimple className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
          </div>
        ),
      },
    ],
    [t, copiedInvoiceId],
  );

  return (
    <main className="w-full space-y-4">
      {/* ── Header ── */}
      <div>
        <DashboardPageHeader
          back={{
            onClick: () => router.push("/dashboard/workspaces"),
            label: t("header.backToWorkspaces"),
          }}
          icon={<Wallet className="h-5 w-5" weight="fill" />}
          badge={t("header.badge")}
          title={t("header.title")}
          description={t("header.description", {
            workspaceId: workspaceId.slice(0, 8),
          })}
          actions={
            <>
              <Button
                variant="primary"
                title={t("header.generateInvoice")}
                icon={<InvoiceIcon className="h-4 w-4" weight="bold" />}
                iconVisible
                iconSide="left"
                onClick={() =>
                  setShowForm(showForm === "invoice" ? null : "invoice")
                }
              />
              <Button
                variant="outline"
                title={t("header.debit")}
                icon={<ArrowDown className="h-4 w-4" weight="bold" />}
                iconVisible
                iconSide="left"
                onClick={() =>
                  setShowForm(showForm === "debit" ? null : "debit")
                }
              />
            </>
          }
        />
      </div>

      {/* ── Invoice / Debit Form ── */}
      <AnimatePresence>
        {showForm !== null && (
          <motion.div
            key={showForm}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className={cn(
                "rounded-[--radius] border p-6",
                showForm === "invoice"
                  ? "border-border bg-muted"
                  : "border-border bg-muted",
              )}
            >
              <h3 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground mb-4">
                {showForm === "invoice"
                  ? t("form.titleInvoice")
                  : t("form.titleDebit")}
              </h3>
              <form onSubmit={handleSubmitOperation} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* ── Invoice: billing type ── */}
                  {showForm === "invoice" && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        {t("form.billingType")}
                      </label>
                      <ElevatedSelect
                        value={formBillingType}
                        onValueChange={(v) =>
                          setFormBillingType(v as "PIX" | "BOLETO")
                        }
                        className="w-full"
                      >
                        <ElevatedSelectItem value="PIX">
                          <span className="flex items-center gap-2">PIX</span>
                        </ElevatedSelectItem>
                        <ElevatedSelectItem value="BOLETO">
                          <span className="flex items-center gap-2">
                            Boleto
                          </span>
                        </ElevatedSelectItem>
                      </ElevatedSelect>
                    </div>
                  )}

                  {/* ── Debit: service type ── */}
                  {showForm === "debit" && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        {t("form.serviceType")}
                      </label>
                      <ElevatedSelect
                        value={formServiceType}
                        onValueChange={(v) =>
                          setFormServiceType(v as ServiceType)
                        }
                        className="w-full"
                      >
                        {SERVICE_TYPE_OPTIONS.map((st) => (
                          <ElevatedSelectItem key={st} value={st}>
                            {t(`form.serviceTypeOptions.${st}`)}
                          </ElevatedSelectItem>
                        ))}
                      </ElevatedSelect>
                    </div>
                  )}

                  {/* ── Amount (BRL) ── */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      {t("form.amount")}
                    </label>
                    <ElevatedInput
                      type="number"
                      label={t("form.amountPlaceholder")}
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      controlSize="sm"
                      className="w-full"
                    />
                    {formAmount &&
                      Number.parseFloat(formAmount) > 0 &&
                      exchangeRate && (
                        <p className="mt-1 text-2xs text-muted-foreground">
                          ≈{" "}
                          <span className="font-semibold text-foreground">
                            $
                            {(
                              Number.parseFloat(formAmount) / exchangeRate
                            ).toFixed(2)}{" "}
                            USD
                          </span>
                          <span className="ml-1 text-muted-foreground">
                            (1 USD = R$ {exchangeRate.toFixed(2)})
                          </span>
                        </p>
                      )}
                  </div>

                  {/* ── Description ── */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      {t("form.description")}
                    </label>
                    <ElevatedInput
                      type="text"
                      label={t("form.descriptionPlaceholder")}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      controlSize="sm"
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(null)}
                    className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <XCircle className="h-4 w-4" weight="bold" />
                    {t("form.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !formAmount}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-[--radius] px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                      showForm === "invoice"
                        ? "bg-healthy text-healthy-foreground hover:bg-healthy"
                        : "bg-destructive text-destructive-foreground hover:bg-destructive",
                    )}
                  >
                    {submitting ? (
                      <CircleNotch
                        className="h-4 w-4 animate-spin"
                        weight="bold"
                      />
                    ) : (
                      <CheckCircle className="h-4 w-4" weight="bold" />
                    )}
                    {showForm === "invoice"
                      ? t("form.submitInvoice")
                      : t("form.submitDebit")}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Transaction History ── */}
      <div>
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
                    ),
              icon: (
                <CurrencyDollar
                  className="h-4 w-4 text-warning-ink"
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
                    ),
              icon: (
                <ArrowUp className="h-4 w-4 text-healthy-ink" weight="bold" />
              ),
            },
            {
              label: t("card.debited"),
              value:
                loadingSummary || loadingRate || !moneyBalance
                  ? "..."
                  : formatMoneyValue(moneyBalance.total_debited, exchangeRate!),
              icon: (
                <ArrowDown className="h-4 w-4 text-destructive-ink" weight="bold" />
              ),
            },
          ]}
          data={transactions}
          columns={tableColumns}
          rowKey={(row) => row.id}
          loading={loadingTx}
          toolbar={
            <div className="flex flex-col gap-3 w-full sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FunnelSimple
                  className="h-5 w-5 text-muted-foreground"
                  weight="bold"
                />
                <span className="text-sm font-medium text-foreground">
                  {t("transactions.filters")}
                </span>
              </div>
              <div className="flex flex-1 items-center gap-3 justify-end">
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
              </div>
            </div>
          }
          pagination={
            totalPages > 1
              ? {
                  currentPage,
                  totalPages,
                  pageSize: 15,
                  totalItems,
                  onPageChange: setCurrentPage,
                }
              : undefined
          }
          paginationText={{
            showing: t("pagination.page"),
            of: t("pagination.of"),
            items: t("transactions.total"),
          }}
          emptyState={
            error
              ? {
                  icon: (
                    <Wallet className="h-7 w-7 text-destructive-ink" weight="fill" />
                  ),
                  title: t("error.title"),
                  description: error,
                }
              : {
                  icon: (
                    <Wallet
                      className="h-7 w-7 text-muted-foreground"
                      weight="duotone"
                    />
                  ),
                  title: t("transactions.empty"),
                }
          }
        />
      </div>

      {/* ── Invoices ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <InvoiceIcon className="h-5 w-5 text-primary-ink" weight="bold" />
          <h2 className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
            {t("invoices.title")}
          </h2>
        </div>
        <DashboardTable<Invoice>
          data={invoices}
          columns={invoiceColumns}
          rowKey={(row) => row.id}
          loading={loadingInvoices}
          pagination={
            invoiceTotalPages > 1
              ? {
                  currentPage: invoicePage,
                  totalPages: invoiceTotalPages,
                  pageSize: 15,
                  totalItems: invoiceTotal,
                  onPageChange: setInvoicePage,
                }
              : undefined
          }
          paginationText={{
            showing: t("pagination.page"),
            of: t("pagination.of"),
            items: t("invoices.total"),
          }}
          emptyState={{
            icon: (
              <InvoiceIcon
                className="h-7 w-7 text-muted-foreground"
                weight="duotone"
              />
            ),
            title: t("invoices.empty"),
          }}
        />
      </div>

      {/* ── Invoice Detail Dialog ── */}
      <ElevatedDialog
        open={!!viewInvoice}
        onOpenChange={(open) => {
          if (!open) {
            setViewInvoice(null);
            setPaymentConfirmed(false);
            setPixCopied(false);
          }
        }}
      >
        <ElevatedDialogContent
          className={
            viewInvoice?.bankSlipUrl
              ? "w-[95vw] max-w-[1100px] max-h-[90vh] overflow-y-auto"
              : "w-[80vw] max-w-[500px]"
          }
        >
          <ElevatedDialogHeader>
            <ElevatedDialogTitle>
              {t("invoiceDialog.title")}
            </ElevatedDialogTitle>
            <ElevatedDialogDescription>
              {viewInvoice
                ? t("invoiceDialog.description", {
                    amount: formatBRL(viewInvoice.amountBRL),
                  })
                : ""}
            </ElevatedDialogDescription>
          </ElevatedDialogHeader>

          {paymentConfirmed ? (
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full tile-healthy">
                <Check className="h-8 w-8 text-healthy-ink" weight="bold" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
                  {t("invoiceDialog.confirmed")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("invoiceDialog.confirmedDescription")}
                </p>
              </div>
              {viewInvoice && (
                <span className="text-sm font-semibold text-foreground">
                  {formatBRL(viewInvoice.amountBRL)}
                </span>
              )}
            </div>
          ) : viewInvoice ? (
            <div className="flex flex-col gap-5 pt-2">
              {viewInvoice.billingType === "PIX" ? (
                <>
                  <div className="flex flex-col items-center gap-4">
                    {viewInvoice.pixQrCode ? (
                      <img
                        src={`data:image/png;base64,${viewInvoice.pixQrCode}`}
                        alt="PIX QR Code"
                        className="h-48 w-48 rounded-[--radius] border border-border"
                      />
                    ) : (
                      <div className="flex h-48 w-48 items-center justify-center rounded-[--radius] border border-dashed border-border bg-muted">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <PixLogo className="h-12 w-12" weight="duotone" />
                          <span className="text-xs">QR Code PIX</span>
                        </div>
                      </div>
                    )}
                    <p className="text-center text-sm text-muted-foreground">
                      {t("invoiceDialog.scanQr")}
                    </p>
                  </div>

                  {viewInvoice.pixCopy && (
                    <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted p-3">
                      <code className="flex-1 truncate text-xs text-muted-foreground">
                        {viewInvoice.pixCopy}
                      </code>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              viewInvoice.pixCopy ?? "",
                            );
                            setPixCopied(true);
                            setTimeout(() => setPixCopied(false), 2000);
                          } catch {
                            /* clipboard may not be available */
                          }
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        {pixCopied ? (
                          <Check
                            className="h-4 w-4 text-healthy-ink"
                            weight="bold"
                          />
                        ) : (
                          <CopySimple className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex min-h-0 flex-1 flex-col items-center gap-4">
                    {viewInvoice.bankSlipUrl ? (
                      <div className="min-h-0 w-full flex-1 overflow-hidden rounded-[--radius] border border-border">
                        <iframe
                          src={viewInvoice.bankSlipUrl}
                          className="h-full min-h-[400px] w-full"
                          title="Boleto"
                        />
                      </div>
                    ) : (
                      <div className="flex h-32 w-full items-center justify-center rounded-[--radius] border border-dashed border-border bg-muted">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Barcode className="h-12 w-12" weight="duotone" />
                          <span className="text-xs">
                            {t("invoiceDialog.boletoGenerated")}
                          </span>
                        </div>
                      </div>
                    )}
                    <p className="text-center text-sm text-muted-foreground">
                      {t("invoiceDialog.boletoDescription")}
                    </p>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between rounded-[--radius] bg-muted px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {t("invoiceDialog.amountSummary")}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatBRL(viewInvoice.amountBRL)}
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-[--radius] bg-muted border border-border px-4 py-3">
                <Hourglass className="h-4 w-4 text-warning-ink" weight="bold" />
                <span className="text-sm text-warning-ink">
                  {t("invoiceDialog.waitingPayment")}
                </span>
              </div>
            </div>
          ) : null}
        </ElevatedDialogContent>
      </ElevatedDialog>

      {/* ── Boleto Preview Dialog ── */}
      <ElevatedDialog
        open={!!previewBoletoUrl}
        onOpenChange={(open) => !open && setPreviewBoletoUrl(null)}
      >
        <ElevatedDialogContent className="w-[95vw] max-w-[1100px] max-h-[90vh] overflow-y-auto">
          <ElevatedDialogHeader>
            <ElevatedDialogTitle>Boleto</ElevatedDialogTitle>
            <ElevatedDialogDescription>
              {t("invoiceDialog.boletoDescription")}
            </ElevatedDialogDescription>
          </ElevatedDialogHeader>
          {previewBoletoUrl && (
            <div className="w-full overflow-hidden rounded-[--radius] border border-border">
              <iframe
                src={previewBoletoUrl}
                className="h-full min-h-[500px] w-full"
                title="Boleto"
              />
            </div>
          )}
        </ElevatedDialogContent>
      </ElevatedDialog>
    </main>
  );
}
