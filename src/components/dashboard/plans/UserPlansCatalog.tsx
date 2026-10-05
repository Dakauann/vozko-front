"use client";

import * as React from "react";

import {
  Barcode,
  Brain,
  CalendarBlank,
  ChatCircle,
  Check,
  CircleNotch,
  CopySimple,
  CurrencyDollar,
  Microphone,
  Package,
  Phone,
  PixLogo,
  Receipt,
  SpeakerHigh,
  WhatsappLogo,
} from "@/components/icons";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { useLocale, useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import Button from "@/components/elevated-design/button";
import {
  AffiliateBrandChip,
  type AffiliateBrand,
} from "@/components/plans/plans-carousel";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PlanCard } from "@/components/plans/plan-card";
import { formatCentsAsBrl, formatMicrosToMoney } from "@/lib/format/money";
import {
  MONTHLY_INVOICE_DUE_DAY,
  PLAN_CATEGORY_ORDER,
  billableItems,
  featuredPlan,
  sortedPlans,
} from "@/lib/workspace-plan/catalog";
import { formatPricingServiceFallback } from "@/lib/branding/ai-models";
import type { Invoice } from "@/lib/invoices/types";
import type {
  PublicPlanDetails,
  PublicWorkspaceSubscriptionDetails,
} from "@/lib/workspace-plan/types";
import { cn } from "@/lib/utils";
import {
  estimateUsage,
  formatEstimateNumber,
} from "./plan-estimates";
import { motion } from "framer-motion";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/workspace-context";
import { isCustomerDocumentRequiredError } from "@/lib/invoices/recharge-errors";
import { getInvoiceAction } from "@/app/actions/invoices";
import { getExchangeRateAction } from "@/app/actions/pricing";
import {
  cancelWorkspaceSubscriptionAction,
  createSubscriptionInvoiceAction,
  getWorkspaceSubscriptionAction,
  listPublicPlansAction,
} from "@/app/actions/workspace-plan";

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatDateOnly(value: string | null | undefined, locale: string) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

const SEARCHABLE_PLAN_COUNT = 6;

interface PlansCatalogResponse {
  plans: PublicPlanDetails[];
  subscription: PublicWorkspaceSubscriptionDetails | null;
  exchangeRate: number | null;
  annualDiscountPct: number;
  affiliateBrand?: AffiliateBrand | null;
  error?: string | null;
}

interface SubscriptionInvoiceResponse {
  invoice: Invoice | null;
  error?: string | null;
  errorCode?: string | null;
}

interface SubscriptionCancelResponse {
  subscription: PublicWorkspaceSubscriptionDetails | null;
  error?: string | null;
}

interface InvoiceDetailsResponse {
  data: Invoice | null;
  error?: string | null;
}

async function fetchPlansCatalog(
  workspaceId: string,
): Promise<PlansCatalogResponse> {
  const [plansResult, subscriptionResult, exchangeRateResult] =
    await Promise.all([
      listPublicPlansAction(workspaceId),
      getWorkspaceSubscriptionAction(workspaceId),
      getExchangeRateAction(),
    ]);

  const error =
    plansResult.error ?? subscriptionResult.error ?? exchangeRateResult.error ?? null;

  return {
    plans: plansResult.plans,
    subscription: subscriptionResult.subscription ?? null,
    exchangeRate: exchangeRateResult.item
      ? exchangeRateResult.item.priceMicros / 1_000_000
      : null,
    annualDiscountPct: plansResult.annualDiscountPct ?? 0,
    affiliateBrand: plansResult.affiliateBrand ?? null,
    error,
  };
}

async function createSubscriptionInvoiceRequest(
  workspaceId: string,
  planId: string,
  billingType: "PIX" | "BOLETO",
  billingCycle: "monthly" | "annual" = "monthly",
): Promise<SubscriptionInvoiceResponse> {
  return createSubscriptionInvoiceAction(workspaceId, {
    planId,
    billingType,
    billingCycle,
  });
}

async function cancelSubscriptionRequest(
  workspaceId: string,
): Promise<SubscriptionCancelResponse> {
  return cancelWorkspaceSubscriptionAction(workspaceId);
}

async function fetchDashboardInvoice(
  invoiceId: string,
): Promise<InvoiceDetailsResponse> {
  return getInvoiceAction(invoiceId);
}

export default function UserPlansCatalog() {
  const t = useTranslations("plansPage");
  const locale = useLocale();
  const { toast } = useToast();
  const { currentWorkspace, can } = useWorkspace();

  const [plans, setPlans] = React.useState<PublicPlanDetails[]>([]);
  const [search, setSearch] = React.useState("");
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(
    null,
  );
  const [subscription, setSubscription] =
    React.useState<PublicWorkspaceSubscriptionDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<"PIX" | "BOLETO">(
    "PIX",
  );
  const [billingCycle, setBillingCycle] = React.useState<"monthly" | "annual">(
    "monthly",
  );
  const [creatingInvoice, setCreatingInvoice] = React.useState(false);
  const [invoiceError, setInvoiceError] = React.useState<string | null>(null);
  const [generatedInvoice, setGeneratedInvoice] =
    React.useState<Invoice | null>(null);
  const [pixCopied, setPixCopied] = React.useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = React.useState(false);
  const [exchangeRate, setExchangeRate] = React.useState<number>(6.0);
  const [annualDiscountPct, setAnnualDiscountPct] = React.useState<number>(0);
  const [affiliateBrand, setAffiliateBrand] =
    React.useState<AffiliateBrand | null>(null);
  const [cancellingSubscription, setCancellingSubscription] =
    React.useState(false);

  const canCreateBilling = can("plans", "create");
  const detailsRef = React.useRef<HTMLElement>(null);

  const loadData = React.useCallback(async () => {
    if (!currentWorkspace?.id) {
      setPlans([]);
      setSubscription(null);
      setSelectedPlanId(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchPlansCatalog(currentWorkspace.id);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.exchangeRate != null) {
        setExchangeRate(result.exchangeRate);
      }

      setAnnualDiscountPct(result.annualDiscountPct ?? 0);
      setAffiliateBrand(result.affiliateBrand ?? null);

      const nextPlans = result.plans;
      const nextSubscription = result.subscription;
      const lockedCurrentPlanId =
        nextSubscription?.subscription.status !== "expired"
          ? nextSubscription?.subscription.planDefinitionId
          : null;

      setPlans(nextPlans);
      setSubscription(nextSubscription);
      setSelectedPlanId((current) => {
        if (current && nextPlans.some((plan) => plan.plan.id === current)) {
          return current;
        }
        if (
          lockedCurrentPlanId &&
          nextPlans.some((plan) => plan.plan.id === lockedCurrentPlanId)
        ) {
          return lockedCurrentPlanId;
        }
        return nextPlans[0]?.plan.id ?? null;
      });
    } catch {
      setError(t("error.default"));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, t]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (
      !dialogOpen ||
      !generatedInvoice ||
      generatedInvoice.status !== "PENDING"
    ) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      const result = await fetchDashboardInvoice(generatedInvoice.id);
      if (cancelled || !result.data) {
        return;
      }

      setGeneratedInvoice(result.data);
      if (result.data.status === "PAID") {
        setPaymentConfirmed(true);
        toast({ title: t("toast.paymentConfirmed") });
        void loadData();
      }
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [dialogOpen, generatedInvoice, loadData, t, toast]);

  const featured = React.useMemo(() => featuredPlan(plans), [plans]);

  const filteredPlans = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const ordered = sortedPlans(plans);
    if (!query) {
      return ordered;
    }

    return ordered.filter((item) => {
      const haystack =
        `${item.plan.name} ${item.plan.description}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [plans, search]);

  const currentSubscription = subscription?.subscription ?? null;
  const currentPlan = subscription?.plan ?? null;
  const hasCurrentSubscription =
    currentSubscription != null && currentSubscription.status === "active";
  const canCancelSubscription =
    currentWorkspace != null &&
    currentSubscription?.status === "active" &&
    canCreateBilling;
  const currentPlanId = hasCurrentSubscription
    ? currentSubscription.planDefinitionId
    : null;

  const selectedPlan = React.useMemo(() => {
    if (!plans.length) {
      return null;
    }

    return (
      plans.find((item) => item.plan.id === selectedPlanId) ?? plans[0] ?? null
    );
  }, [plans, selectedPlanId]);

  const selectedIsCurrentPlan = Boolean(
    selectedPlan && currentPlanId === selectedPlan.plan.id,
  );
  const selectedPlanBillableCount = billableItems(
    selectedPlan?.plan.pricingItems,
  ).length;

  const contractStateFor = React.useCallback(
    (item: PublicPlanDetails) => {
      const isCurrent = currentPlanId === item.plan.id;
      const isUpgrade = Boolean(
        hasCurrentSubscription &&
          !isCurrent &&
          currentPlan &&
          item.plan.basePriceBRLCents > currentPlan.basePriceBRLCents,
      );
      const isDowngrade = Boolean(
        hasCurrentSubscription &&
          !isCurrent &&
          currentPlan &&
          item.plan.basePriceBRLCents <= currentPlan.basePriceBRLCents,
      );
      const locked = isCurrent || (hasCurrentSubscription && !isUpgrade);

      return {
        isCurrent,
        locked,
        disabled: locked || !canCreateBilling,
        title: isCurrent
          ? t("actions.currentPlan")
          : isUpgrade
            ? t("actions.upgrade")
            : isDowngrade
              ? t("actions.downgradeBlocked")
              : !canCreateBilling
                ? t("actions.noPermission")
                : t("actions.contract"),
      };
    },
    [canCreateBilling, currentPlan, currentPlanId, hasCurrentSubscription, t],
  );

  const lampTone = !currentSubscription
    ? null
    : currentSubscription.status === "active"
      ? "var(--healthy)"
      : currentSubscription.status === "cancelled"
        ? "var(--warning)"
        : null;

  const handleDialogChange = React.useCallback((open: boolean) => {
    setDialogOpen(open);
    if (open) {
      return;
    }

    setPaymentMethod("PIX");
    setBillingCycle("monthly");
    setCreatingInvoice(false);
    setInvoiceError(null);
    setGeneratedInvoice(null);
    setPixCopied(false);
    setPaymentConfirmed(false);
  }, []);

  const handleContract = React.useCallback(
    (planId: string) => {
      setSelectedPlanId(planId);
      handleDialogChange(true);
    },
    [handleDialogChange],
  );

  const handleCreateInvoice = React.useCallback(async () => {
    if (!currentWorkspace?.id || !selectedPlan) {
      return;
    }

    setCreatingInvoice(true);
    setInvoiceError(null);

    const result = await createSubscriptionInvoiceRequest(
      currentWorkspace.id,
      selectedPlan.plan.id,
      paymentMethod,
      billingCycle,
    );

    setCreatingInvoice(false);

    if (result.error || !result.invoice) {
      if (isCustomerDocumentRequiredError(result.errorCode, result.error)) {
        setInvoiceError(t("dialog.documentRequired"));
      } else {
        setInvoiceError(result.error ?? t("dialog.createError"));
      }
      return;
    }

    setGeneratedInvoice(result.invoice);
    toast({ title: t("toast.invoiceCreated") });
  }, [
    currentWorkspace?.id,
    paymentMethod,
    billingCycle,
    selectedPlan,
    t,
    toast,
  ]);

  const handleCancelSubscription = React.useCallback(async () => {
    if (!currentWorkspace?.id || !currentSubscription || !currentPlan) {
      return;
    }

    const confirmed = window.confirm(
      t("subscription.cancelConfirm", { name: currentPlan.name }),
    );
    if (!confirmed) {
      return;
    }

    setCancellingSubscription(true);
    const result = await cancelSubscriptionRequest(currentWorkspace.id);
    setCancellingSubscription(false);

    if (result.error) {
      toast({
        title: result.error ?? t("toast.cancelError"),
        variant: "destructive",
      });
      return;
    }

    toast({ title: t("toast.cancelSuccess") });
    await loadData();
  }, [
    currentPlan,
    currentSubscription,
    currentWorkspace?.id,
    loadData,
    t,
    toast,
  ]);

  const handleCopyPix = React.useCallback(async () => {
    if (!generatedInvoice?.pixCopy) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedInvoice.pixCopy);
      setPixCopied(true);
      toast({ title: t("toast.pixCopied") });
      window.setTimeout(() => setPixCopied(false), 2000);
    } catch {
      toast({ title: t("toast.copyFailed"), variant: "destructive" });
    }
  }, [generatedInvoice?.pixCopy, t, toast]);

  const subscriptionDescription = currentSubscription
    ? currentSubscription.status === "cancelled"
      ? t("subscription.cancelledDescription", {
          date: formatDate(currentSubscription.currentPeriodEnd, locale),
        })
      : currentSubscription.status === "expired"
        ? t("subscription.expiredDescription")
        : t("subscription.description")
    : t("subscription.noneDescription");

  if (loading) {
    return <ScreenLoader fit="screen" label={t("loading")} />;
  }

  if (!currentWorkspace) {
    return (
      <div
        className="mx-auto mt-8 max-w-2xl rounded-[--radius] border border-border bg-card p-12 text-center"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <Package
          className="mx-auto mb-4 h-12 w-12 text-muted-foreground"
          weight="fill"
        />
        <p className="font-semibold text-foreground">
          {t("emptyWorkspace.title")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("emptyWorkspace.description")}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="mx-auto mt-8 max-w-2xl rounded-[--radius] border border-border bg-card p-12 text-center"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <Package
          className="mx-auto mb-4 h-12 w-12 text-destructive-ink"
          weight="fill"
        />
        <p className="font-semibold text-foreground">{t("error.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button
          className="mt-4"
          onClick={() => loadData()}
          title={t("actions.retry")}
          variant="outline"
        />
      </div>
    );
  }

  return (
    <>
      <motion.main
        animate={{ opacity: 1 }}
        className="w-full space-y-4"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          animate={{ opacity: 1 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <DashboardPageHeader
            actions={
              <Button
                icon={<Receipt className="h-4 w-4" weight="bold" />}
                iconVisible
                link="/dashboard/invoices"
                newTab={false}
                title={t("actions.openInvoices")}
                variant="outline"
              />
            }
            badge={t("header.badge")}
            description={t("header.description")}
            icon={<Package className="h-6 w-6" weight="fill" />}
          />
        </motion.div>

        <section aria-labelledby="your-plan" className="well">
          <div className="flex flex-col gap-x-10 gap-y-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="legend">{t("subscription.badge")}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <h2 id="your-plan" className="truncate font-display text-xl font-semibold text-foreground">
                  {currentPlan?.name ?? t("subscription.noneTitle")}
                </h2>
                {currentSubscription ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-2xs font-semibold text-foreground">
                    <span
                      aria-hidden
                      className={cn("lamp", !lampTone && "opacity-30")}
                      style={lampTone ? { background: `hsl(${lampTone})` } : undefined}
                    />
                    {t(`status.${currentSubscription.status}`)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 max-w-[62ch] text-sm leading-snug text-muted-foreground">
                {subscriptionDescription}
              </p>
            </div>

            {currentSubscription ? (
              <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
                <dl className="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3">
                  <div>
                    <dt className="legend">{t("subscription.basePrice")}</dt>
                    <dd className="readout mt-1.5 whitespace-nowrap text-sm font-semibold text-foreground">
                      {formatCentsAsBrl(currentPlan?.basePriceBRLCents ?? 0, locale)}
                      <span className="font-normal text-muted-foreground">{t("detail.perMonth")}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="legend">{t("subscription.invoice")}</dt>
                    <dd className="mt-1.5 whitespace-nowrap text-sm text-foreground">
                      {t("subscription.invoiceDay", { day: MONTHLY_INVOICE_DUE_DAY })}
                    </dd>
                  </div>
                  <div>
                    <dt className="legend">
                      {currentSubscription.status === "active"
                        ? t("subscription.periodEnds")
                        : t("subscription.accessUntil")}
                    </dt>
                    <dd className="readout mt-1.5 whitespace-nowrap text-sm text-foreground">
                      {formatDateOnly(currentSubscription.currentPeriodEnd, locale)}
                    </dd>
                  </div>
                </dl>

                {canCancelSubscription ? (
                  <Button
                    disabled={cancellingSubscription}
                    onClick={() => {
                      void handleCancelSubscription();
                    }}
                    title={
                      cancellingSubscription
                        ? t("actions.cancelling")
                        : t("actions.cancelSubscription")
                    }
                    variant="outline"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="available-plans" className="space-y-4 pt-2">
          <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div>
              <h2 id="available-plans" className="font-display text-lg font-semibold text-foreground">
                {hasCurrentSubscription ? t("list.changeTitle") : t("list.chooseTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasCurrentSubscription ? t("list.changeDescription") : t("list.chooseDescription")}
              </p>
            </div>
            {plans.length > SEARCHABLE_PLAN_COUNT ? (
              <input
                aria-label={t("filters.search")}
                className="h-8 w-full rounded-[--radius] border border-control-edge bg-card px-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:w-60"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("filters.search")}
                type="search"
                value={search}
              />
            ) : null}
          </header>

          {filteredPlans.length === 0 ? (
            <div className="well px-4 py-16 text-center">
              <p className="text-sm font-semibold text-foreground">
                {t("empty.title")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("empty.description")}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),23rem))]">
              {filteredPlans.map((item) => {
                const state = contractStateFor(item);
                const isSelected = item.plan.id === selectedPlan?.plan.id;
                return (
                  <PlanCard
                    key={item.plan.id}
                    plan={item.plan}
                    locale={locale}
                    featured={featured?.planId === item.plan.id ? featured.kind : null}
                    current={state.isCurrent}
                    selected={isSelected}
                    onShowDetails={
                      billableItems(item.plan.pricingItems).length > 0
                        ? () => {
                            setSelectedPlanId(item.plan.id);
                            detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }
                        : undefined
                    }
                    brand={
                      item.plan.exclusiveAffiliateId && affiliateBrand ? (
                        <AffiliateBrandChip brand={affiliateBrand} />
                      ) : undefined
                    }
                    action={
                      <Button
                        className="w-full"
                        disabled={state.disabled}
                        icon={
                          creatingInvoice && isSelected ? (
                            <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
                          ) : undefined
                        }
                        iconVisible={creatingInvoice && isSelected}
                        onClick={() => handleContract(item.plan.id)}
                        title={state.title}
                        variant={state.disabled ? "outline" : featured?.planId === item.plan.id ? "primary" : "secondary"}
                      />
                    }
                  />
                );
              })}
            </div>
          )}
        </section>

        {selectedPlan && selectedPlanBillableCount > 0 ? (
          <section ref={detailsRef} aria-labelledby="plan-prices" className="well scroll-mt-6">
            <header className="rule-engraved px-5 py-4">
              <h2 id="plan-prices" className="font-display text-lg font-semibold text-foreground">
                {t("detail.title", { plan: selectedPlan.plan.name })}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedIsCurrentPlan ? t("detail.currentDescription") : t("detail.availableDescription")}
              </p>
            </header>

            <div className="space-y-8 px-5 py-6">
              <PlanEstimatesPanel
                basePriceBRLCents={selectedPlan.plan.basePriceBRLCents}
                items={selectedPlan.plan.pricingItems ?? []}
                exchangeRate={exchangeRate}
                locale={locale}
                t={t}
              />
              <PlanPricingTable
                items={selectedPlan.plan.pricingItems ?? []}
                exchangeRate={exchangeRate}
                locale={locale}
                t={t}
              />
            </div>
          </section>
        ) : null}
      </motion.main>

      <ElevatedDialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <ElevatedDialogContent
          className={cn(
            "w-[95vw] overflow-y-auto",
            generatedInvoice?.billingType === "BOLETO"
              ? "max-w-[1100px] max-h-[90vh]"
              : "max-w-[560px]",
          )}
        >
          <ElevatedDialogHeader>
            <ElevatedDialogTitle>
              {generatedInvoice
                ? t("dialog.invoiceReadyTitle")
                : t("dialog.title")}
            </ElevatedDialogTitle>
            <ElevatedDialogDescription>
              {generatedInvoice
                ? t("dialog.invoiceReadyDescription")
                : t("dialog.description")}
            </ElevatedDialogDescription>
          </ElevatedDialogHeader>

          {generatedInvoice ? (
            <div className="space-y-4">
              {paymentConfirmed ? (
                <div className="rounded-[--radius] border border-border bg-muted/90 px-4 py-3 text-sm text-healthy-ink">
                  <p className="font-medium">
                    {t("dialog.paymentConfirmedTitle")}
                  </p>
                  <p className="mt-1 text-xs text-healthy-ink">
                    {t("dialog.paymentConfirmedDescription")}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[--radius] border border-border bg-background p-4">
                  <p className="text-2xs font-semibold text-muted-foreground">
                    {t("dialog.amount")}
                  </p>
                  <p className="mt-2 font-display text-xl font-semibold text-foreground">
                    {formatCentsAsBrl(
                      Math.round(generatedInvoice.amountBRL * 100),
                      locale,
                    )}
                  </p>
                </div>
                <div className="rounded-[--radius] border border-border bg-background p-4">
                  <p className="text-2xs font-semibold text-muted-foreground">
                    {t("dialog.method")}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {generatedInvoice.billingType}
                  </p>
                </div>
              </div>

              <div className="rounded-[--radius] border border-border bg-background p-4">
                <p className="text-2xs font-semibold text-muted-foreground">
                  {t("dialog.status")}
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {paymentConfirmed ? t("dialog.paid") : t("dialog.pending")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("dialog.pendingHint")}
                </p>
              </div>

              {generatedInvoice.billingType === "PIX" ? (
                <div className="space-y-4 rounded-[--radius] border border-border bg-background p-4">
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

                  {generatedInvoice.pixCopy ? (
                    <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted p-3">
                      <code className="flex-1 truncate text-xs text-muted-foreground">
                        {generatedInvoice.pixCopy}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {pixCopied ? (
                          <Check
                            className="h-4 w-4 text-healthy-ink"
                            weight="bold"
                          />
                        ) : (
                          <CopySimple className="h-4 w-4" weight="bold" />
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {generatedInvoice.billingType === "BOLETO" ? (
                <div className="space-y-4 rounded-[--radius] border border-border bg-background p-4">
                  <div className="flex min-h-0 flex-1 flex-col items-center gap-4">
                    {generatedInvoice.bankSlipUrl ? (
                      <div className="min-h-0 w-full flex-1 overflow-hidden rounded-[--radius] border border-border">
                        <iframe
                          src={generatedInvoice.bankSlipUrl}
                          className="h-full min-h-[420px] w-full"
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

                  {generatedInvoice.bankSlipUrl ? (
                    <Button
                      icon={<Barcode className="h-4 w-4" weight="bold" />}
                      iconVisible
                      link={generatedInvoice.bankSlipUrl}
                      title={t("dialog.openBoleto")}
                      variant="outline"
                    />
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  icon={<Receipt className="h-4 w-4" weight="bold" />}
                  iconVisible
                  link="/dashboard/invoices"
                  newTab={false}
                  title={t("actions.openInvoices")}
                  variant="outline"
                />
                <Button
                  onClick={() => handleDialogChange(false)}
                  title={t("actions.close")}
                  variant="outline"
                />
              </div>
            </div>
          ) : (
            (() => {
              const baseCents = selectedPlan?.plan.basePriceBRLCents ?? 0;
              const isAnnual = billingCycle === "annual";
              const periodMonths = isAnnual ? 12 : 1;
              const totalCentsNoDiscount = baseCents * periodMonths;
              const hasDiscount = isAnnual && annualDiscountPct > 0;
              const totalCents = hasDiscount
                ? Math.round(
                    (totalCentsNoDiscount * (100 - annualDiscountPct)) / 100,
                  )
                : totalCentsNoDiscount;

              return (
                <div className="space-y-5">
                  {}
                  <div className="rounded-[--radius] border border-border bg-background p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-primary-ink">
                          {selectedPlan?.plan.name ?? t("detail.emptyTitle")}
                        </p>
                        <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                          {selectedPlan?.plan.description ||
                            t("detail.emptyDescription")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display text-lg font-semibold text-foreground tabular-nums">
                          {formatCentsAsBrl(baseCents, locale)}
                        </p>
                        <p className="text-2xs text-muted-foreground">
                          {t("detail.perMonth")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {}
                  <div className="space-y-2.5">
                    <p className="text-sm font-medium text-foreground">
                      {t("dialog.billingCycleTitle")}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          value: "monthly" as const,
                          title: t("dialog.monthly"),
                          description: t("dialog.monthlyDescription"),
                          icon: (
                            <CalendarBlank
                              className="h-5 w-5"
                              weight="bold"
                            />
                          ),
                          bg: "tile-3",
                        },
                        {
                          value: "annual" as const,
                          title:
                            annualDiscountPct > 0
                              ? t("dialog.annualWithDiscount", {
                                  discount: String(annualDiscountPct),
                                })
                              : t("dialog.annual"),
                          description:
                            annualDiscountPct > 0
                              ? t("dialog.annualDescriptionWithDiscount", {
                                  discount: String(annualDiscountPct),
                                })
                              : t("dialog.annualDescription"),
                          icon: (
                            <CalendarBlank
                              className="h-5 w-5"
                              weight="fill"
                            />
                          ),
                          bg: "tile-3",
                        },
                      ].map((option) => (
                        <button
                          key={option.value}
                          className={cn(
                            "rounded-[--radius] border p-4 text-left transition-all",
                            billingCycle === option.value
                              ? "border-primary bg-muted"
                              : "border-border bg-background hover:border-primary/30",
                          )}
                          onClick={() => setBillingCycle(option.value)}
                          type="button"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius]",
                                option.bg,
                              )}
                            >
                              {option.icon}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {option.title}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {option.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {}
                  <div className="space-y-2.5">
                    <p className="text-sm font-medium text-foreground">
                      {t("dialog.methodTitle")}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          value: "PIX" as const,
                          title: t("dialog.pixMethod"),
                          description: t("dialog.pixMethodDescription"),
                          icon: (
                            <PixLogo
                              className="h-5 w-5"
                              weight="fill"
                            />
                          ),
                          bg: "bg-healthy",
                        },
                        {
                          value: "BOLETO" as const,
                          title: t("dialog.boletoMethod"),
                          description: t("dialog.boletoMethodDescription"),
                          icon: (
                            <Barcode
                              className="h-5 w-5"
                              weight="bold"
                            />
                          ),
                          bg: "bg-warning",
                        },
                      ].map((method) => (
                        <button
                          key={method.value}
                          className={cn(
                            "rounded-[--radius] border p-4 text-left transition-all",
                            paymentMethod === method.value
                              ? "border-primary bg-muted"
                              : "border-border bg-background hover:border-primary/30",
                          )}
                          onClick={() => setPaymentMethod(method.value)}
                          type="button"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius]",
                                method.bg,
                              )}
                            >
                              {method.icon}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {method.title}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {method.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {}
                  <div className="rounded-[--radius] border border-border bg-muted p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {t("dialog.orderSummary")}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {selectedPlan?.plan.name} × {periodMonths}{" "}
                        {periodMonths === 1
                          ? t("dialog.monthSingular")
                          : t("dialog.monthPlural")}
                      </span>
                      <span className="font-medium tabular-nums text-foreground">
                        {formatCentsAsBrl(totalCentsNoDiscount, locale)}
                      </span>
                    </div>
                    {hasDiscount && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-healthy-ink">
                          {t("dialog.discountLabel", {
                            discount: String(annualDiscountPct),
                          })}
                        </span>
                        <span className="font-medium tabular-nums text-healthy-ink">
                          -
                          {formatCentsAsBrl(
                            totalCentsNoDiscount - totalCents,
                            locale,
                          )}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-border pt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">
                        {t("dialog.totalLabel")}
                      </span>
                      <span className="font-display text-lg font-semibold tabular-nums text-foreground">
                        {formatCentsAsBrl(totalCents, locale)}
                      </span>
                    </div>
                  </div>

                  <p className="rounded-[--radius] bg-muted px-4 py-3 text-2xs leading-relaxed text-muted-foreground">
                    {isAnnual
                      ? t("dialog.scheduleNoteAnnual")
                      : t("dialog.scheduleNoteMonthly", { day: MONTHLY_INVOICE_DUE_DAY })}
                  </p>

                  {invoiceError ? (
                    <div className="rounded-[--radius] border border-destructive bg-destructive px-4 py-3 text-sm text-destructive-foreground">
                      {invoiceError}
                    </div>
                  ) : null}

                  <div className="flex items-center gap-3">
                    <Button
                      disabled={!selectedPlan || creatingInvoice}
                      icon={
                        creatingInvoice ? (
                          <CircleNotch
                            className="h-4 w-4 animate-spin"
                            weight="bold"
                          />
                        ) : (
                          <CurrencyDollar className="h-4 w-4" weight="bold" />
                        )
                      }
                      iconVisible
                      onClick={handleCreateInvoice}
                      title={t("dialog.confirm")}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => handleDialogChange(false)}
                      title={t("actions.close")}
                      variant="outline"
                    />
                  </div>
                </div>
              );
            })()
          )}
        </ElevatedDialogContent>
      </ElevatedDialog>
    </>
  );
}



const CATEGORY_INK: Record<string, { ink: string; glyph: React.ReactNode }> = {
  whatsapp: { ink: "ink-2", glyph: <WhatsappLogo className="h-3.5 w-3.5" /> },
  telephony: { ink: "ink-4", glyph: <Phone className="h-3.5 w-3.5" /> },
  sms: { ink: "ink-1", glyph: <ChatCircle className="h-3.5 w-3.5" /> },
  stt: { ink: "ink-4", glyph: <Microphone className="h-3.5 w-3.5" /> },
  tts: { ink: "ink-5", glyph: <SpeakerHigh className="h-3.5 w-3.5" /> },
  llm: { ink: "ink-3", glyph: <Brain className="h-3.5 w-3.5" /> },
};

export function CategoryMark({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const config = CATEGORY_INK[category];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        config?.ink ?? "text-muted-foreground",
        className,
      )}
    >
      {config?.glyph ?? <Package className="h-3.5 w-3.5" />}
    </span>
  );
}

type PlansTranslate = ReturnType<typeof useTranslations<"plansPage">>;

function translatedOr(t: PlansTranslate, key: string, fallback: string): string {
  const typed = key as Parameters<PlansTranslate>[0];
  return t.has(typed) ? t(typed) : fallback;
}

interface PricedItem {
  category: string;
  service: string;
  metric: string;
  priceMicros: number;
  markupPct?: number;
  currency: string;
}

function priceLabel(item: PricedItem, exchangeRate: number, locale: string, t: PlansTranslate): string {
  if (item.metric === "percentage") {
    const percent = Math.round((item.markupPct ?? 0) * 100);
    return percent > 0 ? t("pricing.markup", { percent }) : t("pricing.atCost");
  }
  if (item.priceMicros === 0) {
    return t("pricing.free");
  }
  return formatMicrosToMoney(item.priceMicros, exchangeRate, locale);
}

export function PlanPricingTable({
  items,
  exchangeRate,
  locale,
  t,
}: {
  items: PricedItem[];
  exchangeRate: number;
  locale: string;
  t: PlansTranslate;
}) {
  const grouped = React.useMemo(() => {
    const groups = new Map<string, PricedItem[]>();
    for (const item of billableItems(items)) {
      groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
    }
    return [...groups.entries()].sort(
      (a, b) => (PLAN_CATEGORY_ORDER[a[0]] ?? 99) - (PLAN_CATEGORY_ORDER[b[0]] ?? 99),
    );
  }, [items]);

  if (grouped.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{t("pricing.title")}</h3>
      <p className="mt-1 max-w-[74ch] text-sm leading-snug text-muted-foreground">
        {t("pricing.description")}
      </p>

      <div className="-mx-1 mt-3 overflow-x-auto px-1">
        <table className="w-full min-w-[440px] border-collapse text-left">
          <thead>
            <tr className="rule-engraved">
              <th className="legend py-2 pr-3 font-semibold" scope="col">
                {t("pricing.columns.service")}
              </th>
              <th className="legend px-3 py-2 font-semibold" scope="col">
                {t("pricing.columns.metric")}
              </th>
              <th className="legend py-2 pl-3 text-right font-semibold" scope="col">
                {t("pricing.columns.price")}
              </th>
            </tr>
          </thead>

          {grouped.map(([category, categoryItems]) => {
            const description = translatedOr(t, `pricing.categoryDescriptions.${category}`, "");
            return (
              <tbody key={category}>
                <tr>
                  <th className="pb-1.5 pt-5 font-normal" colSpan={3} scope="colgroup">
                    <span className="flex items-center gap-2">
                      <CategoryMark category={category} />
                      <span className="text-sm font-semibold text-foreground">
                        {translatedOr(t, `pricing.categories.${category}`, category)}
                      </span>
                      <span aria-hidden className="h-px min-w-4 flex-1 bg-border" />
                    </span>
                    {description ? (
                      <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
                    ) : null}
                  </th>
                </tr>

                {[...categoryItems]
                  .sort((a, b) => b.priceMicros - a.priceMicros || a.service.localeCompare(b.service))
                  .map((item) => (
                    <tr key={`${item.service}-${item.metric}`} className="border-b border-border last:border-b-0">
                      <th className="py-2.5 pr-3 text-sm font-medium text-foreground" scope="row">
                        {translatedOr(t, `pricing.services.${item.service}`, formatPricingServiceFallback(item.service))}
                      </th>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {translatedOr(t, `pricing.metrics.${item.metric}`, item.metric)}
                      </td>
                      <td className="readout py-2.5 pl-3 text-right text-sm font-semibold text-foreground">
                        {priceLabel(item, exchangeRate, locale, t)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            );
          })}
        </table>
      </div>

      <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
        {t("pricing.exchangeRateHint", {
          rate: formatMicrosToMoney(1_000_000, exchangeRate, locale),
        })}
      </p>
    </div>
  );
}

export function PlanEstimatesPanel({
  basePriceBRLCents,
  items,
  exchangeRate,
  locale,
  t,
}: {
  basePriceBRLCents: number;
  items: {
    category: string;
    service: string;
    metric: string;
    priceMicros: number;
  }[];
  exchangeRate: number;
  locale: string;
  t: PlansTranslate;
}) {
  const estimates = React.useMemo(
    () => estimateUsage(basePriceBRLCents, items, exchangeRate),
    [basePriceBRLCents, items, exchangeRate],
  );

  if (estimates.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">
        {t("estimates.title", { amount: formatCentsAsBrl(basePriceBRLCents, locale) })}
      </h3>
      <p className="mt-1 max-w-[74ch] text-sm leading-snug text-muted-foreground">
        {t("estimates.description")}
      </p>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {estimates.map((est) => (
          <div
            key={`${est.category}-${est.service}`}
            className="flex flex-col-reverse rounded-[--radius] border border-border bg-card px-4 py-3.5"
          >
            <dt className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <CategoryMark category={est.category} />
              <span className="truncate">
                {translatedOr(
                  t,
                  `estimates.serviceLabel.${est.category}.${est.service}`,
                  translatedOr(t, `pricing.services.${est.service}`, est.service),
                )}
              </span>
            </dt>
            <dd className="readout flex items-baseline gap-1.5 font-display text-2xl font-semibold text-foreground">
              {t("estimates.approximately", { count: formatEstimateNumber(est.count, locale) })}
              <span className="text-xs font-normal text-muted-foreground">
                {est.unit === "minutes" ? t("estimates.minutesLabel") : t("estimates.messagesLabel")}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
