"use client";

import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { ElevatedSegmentedControl } from "@/components/elevated-design/elevated-segmented-control";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { X } from "@/components/icons";
import { breakdownToggleAllowed, toggleBreakdown, toggleMetric } from "@/lib/advertising/reports";
import type { AdLevel, AdReportDefinition, AdReportOptions } from "@/lib/advertising/types";

import { IconAction } from "../icon-action";
import type { ReportLabels } from "./use-report-labels";

function CheckRow({ id, label, checked, disabled, onToggle }: { id: string; label: string; checked: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={onToggle} />
      <label htmlFor={id} className="text-sm text-foreground peer-disabled:text-muted-foreground">
        {label}
      </label>
    </li>
  );
}

export function ReportCustomizePanel({
  definition,
  options,
  labels,
  onChange,
  onClose,
}: {
  definition: AdReportDefinition;
  options: AdReportOptions;
  labels: ReportLabels;
  onChange: (definition: AdReportDefinition) => void;
  onClose: () => void;
}) {
  const t = useTranslations("adsReports.panel");
  const trend = definition.view === "trend";

  return (
    <aside aria-label={t("title")} className="rounded-[--radius] border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        <IconAction label={t("close")} onClick={onClose}>
          <X className="h-4 w-4" />
        </IconAction>
      </div>
      <Tabs defaultValue="breakdowns" className="px-4 pb-4 pt-3">
        <TabsList>
          <TabsTrigger value="breakdowns">{t("tabs.breakdowns")}</TabsTrigger>
          <TabsTrigger value="metrics">{t("tabs.metrics")}</TabsTrigger>
        </TabsList>
        <TabsContent value="breakdowns" className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{t("level")}</p>
            <ElevatedSegmentedControl
              options={options.levels.map((level) => ({ value: level, label: t(`levels.${level}`) }))}
              value={definition.level}
              onChange={(level) => onChange({ ...definition, level: level as AdLevel })}
              size="sm"
              columns={3}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">{t("breakdowns")}</p>
            <ul>
              {options.breakdowns.map((breakdown) => (
                <CheckRow
                  key={breakdown}
                  id={`report-breakdown-${breakdown}`}
                  label={labels.breakdown(breakdown)}
                  checked={definition.breakdowns.includes(breakdown)}
                  disabled={trend || !breakdownToggleAllowed(definition.breakdowns, breakdown, options.breakdownGroups)}
                  onToggle={() => onChange({ ...definition, breakdowns: toggleBreakdown(definition.breakdowns, breakdown) })}
                />
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{t("breakdownsHint")}</p>
          </div>
        </TabsContent>
        <TabsContent value="metrics" className="space-y-1">
          {trend ? <p className="text-xs text-muted-foreground">{t("trendHint")}</p> : null}
          <ul>
            {options.metrics.map((metric) => (
              <CheckRow
                key={metric}
                id={`report-metric-${metric}`}
                label={labels.metric(metric)}
                checked={definition.metrics.includes(metric)}
                disabled={trend && !options.trendMetrics.includes(metric)}
                onToggle={() => onChange({ ...definition, metrics: toggleMetric(definition.metrics, metric) })}
              />
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
