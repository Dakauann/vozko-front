"use client";

import * as React from "react";

import {
  ArrowsClockwise,
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
  PixLogo,
  Receipt,
  ShieldCheck,
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

import Button from "@/components/elevated-design/button";
import {
  AffiliateBrandChip,
  type AffiliateBrand,
} from "@/components/plans/plans-carousel";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { formatPricingServiceFallback } from "@/lib/branding/ai-models";
import type { Invoice } from "@/lib/invoices/types";
import type {
  PublicPlanDetails,
  PublicWorkspaceSubscriptionDetails,
} from "@/lib/workspace-plan/types";
import { cn } from "@/lib/utils";
import {
  estimateMessagesByType,
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

// Date without the time, for prose where "31 de dez. de 2027, 23:59" would read awkwardly (e.g. the
// renewal summary). The subscription's own currentPeriodEnd is the single source of truth for when it
// renews, so the copy quotes it directly rather than asserting a fixed calendar day.
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

function formatBRLFromCents(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}


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
  const pricingT = useTranslations("pricing");
  const locale = useLocale();
  const { toast } = useToast();
  const { currentWorkspace, can, permissionsLoading } = useWorkspace();

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

  const canReadPlans = can("plans", "read");
  const canCreateBilling = can("plans", "create");

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

  const orderedPlans = React.useMemo(() => {
    const sorted = plans
      .filter((p) => !p.plan.archivedAt)
      .sort((a, b) => a.plan.basePriceBRLCents - b.plan.basePriceBRLCents);
    if (sorted.length <= 1) return sorted;

    const exclusiveIdx = sorted.findIndex((p) => !!p.plan.exclusiveAffiliateId);
    const featuredIdx =
      exclusiveIdx >= 0
        ? exclusiveIdx
        : sorted.length === 2
          ? 1
          : Math.floor(sorted.length / 2);

    if (featuredIdx <= 0) return sorted;
    const featured = sorted[featuredIdx];
    return [featured, ...sorted.filter((_, i) => i !== featuredIdx)];
  }, [plans]);

  const featuredPlanId = React.useMemo(() => {
    if (orderedPlans.length === 0) return null;
    return orderedPlans.length > 1 ? orderedPlans[0].plan.id : null;
  }, [orderedPlans]);

  const featuredLabelKey: "exclusive" | "popular" | null = React.useMemo(() => {
    if (!featuredPlanId) return null;
    const featured = orderedPlans.find((p) => p.plan.id === featuredPlanId);
    if (!featured) return null;
    return featured.plan.exclusiveAffiliateId ? "exclusive" : "popular";
  }, [featuredPlanId, orderedPlans]);

  const filteredPlans = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return orderedPlans;
    }

    return orderedPlans.filter((item) => {
      const haystack =
        `${item.plan.name} ${item.plan.description}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [orderedPlans, search]);

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

  /**
   * Contract rules, resolved per plan.
   *
   * Every strip in the rack carries its own CTA now, so the rules that used to
   * apply to "the selected plan" apply to each column. They are unchanged: the
   * active plan is locked, and a subscribed workspace can only move up — a
   * downgrade waits for the current period to close.
   */
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

  // The rack reads as a price ladder, so it runs cheapest to dearest regardless
  // of which plan is featured; the featured strip is marked, not reordered.
  const rackPlans = React.useMemo(
    () =>
      [...filteredPlans].sort(
        (a, b) => a.plan.basePriceBRLCents - b.plan.basePriceBRLCents,
      ),
    [filteredPlans],
  );

  const capacityRows: {
    key: string;
    label: string;
    value: (item: PublicPlanDetails) => string;
  }[] = React.useMemo(
    () => [
      {
        key: "phones",
        label: t("compare.whatsappPhones"),
        value: (item) =>
          String(item.plan.includedWhatsAppBusinessPhones ?? 0),
      },
      {
        key: "tts",
        label: t("compare.ttsConcurrency"),
        value: (item) => String(item.plan.maxTtsConcurrency ?? 0),
      },
      {
        key: "items",
        label: t("compare.pricingItems"),
        value: (item) => String(billableItems(item.plan.pricingItems).length),
      },
    ],
    [t],
  );

  // Every category any plan in the rack prices, so a plan that lacks one shows
  // the gap on the same row instead of simply omitting the line.
  const compareCategories = React.useMemo(
    () =>
      [
        ...new Set(
          rackPlans.flatMap((item) =>
            billableItems(item.plan.pricingItems).map((entry) => entry.category),
          ),
        ),
      ].sort(
        (a, b) =>
          (CATEGORY_SORT_ORDER[a] ?? 99) - (CATEGORY_SORT_ORDER[b] ?? 99),
      ),
    [rackPlans],
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
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <CircleNotch
          className="h-8 w-8 animate-spin text-lamp-ink"
          weight="bold"
        />
        <p className="mt-3 text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
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

  if (!permissionsLoading && !canReadPlans) {
    return (
      <div
        className="mx-auto mt-8 max-w-2xl rounded-[--radius] border border-border bg-card p-12 text-center"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <ShieldCheck
          className="mx-auto mb-4 h-12 w-12 text-warning"
          weight="fill"
        />
        <p className="font-semibold text-foreground">{t("noAccess.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("noAccess.description")}
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
          className="mx-auto mb-4 h-12 w-12 text-red-400"
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
              <>
                <Button
                  icon={<ArrowsClockwise className="h-4 w-4" weight="bold" />}
                  iconVisible
                  onClick={() => loadData()}
                  title={t("actions.refresh")}
                  variant="outline"
                />
                <Button
                  icon={<Receipt className="h-4 w-4" weight="bold" />}
                  iconVisible
                  link="/dashboard/invoices"
                  newTab={false}
                  title={t("actions.openInvoices")}
                  variant="outline"
                />
              </>
            }
            badge={t("header.badge")}
            description={t("header.description", {
              workspace: currentWorkspace.name,
            })}
            icon={<Package className="h-6 w-6" weight="fill" />}
          />
        </motion.div>

        {/*
          MASTER SECTION.

          What was three stat cards plus a large subscription card said the same
          thing four times: which plan, what status, when it renews. One status
          bar says it once, in reading order, with the figures in a single row of
          readouts so the eye lands on values rather than on card chrome.
        */}
        <section className="well">
          <header className="rule-engraved flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
            <p className="legend">
              {currentSubscription
                ? t("subscription.badge")
                : t("subscription.availableBadge")}
            </p>
            <p className="legend">{currentWorkspace.name}</p>
          </header>

          <div className="flex flex-col gap-x-10 gap-y-5 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden
                className={cn("lamp mt-1.5", !lampTone && "opacity-20")}
                style={lampTone ? { background: `hsl(${lampTone})` } : undefined}
              />
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-semibold tracking-[-0.01em] text-foreground">
                  {currentPlan?.name ?? t("subscription.noneTitle")}
                </h2>
                <p className="mt-1 max-w-[60ch] text-[13px] leading-snug text-muted-foreground">
                  {subscriptionDescription}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              {currentSubscription ? (
                <dl className="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-4">
                  <div>
                    <dt className="legend">{t("subscription.plan")}</dt>
                    <dd className="mt-1.5 truncate text-[13px] font-medium text-foreground">
                      {currentPlan?.name ?? "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="legend">{t("subscription.basePrice")}</dt>
                    <dd className="readout mt-1.5 text-[13px] font-semibold text-foreground">
                      {formatBRLFromCents(currentPlan?.basePriceBRLCents ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="legend">{t("subscription.period")}</dt>
                    <dd className="readout mt-1.5 whitespace-nowrap text-[13px] text-foreground">
                      {formatDateOnly(
                        currentSubscription.currentPeriodStart,
                        locale,
                      )}
                      {" — "}
                      {formatDateOnly(
                        currentSubscription.currentPeriodEnd,
                        locale,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="legend">{t("stats.currentStatus")}</dt>
                    <dd className="mt-1.5 text-[13px] font-medium text-foreground">
                      {t(`status.${currentSubscription.status}`)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <dl className="grid grid-cols-2 gap-x-10 gap-y-4">
                  <div>
                    <dt className="legend">{t("stats.totalPlans")}</dt>
                    <dd className="readout mt-1.5 text-[13px] font-semibold text-foreground">
                      {plans.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="legend">{t("stats.currentStatus")}</dt>
                    <dd className="mt-1.5 text-[13px] font-medium text-foreground">
                      {t("stats.available")}
                    </dd>
                  </div>
                </dl>
              )}

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
          </div>

          {currentSubscription ? (
            <p className="border-t border-border/60 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {t("subscription.billingSummary", {
                date: formatDateOnly(
                  currentSubscription.currentPeriodEnd,
                  locale,
                ),
              })}
            </p>
          ) : null}
        </section>

        {/*
          THE RACK.

          Plans are chosen by comparison, and a rail of cards makes that the
          hardest thing to do: to check whether Scale includes more numbers than
          Professional you had to select one, read it, select the other, and
          remember. So the catalogue is a rack of parallel strips over shared
          rows — every capability sits on one engraved line, and the answer is
          read across instead of held in memory.
        */}
        <section className="well overflow-hidden">
          <header className="rule-engraved flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
            <div className="flex items-baseline gap-2.5">
              <p className="legend">{t("stats.totalPlans")}</p>
              <span className="readout text-[11px] text-muted-foreground/60">
                {String(rackPlans.length).padStart(2, "0")}
              </span>
            </div>
            <input
              aria-label={t("filters.search")}
              className="h-8 w-full rounded-[--radius] border border-border border-t-rule-strong bg-background px-2.5 text-[13px] text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/50 sm:w-60"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("filters.search")}
              type="search"
              value={search}
            />
          </header>

          {rackPlans.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="text-sm font-semibold text-foreground">
                {t("empty.title")}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {t("empty.description")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    <th
                      className="sticky left-0 z-10 w-[168px] min-w-[168px] bg-card px-4 pb-4 align-bottom"
                      scope="col"
                    >
                      <span className="sr-only">{t("subscription.plan")}</span>
                    </th>

                    {rackPlans.map((item, index) => {
                      const isSelected = item.plan.id === selectedPlan?.plan.id;
                      const isFeatured = featuredPlanId === item.plan.id;
                      const state = contractStateFor(item);

                      return (
                        <th
                          key={item.plan.id}
                          className={cn(
                            "min-w-[204px] border-l border-border/60 px-4 pb-4 align-top font-normal",
                            isSelected && "bg-muted",
                          )}
                          scope="col"
                        >
                          {/* The lit rail: which strip the readouts below belong to. */}
                          <span
                            aria-hidden
                            className="mb-4 block h-[3px] w-full"
                            style={
                              isSelected
                                ? { background: "hsl(var(--lamp))" }
                                : undefined
                            }
                          />

                          <button
                            aria-pressed={isSelected}
                            className="block w-full text-left"
                            onClick={() => setSelectedPlanId(item.plan.id)}
                            type="button"
                          >
                            <span className="flex items-center gap-2">
                              <span className="readout text-[11px] text-muted-foreground/60">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                                {item.plan.name}
                              </span>
                            </span>

                            <span className="mt-2 flex min-h-[22px] flex-wrap items-center gap-1.5">
                              {isFeatured && featuredLabelKey ? (
                                <span className="legend inline-flex border border-border border-t-rule-strong bg-background px-1.5 py-1 text-foreground">
                                  {pricingT(featuredLabelKey)}
                                </span>
                              ) : null}
                              {state.isCurrent ? (
                                <span className="legend inline-flex border border-border border-t-rule-strong bg-background px-1.5 py-1 text-lamp-ink">
                                  {t("list.current")}
                                </span>
                              ) : null}
                            </span>

                            <span className="mt-3 flex items-baseline gap-1">
                              <span className="readout text-[22px] font-semibold leading-none tracking-[-0.02em] text-foreground">
                                {formatBRLFromCents(item.plan.basePriceBRLCents)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {t("detail.perMonth")}
                              </span>
                            </span>

                            <span className="mt-2 line-clamp-2 block min-h-[32px] text-[12px] leading-snug text-muted-foreground">
                              {item.plan.description || t("list.noDescription")}
                            </span>
                          </button>

                          {item.plan.exclusiveAffiliateId && affiliateBrand ? (
                            <div className="mt-3">
                              <AffiliateBrandChip brand={affiliateBrand} />
                            </div>
                          ) : null}

                          <Button
                            className="mt-3 w-full"
                            disabled={state.disabled}
                            icon={
                              creatingInvoice &&
                              selectedPlan?.plan.id === item.plan.id ? (
                                <CircleNotch
                                  className="h-4 w-4 animate-spin"
                                  weight="bold"
                                />
                              ) : (
                                <CurrencyDollar className="h-4 w-4" weight="bold" />
                              )
                            }
                            iconVisible
                            onClick={() => handleContract(item.plan.id)}
                            title={state.title}
                            variant={
                              isSelected && !state.disabled
                                ? "primary"
                                : "outline"
                            }
                          />
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {capacityRows.map((row) => (
                    <tr key={row.key} className="border-t border-border/50">
                      <th
                        className="sticky left-0 z-10 bg-card px-4 py-2.5 text-[12px] font-normal text-muted-foreground"
                        scope="row"
                      >
                        {row.label}
                      </th>
                      {rackPlans.map((item) => (
                        <td
                          key={item.plan.id}
                          className={cn(
                            "readout border-l border-border/60 px-4 py-2.5 text-[13px] font-semibold text-foreground",
                            item.plan.id === selectedPlan?.plan.id && "bg-muted",
                          )}
                        >
                          {row.value(item)}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {compareCategories.map((category) => {
                    const categoryKey =
                      `pricing.categories.${category}` as Parameters<
                        typeof t
                      >[0];

                    return (
                      <tr key={category} className="border-t border-border/50">
                        <th
                          className="sticky left-0 z-10 bg-card px-4 py-2.5 text-[12px] font-normal text-muted-foreground"
                          scope="row"
                        >
                          <span className="flex items-center gap-2">
                            <CategoryMark category={category} />
                            {t.has(categoryKey) ? t(categoryKey) : category}
                          </span>
                        </th>
                        {rackPlans.map((item) => {
                          const included = billableItems(
                            item.plan.pricingItems,
                          ).some((entry) => entry.category === category);

                          return (
                            <td
                              key={item.plan.id}
                              className={cn(
                                "border-l border-border/60 px-4 py-2.5",
                                item.plan.id === selectedPlan?.plan.id &&
                                  "bg-muted",
                              )}
                            >
                              {included ? (
                                <Check
                                  aria-label={t("compare.included")}
                                  className="h-3.5 w-3.5 text-healthy"
                                  weight="bold"
                                />
                              ) : (
                                <span
                                  aria-label={t("compare.notIncluded")}
                                  className="text-muted-foreground/40"
                                  role="img"
                                >
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* The selected strip, expanded: what it costs to run, line by line. */}
        {selectedPlan && selectedPlanBillableCount > 0 ? (
          <section className="well">
            <header className="rule-engraved flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <p className="legend">
                  {selectedIsCurrentPlan
                    ? t("detail.currentBadge")
                    : t("detail.availableBadge")}
                </p>
                <span aria-hidden className="h-3 w-px bg-border" />
                <p className="truncate text-[13px] font-semibold text-foreground">
                  {selectedPlan.plan.name}
                </p>
              </div>
              <p className="readout text-[11px] text-muted-foreground">
                {formatBRLFromCents(selectedPlan.plan.basePriceBRLCents)}
                {t("detail.perMonth")}
              </p>
            </header>

            <div className="space-y-7 px-4 py-5">
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
                t={t}
              />
            </div>

            <p className="border-t border-border/60 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {t("detail.ctaHint")} · {t("detail.scheduleNote")}
            </p>
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
                <div className="rounded-[--radius] border border-emerald-200 bg-healthy/10/90 px-4 py-3 text-sm text-emerald-900">
                  <p className="font-medium">
                    {t("dialog.paymentConfirmedTitle")}
                  </p>
                  <p className="mt-1 text-xs text-emerald-800">
                    {t("dialog.paymentConfirmedDescription")}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[--radius] border border-border bg-background p-4">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                    {t("dialog.amount")}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {formatBRLFromCents(
                      Math.round(generatedInvoice.amountBRL * 100),
                    )}
                  </p>
                </div>
                <div className="rounded-[--radius] border border-border bg-background p-4">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                    {t("dialog.method")}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {generatedInvoice.billingType}
                  </p>
                </div>
              </div>

              <div className="rounded-[--radius] border border-border bg-background p-4">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
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
                            className="h-4 w-4 text-healthy"
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
                  {/* ── Plan summary ── */}
                  <div className="rounded-[--radius] border border-border bg-background p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-lamp-ink tracking-wide">
                          {selectedPlan?.plan.name ?? t("detail.emptyTitle")}
                        </p>
                        <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                          {selectedPlan?.plan.description ||
                            t("detail.emptyDescription")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-semibold text-foreground tabular-nums">
                          {formatBRLFromCents(baseCents)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {t("detail.perMonth")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── Billing cycle ── */}
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
                              className="h-5 w-5 text-white"
                              weight="bold"
                            />
                          ),
                          bg: "bg-muted",
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
                              className="h-5 w-5 text-white"
                              weight="fill"
                            />
                          ),
                          bg: "bg-muted",
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

                  {/* ── Payment method ── */}
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
                              className="h-5 w-5 text-white"
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
                              className="h-5 w-5 text-white"
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

                  {/* ── Order summary ── */}
                  <div className="rounded-[--radius] border border-border bg-muted p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
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
                        {formatBRLFromCents(totalCentsNoDiscount)}
                      </span>
                    </div>
                    {hasDiscount && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-healthy">
                          {t("dialog.discountLabel", {
                            discount: String(annualDiscountPct),
                          })}
                        </span>
                        <span className="font-medium tabular-nums text-healthy">
                          -
                          {formatBRLFromCents(
                            totalCentsNoDiscount - totalCents,
                          )}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-border pt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">
                        {t("dialog.totalLabel")}
                      </span>
                      <span className="text-lg font-semibold tabular-nums text-foreground">
                        {formatBRLFromCents(totalCents)}
                      </span>
                    </div>
                  </div>

                  <p className="rounded-[--radius] bg-muted px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
                    {isAnnual
                      ? t("dialog.scheduleNoteAnnual")
                      : t("dialog.scheduleNoteMonthly")}
                  </p>

                  {invoiceError ? (
                    <div className="rounded-[--radius] border border-destructive bg-destructive px-4 py-3 text-sm text-white">
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


const CATEGORY_SORT_ORDER: Record<string, number> = {
  whatsapp: 0,
  sms: 1,
  stt: 3,
  tts: 4,
  llm: 5,
};

/**
 * Categories a customer must never be shown.
 *
 * `exchange_rate` is a system row, and `telephony` is the SIP catalogue left
 * over from the VoIP era — the product no longer sells call capacity, so a plan
 * must not advertise it even when the backend taxonomy still carries the rows.
 */
const HIDDEN_CATEGORIES = new Set(["exchange_rate", "telephony"]);

function billableItems(items: { category: string }[] | undefined) {
  return (items ?? []).filter((item) => !HIDDEN_CATEGORIES.has(item.category));
}

function formatUSD(micros: number) {
  const dollars = micros / 1_000_000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(dollars);
}

function formatBRLPrice(micros: number, exchangeRate: number) {
  const brl = (micros / 1_000_000) * exchangeRate;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(brl);
}

/**
 * Category marks.
 *
 * Not filled tiles: a patch bay colour-codes with ink on the same plate, so
 * each category gets a chart ink and a glyph at label size, and the plate stays
 * the panel it is engraved on.
 */
const CATEGORY_INK: Record<string, { ink: string; glyph: React.ReactNode }> = {
  whatsapp: { ink: "ink-2", glyph: <WhatsappLogo className="h-3.5 w-3.5" /> },
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

/**
 * The plan's price list.
 *
 * Prices are read by comparison — this line against the one below it, BRL
 * against USD — which a grid of bordered mini-cards actively prevents: every
 * amount starts at a different x. So it is one table, category by category,
 * with the figures right-aligned in tabular columns and the category names
 * engraved across the width rather than boxed.
 */
export function PlanPricingTable({
  items,
  exchangeRate,
  t,
}: {
  items: {
    category: string;
    service: string;
    metric: string;
    priceMicros: number;
    currency: string;
  }[];
  exchangeRate: number;
  t: ReturnType<typeof useTranslations<"plansPage">>;
}) {
  const grouped = React.useMemo(() => {
    // Drop internal and markup-based (percentage) rows: a customer sees final per-unit prices only,
    // never our markup. The backend also strips markupPct/costMicros from customer plan responses.
    const filtered = items.filter(
      (i) =>
        !HIDDEN_CATEGORIES.has(i.category) &&
        i.category !== "llm" &&
        i.metric !== "percentage",
    );
    const groups = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const existing = groups.get(item.category) ?? [];
      existing.push(item);
      groups.set(item.category, existing);
    }
    return [...groups.entries()].sort((a, b) => {
      const oa = CATEGORY_SORT_ORDER[a[0]] ?? 99;
      const ob = CATEGORY_SORT_ORDER[b[0]] ?? 99;
      return oa - ob;
    });
  }, [items]);

  if (grouped.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="rule-engraved pb-2.5">
        <p className="legend">{t("pricing.title")}</p>
        <p className="mt-1.5 max-w-[74ch] text-[13px] leading-snug text-muted-foreground">
          {t("pricing.description")}
        </p>
        <p className="readout mt-1 text-[11px] text-muted-foreground/70">
          {t("pricing.exchangeRateHint", {
            rate: `1 USD = ${exchangeRate.toFixed(2)} BRL`,
          })}
        </p>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="rule-engraved">
              <th className="legend py-2 pr-3 font-semibold" scope="col">
                {t("pricing.columns.service")}
              </th>
              <th className="legend px-3 py-2 font-semibold" scope="col">
                {t("pricing.columns.metric")}
              </th>
              <th
                className="legend px-3 py-2 text-right font-semibold"
                scope="col"
              >
                BRL
              </th>
              <th className="legend py-2 pl-3 text-right font-semibold" scope="col">
                USD
              </th>
            </tr>
          </thead>

          {grouped.map(([category, categoryItems]) => {
            const categoryKey = `pricing.categories.${category}` as Parameters<
              typeof t
            >[0];
            const categoryDescKey =
              `pricing.categoryDescriptions.${category}` as Parameters<
                typeof t
              >[0];

            return (
              <tbody key={category}>
                <tr>
                  <th className="pb-1.5 pt-5" colSpan={4} scope="colgroup">
                    <span className="flex items-center gap-2">
                      <CategoryMark category={category} />
                      <span className="legend text-foreground">
                        {t.has(categoryKey) ? t(categoryKey) : category}
                      </span>
                      {t.has(categoryDescKey) ? (
                        <span className="hidden whitespace-nowrap text-[11px] font-normal text-muted-foreground sm:inline">
                          {t(categoryDescKey)}
                        </span>
                      ) : null}
                      <span
                        aria-hidden
                        className="h-px min-w-4 flex-1 bg-border"
                      />
                    </span>
                  </th>
                </tr>

                {categoryItems
                  .sort((a, b) => a.service.localeCompare(b.service))
                  .map((item) => {
                    const serviceKey =
                      `pricing.services.${item.service}` as Parameters<
                        typeof t
                      >[0];
                    const metricKey =
                      `pricing.metrics.${item.metric}` as Parameters<
                        typeof t
                      >[0];

                    return (
                      <tr
                        key={`${item.service}-${item.metric}`}
                        className="border-b border-border/50 last:border-b-0"
                      >
                        <th
                          className="py-2 pr-3 text-[13px] font-medium text-foreground"
                          scope="row"
                        >
                          {t.has(serviceKey)
                            ? t(serviceKey)
                            : formatPricingServiceFallback(item.service)}
                        </th>
                        <td className="px-3 py-2 text-[12px] text-muted-foreground">
                          {/* An unmapped metric would otherwise print its i18n path. */}
                          {t.has(metricKey) ? t(metricKey) : item.metric}
                        </td>
                        <td className="readout px-3 py-2 text-right text-[13px] font-semibold text-foreground">
                          {formatBRLPrice(item.priceMicros, exchangeRate)}
                        </td>
                        <td className="readout py-2 pl-3 text-right text-[12px] text-muted-foreground">
                          {formatUSD(item.priceMicros)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}

/**
 * What the base price buys, in message counts.
 *
 * The call-minutes estimate that used to sit here was priced off SIP trunking;
 * it went with the rest of the VoIP surface. What remains is a readout, not a
 * set of stat cards — same figures, aligned in one column so they compare.
 */
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
  t: ReturnType<typeof useTranslations<"plansPage">>;
}) {
  const msgEstimates = React.useMemo(
    () => estimateMessagesByType(basePriceBRLCents, items, exchangeRate),
    [basePriceBRLCents, items, exchangeRate],
  );

  if (msgEstimates.length === 0) return null;

  return (
    <div>
      <div className="rule-engraved pb-2.5">
        <p className="legend">{t("estimates.title")}</p>
        <p className="mt-1.5 max-w-[74ch] text-[13px] leading-snug text-muted-foreground">
          {t("estimates.description")}
        </p>
      </div>

      <dl className="mt-1 grid gap-x-10 sm:grid-cols-2 xl:grid-cols-3">
        {msgEstimates.map((est) => {
          const serviceKey =
            `estimates.serviceLabel.${est.category}.${est.service}` as Parameters<
              typeof t
            >[0];
          return (
            <div
              key={`${est.category}-${est.service}`}
              className="flex items-baseline justify-between gap-3 border-b border-border/50 py-2.5"
            >
              <dt className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
                <CategoryMark category={est.category} />
                <span className="truncate">
                  {t.has(serviceKey) ? t(serviceKey) : est.service}
                </span>
              </dt>
              <dd className="readout shrink-0 text-[15px] font-semibold text-foreground">
                ~{formatEstimateNumber(est.count, locale)}
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  {t("estimates.messagesLabel")}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}