"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { ReportLabelTexts } from "@/lib/advertising/reports-run";
import type { AdLevel, AdReportMetric, AdReportRun } from "@/lib/advertising/types";

import { useBreakdownLabel, useBreakdownValueLabel } from "../use-breakdown-labels";
import { useAdsFormat } from "../use-ads-format";

export function useReportLabels() {
  const t = useTranslations("adsReports");
  const fmt = useAdsFormat();
  const groupLabel = useBreakdownLabel();
  const valueLabel = useBreakdownValueLabel();

  return useMemo(() => {
    const metric = (value: AdReportMetric) => t(`metrics.${value}`);
    const breakdown = (value: string) => groupLabel([value]);
    const formatMetric = (run: Pick<AdReportRun, "metricKinds" | "currency">, value: AdReportMetric, amount: number | null | undefined) => {
      switch (run.metricKinds[value]) {
        case "money":
          return fmt.micros(amount, run.currency);
        case "percent":
          return fmt.percent(amount);
        case "decimal":
          return fmt.decimal(amount);
        case "count":
          return fmt.count(amount);
      }
      return fmt.empty;
    };
    const exportTexts = (level: AdLevel): ReportLabelTexts => ({
      object: t(`editor.object.${level}`),
      day: t("editor.day"),
      total: t("editor.total"),
      breakdown,
      value: valueLabel,
      metric,
    });
    return { metric, breakdown, group: groupLabel, value: valueLabel, formatMetric, exportTexts };
  }, [t, fmt, groupLabel, valueLabel]);
}

export type ReportLabels = ReturnType<typeof useReportLabels>;
