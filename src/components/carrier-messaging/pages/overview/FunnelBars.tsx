"use client";

import { useTranslations } from "next-intl";

import { CompareBars } from "@/components/charts/vozko";
import type { FunnelRates, FunnelTotals } from "@/lib/carrier-messaging/analytics";

import { useCountText, useRateText } from "./carrier-query";

type FunnelStep = { key: keyof FunnelTotals; rate?: keyof FunnelRates };

const STEPS: readonly FunnelStep[] = [
  { key: "sent" },
  { key: "delivered", rate: "delivery" },
  { key: "read", rate: "read" },
  { key: "clicks", rate: "click_through" },
  { key: "replies", rate: "reply" },
  { key: "conversions", rate: "conversion" },
];

export function FunnelBars({ totals, rates, className }: { totals: FunnelTotals; rates: FunnelRates; className?: string }) {
  const tFunnel = useTranslations("carrierMessaging.funnel");
  const tRates = useTranslations("carrierMessaging.rates");
  const count = useCountText();
  const rate = useRateText();
  return (
    <CompareBars
      className={className}
      size="lg"
      rows={STEPS.map((step) => ({
        key: step.key,
        label: tFunnel(step.key),
        value: totals[step.key],
        display: count(totals[step.key]),
        hint: step.rate ? `${tRates(step.rate)} ${rate(rates[step.rate])}` : undefined,
      }))}
    />
  );
}
