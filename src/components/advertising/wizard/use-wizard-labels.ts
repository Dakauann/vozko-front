"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

export function useWizardLabels() {
  const t = useTranslations("adsWizard");
  return useMemo(() => {
    const safe = (key: string, fallback: string) => (fallback && t.has(key) ? t(key) : fallback);
    return {
      objective: (value: string | undefined) => safe(`objective.objectives.${value}.title`, value ?? ""),
      destination: (value: string | undefined) => safe(`adSet.destinations.${value}.title`, value ?? ""),
      goal: (value: string | undefined) => safe(`adSet.goals.${value}`, value ?? ""),
      callToAction: (value: string | undefined) => safe(`cta.${value}`, value ?? ""),
      format: (value: string | undefined) => safe(`ads.formats.${value}.title`, value ?? ""),
      placement: (platform: string) => safe(`placements.platforms.${platform}`, platform),
      position: (position: string) => safe(`placements.positions.${position}`, position),
      pixelEvent: (value: string) => safe(`adSet.pixelEvents.${value}`, value),
    };
  }, [t]);
}
