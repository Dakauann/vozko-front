"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { getAdLiveInsightsAction, getAdsReportAction, getAdsTrendAction } from "@/app/actions/advertising";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { trendScope } from "@/lib/advertising/manager-insights";
import {
  HOUR_BREAKDOWN,
  TREND_GRANULARITIES,
  TREND_METRICS,
  rowsFromHours,
  rowsFromTrend,
  type TrendGranularity,
  type TrendMetric,
} from "@/lib/advertising/trend-series";
import type { AdAccount, AdLiveInsights, AdRange, AdReport, AdRow, AdTrend } from "@/lib/advertising/types";

import { AdsKpiStrip } from "../ads-kpi-strip";
import { AdsTrendChart } from "../ads-trend-chart";
import { useAdsFormat } from "../use-ads-format";
import { useAdsResource } from "../wizard/use-ads-resource";

const NO_RANGE: AdRange = { since: "", until: "" };

export function InsightsPerformance({ account, row, range }: { account: AdAccount; row: AdRow; range: AdRange | null }) {
  const t = useTranslations("adsManager.insights.performance");
  const tTrend = useTranslations("adsManager.trend");
  const fmt = useAdsFormat();
  const [metric, setMetric] = useState<TrendMetric>("results");
  const [granularity, setGranularity] = useState<TrendGranularity>("day");
  const period = range ?? NO_RANGE;
  const base = range ? `${account.id}:${row.metaId}:${range.since}:${range.until}:${account.lastSyncedAt ?? ""}` : null;
  const hourly = granularity === "hour";
  const trendGranularity = granularity === "hour" ? "day" : granularity;

  const report = useAdsResource<AdReport>(base ? `insights-report:${base}` : null, () =>
    getAdsReportAction(account.id, { level: row.level, range: period, objectIds: [row.metaId], compare: true }),
  );
  const trend = useAdsResource<AdTrend>(base && !hourly ? `insights-trend:${base}:${granularity}` : null, () =>
    getAdsTrendAction(account.id, { range: period, ...trendScope(row), granularity: trendGranularity }),
  );
  const hours = useAdsResource<AdLiveInsights>(base && hourly ? `insights-hours:${base}` : null, () =>
    getAdLiveInsightsAction(account.id, { level: row.level, range: period, objectIds: [row.metaId], breakdowns: [HOUR_BREAKDOWN] }),
  );

  const series = hourly ? hours : trend;
  const hourRows = hours.status === "ready" ? rowsFromHours(hours.data.rows ?? []) : [];
  const trendRows = trend.status === "ready" ? rowsFromTrend(trend.data.points ?? [], trendGranularity, fmt.tag) : [];
  const rows = hourly ? hourRows : trendRows;
  const data = report.status === "ready" ? report.data : null;

  return (
    <div className="space-y-4">
      {report.status === "error" ? <p className="text-sm text-destructive-ink">{report.message}</p> : null}
      <AdsKpiStrip
        totals={data?.totals ?? null}
        outcome={data?.outcome ?? null}
        previous={data?.previous ?? null}
        loading={report.status === "loading"}
        columns={4}
      />
      {series.status === "error" ? <p className="text-sm text-destructive-ink">{series.message}</p> : null}
      <AdsTrendChart
        rows={rows}
        series={[{ metric, mark: "bar", axis: "left" }]}
        currency={data?.totals.currency || account.currency}
        loading={series.status === "loading"}
        title={t(`by.${granularity}`, { metric: tTrend(`metrics.${metric}`) })}
        subtitle={hourly ? t("hourNote") : tTrend("subtitle")}
        toolbar={
          <>
            <ElevatedPillToggle<TrendGranularity>
              size="sm"
              value={granularity}
              onChange={setGranularity}
              options={TREND_GRANULARITIES.map((value) => ({ value, label: t(`granularity.${value}`) }))}
            />
            <ElevatedSelect value={metric} onValueChange={(value) => setMetric(value as TrendMetric)} aria-label={t("metric")}>
              {TREND_METRICS.map(({ key }) => (
                <ElevatedSelectItem key={key} value={key}>
                  {tTrend(`metrics.${key}`)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          </>
        }
      />
    </div>
  );
}
