"use client";

import { useFormatter, useTranslations } from "next-intl";

import { gradeSummary, type ColorGrade } from "@/lib/studio/color-grade";

export function useGradeSummary(): (grade: ColorGrade | undefined) => string | null {
  const t = useTranslations("studio.grade");
  const format = useFormatter();
  return (grade) => {
    const summary = gradeSummary(grade);
    if (!summary) return null;
    return [
      summary.warmth ? t(`summary.${summary.warmth}`) : null,
      summary.exposure !== null ? t("stops", { value: format.number(summary.exposure, { maximumFractionDigits: 2, signDisplay: "exceptZero" }) }) : null,
      summary.others > 0 ? t("summary.others", { count: summary.others }) : null,
    ]
      .filter((part): part is string => part !== null)
      .join(", ");
  };
}
