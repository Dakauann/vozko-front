"use client";

import {
  AffiliateBrandChip,
  PlansCarousel,
  type AffiliateBrand,
} from "@/components/plans/plans-carousel";

import type { PublicPlanDetails } from "@/lib/workspace-plan/types";
import { useTranslations } from "next-intl";

export type { AffiliateBrand };

interface PricingSectionProps {
  plans: PublicPlanDetails[];
  exchangeRate?: number;
  annualDiscountPct?: number;
  affiliateBrand?: AffiliateBrand | null;
}

export function PricingSection({
  plans,
  exchangeRate = 6.0,
  annualDiscountPct = 0,
  affiliateBrand,
}: PricingSectionProps) {
  const t = useTranslations("pricing");
  void annualDiscountPct; 

  return (
    <section
      id="pricing"
      className="relative overflow-hidden bg-background py-24 md:py-32"
    >
      {/* Subtle background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[1000px] h-[600px] rounded-full opacity-15"
          style={{
            background:
              "radial-gradient(ellipse, rgba(59,130,246,0.2) 0%, rgba(16,185,129,0.06) 50%, transparent 70%)",
            filter: "blur(100px)",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-6 md:px-10">
        {/* Header */}
        <div className="relative text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-semibold text-muted-foreground dark:text-info">
            {t("badge")}
          </span>
          <h2 className="mt-4 text-3xl font-semibold md:text-5xl text-foreground">
            {t("title")}
          </h2>
          <p className="mt-4 text-sm text-muted-foreground md:text-base max-w-2xl mx-auto">
            {t("description")}
          </p>

          {/* Affiliate signature, top-right on md+, centered below on mobile */}
          {affiliateBrand && (
            <>
              <div className="hidden md:block absolute top-0 right-0">
                <AffiliateBrandChip brand={affiliateBrand} />
              </div>
              <div className="md:hidden mt-5 flex justify-center">
                <AffiliateBrandChip brand={affiliateBrand} />
              </div>
            </>
          )}
        </div>

        <PlansCarousel
          plans={plans}
          exchangeRate={exchangeRate}
          affiliateBrand={affiliateBrand}
        />

        <p className="mt-10 text-center text-xs text-muted-foreground max-w-xl mx-auto">
          {t("footer")}
        </p>
      </div>
    </section>
  );
}
