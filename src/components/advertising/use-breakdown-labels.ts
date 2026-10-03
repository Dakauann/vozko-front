"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { useWizardLabels } from "./wizard/use-wizard-labels";

export function useBreakdownLabel() {
  const t = useTranslations("adsManager.breakdown");
  return useCallback(
    (group: string[]) => group.map((breakdown) => (t.has(`groups.${breakdown}`) ? t(`groups.${breakdown}`) : breakdown)).join(" + "),
    [t],
  );
}

export function useBreakdownValueLabel() {
  const t = useTranslations("adsManager.breakdown");
  const labels = useWizardLabels();
  return useCallback(
    (breakdown: string, value: string) => {
      if (!value) return t("values.unknown");
      if (breakdown === "publisher_platform") return labels.placement(value);
      if (breakdown === "platform_position") return labels.position(value);
      return t.has(`values.${value}`) ? t(`values.${value}`) : value;
    },
    [t, labels],
  );
}
