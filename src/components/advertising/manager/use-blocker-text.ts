"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import type { ActionState } from "@/lib/advertising/manager-toolbar";

export function useBlockerText(accountReason: string | null) {
  const t = useTranslations("adsManager.toolbar.blockers");
  return useCallback(
    (state: ActionState): string | null => {
      if (state.enabled) return null;
      if (state.reason === "account" && accountReason) return accountReason;
      return t(state.reason);
    },
    [t, accountReason],
  );
}

export type BlockerText = ReturnType<typeof useBlockerText>;
