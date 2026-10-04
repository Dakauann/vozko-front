"use client";

import { useTranslations } from "next-intl";

import { getAdsReportAction } from "@/app/actions/advertising";

import { useAdsFormat } from "../use-ads-format";
import { useAdsResource } from "../wizard/use-ads-resource";

export function TodaySpendHint({
  accountId,
  today,
  currency,
  reloadToken,
  onShowToday,
}: {
  accountId: string;
  today: string;
  currency: string;
  reloadToken: number;
  onShowToday: () => void;
}) {
  const t = useTranslations("adsManager.todaySpend");
  const fmt = useAdsFormat();
  const report = useAdsResource(`today-spend:${accountId}:${today}:${reloadToken}`, () =>
    getAdsReportAction(accountId, { level: "campaign", range: { since: today, until: today } }),
  );
  const spend = report.status === "ready" ? report.data.totals.spend : 0;
  if (spend <= 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-xs text-muted-foreground">
      <span>{t("body", { amount: fmt.micros(spend, currency) })}</span>
      <button type="button" onClick={onShowToday} className="font-semibold text-primary-ink hover:underline">
        {t("action")}
      </button>
    </p>
  );
}
