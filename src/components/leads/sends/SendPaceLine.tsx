"use client";

import { useTranslations } from "next-intl";

import type { SendQuote } from "@/lib/leads/sends";

export function SendPaceLine({ quote, emptyLabel }: { quote: SendQuote; emptyLabel: string }) {
  const t = useTranslations("leadSends.quote");
  return <>{quote.dailyCap ? t("daily", { cap: quote.dailyCap, days: quote.estimatedDays ?? 1 }) : emptyLabel}</>;
}
