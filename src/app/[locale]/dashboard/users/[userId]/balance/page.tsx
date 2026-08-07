"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  CaretLeft,
  CaretRight,
  CheckCircle,
  CircleNotch,
  CurrencyDollar,
  FunnelSimple,
  Plus,
  Wallet,
  XCircle,
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
  adminCreateBalanceAction,
  adminCreditResourceAction,
  adminDebitResourceAction,
  adminGetFullSummaryAction,
  adminListTransactionsAction,
} from "@/app/actions/balance";
import { useCallback, useEffect, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { getExchangeRateAction } from "@/app/actions/pricing";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
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


export default function AdminUserBalancePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.userId as string;
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

  const [showForm, setShowForm] = useState(false);
  const [operationType, setOperationType] = useState<"credit" | "debit">(
    "credit",
  );

  const [formServiceType, setFormServiceType] =
    useState<ServiceType>("manual_adjustment");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

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

  const handleSubmitOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseFloat(formAmount);
    if (!amount || amount <= 0) {
      toast({ title: t("form.error.invalidAmount"), variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
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

      const action =
        operationType === "credit"
          ? adminCreditResourceAction
          : adminDebitResourceAction;
      const result = await action(workspaceId, payload);

      if (result.error) {
        toast({
          title: t("form.error.operationFailed"),
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title:
            operationType === "credit"
              ? t("form.success.credit")
              : t("form.success.debit"),
          description: t("form.success.description"),
        });
        setShowForm(false);
        setFormAmount("");
        setFormDescription("");
        fetchSummary();
        fetchTransactions();
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

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-6"
    >
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <DashboardPageHeader
          back={{
            onClick: () => router.push("/dashboard/users"),
            label: t("header.backToUsers"),
          }}
          icon={<Wallet className="h-5 w-5" weight="fill" />}
          badge={t("header.badge")}
          title={t("header.title")}
          description={t("header.description", {
            userId: workspaceId.slice(0, 8),
          })}
          actions={
            <Button
              variant="primary"
              title={t("header.newOperation")}
              icon={<Plus className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
              onClick={() => setShowForm(!showForm)}
            />
          }
        />
      </motion.div>

      {/* ── Resource Cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div
          className="rounded-[--radius] border border-border bg-card p-6"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted">
              <Wallet className="h-5 w-5" weight="fill" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {t("header.title")}
              </h2>
              {summary?.last_updated && (
                <p className="text-xs text-muted-foreground">
                  {formatDate(summary.last_updated)}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 grid-cols-1">
            <div className="group relative flex flex-col gap-4 p-5 rounded-[--radius] border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="tile-3 flex h-10 w-10 items-center justify-center">
                  <CurrencyDollar
                    className="h-5 w-5"
                    weight="fill"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {t("resource.money")}
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    {loadingSummary
                      ? "..."
                      : formatMoneyValue(
                          moneyBalance?.current_balance ?? 0,
                          exchangeRate!,
                        )}
                  </p>
                </div>
              </div>

              {!loadingSummary && moneyBalance && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[--radius] bg-muted px-3 py-2 text-center">
                    <p className="text-[11px] text-muted-foreground font-medium">
                      {t("card.credited")}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {formatMoneyValue(
                        moneyBalance.total_credited,
                        exchangeRate!,
                      )}
                    </p>
                  </div>
                  <div className="rounded-[--radius] bg-muted px-3 py-2 text-center">
                    <p className="text-[11px] text-muted-foreground font-medium">
                      {t("card.debited")}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {formatMoneyValue(
                        moneyBalance.total_debited,
                        exchangeRate!,
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Credit / Debit Form ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="rounded-[--radius] border border-border bg-muted p-6"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">
                {t("form.title")}
              </h3>
              <form onSubmit={handleSubmitOperation} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Operation Type */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      {t("form.operationType")}
                    </label>
                    <ElevatedSelect
                      value={operationType}
                      onValueChange={(v) =>
                        setOperationType(v as "credit" | "debit")
                      }
                      className="w-full"
                    >
                      <ElevatedSelectItem value="credit">
                        <span className="flex items-center gap-2">
                          <ArrowUp
                            className="h-3.5 w-3.5 text-healthy-ink"
                            weight="bold"
                          />
                          {t("form.credit")}
                        </span>
                      </ElevatedSelectItem>
                      <ElevatedSelectItem value="debit">
                        <span className="flex items-center gap-2">
                          <ArrowDown
                            className="h-3.5 w-3.5 text-destructive-ink"
                            weight="bold"
                          />
                          {t("form.debit")}
                        </span>
                      </ElevatedSelectItem>
                    </ElevatedSelect>
                  </div>

                  {/* Service Type */}
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

                  {/* Amount */}
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
                  </div>

                  {/* Description */}
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
                    onClick={() => setShowForm(false)}
                    className="inline-flex items-center gap-1.5 rounded-[--radius] border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <XCircle className="h-4 w-4" weight="bold" />
                    {t("form.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !formAmount}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-[--radius] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50",
                      operationType === "credit"
                        ? "bg-healthy hover:bg-healthy"
                        : "bg-destructive hover:bg-destructive",
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
                    {operationType === "credit"
                      ? t("form.submitCredit")
                      : t("form.submitDebit")}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filters ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <div
          className="rounded-[--radius] border border-border bg-card p-4"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
        </div>
      </motion.div>

      {/* ── Transaction History ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div
          className="rounded-[--radius] border border-border bg-card overflow-hidden"
          style={{ boxShadow: softSurfaceShadow }}
        >
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-muted"
                style={{ boxShadow: softSurfaceShadow }}
              >
                <Wallet
                  className="h-5 w-5 text-muted-foreground"
                  weight="bold"
                />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t("transactions.title")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {totalItems} {t("transactions.total")}
                </p>
              </div>
            </div>
          </div>

          {loadingTx ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border border-foreground/20 border-t-blue-500" />
              <p className="text-sm text-muted-foreground mt-3">
                {t("loading")}
              </p>
            </div>
          ) : error && transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-[--radius] tile-fault mb-4">
                <Wallet className="h-7 w-7 text-destructive-ink" weight="fill" />
              </div>
              <p className="font-semibold text-foreground">
                {t("error.title")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Wallet className="h-12 w-12 text-muted-foreground mb-3" weight="fill" />
              <p className="text-sm text-muted-foreground">
                {t("transactions.empty")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map((tx) => {
                const isCredit = tx.transaction_type === "credit";

                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-[--radius]">
                      <CurrencyDollar
                        className="h-5 w-5 text-warning-ink"
                        weight="fill"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {tx.description || t(`resource.${tx.resource_type}`)}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(tx.created_at)}
                        {tx.service_type &&
                          ` · ${tx.service_type.replace(/_/g, " ")}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCredit ? (
                        <ArrowUp
                          className="h-4 w-4 text-healthy-ink"
                          weight="bold"
                        />
                      ) : (
                        <ArrowDown
                          className="h-4 w-4 text-destructive-ink"
                          weight="bold"
                        />
                      )}
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          isCredit ? "text-healthy-ink" : "text-destructive-ink",
                        )}
                      >
                        {isCredit ? "+" : "-"}
                        {formatMoneyValue(tx.amount, exchangeRate!)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-6 py-3">
              <p className="text-xs text-muted-foreground">
                {t("pagination.page")} {currentPage} {t("pagination.of")}{" "}
                {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-muted-foreground disabled:opacity-40"
                >
                  <CaretLeft className="h-4 w-4" weight="bold" />
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage >= totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-muted-foreground disabled:opacity-40"
                >
                  <CaretRight className="h-4 w-4" weight="bold" />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.main>
  );
}
