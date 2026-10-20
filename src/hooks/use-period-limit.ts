"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { periodOfferKey, periodOffers } from "@/lib/period-limit/offers";
import { checkPeriodLimit } from "@/lib/period-limit/period-limit";

export function usePeriodOffer(view: string, from: string, to: string, exceeded: boolean) {
  const key = periodOfferKey(view, from, to);
  const settled = useSyncExternalStore(
    periodOffers.subscribe,
    () => periodOffers.isSettled(key),
    () => true,
  );
  const settle = useCallback(() => periodOffers.settle(key), [key]);

  return { key, dialogOpen: exceeded && !settled, settle };
}

export function usePeriodLimit(view: string, from: string, to: string, maxDays: number) {
  const check = useMemo(() => checkPeriodLimit(from, to, maxDays), [from, to, maxDays]);
  const offer = usePeriodOffer(view, from, to, check.exceeded);

  return { ...check, ...offer };
}
