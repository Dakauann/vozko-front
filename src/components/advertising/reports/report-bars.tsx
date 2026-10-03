"use client";

import { useTranslations } from "next-intl";

import { reportBars } from "@/lib/advertising/reports-run";
import type { AdLevel, AdReportRun } from "@/lib/advertising/types";

import type { ReportLabels } from "./use-report-labels";

export function ReportBars({
  run,
  level,
  labels,
}: {
  run: AdReportRun;
  level: AdLevel;
  labels: ReportLabels;
}) {
  const t = useTranslations("adsReports.editor");
  const metric = run.metrics[0];
  const bars = reportBars(run, labels.value);
  const peak = Math.max(0, ...bars.map((bar) => bar.value ?? 0));
  const dimension = run.breakdowns.length > 0 ? labels.group(run.breakdowns) : t(`object.${level}`);

  return (
    <figure className="rounded-[--radius] border border-border bg-card shadow-sm">
      <figcaption className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">
        {t("barsOf", { metric: labels.metric(metric), dimension })}
      </figcaption>
      <ul className="space-y-2.5 p-4">
        {bars.map((bar) => {
          const width = peak > 0 && bar.value ? (bar.value / peak) * 100 : 0;
          return (
            <li key={bar.key} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]">
              <span className="truncate text-sm text-foreground" title={bar.label}>
                {bar.label}
              </span>
              <span className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full bg-chart-1" style={{ width: `${width}%` }} />
              </span>
              <span className="text-right text-sm tabular-nums text-foreground">{labels.formatMetric(run, metric, bar.value)}</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
