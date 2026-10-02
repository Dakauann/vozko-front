"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";

import { localeTagFor } from "@/components/dashboard/attendance/primitives";
import { formatCount, formatDecimal, formatMicros, formatMinor, formatPercent, formatRoas } from "@/lib/advertising/money";

export function useAdsFormat() {
  const locale = useLocale();
  const tag = localeTagFor(locale);
  return useMemo(
    () => ({
      tag,
      micros: (value: number | null | undefined, currency: string) => formatMicros(value, currency, tag),
      minor: (value: number | null | undefined, currency: string) => formatMinor(value, currency, tag),
      count: (value: number | null | undefined) => formatCount(value, tag),
      percent: (value: number | null | undefined) => formatPercent(value, tag),
      roas: (value: number | null | undefined) => formatRoas(value, tag),
      decimal: (value: number | null | undefined, digits = 2) => formatDecimal(value, tag, digits),
    }),
    [tag],
  );
}

export type AdsFormat = ReturnType<typeof useAdsFormat>;
