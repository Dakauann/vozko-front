"use client";

import { useTranslations } from "next-intl";

import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { breakdownRunRequest, type BreakdownRunInput } from "@/lib/advertising/reports-run";
import { MAX_LIVE_OBJECT_IDS } from "@/lib/advertising/report-query";

import { useReportLabels } from "./reports/use-report-labels";
import { useReportRun } from "./reports/use-report-run";
import { useAdsFormat } from "./use-ads-format";
import { useBreakdownLabel, useBreakdownValueLabel } from "./use-breakdown-labels";

export interface BreakdownRequest extends BreakdownRunInput {
  scope: "selection" | "all";
}

export function BreakdownSheet({
  request,
  accountId,
  onClose,
}: {
  request: BreakdownRequest | null;
  accountId: string;
  onClose: () => void;
}) {
  const t = useTranslations("adsManager.breakdown");
  const fmt = useAdsFormat();
  const groupLabel = useBreakdownLabel();
  const valueLabel = useBreakdownValueLabel();
  const labels = useReportLabels();
  const runRequest = request ? breakdownRunRequest(request) : null;
  const run = useReportRun(accountId, runRequest);
  const rows = run.status === "ready" ? run.data.rows : [];

  return (
    <ElevatedSheet open={!!request} onOpenChange={(open) => !open && onClose()}>
      <ElevatedSheetContent side="right" className="flex w-full flex-col sm:max-w-3xl">
        <ElevatedSheetHeader>
          <ElevatedSheetTitle className="text-xl">{request ? t("title", { group: groupLabel(request.group) }) : t("menu")}</ElevatedSheetTitle>
          <ElevatedSheetDescription>
            {request ? t(`scope.${request.scope}`, { count: request.objectIds.length }) : null} {t("liveNote")}
          </ElevatedSheetDescription>
        </ElevatedSheetHeader>
        <div className="flex-1 overflow-auto px-6 pb-6">
          {request && !runRequest ? <p className="text-sm text-muted-foreground">{t("tooMany", { max: MAX_LIVE_OBJECT_IDS })}</p> : null}
          {run.status === "error" ? <p className="text-sm text-destructive-ink">{t("failed", { message: run.message })}</p> : null}
          {run.status === "loading" ? <div className="h-40 animate-pulse rounded-[--radius] bg-muted" /> : null}
          {run.status === "ready" && rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
          {rows.length > 0 && request ? (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-strong bg-muted text-2xs font-semibold text-muted-foreground">
                  {request.group.map((breakdown) => (
                    <th key={breakdown} scope="col" className="px-3 py-2">
                      {t.has(`groups.${breakdown}`) ? t(`groups.${breakdown}`) : breakdown}
                    </th>
                  ))}
                  {run.status === "ready"
                    ? run.data.metrics.map((metric, index) => [
                        <th key={metric} scope="col" className="px-3 py-2 text-right">
                          {labels.metric(metric)}
                        </th>,
                        index === 0 ? (
                          <th key="share" scope="col" className="px-3 py-2">
                            {t("columns.share")}
                          </th>
                        ) : null,
                      ])
                    : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map((row) => (
                  <tr key={row.key}>
                    {row.dimensions.map((value, index) => (
                      <td key={request.group[index]} className="px-3 py-2 text-foreground">
                        {valueLabel(request.group[index], value)}
                      </td>
                    ))}
                    {run.status === "ready"
                      ? run.data.metrics.map((metric, index) => [
                          <td key={metric} className="px-3 py-2 text-right tabular-nums">
                            {labels.formatMetric(run.data, metric, row.values[metric])}
                          </td>,
                          index === 0 ? (
                            <td key="share" className="px-3 py-2">
                              <span className="flex items-center gap-2">
                                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
                                  <span className="block h-full bg-chart-1" style={{ width: `${row.share * 100}%` }} />
                                </span>
                                <span className="text-xs tabular-nums text-muted-foreground">{fmt.percent(row.share * 100)}</span>
                              </span>
                            </td>
                          ) : null,
                        ])
                      : null}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
