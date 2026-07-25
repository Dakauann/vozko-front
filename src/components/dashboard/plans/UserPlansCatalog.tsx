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
  Crown,
  CurrencyDollar,
  Headset,
  Microphone,
  MusicNotes,
  Package,
  Phone,
  PixLogo,
  Receipt,
  ShieldCheck,
  SpeakerHigh,
  Sparkle,
  WhatsappLogo,
} from "@phosphor-icons/react";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { useLocale, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import Image from "next/image";
import {
  AffiliateBrandChip,
  type AffiliateBrand,
} from "@/components/plans/plans-carousel";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { formatPricingServiceFallback } from "@/lib/branding/ai-models";
import type { Invoice } from "@/lib/invoices/types";
import type {
  PublicPlanDetails,
  PublicWorkspaceSubscriptionDetails,
} from "@/lib/workspace-plan/types";
import { cn } from "@/lib/utils";
import {
  estimateCallMinutesFromPlan,
  estimateCostPerMinuteUSD,
  estimateMessagesByType,
  formatEstimateNumber,
  formatMicroCostAsBRL,
  hasTelephonyCapability,
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

function getStatusClass(status: "active" | "cancelled" | "expired") {
  switch (status) {
    case "active":
      return "bg-emerald-500 text-white";
    case "cancelled":
      return "bg-amber-500 text-white";
    case "expired":
    default:
      return "bg-slate-500 text-white";
  }
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
  const isUpgrade = Boolean(
    hasCurrentSubscription &&
    selectedPlan &&
    !selectedIsCurrentPlan &&
    currentPlan &&
    selectedPlan.plan.basePriceBRLCents > currentPlan.basePriceBRLCents,
  );
  const isDowngrade = Boolean(
    hasCurrentSubscription &&
    selectedPlan &&
    !selectedIsCurrentPlan &&
    currentPlan &&
    selectedPlan.plan.basePriceBRLCents <= currentPlan.basePriceBRLCents,
  );
  const contractLocked =
    selectedIsCurrentPlan || (hasCurrentSubscription && !isUpgrade);

  const contractButtonTitle = selectedIsCurrentPlan
    ? t("actions.currentPlan")
    : isUpgrade
      ? t("actions.upgrade")
      : isDowngrade
        ? t("actions.downgradeBlocked")
        : !canCreateBilling
          ? t("actions.noPermission")
          : t("actions.contract");

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
          className="h-8 w-8 animate-spin text-primary"
          weight="bold"
        />
        <p className="mt-3 text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div
        className="mx-auto mt-8 max-w-2xl rounded-[26px] border border-border/70 bg-card/90 p-12 text-center"
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
        className="mx-auto mt-8 max-w-2xl rounded-[26px] border border-border/70 bg-card/90 p-12 text-center"
        style={{ boxShadow: softSurfaceShadow }}
      >
        <ShieldCheck
          className="mx-auto mb-4 h-12 w-12 text-amber-500"
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
        className="mx-auto mt-8 max-w-2xl rounded-[26px] border border-border/70 bg-card/90 p-12 text-center"
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

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: t("stats.totalPlans"),
              value: String(plans.length),
              helper: t("stats.totalPlansHelper"),
              icon: <Package className="h-4 w-4 text-white" weight="fill" />,
              bg: "bg-slate-700",
            },
            {
              label: t("stats.currentPlan"),
              value: hasCurrentSubscription
                ? (currentPlan?.name ?? t("stats.none"))
                : t("stats.none"),
              helper: hasCurrentSubscription
                ? formatBRLFromCents(currentPlan?.basePriceBRLCents ?? 0)
                : t("stats.noSubscription"),
              icon: <Sparkle className="h-4 w-4 text-white" weight="fill" />,
              bg: "bg-emerald-500",
            },
            {
              label: t("stats.currentStatus"),
              value: currentSubscription
                ? t(`status.${currentSubscription.status}`)
                : t("stats.available"),
              helper: currentSubscription
                ? formatDate(currentSubscription.currentPeriodEnd, locale)
                : t("stats.readyToContract"),
              icon: (
                <CalendarBlank className="h-4 w-4 text-white" weight="fill" />
              ),
              bg: "bg-amber-500",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border/70 bg-card/90 p-5"
              style={{ boxShadow: softSurfaceShadow }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 truncate text-2xl font-semibold text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stat.helper}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                    stat.bg,
                  )}
                >
                  {stat.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section
            className="space-y-4 rounded-[26px] border border-border/70 bg-card/90 p-5"
            style={{ boxShadow: softSurfaceShadow }}
          >
            <ElevatedInput
              label={t("filters.search")}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("filters.searchPlaceholder")}
              value={search}
            />

            <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t("filters.workspaceLabel")}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {currentWorkspace.name}
              </p>
            </div>

            <div className="space-y-3">
              {filteredPlans.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-4 py-10 text-center">
                  <Package
                    className="mx-auto h-8 w-8 text-muted-foreground"
                    weight="fill"
                  />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {t("empty.title")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("empty.description")}
                  </p>
                </div>
              ) : (
                filteredPlans.map((item) => {
                  const isSelected = item.plan.id === selectedPlan?.plan.id;
                  const isCurrent = currentPlanId === item.plan.id;
                  const isExclusive = Boolean(item.plan.exclusiveAffiliateId);
                  const isFeatured = featuredPlanId === item.plan.id;
                  const featureCategories = [
                    ...new Set(
                      (item.plan.pricingItems ?? [])
                        .filter((i) => i.category !== "exchange_rate")
                        .map((i) => i.category),
                    ),
                  ];

                  return (
                    <button
                      key={item.plan.id}
                      className={cn(
                        "w-full rounded-2xl border px-4 py-4 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
                          : isFeatured
                            ? "border-primary/40 bg-background hover:border-primary/60"
                            : "border-border/70 bg-background/70 hover:border-primary/30 hover:bg-background",
                      )}
                      onClick={() => setSelectedPlanId(item.plan.id)}
                      type="button"
                    >
                      {isFeatured && featuredLabelKey ? (
                        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                          {featuredLabelKey === "exclusive" ? (
                            <Sparkle className="h-3 w-3" weight="fill" />
                          ) : (
                            <Crown className="h-3 w-3" weight="fill" />
                          )}
                          {pricingT(featuredLabelKey)}
                        </div>
                      ) : null}
                      {isExclusive && affiliateBrand ? (
                        <div className="mb-3 flex items-center gap-2.5 border-b border-border/60 pb-2.5">
                          <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center">
                            {affiliateBrand.brandLogoUrl ? (
                              <Image
                                src={affiliateBrand.brandLogoUrl}
                                alt={
                                  affiliateBrand.brandName ||
                                  affiliateBrand.code
                                }
                                fill
                                sizes="32px"
                                unoptimized
                                className="object-contain"
                              />
                            ) : (
                              <Sparkle
                                className="h-4 w-4 text-foreground/70"
                                weight="fill"
                              />
                            )}
                          </span>
                          <div className="flex min-w-0 flex-col leading-tight">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              {pricingT("exclusivePartner")}
                            </span>
                            <span className="truncate text-xs font-semibold tracking-tight text-foreground">
                              {affiliateBrand.brandName || affiliateBrand.code}
                            </span>
                          </div>
                        </div>
                      ) : null}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {item.plan.name}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {item.plan.description || t("list.noDescription")}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase",
                            isCurrent
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-500 text-white",
                          )}
                        >
                          {isCurrent ? t("list.current") : t("list.available")}
                        </span>
                      </div>

                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-lg font-bold text-foreground">
                          {formatBRLFromCents(item.plan.basePriceBRLCents)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {t("detail.perMonth")}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <Check
                            className="h-3 w-3 shrink-0 text-emerald-500"
                            weight="bold"
                          />
                          <span>
                            <span className="font-semibold">
                              {item.plan.maxCallChannels}
                            </span>{" "}
                            {t("list.channels")}
                          </span>
                        </div>
                        {(item.plan.maxBranches ?? 1) > 0 ? (
                          <div className="flex items-center gap-1.5 text-xs text-foreground">
                            <Check
                              className="h-3 w-3 shrink-0 text-emerald-500"
                              weight="bold"
                            />
                            <span>
                              <span className="font-semibold">
                                {item.plan.maxBranches ?? 1}
                              </span>{" "}
                              {t("list.branches")}
                            </span>
                          </div>
                        ) : null}
                        {(item.plan.maxHoldMusicTracks ?? 3) > 0 ? (
                          <div className="flex items-center gap-1.5 text-xs text-foreground">
                            <Check
                              className="h-3 w-3 shrink-0 text-emerald-500"
                              weight="bold"
                            />
                            <span>
                              <span className="font-semibold">
                                {item.plan.maxHoldMusicTracks ?? 3}
                              </span>{" "}
                              {t("list.holdMusic")}
                            </span>
                          </div>
                        ) : null}
                        {featureCategories.map((cat) => {
                          const catKey =
                            `pricing.categories.${cat}` as Parameters<
                              typeof t
                            >[0];
                          return (
                            <div
                              key={cat}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground"
                            >
                              <Check
                                className="h-3 w-3 shrink-0 text-emerald-500"
                                weight="bold"
                              />
                              <span>{t(catKey)}</span>
                            </div>
                          );
                        })}
                      </div>

                      <SidebarEstimateBadges
                        basePriceBRLCents={item.plan.basePriceBRLCents}
                        items={item.plan.pricingItems ?? []}
                        exchangeRate={exchangeRate}
                        locale={locale}
                        t={t}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section
            className="space-y-4 rounded-[26px] border border-border/70 bg-card/90 p-5"
            style={{ boxShadow: softSurfaceShadow }}
          >
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-primary">
                    {currentSubscription
                      ? t("subscription.badge")
                      : t("subscription.availableBadge")}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">
                    {currentPlan?.name ?? t("subscription.noneTitle")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {subscriptionDescription}
                  </p>
                </div>

                {currentSubscription ? (
                  <span
                    className={cn(
                      "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold uppercase",
                      getStatusClass(currentSubscription.status),
                    )}
                  >
                    {t(`status.${currentSubscription.status}`)}
                  </span>
                ) : null}
              </div>

              {currentSubscription ? (
                <>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      {t("subscription.plan")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {currentPlan?.name ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      {t("subscription.period")}
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {formatDate(
                        currentSubscription.currentPeriodStart,
                        locale,
                      )}
                      {" - "}
                      {formatDate(currentSubscription.currentPeriodEnd, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      {t("subscription.basePrice")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {formatBRLFromCents(currentPlan?.basePriceBRLCents ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      {t("subscription.channels")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {currentPlan?.maxCallChannels ?? 0}
                    </p>
                  </div>
                </div>
                <p className="mt-4 rounded-xl bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  {t("subscription.billingSummary", {
                    date: formatDateOnly(currentSubscription.currentPeriodEnd, locale),
                  })}
                </p>
                </>
              ) : null}

              {canCancelSubscription ? (
                <div className="mt-4 flex flex-wrap gap-2">
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
                </div>
              ) : null}
            </div>

            {selectedPlan ? (
              <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-card p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase",
                          selectedIsCurrentPlan
                            ? "bg-emerald-500 text-white"
                            : "bg-primary text-white",
                        )}
                      >
                        {selectedIsCurrentPlan
                          ? t("detail.currentBadge")
                          : t("detail.availableBadge")}
                      </span>
                      {selectedPlan.plan.exclusiveAffiliateId &&
                      affiliateBrand ? (
                        <AffiliateBrandChip brand={affiliateBrand} />
                      ) : null}
                    </div>

                    <div>
                      <h3 className="text-2xl font-bold text-foreground">
                        {selectedPlan.plan.name}
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {selectedPlan.plan.description ||
                          t("detail.emptyDescription")}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <CurrencyDollar
                          className="h-4 w-4 text-emerald-500"
                          weight="bold"
                        />
                        <span className="font-semibold">
                          {formatBRLFromCents(
                            selectedPlan.plan.basePriceBRLCents,
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {t("detail.perMonth")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone
                          className="h-4 w-4 text-blue-500"
                          weight="fill"
                        />
                        <span className="font-semibold">
                          {selectedPlan.plan.maxCallChannels}
                        </span>
                        <span className="text-muted-foreground">
                          {t("detail.channelsIncluded")}
                        </span>
                      </div>
                      {(selectedPlan.plan.maxBranches ?? 1) > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <Headset
                            className="h-4 w-4 text-blue-500"
                            weight="fill"
                          />
                          <span className="font-semibold">
                            {selectedPlan.plan.maxBranches ?? 1}
                          </span>
                          <span className="text-muted-foreground">
                            {t("detail.branchesIncluded")}
                          </span>
                        </div>
                      ) : null}
                      {(selectedPlan.plan.maxHoldMusicTracks ?? 3) > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <MusicNotes
                            className="h-4 w-4 text-blue-500"
                            weight="fill"
                          />
                          <span className="font-semibold">
                            {selectedPlan.plan.maxHoldMusicTracks ?? 3}
                          </span>
                          <span className="text-muted-foreground">
                            {t("detail.holdMusicIncluded")}
                          </span>
                        </div>
                      ) : null}
                      {selectedPlan.plan.pricingItems &&
                      selectedPlan.plan.pricingItems.filter(
                        (i) => i.category !== "exchange_rate",
                      ).length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <Receipt
                            className="h-4 w-4 text-amber-500"
                            weight="fill"
                          />
                          <span className="font-semibold">
                            {
                              selectedPlan.plan.pricingItems.filter(
                                (i) => i.category !== "exchange_rate",
                              ).length
                            }
                          </span>
                          <span className="text-muted-foreground">
                            {t("detail.pricingItemsIncluded")}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {selectedPlan.plan.pricingItems &&
                    selectedPlan.plan.pricingItems.length > 0 ? (
                      <SidebarEstimateBadges
                        basePriceBRLCents={selectedPlan.plan.basePriceBRLCents}
                        items={selectedPlan.plan.pricingItems}
                        exchangeRate={exchangeRate}
                        locale={locale}
                        t={t}
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-col items-stretch gap-2 lg:items-end">
                    <div className="text-right">
                      <p className="text-3xl font-bold text-foreground">
                        {formatBRLFromCents(
                          selectedPlan.plan.basePriceBRLCents,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("detail.perMonth")}
                      </p>
                    </div>
                    <Button
                      size="lg"
                      disabled={
                        !selectedPlan || contractLocked || !canCreateBilling
                      }
                      icon={
                        creatingInvoice ? (
                          <CircleNotch
                            className="h-5 w-5 animate-spin"
                            weight="bold"
                          />
                        ) : (
                          <CurrencyDollar className="h-5 w-5" weight="bold" />
                        )
                      }
                      iconVisible
                      onClick={() => handleDialogChange(true)}
                      title={contractButtonTitle}
                    />
                    {!contractLocked && canCreateBilling ? (
                      <div className="space-y-1 text-center lg:text-right">
                        <p className="text-[11px] text-muted-foreground">
                          {t("detail.ctaHint")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {t("detail.scheduleNote")}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-8 text-center">
                <Package
                  className="mx-auto h-10 w-10 text-muted-foreground"
                  weight="fill"
                />
                <p className="mt-3 font-semibold text-foreground">
                  {t("detail.emptyTitle")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("detail.emptyDescription")}
                </p>
              </div>
            )}

            {selectedPlan?.plan.pricingItems &&
            selectedPlan.plan.pricingItems.length > 0 ? (
              <PlanEstimatesPanel
                basePriceBRLCents={selectedPlan.plan.basePriceBRLCents}
                items={selectedPlan.plan.pricingItems}
                exchangeRate={exchangeRate}
                locale={locale}
                t={t}
              />
            ) : null}

            {selectedPlan?.plan.pricingItems &&
            selectedPlan.plan.pricingItems.length > 0 ? (
              <PlanPricingTable
                items={selectedPlan.plan.pricingItems}
                exchangeRate={exchangeRate}
                t={t}
              />
            ) : null}
          </section>
        </div>
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
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
                  <p className="font-medium">
                    {t("dialog.paymentConfirmedTitle")}
                  </p>
                  <p className="mt-1 text-xs text-emerald-800">
                    {t("dialog.paymentConfirmedDescription")}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                    {t("dialog.amount")}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {formatBRLFromCents(
                      Math.round(generatedInvoice.amountBRL * 100),
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                    {t("dialog.method")}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {generatedInvoice.billingType}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
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
                <div className="space-y-4 rounded-2xl border border-border/70 bg-background/60 p-4">
                  <div className="flex flex-col items-center gap-4">
                    {generatedInvoice.pixQrCode ? (
                      <img
                        src={`data:image/png;base64,${generatedInvoice.pixQrCode}`}
                        alt="PIX QR Code"
                        className="h-48 w-48 rounded-2xl border border-border"
                      />
                    ) : (
                      <div className="flex h-48 w-48 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/50">
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
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-3">
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
                            className="h-4 w-4 text-emerald-500"
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
                <div className="space-y-4 rounded-2xl border border-border/70 bg-background/60 p-4">
                  <div className="flex min-h-0 flex-1 flex-col items-center gap-4">
                    {generatedInvoice.bankSlipUrl ? (
                      <div className="min-h-0 w-full flex-1 overflow-hidden rounded-2xl border border-border">
                        <iframe
                          src={generatedInvoice.bankSlipUrl}
                          className="h-full min-h-[420px] w-full"
                          title="Boleto"
                        />
                      </div>
                    ) : (
                      <div className="flex h-32 w-full items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/50">
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
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-primary tracking-wide">
                          {selectedPlan?.plan.name ?? t("detail.emptyTitle")}
                        </p>
                        <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                          {selectedPlan?.plan.description ||
                            t("detail.emptyDescription")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-bold text-foreground tabular-nums">
                          {formatBRLFromCents(baseCents)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {t("detail.perMonth")}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" weight="fill" />
                        {selectedPlan?.plan.maxCallChannels ?? 0}{" "}
                        {t("detail.channels")}
                      </span>
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
                          bg: "bg-blue-500",
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
                          bg: "bg-violet-500",
                        },
                      ].map((option) => (
                        <button
                          key={option.value}
                          className={cn(
                            "rounded-2xl border p-4 text-left transition-all",
                            billingCycle === option.value
                              ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
                              : "border-border/70 bg-background/60 hover:border-primary/30",
                          )}
                          onClick={() => setBillingCycle(option.value)}
                          type="button"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
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
                          bg: "bg-emerald-500",
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
                          bg: "bg-amber-500",
                        },
                      ].map((method) => (
                        <button
                          key={method.value}
                          className={cn(
                            "rounded-2xl border p-4 text-left transition-all",
                            paymentMethod === method.value
                              ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
                              : "border-border/70 bg-background/60 hover:border-primary/30",
                          )}
                          onClick={() => setPaymentMethod(method.value)}
                          type="button"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
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
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 space-y-2">
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
                        <span className="text-emerald-600">
                          {t("dialog.discountLabel", {
                            discount: String(annualDiscountPct),
                          })}
                        </span>
                        <span className="font-medium tabular-nums text-emerald-600">
                          -
                          {formatBRLFromCents(
                            totalCentsNoDiscount - totalCents,
                          )}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-border/50 pt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">
                        {t("dialog.totalLabel")}
                      </span>
                      <span className="text-lg font-bold tabular-nums text-foreground">
                        {formatBRLFromCents(totalCents)}
                      </span>
                    </div>
                  </div>

                  <p className="rounded-2xl bg-muted/30 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
                    {isAnnual
                      ? t("dialog.scheduleNoteAnnual")
                      : t("dialog.scheduleNoteMonthly")}
                  </p>

                  {invoiceError ? (
                    <div className="rounded-2xl border border-red-600 bg-red-500 px-4 py-3 text-sm text-white">
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
  telephony: 2,
  stt: 3,
  tts: 4,
  llm: 5,
};

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

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ReactNode; colorClass: string }
> = {
  whatsapp: {
    icon: <WhatsappLogo className="h-4 w-4 text-white" weight="fill" />,
    colorClass: "bg-emerald-500",
  },
  telephony: {
    icon: <Phone className="h-4 w-4 text-white" weight="fill" />,
    colorClass: "bg-violet-500",
  },
  stt: {
    icon: <Microphone className="h-4 w-4 text-white" weight="fill" />,
    colorClass: "bg-amber-500",
  },
  tts: {
    icon: <SpeakerHigh className="h-4 w-4 text-white" weight="fill" />,
    colorClass: "bg-rose-500",
  },
  llm: {
    icon: <Brain className="h-4 w-4 text-white" weight="fill" />,
    colorClass: "bg-slate-700",
  },
};

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
        i.category !== "exchange_rate" &&
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
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase text-primary">
          {t("pricing.title")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("pricing.description")}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          {t("pricing.exchangeRateHint", {
            rate: `1 USD = ${exchangeRate.toFixed(2)} BRL`,
          })}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {grouped.map(([category, categoryItems]) => {
          const config = CATEGORY_CONFIG[category];
          const categoryKey = `pricing.categories.${category}` as Parameters<
            typeof t
          >[0];
          const categoryDescKey =
            `pricing.categoryDescriptions.${category}` as Parameters<
              typeof t
            >[0];

          return (
            <div
              key={category}
              className="overflow-hidden rounded-2xl border border-border/70 bg-background/60"
            >
              <div className="flex items-center gap-3 border-b border-border/50 bg-muted/30 px-4 py-3">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                    config?.colorClass ?? "bg-slate-500",
                  )}
                >
                  {config?.icon ?? (
                    <Package className="h-4 w-4 text-white" weight="fill" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {t(categoryKey)}
                  </p>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">
                    {t(categoryDescKey)}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-border/40">
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
                      <div
                        key={`${item.service}-${item.metric}`}
                        className="px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {t.has(serviceKey)
                                ? t(serviceKey)
                                : formatPricingServiceFallback(item.service)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {t(metricKey)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                              {formatBRLPrice(item.priceMicros, exchangeRate)}
                            </p>
                            <p className="text-[11px] tabular-nums text-muted-foreground">
                              {formatUSD(item.priceMicros)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


const MSG_ICON_MAP: Record<string, React.ReactNode> = {
  whatsapp: <WhatsappLogo className="h-4 w-4 text-white" weight="fill" />,
};
const MSG_COLOR_MAP: Record<string, string> = {
  whatsapp: "bg-emerald-500",
};

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
  const callEstimate = React.useMemo(
    () => estimateCallMinutesFromPlan(basePriceBRLCents, items, exchangeRate),
    [basePriceBRLCents, items, exchangeRate],
  );
  const costPerMin = React.useMemo(
    () => estimateCostPerMinuteUSD(items),
    [items],
  );
  const hasTelephony = React.useMemo(
    () => hasTelephonyCapability(items),
    [items],
  );

  if (msgEstimates.length === 0 && !callEstimate && !hasTelephony) return null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase text-primary">
          {t("estimates.title")}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t("estimates.description")}
        </p>
      </div>

      {/* Per-service message estimates */}
      {msgEstimates.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {msgEstimates.map((est) => {
            const serviceKey =
              `estimates.serviceLabel.${est.category}.${est.service}` as Parameters<
                typeof t
              >[0];
            return (
              <div
                key={`${est.category}-${est.service}`}
                className="rounded-2xl border border-border/70 bg-background/60 p-4"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-xl",
                      MSG_COLOR_MAP[est.category] ?? "bg-slate-500",
                    )}
                  >
                    {MSG_ICON_MAP[est.category] ?? (
                      <ChatCircle
                        className="h-4 w-4 text-white"
                        weight="fill"
                      />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {t(serviceKey)}
                  </p>
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
                  ~{formatEstimateNumber(est.count, locale)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("estimates.messagesLabel")}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Telephony / call minutes */}
      {callEstimate || hasTelephony ? (
        <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500">
              <Phone className="h-4 w-4 text-white" weight="fill" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("estimates.callMinutesTitle")}
              </p>
              {hasTelephony ? (
                <p className="text-[11px] text-emerald-600">
                  {t("estimates.telephonyCapable")}
                </p>
              ) : null}
            </div>
          </div>
          {callEstimate ? (
            <>
              <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
                ~{formatEstimateNumber(callEstimate, locale)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("estimates.minutesLabel")}
              </p>
            </>
          ) : null}
          {costPerMin ? (
            <div className="mt-2 rounded-xl border border-border/50 bg-muted/30 px-2.5 py-1.5">
              <p className="text-[11px] font-medium tabular-nums text-foreground">
                {t("estimates.costPerMinute")}:{" "}
                {formatMicroCostAsBRL(costPerMin, exchangeRate)}/min
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t("estimates.costPerMinuteHint")}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


const SIDEBAR_ICON_MAP: Record<string, React.ReactNode> = {
  whatsapp: (
    <WhatsappLogo className="h-3 w-3 shrink-0 text-emerald-500" weight="fill" />
  ),
};

function SidebarEstimateBadges({
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
  const callEstimate = React.useMemo(
    () => estimateCallMinutesFromPlan(basePriceBRLCents, items, exchangeRate),
    [basePriceBRLCents, items, exchangeRate],
  );

  if (msgEstimates.length === 0 && !callEstimate) return null;

  return (
    <div className="mt-3 space-y-1.5">
      {msgEstimates.map((est) => (
        <div
          key={`${est.category}-${est.service}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {SIDEBAR_ICON_MAP[est.category] ?? (
            <ChatCircle
              className="h-3 w-3 shrink-0 text-emerald-500"
              weight="fill"
            />
          )}
          <span>
            ~{formatEstimateNumber(est.count, locale)}{" "}
            {t(
              `estimates.serviceLabel.${est.category}.${est.service}` as Parameters<
                typeof t
              >[0],
            )}
          </span>
        </div>
      ))}
      {callEstimate ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0 text-blue-500" weight="fill" />
          <span>
            ~{formatEstimateNumber(callEstimate, locale)}{" "}
            {t("estimates.minutesLabel")}
          </span>
        </div>
      ) : null}
    </div>
  );
}
