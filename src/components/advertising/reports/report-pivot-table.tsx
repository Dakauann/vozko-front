"use client";

import { useTranslations } from "next-intl";

import { pivotRows } from "@/lib/advertising/reports-run";
import type { AdLevel, AdReportRun } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

import type { ReportLabels } from "./use-report-labels";

const HEAD = "whitespace-nowrap px-3 py-2 text-2xs font-semibold text-muted-foreground";
const CELL = "whitespace-nowrap px-3 py-2";

export function ReportPivotTable({ run, level, labels }: { run: AdReportRun; level: AdLevel; labels: ReportLabels }) {
  const t = useTranslations("adsReports.editor");
  const rows = pivotRows(run.rows);
  return (
    <div className="overflow-x-auto rounded-[--radius] border border-border bg-card shadow-sm">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border-strong bg-muted">
            <th scope="col" className={cn(HEAD, "sticky left-0 z-10 bg-muted")}>
              {t(`object.${level}`)}
            </th>
            {run.breakdowns.map((breakdown) => (
              <th key={breakdown} scope="col" className={HEAD}>
                {labels.breakdown(breakdown)}
              </th>
            ))}
            {run.metrics.map((metric) => (
              <th key={metric} scope="col" className={cn(HEAD, "text-right")}>
                {labels.metric(metric)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={cn(row.groupStart ? "border-t border-border" : "border-t border-border/40")}>
              <th scope="row" className={cn(CELL, "sticky left-0 max-w-[14rem] truncate bg-card font-medium text-foreground")} title={row.name}>
                {row.groupStart ? row.name : <span className="sr-only">{row.name}</span>}
              </th>
              {row.dimensions.map((value, index) => (
                <td key={run.breakdowns[index]} className={cn(CELL, "text-foreground")}>
                  {labels.value(run.breakdowns[index], value)}
                </td>
              ))}
              {run.metrics.map((metric) => (
                <td key={metric} className={cn(CELL, "text-right tabular-nums text-foreground")}>
                  {labels.formatMetric(run, metric, row.values[metric])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border-strong bg-muted font-semibold">
            <th scope="row" className={cn(CELL, "sticky left-0 bg-muted text-foreground")} colSpan={1 + run.breakdowns.length}>
              {t("total")}
            </th>
            {run.metrics.map((metric) => (
              <td key={metric} className={cn(CELL, "text-right tabular-nums text-foreground")}>
                {labels.formatMetric(run, metric, run.totals[metric])}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
