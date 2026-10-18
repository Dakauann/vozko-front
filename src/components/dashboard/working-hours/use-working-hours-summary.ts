"use client";

import { useTranslations } from "next-intl";

import { summarizeWorkingHours, type WorkingHoursSpec } from "@/lib/working-hours/types";

export function useWorkingHoursSummary(spec: WorkingHoursSpec | null | undefined): string {
  const t = useTranslations("workingHours");
  const summary = summarizeWorkingHours(spec);
  switch (summary.kind) {
    case "alwaysOpen":
      return t("summaryAlwaysOpen");
    case "everyDay":
      return t("summaryEveryDay", { start: summary.start, end: summary.end });
    case "weekdays":
      return t("summaryWeekdays", { start: summary.start, end: summary.end });
    default:
      return t("summaryCustom", { count: summary.openDays });
  }
}
