"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { ArrowSquareOut } from "@/components/icons";
import { CompareBars, type CompareRow } from "@/components/charts/vozko";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { FunnelChart } from "@/components/dashboard/attendance/dispatch-report";
import { ChartSkeleton, useMetricsFmt } from "@/components/dashboard/attendance/primitives";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { useDispatchReportSection } from "@/hooks/use-dispatch-report-section";
import { presetRange } from "@/lib/attendance/period";
import { funnelStages, ratio, type DispatchReportParams } from "@/lib/whatsapp-campaigns/dispatch-report";
import { resolveWhatsAppCampaignErrorDisplay } from "@/lib/whatsapp-campaigns/error-display";

const LIVE_REPORT_REFRESH_MS = 60_000;
const FAILURE_REASON_LIMIT = 6;

export function useCampaignReport(campaignId: string, running: boolean) {
  const params: DispatchReportParams = useMemo(() => ({ campaignId, ...presetRange("7d") }), [campaignId]);
  const refetchInterval = running ? LIVE_REPORT_REFRESH_MS : undefined;
  const summary = useDispatchReportSection("summary", params, { enabled: true, refetchInterval });
  const failures = useDispatchReportSection("failures", params, { enabled: true, refetchInterval });
  return { summary, failures };
}

type CampaignReport = ReturnType<typeof useCampaignReport>;

export function CampaignFullReportLink({ campaignId }: { campaignId: string }) {
  const t = useTranslations("whatsappCampaignsPage.detail.delivery");
  return (
    <Link
      href={`/dashboard/attendance?campaignId=${campaignId}&campaignType=whatsapp#att-dispatch`}
      className="inline-flex h-8 items-center gap-1.5 rounded-[--radius] px-2 text-xs font-semibold text-foreground hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {t("fullReport")}
      <ArrowSquareOut className="h-3.5 w-3.5" weight="bold" aria-hidden />
    </Link>
  );
}

export function CampaignFunnelPanel({ report, className }: { report: CampaignReport; className?: string }) {
  const t = useTranslations("whatsappCampaignsPage.detail.delivery");
  const fmt = useMetricsFmt();
  const funnel = report.summary.data?.funnel;

  return (
    <PanelSection boxed className={className} title={t("funnelTitle")} legend={t("funnelLegend")} description={t("funnelSubtitle")}>
      <SectionState query={report.summary}>
        {funnel ? <FunnelChart stages={funnelStages(funnel)} fmt={fmt} /> : <ChartSkeleton height={190} />}
      </SectionState>
    </PanelSection>
  );
}

export function CampaignFailuresPanel({ report, className }: { report: CampaignReport; className?: string }) {
  const t = useTranslations("whatsappCampaignsPage.detail.delivery");
  const tc = useTranslations("whatsappCampaignsPage");
  const fmt = useMetricsFmt();
  const failed = report.summary.data?.funnel.failed ?? 0;
  const reasons = report.failures.data?.reasons ?? [];
  const rows: CompareRow[] = reasons.slice(0, FAILURE_REASON_LIMIT).map((reason) => ({
    key: String(reason.code),
    label: resolveWhatsAppCampaignErrorDisplay({
      errorCode: reason.code,
      hasTranslation: (key) => tc.has(key),
      translate: (key) => tc(key),
      unknownMessage: tc("detail.metaErrors.0"),
    }).description,
    value: reason.count,
    display: fmt.num(reason.count),
    hint: fmt.pct(ratio(reason.count, failed)),
    color: "hsl(var(--destructive))",
  }));

  return (
    <PanelSection boxed className={className} title={t("failuresTitle")} description={t("failuresSubtitle")} legend={t("failuresLegend", { count: failed })}>
      <SectionState query={report.failures}>
        {report.failures.isPending ? (
          <ChartSkeleton height={120} />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noFailures")}</p>
        ) : (
          <CompareBars rows={rows} size="md" />
        )}
      </SectionState>
    </PanelSection>
  );
}
