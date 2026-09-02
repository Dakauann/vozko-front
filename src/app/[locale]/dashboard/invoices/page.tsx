"use client";

import {
  Barcode,
  Check,
  Clock,
  CopySimple,
  Eye,
  Hourglass,
  PixLogo,
  Plus,
  Receipt,
  Spinner,
  Warning,
  XCircle,
} from "@/components/icons";
import type { Icon } from "@/components/icons";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";
import type { PublicPlanDetails } from "@/lib/workspace-plan/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { PlanCatalogRail } from "@/components/dashboard/plans/PlanCatalogRail";
import { InvoiceDetailDialog } from "@/components/dashboard/invoices/InvoiceDetailDialog";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { cn } from "@/lib/utils";
import {
  createInvoiceAction,
  getInvoiceAction,
  listInvoicesAction,
} from "@/app/actions/invoices";
import { listPublicPlansAction } from "@/app/actions/workspace-plan";
import {
  getSubscriptionStatusKey,
  isRechargeSubscriptionRequiredError,
  normalizeRechargeErrorMessage,
} from "@/lib/invoices/recharge-errors";
import { useWorkspace } from "@/contexts/workspace-context";

const PAGE_SIZE = 15;

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatUSD(micros: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(micros / 1_000_000);
}

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { icon: Icon; label: string; className: string }
> = {
  PENDING: {
    icon: Hourglass,
    label: "pending",
    className: "text-warning-foreground bg-warning border-warning",
  },
  PAID: {
    icon: Check,
    label: "paid",
    className: "text-healthy-foreground bg-healthy border-healthy",
  },
  OVERDUE: {
    icon: Warning,
    label: "overdue",
    className: "text-destructive-foreground bg-destructive border-destructive",
  },
  CANCELLED: {
    icon: XCircle,
    label: "cancelled",
    className: "text-white bg-[hsl(var(--plate-neutral))] border-transparent",
  },
  REFUNDED: {
    icon: Clock,
    label: "refunded",
    className: "text-muted-foreground bg-muted border-info",
  },
  EXPIRED: {
    icon: Clock,
    label: "expired",
    className: "text-white bg-[hsl(var(--plate-neutral))] border-transparent",
  },
};

export default function InvoicesPage() {
  const t = useTranslations("invoicesPage");
  const plansT = useTranslations("plansPage");
  const gateT = useTranslations("billingPlanGate");
  const locale = useLocale();
  const { currentWorkspace } = useWorkspace();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "boleto">("pix");
  const [generating, setGenerating] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(
    null,
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [previewBoletoUrl, setPreviewBoletoUrl] = useState<string | null>(null);
  const [showPlanCatalog, setShowPlanCatalog] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<PublicPlanDetails[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);

  const currentPlanName = currentWorkspace?.planName?.trim() || null;
  const subscriptionStatus = getSubscriptionStatusKey(
    currentWorkspace?.subscriptionStatus,
  );
  const hasRechargeEligiblePlan =
    Boolean(currentPlanName) && subscriptionStatus === "active";
  const hasVisiblePlan =
    Boolean(currentPlanName) && subscriptionStatus !== "expired";
  const subscriptionStatusLabel = subscriptionStatus
    ? plansT(`status.${subscriptionStatus}`)
    : null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadPlans = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setAvailablePlans([]);
      setPlansError(null);
      return;
    }

    setLoadingPlans(true);
    setPlansError(null);
    const result = await listPublicPlansAction(currentWorkspace.id);

    if (result.error) {
      setAvailablePlans([]);
      setPlansError(result.error);
      setLoadingPlans(false);
      return;
    }

    setAvailablePlans(result.plans);
    setLoadingPlans(false);
  }, [currentWorkspace?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const result = await listInvoicesAction({
        page,
        pageSize: PAGE_SIZE,
      });
      if (cancelled) {
        return;
      }
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setInvoices(result.data.invoices ?? []);
        setTotal(result.data.total ?? 0);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [page]);

  const handleCopyPix = async (invoice: Invoice) => {
    if (!invoice.pixCopy) return;
    try {
      await navigator.clipboard.writeText(invoice.pixCopy);
      setCopiedId(invoice.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API may not be available in all contexts
    }
  };

  const formatDate = useCallback(
    (dateStr: string) =>
      new Date(dateStr).toLocaleDateString(locale === "pt" ? "pt-BR" : locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );

  const columns = useMemo<DashboardTableColumn<Invoice>[]>(
    () => [
      {
        key: "date",
        header: t("table.columns.date"),
        render: (row) => (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-foreground">
                {formatDate(row.createdAt)}
              </span>
              {row.purpose && (
                <span
                  className={cn(
                    "rounded-[--radius] px-1.5 py-0.5 text-2xs font-medium",
                    row.purpose === "MONTHLY_BILLING"
                      ? "bg-muted text-primary-ink"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {t(`purpose.${row.purpose}`)}
                </span>
              )}
            </div>
            {row.description && (
              <span className="max-w-[200px] truncate text-xs text-muted-foreground">
                {row.description}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "amountBRL",
        header: t("table.columns.amountBRL"),
        className: "text-right",
        render: (row) => (
          <span className="text-sm font-medium text-foreground tabular-nums">
            {formatBRL(row.amountBRL)}
          </span>
        ),
      },
      {
        key: "amountUSD",
        header: t("table.columns.amountUSD"),
        className: "text-right",
        render: (row) => (
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatUSD(row.amountUSD)}
          </span>
        ),
      },
      {
        key: "rate",
        header: t("table.columns.rate"),
        className: "text-right",
        render: (row) => (
          <span className="text-sm text-muted-foreground tabular-nums">
            {row.exchangeRate.toFixed(2)}
          </span>
        ),
      },
      {
        key: "method",
        header: t("table.columns.method"),
        className: "text-center",
        render: (row) =>
          row.billingType === "PIX" ? (
            <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-healthy-ink">
              <PixLogo className="h-3.5 w-3.5" weight="bold" />
              PIX
            </div>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">
              {t("table.boleto")}
            </span>
          ),
      },
      {
        key: "status",
        header: t("table.columns.status"),
        className: "text-center",
        render: (row) => {
          const cfg = STATUS_CONFIG[row.status];
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
                {t(`status.${cfg.label}`)}
              </span>
            </div>
          );
        },
      },
      {
        key: "actions",
        header: "",
        className: "w-[80px]",
        render: (row) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setDetailInvoice(row);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={t("table.viewDetails")}
            >
              <Receipt className="h-3.5 w-3.5" />
            </button>
            {row.billingType === "BOLETO" &&
              row.bankSlipUrl &&
              row.status === "PENDING" && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewBoletoUrl(row.bankSlipUrl ?? null);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={t("table.viewBoleto")}
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              )}
            {row.billingType === "PIX" &&
              row.pixCopy &&
              row.status === "PENDING" && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleCopyPix(row);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={t("table.copyPix")}
                >
                  {copiedId === row.id ? (
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
    [copiedId, formatDate, t],
  );

  const openCreateDialog = useCallback(() => {
    setGeneratedInvoice(null);
    setCreateError(null);
    setRechargeAmount("");
    setPaymentMethod("pix");
    setPixCopied(false);
    setPaymentConfirmed(false);
    if (!hasRechargeEligiblePlan) {
      setShowPlanCatalog(true);
      void loadPlans();
    } else {
      setShowPlanCatalog(false);
    }
    setCreateOpen(true);
  }, [hasRechargeEligiblePlan, loadPlans]);

  const handleCreateDialogChange = useCallback((open: boolean) => {
    setCreateOpen(open);
    if (open) {
      return;
    }

    setShowPlanCatalog(false);
    setCreateError(null);
    setPlansError(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setCreateError(null);
    const result = await createInvoiceAction({
      amountBrl: Number(rechargeAmount),
      billingType: paymentMethod === "pix" ? "PIX" : "BOLETO",
    });
    setGenerating(false);

    if (result.error) {
      setCreateError(
        normalizeRechargeErrorMessage(result.error, {
          defaultMessage: gateT("defaultCreateError"),
          subscriptionRequired: gateT("subscriptionRequired"),
        }),
      );
      if (isRechargeSubscriptionRequiredError(result.error)) {
        setShowPlanCatalog(true);
        void loadPlans();
      }
      return;
    }

    if (result.data?.invoice) {
      setGeneratedInvoice(result.data.invoice);
      setPage((currentPage) => currentPage);
    }
  }, [gateT, loadPlans, paymentMethod, rechargeAmount]);

  useEffect(() => {
    if (
      !createOpen ||
      !generatedInvoice ||
      generatedInvoice.status !== "PENDING"
    ) {
      return;
    }

    let active = true;

    const poll = async () => {
      while (active) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
        if (!active) {
          break;
        }
        try {
          const result = await getInvoiceAction(generatedInvoice.id);
          if (result.data && result.data.status === "PAID") {
            if (active) {
              setPaymentConfirmed(true);
            }
            break;
          }
        } catch {
          // ignore polling errors
        }
      }
    };

    void poll();
    return () => {
      active = false;
    };
  }, [createOpen, generatedInvoice]);

  useEffect(() => {
    if (!paymentConfirmed) return;
    const timeout = setTimeout(() => {
      setCreateOpen(false);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [paymentConfirmed]);

  useEffect(() => {
    if (!createOpen && generatedInvoice) {
      let cancelled = false;
      (async () => {
        const result = await listInvoicesAction({ page, pageSize: PAGE_SIZE });
        if (cancelled) {
          return;
        }
        if (result.data) {
          setInvoices(result.data.invoices ?? []);
          setTotal(result.data.total ?? 0);
        }
      })();

      return () => {
        cancelled = true;
      };
    }
  }, [createOpen, generatedInvoice, page]);

  return (
    <main className="w-full space-y-4">
      <DashboardPageHeader
        icon={<Receipt className="h-5 w-5" weight="fill" />}
        badge={t("header.badge")}
        description={t("header.description")}
        actions={
          <Button
            variant="primary"
            onClick={openCreateDialog}
            icon={<Plus className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            title={t("addFunds")}
          />
        }
      />

      <DashboardTable<Invoice>
        data={invoices}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        pagination={
          totalPages > 1
            ? {
                currentPage: page,
                totalPages,
                pageSize: PAGE_SIZE,
                totalItems: total,
                onPageChange: setPage,
              }
            : undefined
        }
        paginationText={{
          showing: t("pagination.page"),
          of: t("pagination.of"),
          items: t("table.total"),
        }}
        emptyState={
          error
            ? {
                icon: (
                  <Receipt className="h-7 w-7 text-destructive-ink" weight="fill" />
                ),
                title: t("error.title"),
                description: error,
              }
            : {
                icon: (
                  <Receipt
                    className="h-7 w-7 text-muted-foreground"
                    weight="duotone"
                  />
                ),
                title: t("table.empty"),
              }
        }
      />

      <ElevatedDialog open={createOpen} onOpenChange={handleCreateDialogChange}>
        <ElevatedDialogContent
          className={
            showPlanCatalog
              ? "w-[95vw] max-w-[1040px] max-h-[90vh] overflow-y-auto"
              : generatedInvoice?.bankSlipUrl
                ? "w-[95vw] max-w-[1100px] max-h-[90vh] overflow-y-auto"
                : "w-[80vw] max-w-[500px]"
          }
        >
          <ElevatedDialogHeader>
            <ElevatedDialogTitle>
              {showPlanCatalog ? gateT("title") : t("create.title")}
            </ElevatedDialogTitle>
            <ElevatedDialogDescription>
              {showPlanCatalog ? gateT("description") : t("create.description")}
            </ElevatedDialogDescription>
          </ElevatedDialogHeader>

          {paymentConfirmed ? (
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full tile-healthy">
                <Check className="h-8 w-8 text-healthy-ink" weight="bold" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="font-display text-lg font-semibold tracking-[0.01em] text-foreground">
                  {t("create.confirmed")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("create.confirmedDescription")}
                </p>
              </div>
              {generatedInvoice ? (
                <span className="text-sm font-semibold text-foreground">
                  {formatBRL(generatedInvoice.amountBRL)}
                </span>
              ) : null}
            </div>
          ) : showPlanCatalog ? (
            <div className="flex flex-col gap-5 pt-2">
              {hasVisiblePlan ? (
                <div className="rounded-[--radius] border border-border bg-background p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-2xs font-semibold text-muted-foreground">
                        {gateT("currentPlanTitle")}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {currentPlanName}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {gateT("currentPlanDescription")}
                      </p>
                    </div>
                    {subscriptionStatusLabel ? (
                      <span
                        className={cn(
                          "inline-flex w-fit items-center rounded-[--radius] px-3 py-1 text-xs font-semibold",
                          hasRechargeEligiblePlan
                            ? "bg-healthy text-healthy-foreground"
                            : "bg-warning text-warning-foreground",
                        )}
                      >
                        {subscriptionStatusLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {createError ? (
                <p className="text-sm text-destructive-ink">{createError}</p>
              ) : null}

              {loadingPlans ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[--radius] border border-border bg-background text-center">
                  <Spinner className="h-6 w-6 animate-spin text-primary-ink" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {gateT("loading")}
                  </p>
                </div>
              ) : plansError ? (
                <div className="rounded-[--radius] border border-border bg-background p-5 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {gateT("errorTitle")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plansError}
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => {
                      void loadPlans();
                    }}
                    title={plansT("actions.retry")}
                    variant="outline-subtle"
                  />
                </div>
              ) : availablePlans.length > 0 ? (
                <PlanCatalogRail
                  labels={{
                    available: plansT("list.available"),
                    basePrice: plansT("list.basePrice"),
                    best: gateT("bestBadge"),
                    categoryNames: {
                      whatsapp: plansT("pricing.categories.whatsapp"),
                      sms: plansT("pricing.categories.sms"),
                      stt: plansT("pricing.categories.stt"),
                      tts: plansT("pricing.categories.tts"),
                      llm: plansT("pricing.categories.llm"),
                    },
                    messagesLabel: plansT("estimates.messagesLabel"),
                    serviceLabels: {
                      whatsapp: {
                        utility: plansT("estimates.serviceLabel.whatsapp.utility"),
                        marketing: plansT(
                          "estimates.serviceLabel.whatsapp.marketing",
                        ),
                        authentication: plansT(
                          "estimates.serviceLabel.whatsapp.authentication",
                        ),
                      },
                      sms: { standard: plansT("estimates.serviceLabel.sms.standard") },
                    },
                    current: plansT("list.current"),
                    noDescription: plansT("list.noDescription"),
                  }}
                  locale={locale}
                  plans={availablePlans}
                />
              ) : (
                <div className="rounded-[--radius] border border-dashed border-border bg-background px-4 py-10 text-center">
                  <Receipt
                    className="mx-auto h-8 w-8 text-muted-foreground"
                    weight="fill"
                  />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {gateT("emptyTitle")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {gateT("emptyDescription")}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="w-full rounded-[--radius] sm:w-auto"
                  link="/dashboard/plans"
                  newTab={false}
                  title={gateT("openCatalog")}
                  variant="primary"
                />
                <Button
                  className="w-full rounded-[--radius] sm:w-auto"
                  onClick={() => setCreateOpen(false)}
                  title={plansT("actions.close")}
                  variant="outline-subtle"
                />
              </div>
            </div>
          ) : !generatedInvoice ? (
            <div className="flex flex-col gap-5 pt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t("create.amountLabel")}
                </label>
                <input
                  type="number"
                  min="5"
                  step="0.01"
                  placeholder={t("create.amountPlaceholder")}
                  value={rechargeAmount}
                  onChange={(event) => setRechargeAmount(event.target.value)}
                  className={cn(
                    "h-12 rounded-[--radius] border border-border bg-background px-4 text-sm text-foreground",
                    "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary",
                    "transition-all",
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t("create.methodLabel")}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("pix")}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-[--radius] border p-4 transition-all",
                      paymentMethod === "pix"
                        ? "border-control-edge bg-muted text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/20",
                    )}
                  >
                    <PixLogo className="h-8 w-8" weight="duotone" />
                    <span className="text-sm font-medium">PIX</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("boleto")}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-[--radius] border p-4 transition-all",
                      paymentMethod === "boleto"
                        ? "border-control-edge bg-muted text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/20",
                    )}
                  >
                    <Barcode className="h-8 w-8" weight="duotone" />
                    <span className="text-sm font-medium">
                      {t("table.boleto")}
                    </span>
                  </button>
                </div>
              </div>

              {createError ? (
                <p className="text-sm text-destructive-ink">{createError}</p>
              ) : null}

              <Button
                variant="primary"
                size="lg"
                className="w-full rounded-[--radius]"
                disabled={
                  !rechargeAmount || Number(rechargeAmount) < 5 || generating
                }
                onClick={handleGenerate}
                icon={
                  generating ? (
                    <Spinner className="h-4 w-4 animate-spin" />
                  ) : undefined
                }
                iconVisible={generating}
                iconSide="left"
                title={
                  generating ? t("create.generating") : t("create.generate")
                }
              />
            </div>
          ) : (
            <div className="flex flex-col gap-5 pt-2">
              {generatedInvoice.billingType === "PIX" ? (
                <>
                  <div className="flex flex-col items-center gap-4">
                    {generatedInvoice.pixQrCode ? (
                      <img
                        src={`data:image/png;base64,${generatedInvoice.pixQrCode}`}
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
                      {t("create.scanQr")}
                    </p>
                  </div>

                  {generatedInvoice.pixCopy ? (
                    <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted p-3">
                      <code className="flex-1 truncate text-xs text-muted-foreground">
                        {generatedInvoice.pixCopy}
                      </code>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              generatedInvoice.pixCopy ?? "",
                            );
                            setPixCopied(true);
                            setTimeout(() => setPixCopied(false), 2000);
                          } catch {
                            // clipboard may not be available
                          }
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                  ) : null}
                </>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center gap-4">
                  {generatedInvoice.bankSlipUrl ? (
                    <div className="min-h-0 w-full flex-1 overflow-hidden rounded-[--radius] border border-border">
                      <iframe
                        src={generatedInvoice.bankSlipUrl}
                        className="h-full min-h-[300px] w-full"
                        title={t("create.viewBoleto")}
                      />
                    </div>
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center rounded-[--radius] border border-dashed border-border bg-muted">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Barcode className="h-12 w-12" weight="duotone" />
                        <span className="text-xs">
                          {t("create.boletoSuccess")}
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="text-center text-sm text-muted-foreground">
                    {t("create.boletoDescription")}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between rounded-[--radius] bg-muted px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {t("create.amountSummary")}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatBRL(generatedInvoice.amountBRL)}
                </span>
              </div>

              <Button
                variant="outline"
                size="lg"
                className="w-full rounded-[--radius]"
                onClick={() => {
                  setGeneratedInvoice(null);
                  setPixCopied(false);
                }}
                title={t("create.newInvoice")}
              />
            </div>
          )}
        </ElevatedDialogContent>
      </ElevatedDialog>

      <ElevatedDialog
        open={!!previewBoletoUrl}
        onOpenChange={(open) => !open && setPreviewBoletoUrl(null)}
      >
        <ElevatedDialogContent className="w-[95vw] max-w-[1100px] max-h-[90vh] overflow-y-auto">
          <ElevatedDialogHeader>
            <ElevatedDialogTitle>{t("table.viewBoleto")}</ElevatedDialogTitle>
            <ElevatedDialogDescription>
              {t("create.boletoDescription")}
            </ElevatedDialogDescription>
          </ElevatedDialogHeader>
          {previewBoletoUrl ? (
            <div className="w-full overflow-hidden rounded-[--radius] border border-border">
              <iframe
                src={previewBoletoUrl}
                className="h-[calc(90vh-10rem)] w-full"
                title={t("table.viewBoleto")}
              />
            </div>
          ) : null}
        </ElevatedDialogContent>
      </ElevatedDialog>

      <InvoiceDetailDialog
        invoice={detailInvoice}
        open={!!detailInvoice}
        onClose={() => setDetailInvoice(null)}
      />
    </main>
  );
}
