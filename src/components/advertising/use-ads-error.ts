"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

export interface AdsErrorLike {
  error: string;
  code?: string;
}

export function useAdsErrorText() {
  const t = useTranslations("adsErrors");
  return useCallback((failure: AdsErrorLike) => (failure.code && t.has(failure.code) ? t(failure.code) : failure.error), [t]);
}
