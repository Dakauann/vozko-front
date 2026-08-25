"use client";

import { CircleNotch, Package } from "@/components/icons";
import {
  PlanEstimatesPanel,
  PlanPricingTable,
} from "@/components/dashboard/plans/UserPlansCatalog";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PlanCatalogRail } from "@/components/dashboard/plans/PlanCatalogRail";
import type { PublicPlanDetails } from "@/lib/workspace-plan/types";
import { getExchangeRateAction } from "@/app/actions/pricing";
import { getMyAffiliateAction } from "@/app/actions/affiliate";
import { listMyAffiliateExclusivePlansAction } from "@/app/actions/workspace-plan";
import { motion } from "framer-motion";
import { useRouter } from "@/i18n/routing";

const DEFAULT_EXCHANGE_RATE = 6.0;

function formatBRLFromCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === "pt" ? "pt-BR" : locale, {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export default function AffiliatePlansPage() {
  const t = useTranslations("affiliatePage.plans");
  const plansT = useTranslations("plansPage");
  const locale = useLocale();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PublicPlanDetails[]>([]);
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      const profileResult = await getMyAffiliateAction();
      if (cancelled) {
        return;
      }

      if (profileResult.notFound) {
        router.replace("/dashboard/affiliate/register");
        return;
      }

      if (profileResult.error) {
        setError(profileResult.error);
        setLoading(false);
        return;
      }

      const [plansResult, exchangeRateResult] = await Promise.all([
        listMyAffiliateExclusivePlansAction(),
        getExchangeRateAction(),
      ]);

      if (cancelled) {
        return;
      }

      if (plansResult.error === "forbidden") {
        setForbidden(true);
        setPlans([]);
        setSelectedPlanId(null);
      } else if (plansResult.error) {
        setError(plansResult.error);
        setPlans([]);
        setSelectedPlanId(null);
      } else {
        setForbidden(false);
        setError(null);
        setPlans(plansResult.plans);
        setSelectedPlanId(
          (current) => current ?? plansResult.plans[0]?.plan.id ?? null,
        );
      }

      if (exchangeRateResult.item?.priceMicros) {
        setExchangeRate(exchangeRateResult.item.priceMicros / 1_000_000);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const orderedPlans = useMemo(
    () =>
      [...plans].sort(
        (left, right) =>
          left.plan.basePriceBRLCents - right.plan.basePriceBRLCents,
      ),
    [plans],
  );

  const selectedPlan = useMemo(() => {
    if (orderedPlans.length === 0) {
      return null;
    }

    return (
      orderedPlans.find((item) => item.plan.id === selectedPlanId) ??
      orderedPlans[0]
    );
  }, [orderedPlans, selectedPlanId]);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-6"
    >
      <DashboardPageHeader
        icon={<Package className="h-5 w-5" weight="fill" />}
        badge={t("headerBadge")}
        description={t("headerDescription")}
      />

      {error ? (
        <div
          className="rounded-[--radius] border border-border bg-muted p-4 text-sm text-destructive-ink"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <CircleNotch
            className="h-8 w-8 animate-spin text-primary-ink"
            weight="bold"
          />
        </div>
      ) : forbidden ? (
        <div className="rounded-[--radius] border border-dashed border-border bg-background px-4 py-10 text-center">
          <Package
            className="mx-auto h-8 w-8 text-muted-foreground"
            weight="fill"
          />
          <p className="mt-3 text-sm font-medium text-foreground">
            {t("forbiddenTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("forbiddenDescription")}
          </p>
        </div>
      ) : orderedPlans.length === 0 ? (
        <div className="rounded-[--radius] border border-dashed border-border bg-background px-4 py-10 text-center">
          <Package
            className="mx-auto h-8 w-8 text-muted-foreground"
            weight="fill"
          />
          <p className="mt-3 text-sm font-medium text-foreground">
            {t("emptyTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("emptyDescription")}
          </p>
        </div>
      ) : (
        <>
          <PlanCatalogRail
            labels={{
              available: plansT("list.available"),
              basePrice: plansT("list.basePrice"),
              best: t("bestBadge"),
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
            plans={orderedPlans}
            exchangeRate={exchangeRate}
            selectedPlanId={selectedPlan?.plan.id ?? null}
            onSelect={setSelectedPlanId}
          />

          {selectedPlan ? (
            <section className="space-y-6 rounded-[--radius] border border-border bg-card p-5 sm:p-6">
              <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-2xs font-semibold text-primary-ink">
                    {plansT("subscription.availableBadge")}
                  </p>
                  <h2 className="mt-1 font-display text-xl font-semibold tracking-[0.01em] text-foreground">
                    {selectedPlan.plan.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedPlan.plan.description ||
                      plansT("list.noDescription")}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-xs text-muted-foreground">
                    {plansT("list.basePrice")}
                  </p>
                  <p className="font-display text-2xl font-semibold tabular-nums text-foreground">
                    {formatBRLFromCents(
                      selectedPlan.plan.basePriceBRLCents,
                      locale,
                    )}
                  </p>
                </div>
              </header>

              {selectedPlan.plan.pricingItems!.length > 0 ? (
                <>
                  <PlanEstimatesPanel
                    basePriceBRLCents={selectedPlan.plan.basePriceBRLCents}
                    items={selectedPlan.plan.pricingItems!}
                    exchangeRate={exchangeRate}
                    locale={locale}
                    t={plansT}
                  />

                  <PlanPricingTable
                    items={selectedPlan.plan.pricingItems!}
                    exchangeRate={exchangeRate}
                    t={plansT}
                  />
                </>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </motion.main>
  );
}
