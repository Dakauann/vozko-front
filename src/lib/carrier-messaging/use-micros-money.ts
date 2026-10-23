"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";

import { useExchangeRate } from "@/hooks/use-exchange-rate";
import { formatMicrosToMoney } from "@/lib/format/money";

export function useMicrosMoney(enabled = true) {
  const locale = useLocale();
  const rate = useExchangeRate(enabled);
  return useCallback((micros: number | null | undefined) => (rate === null || micros === null || micros === undefined ? null : formatMicrosToMoney(micros, rate, locale)), [rate, locale]);
}
