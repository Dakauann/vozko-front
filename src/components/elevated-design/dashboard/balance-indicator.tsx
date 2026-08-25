"use client";

import * as React from "react";

import { AnimatePresence, motion } from "framer-motion";
import type {
  BalanceSummary,
  FullBalanceSummary,
  ResourceBalance,
} from "@/lib/balance/types";
import {
  Barcode,
  CaretDown,
  Check,
  CopySimple,
  Eye,
  EyeClosedIcon,
  Package,
  PixLogo,
  Plus,
  Sparkle,
  Spinner,
} from "@/components/icons";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import {
  isCustomerDocumentRequiredError,
  isRechargeSubscriptionRequiredError,
  normalizeRechargeErrorMessage,
} from "@/lib/invoices/recharge-errors";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import Image from "next/image";
import type { Invoice } from "@/lib/invoices/types";
import { PlansCarousel } from "@/components/plans/plans-carousel";
import type { PublicExchangeRate } from "@/lib/pricing/types";
import type { PublicPlanDetails } from "@/lib/workspace-plan/types";
import { apiClient } from "@/lib/api/browser-client";
import { cn } from "@/lib/utils";
import { createInvoiceAction } from "@/app/actions/invoices";
import { listPublicPlansAction } from "@/app/actions/workspace-plan";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";

interface BalanceIndicatorProps {
  className?: string;
}

function formatBalance(balance: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(balance);
}

function normalizeBalanceSummary(
  apiResponse: FullBalanceSummary,
): BalanceSummary {
  const balance = apiResponse.balance;

  return {
    workspace_id: balance?.workspaceId ?? "",
    last_updated: balance?.updatedAt ?? new Date().toISOString(),
    balances: [
      {
        resource_type: "money",
        current_balance: (balance?.amount ?? 0) / 1_000_000, // USD micros to USD
        total_credited: (apiResponse.totalMoneyCredits ?? 0) / 1_000_000,
        total_debited: (apiResponse.totalMoneyDebits ?? 0) / 1_000_000,
      },
    ],
  };
}

function getSubscriptionStatusKey(
  status?: string | null,
): "active" | "cancelled" | "expired" | null {
  switch (status?.toLowerCase()) {
    case "active":
      return "active";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    default:
      return null;
  }
}

const MONEY_CONFIG = {
  badge: "R$",
  bgColor: "border border-border bg-muted",
};

function BalanceRow({
  balance,
  hidden,
  label,
  exchangeRate,
}: {
  balance: ResourceBalance;
  hidden: boolean;
  label: string;
  exchangeRate: number;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted transition-colors">
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-[--radius] text-foreground text-2xs font-semibold tracking-tight",
          MONEY_CONFIG.bgColor,
        )}
      >
        {MONEY_CONFIG.badge}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>

      <div className="text-right">
        <p className="text-sm font-semibold text-foreground tabular-nums">
          {hidden
            ? "*****"
            : formatBalance(balance.current_balance * exchangeRate)}
        </p>
      </div>
    </div>
  );
}

export function BalanceIndicator({ className }: BalanceIndicatorProps) {
  const t = useTranslations("balanceIndicator");
  const plansT = useTranslations("plansPage");
  const gateT = useTranslations("billingPlanGate");
  const locale = useLocale();
  const router = useRouter();
  const { can, currentWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [balanceSummary, setBalanceSummary] = useState<BalanceSummary | null>(
    null,
  );
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastJsonRef = useRef<string>("");
  const isFetchingRef = useRef(false);

  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "boleto">("pix");
  const [generating, setGenerating] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(
    null,
  );
  const [rechargeError, setRechargeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPlanCatalog, setShowPlanCatalog] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<PublicPlanDetails[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);

  const hasBalancePermission = can("balance", "read");
  const hasPlansPermission = can("plans", "read");
  const canContractPlan = can("plans", "create");
  const hasPermission = hasBalancePermission || hasPlansPermission;
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

  const openPlanCatalogDialog = useCallback(() => {
    setGeneratedInvoice(null);
    setRechargeError(null);
    setRechargeAmount("");
    setPaymentMethod("pix");
    setCopied(false);
    setShowPlanCatalog(true);
    void loadPlans();
    setRechargeOpen(true);
  }, [loadPlans]);

  const openRechargeDialog = useCallback(() => {
    setGeneratedInvoice(null);
    setRechargeError(null);
    setRechargeAmount("");
    setPaymentMethod("pix");
    setCopied(false);

    if (!hasRechargeEligiblePlan) {
      setShowPlanCatalog(true);
      void loadPlans();
    } else {
      setShowPlanCatalog(false);
    }

    setRechargeOpen(true);
  }, [hasRechargeEligiblePlan, loadPlans]);

  const handleRechargeDialogChange = useCallback((open: boolean) => {
    setRechargeOpen(open);
    if (open) {
      return;
    }

    setShowPlanCatalog(false);
    setRechargeError(null);
    setPlansError(null);
  }, []);

  const fetchBalance = useCallback(async () => {
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    try {
      const [balanceRes, exchangeRes] = await Promise.all([
        apiClient<FullBalanceSummary>("/user/balance", {
          method: "GET",
          cache: "no-store",
        }),
        apiClient<PublicExchangeRate>("/pricing/exchange-rate", {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      if (balanceRes.error || exchangeRes.error) return;

      if (exchangeRes.data) {
        setExchangeRate(exchangeRes.data.priceMicros / 1_000_000);
      }

      if (balanceRes.data) {
        const summary = normalizeBalanceSummary(balanceRes.data);
        const json = JSON.stringify(summary);
        if (json !== lastJsonRef.current) {
          lastJsonRef.current = json;
          setBalanceSummary(summary);
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Failed to fetch balance:", error);
      }
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasBalancePermission) return;

    fetchBalance();
  }, [hasBalancePermission, fetchBalance, currentWorkspace]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!hasPermission) return null;

  const moneyBalance = balanceSummary?.balances.find(
    (b) => b.resource_type === "money",
  );

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {/*
        A panel readout, not a boxed widget. This sits in a 48px bar beside the
        scope route, so it is a legend over a tabular figure — the amount is the
        only thing that should draw the eye, and it holds its width as it ticks.
        The old form (bordered card, amber R$ tile, coloured plan pill, solid
        accent button) outweighed every other element in the bar.
      */}
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-[--radius] px-1.5 py-1 transition-colors",
          isOpen ? "bg-muted" : "hover:bg-muted",
        )}
      >
        {isLoading ? (
          <Spinner className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              className="flex min-w-0 items-center gap-1.5 text-left"
            >
              {hasBalancePermission ? (
                // One line, value-first. A stacked legend over the figure put a
                // wide-tracked label above a short number in a 48px bar, which
                // made the label outweigh the thing it names; the accessible
                // name carries the label instead.
                <span
                  className="readout truncate text-sm font-semibold leading-none text-foreground"
                  title={t("moneyLabel")}
                >
                  {balanceVisible
                    ? moneyBalance
                      ? formatBalance(
                          moneyBalance.current_balance * (exchangeRate ?? 1),
                        )
                      : "R$ 0,00"
                    : "•••••"}
                </span>
              ) : (
                <Package
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  weight="regular"
                />
              )}

              {/* Plan state is a lamp dot plus a word, never colour alone. */}
              {hasPlansPermission && hasVisiblePlan ? (
                <span
                  className="rounded-[--radius] hidden max-w-[8rem] items-center gap-1 truncate border border-border px-1 py-px text-2xs font-medium text-muted-foreground md:inline-flex"
                  title={currentPlanName ?? undefined}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      hasRechargeEligiblePlan ? "bg-healthy" : "bg-primary",
                    )}
                  />
                  <span className="truncate">{currentPlanName}</span>
                </span>
              ) : hasPlansPermission && !hasVisiblePlan ? (
                <span className="rounded-[--radius] hidden items-center gap-1 border border-border px-1 py-px text-2xs font-medium text-muted-foreground md:inline-flex">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  />
                  {t("noPlan")}
                </span>
              ) : null}

              <CaretDown
                className={cn(
                  "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180",
                )}
                weight="bold"
              />
            </button>

            {hasBalancePermission ? (
              <button
                type="button"
                onClick={() => setBalanceVisible((v) => !v)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={
                  balanceVisible ? t("hideBalance") : t("showBalance")
                }
              >
                {balanceVisible ? (
                  <EyeClosedIcon className="h-3.5 w-3.5" weight="regular" />
                ) : (
                  <Eye className="h-3.5 w-3.5" weight="regular" />
                )}
              </button>
            ) : null}

            {(hasBalancePermission && hasRechargeEligiblePlan) ||
            (hasPlansPermission && canContractPlan) ? (
              <button
                type="button"
                onClick={
                  hasBalancePermission && hasRechargeEligiblePlan
                    ? openRechargeDialog
                    : openPlanCatalogDialog
                }
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[--radius] border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={
                  hasBalancePermission && hasRechargeEligiblePlan
                    ? t("actions.addFunds")
                    : gateT("openCatalog")
                }
              >
                {hasBalancePermission && hasRechargeEligiblePlan ? (
                  <Plus className="h-3.5 w-3.5" weight="bold" />
                ) : (
                  <Package className="h-3.5 w-3.5" weight="regular" />
                )}
              </button>
            ) : null}
          </>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-[--radius] border border-border bg-card shadow-xl"
          >
            {/* Header */}
            <div className="border-b border-border px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("title")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t("description")}
                  </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-2xs font-semibold text-foreground">
                  VX
                </div>
              </div>

              <div className="mt-3 rounded-[--radius] border border-border bg-background p-3">
                {!hasPlansPermission ? null : hasVisiblePlan ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius] border border-border bg-muted text-foreground">
                        <Package className="h-5 w-5" weight="fill" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xs font-semibold text-muted-foreground">
                          {t("workspacePlan.label")}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-foreground">
                          {currentPlanName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {hasRechargeEligiblePlan
                            ? t("workspacePlan.activeDescription")
                            : t("workspacePlan.inactiveDescription")}
                        </p>
                      </div>
                    </div>
                    {subscriptionStatusLabel ? (
                      <span
                        className={cn(
                          "rounded-[--radius] px-2.5 py-1 text-2xs font-semibold",
                          hasRechargeEligiblePlan
                            ? "bg-healthy text-healthy-foreground"
                            : "bg-warning text-warning-foreground",
                        )}
                      >
                        {subscriptionStatusLabel}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius] border border-border bg-muted text-foreground">
                        <Sparkle className="h-5 w-5" weight="fill" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {t("workspacePlan.noneTitle")}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t("workspacePlan.noneDescription")}
                        </p>
                      </div>
                    </div>

                    {canContractPlan ? (
                      <Button
                        className="w-full rounded-[--radius]"
                        onClick={() => {
                          setIsOpen(false);
                          openPlanCatalogDialog();
                        }}
                        title={gateT("openCatalog")}
                        variant="outline-subtle"
                      />
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            {hasBalancePermission ? (
              <div className="divide-y divide-slate-100">
                {balanceSummary?.balances.map((balance) => (
                  <BalanceRow
                    key={balance.resource_type}
                    balance={balance}
                    hidden={!balanceVisible}
                    label={t("moneyLabel")}
                    exchangeRate={exchangeRate ?? 1}
                  />
                ))}
              </div>
            ) : null}

            {hasBalancePermission ? (
              <div className="border-t border-border bg-muted px-4 py-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t("updatedAt")}:
                    {balanceSummary?.last_updated
                      ? new Date(balanceSummary.last_updated).toLocaleString(
                          locale === "pt" ? "pt-BR" : locale,
                          {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : "—"}
                  </span>
                  <Button
                    className="!min-h-0 min-w-0 !px-0 !py-0 text-xs font-medium text-primary-ink shadow-none hover:bg-transparent"
                    link="/dashboard/balance"
                    newTab={false}
                    title={t("actions.viewHistory")}
                    variant="ghost"
                  />
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      <ElevatedDialog
        open={rechargeOpen}
        onOpenChange={handleRechargeDialogChange}
      >
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
              {showPlanCatalog
                ? gateT("title")
                : generatedInvoice
                  ? plansT("dialog.invoiceReadyTitle")
                  : t("actions.addFunds")}
            </ElevatedDialogTitle>
            <ElevatedDialogDescription>
              {showPlanCatalog
                ? gateT("description")
                : generatedInvoice
                  ? plansT("dialog.invoiceReadyDescription")
                  : t("dialog.description")}
            </ElevatedDialogDescription>
          </ElevatedDialogHeader>

          {showPlanCatalog ? (
            <div className="flex flex-col gap-5 pt-2">
              {rechargeError ? (
                <p className="text-sm text-destructive-ink">{rechargeError}</p>
              ) : null}

              {loadingPlans ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[--radius] border border-border bg-muted text-center">
                  <Spinner className="h-6 w-6 animate-spin text-primary-ink" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {gateT("loading")}
                  </p>
                </div>
              ) : plansError ? (
                <div className="rounded-[--radius] border border-border bg-muted p-5 text-center">
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
                <PlansCarousel
                  plans={availablePlans}
                  currentPlanName={currentPlanName}
                  showBillingToggle={false}
                  onSelectPlan={() => {
                    setRechargeOpen(false);
                    router.push("/dashboard/plans");
                  }}
                />
              ) : (
                <div className="rounded-[--radius] border border-dashed border-border bg-muted px-4 py-10 text-center">
                  <Package
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

              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button
                  className="w-full rounded-[--radius] sm:w-auto"
                  onClick={() => {
                    setRechargeOpen(false);
                    router.push("/dashboard/plans");
                  }}
                  title={gateT("openCatalog")}
                  variant="primary"
                />
                <Button
                  className="w-full rounded-[--radius] sm:w-auto"
                  onClick={() => setRechargeOpen(false)}
                  title={plansT("actions.close")}
                  variant="outline-subtle"
                />
              </div>
            </div>
          ) : !generatedInvoice ? (
            <div className="flex flex-col gap-5 pt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t("dialog.amountLabel")}
                </label>
                <input
                  type="number"
                  min="5"
                  step="0.01"
                  placeholder={t("dialog.amountPlaceholder")}
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  className={cn(
                    "h-12 rounded-[--radius] border border-border bg-background px-4 text-sm text-foreground",
                    "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary",
                    "transition-all",
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t("dialog.methodLabel")}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("pix")}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-[--radius] border p-4 transition-colors",
                      paymentMethod === "pix"
                        ? "border-border-strong bg-muted text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/20",
                    )}
                  >
                    <PixLogo className="h-8 w-8" weight="duotone" />
                    <span className="text-sm font-medium">
                      {t("dialog.pixMethod")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("boleto")}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-[--radius] border p-4 transition-colors",
                      paymentMethod === "boleto"
                        ? "border-border-strong bg-muted text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/20",
                    )}
                  >
                    <Barcode className="h-8 w-8" weight="duotone" />
                    <span className="text-sm font-medium">
                      {t("dialog.boletoMethod")}
                    </span>
                  </button>
                </div>
              </div>

              {rechargeError && (
                <p className="text-sm text-destructive-ink">{rechargeError}</p>
              )}

              {/* Generate button */}
              <Button
                variant="primary"
                size="lg"
                className="w-full rounded-[--radius]"
                disabled={
                  !rechargeAmount || Number(rechargeAmount) < 5 || generating
                }
                onClick={async () => {
                  setGenerating(true);
                  setRechargeError(null);
                  const result = await createInvoiceAction({
                    amountBrl: Number(rechargeAmount),
                    billingType: paymentMethod === "pix" ? "PIX" : "BOLETO",
                  });
                  setGenerating(false);
                  if (result.error) {
                    setRechargeError(
                      normalizeRechargeErrorMessage(
                        result.error,
                        {
                          defaultMessage: gateT("defaultCreateError"),
                          subscriptionRequired: gateT("subscriptionRequired"),
                          documentRequired: gateT("documentRequired"),
                        },
                        result.errorCode,
                      ),
                    );
                    // Missing CPF/CNPJ is not a subscription problem, don't open the plan catalog;
                    // the normalized message already tells the user to add their document.
                    if (
                      !isCustomerDocumentRequiredError(
                        result.errorCode,
                        result.error,
                      ) &&
                      isRechargeSubscriptionRequiredError(result.error)
                    ) {
                      setShowPlanCatalog(true);
                      void loadPlans();
                    }
                  } else if (result.data?.invoice) {
                    setGeneratedInvoice(result.data.invoice);
                  }
                }}
                title={
                  !rechargeAmount || Number(rechargeAmount) < 5
                    ? t("dialog.minAmount")
                    : t("dialog.confirm")
                }
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="h-4 w-4 animate-spin" />
                    {t("dialog.generating")}
                  </span>
                ) : (
                  t("dialog.confirm")
                )}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-5 pt-2">
              {generatedInvoice.billingType === "PIX" ? (
                <>
                  <div className="flex flex-col items-center gap-4">
                    {generatedInvoice.pixQrCode ? (
                      <Image
                        src={`data:image/png;base64,${generatedInvoice.pixQrCode}`}
                        alt="PIX QR Code"
                        width={192}
                        height={192}
                        unoptimized
                        className="h-48 w-48 rounded-[--radius] border border-border"
                      />
                    ) : (
                      <div className="flex h-48 w-48 items-center justify-center rounded-[--radius] border border-dashed border-border bg-muted">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <PixLogo className="h-12 w-12" weight="duotone" />
                          <span className="text-xs">
                            {t("dialog.pixMethod")}
                          </span>
                        </div>
                      </div>
                    )}
                    <p className="text-center text-sm text-muted-foreground">
                      {t("dialog.scanQr")}
                    </p>
                  </div>

                  {generatedInvoice.pixCopy && (
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
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          } catch {
                            /* clipboard may not be available */
                          }
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        {copied ? (
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
                    {generatedInvoice.bankSlipUrl ? (
                      <div className="min-h-0 w-full flex-1 overflow-hidden rounded-[--radius] border border-border">
                        <iframe
                          src={generatedInvoice.bankSlipUrl}
                          className="h-full min-h-[300px] w-full"
                          title="Boleto"
                        />
                      </div>
                    ) : (
                      <div className="flex h-32 w-full items-center justify-center rounded-[--radius] border border-dashed border-border bg-muted">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Barcode className="h-12 w-12" weight="duotone" />
                          <span className="text-xs">
                            {t("dialog.boletoTitle")}
                          </span>
                        </div>
                      </div>
                    )}
                    <p className="text-center text-sm text-muted-foreground">
                      {generatedInvoice.bankSlipUrl
                        ? t("dialog.boletoDescription")
                        : t("dialog.boletoFallback")}
                    </p>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between rounded-[--radius] bg-muted px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {t("dialog.amountSummary")}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(generatedInvoice.amountBRL)}
                </span>
              </div>

              <Button
                variant="outline"
                size="lg"
                className="w-full rounded-[--radius]"
                onClick={() => {
                  setGeneratedInvoice(null);
                  setCopied(false);
                }}
                title={t("dialog.back")}
              />
            </div>
          )}
        </ElevatedDialogContent>
      </ElevatedDialog>
    </div>
  );
}
