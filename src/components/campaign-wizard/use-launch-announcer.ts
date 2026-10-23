"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";

import type { DraftLaunchResult } from "@/lib/campaign-drafts/types";

export function useLaunchAnnouncer() {
  const t = useTranslations("campaignWizard");
  return useCallback(
    (outcome: DraftLaunchResult, startRefusalText: (code: string) => string | null) => {
      for (const warning of outcome.warnings) {
        toast.error(t("toast.warning"), { description: t.has(`warnings.${warning}`) ? t(`warnings.${warning}`) : warning });
      }
      if (outcome.mode === "now" && !outcome.started) {
        const refusal = outcome.startRefusal ? startRefusalText(outcome.startRefusal) : null;
        toast.error(t("toast.notStarted"), { description: refusal ?? t("toast.notStartedBody") });
        return;
      }
      toast.success(outcome.mode === "now" ? t("toast.started") : outcome.mode === "schedule" ? t("toast.scheduled") : t("toast.readied"));
    },
    [t],
  );
}
