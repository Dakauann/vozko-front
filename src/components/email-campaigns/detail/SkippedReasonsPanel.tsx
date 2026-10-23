"use client";

import { useTranslations } from "next-intl";

import { CompareBars, type CompareRow } from "@/components/charts/vozko";
import { PanelSection } from "@/components/dashboard/PanelSection";
import type { Metrics } from "@/lib/email-campaigns/types";

import { EMAIL_SERIES_COLOR, useEmailFormat } from "../shared";

export function SkippedReasonsPanel({ metrics, className }: { metrics: Metrics; className?: string }) {
  const t = useTranslations("emailCampaigns.detail.skipped");
  const tSkip = useTranslations("emailCampaigns.skip");
  const { number, locale } = useEmailFormat();
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const rows: CompareRow[] = Object.entries(metrics.skipped ?? {})
    .map(([reason, count]) => ({ reason, count: count ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((row) => ({
      key: row.reason,
      label: tSkip.has(row.reason) ? tSkip(row.reason) : row.reason,
      value: row.count,
      display: number(row.count),
      hint: metrics.recipients > 0 ? percent.format(row.count / metrics.recipients) : undefined,
      color: EMAIL_SERIES_COLOR.skipped,
    }));

  return (
    <PanelSection boxed className={className} title={t("title")} description={t("description")} legend={t("legend", { count: metrics.skipped_total })}>
      {rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t("none")}</p> : <CompareBars rows={rows} size="md" />}
    </PanelSection>
  );
}
