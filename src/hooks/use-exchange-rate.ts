"use client";

import { useEffect, useState } from "react";

import { getExchangeRateAction } from "@/app/actions/pricing";
import { exchangeRateFromMicros } from "@/lib/pricing/currency";

export function useExchangeRate(enabled = true): number | null {
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void getExchangeRateAction().then((rate) => {
      if (!cancelled) setExchangeRate(exchangeRateFromMicros(rate.item?.priceMicros));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return exchangeRate;
}
