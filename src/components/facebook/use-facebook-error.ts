"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { facebookErrorKey } from "@/lib/facebook/errors";

export function useFacebookError() {
  const t = useTranslations("facebook");
  return useCallback(
    (failure: { error: string; code?: string }) => {
      const key = facebookErrorKey(failure.code);
      return key ? t(key) : failure.error;
    },
    [t],
  );
}
