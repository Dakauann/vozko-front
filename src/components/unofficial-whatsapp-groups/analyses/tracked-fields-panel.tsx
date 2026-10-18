"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { listGroupAnalysisRunsAction } from "@/app/actions/unofficial-whatsapp-groups";
import { Skeleton } from "@/components/audience/shared";
import { ProgressRing, VOZ_SERIES } from "@/components/charts/vozko";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { ListBullets, PencilSimple } from "@/components/icons";
import type { AnalysisRun, TrackedField } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { PanelFault } from "../kit/chart-panel";
import { Readout } from "../kit/chart-parts";
import { GROUPS_CHART_COLOR, TrendArea, type TrendDatum } from "../kit/charts";
import { HAIRLINE_CELL, HAIRLINE_GRID } from "../kit/hairline";
import { GroupsChapter } from "../kit/panel";
import type { AnalysisWindow } from "../kit/routes";
import { useGroupsFormat, type GroupsFormat } from "../kit/use-groups-format";
import { numericStats, splitByWindow, trackedFieldSeries, windowSince, type TrackedSeries } from "./analysis-series";

const RUNS_PAGE_SIZE = 100;
const TREND_HEIGHT = 120;
const TEXT_VALUES = 5;
const TRACKED_COLOR = VOZ_SERIES[2];

function fieldColumns(count: number): string {
  if (count >= 3) return "md:grid-cols-2 xl:grid-cols-3";
  if (count === 2) return "md:grid-cols-2";
  return "";
}

async function runsWithinWindow(analysisId: string, days: AnalysisWindow): Promise<{ runs: AnalysisRun[]; error?: string }> {
  const since = windowSince(days, new Date());
  const runs: AnalysisRun[] = [];
  for (let page = 1; ; page += 1) {
    const result = await listGroupAnalysisRunsAction(analysisId, { page, pageSize: RUNS_PAGE_SIZE });
    if (result.error) return { runs, error: result.error };
    const window = splitByWindow(result.items, since);
    runs.push(...window.runs);
    if (window.passed || page >= result.meta.totalPages || result.items.length === 0) return { runs };
  }
}

export function TrackedFieldsChapter({
  analysisId,
  fields,
  days,
  windowDays,
  timezone,
  version,
  onEdit,
}: {
  analysisId: string;
  fields: TrackedField[];
  days: AnalysisWindow;
  windowDays: number;
  timezone: string;
  version: number;
  onEdit?: () => void;
}) {
  const t = useTranslations("unofficialGroups.analyses.trackedV2");
  const tp = useTranslations("unofficialGroups.analyses.period");
  const [loaded, setLoaded] = useState<{ key: string; runs: AnalysisRun[]; error: string | null } | null>(null);
  const [retry, setRetry] = useState(0);
  const hasFields = fields.length > 0;
  const requestKey = `${analysisId}:${days}:${version}:${retry}`;
  const loading = hasFields && loaded?.key !== requestKey;

  useEffect(() => {
    if (!hasFields) return;
    let cancelled = false;
    void runsWithinWindow(analysisId, days).then((result) => {
      if (cancelled) return;
      setLoaded({ key: requestKey, runs: result.runs, error: result.error ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [analysisId, days, hasFields, requestKey]);

  const series = useMemo(() => trackedFieldSeries(fields, loaded?.runs ?? []), [fields, loaded]);
  const subtitle = windowDays === 0 ? tp("subtitleAll", { timezone }) : tp("subtitleDays", { days: windowDays, timezone });

  return (
    <GroupsChapter id="analysis-tracked" icon={<ListBullets />} title={t("title")} subtitle={hasFields ? subtitle : undefined}>
      {!hasFields ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">{t("none")}</p>
          {onEdit ? (
            <Button variant="ghost" size="sm" title={t("edit")} icon={<PencilSimple className="h-3.5 w-3.5" weight="bold" />} iconVisible iconSide="left" onClick={onEdit} />
          ) : null}
        </div>
      ) : loaded?.error && !loading ? (
        <PanelFault error={{ message: loaded.error, onRetry: () => setRetry((value) => value + 1) }} />
      ) : (
        <div className={cn(HAIRLINE_GRID, fieldColumns(fields.length))}>
          {loading
            ? fields.map((field) => (
                <div key={field.key} className={cn(HAIRLINE_CELL, "p-4")}>
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="mt-3 h-[168px] w-full" />
                </div>
              ))
            : series.map((entry) => <TrackedFieldCell key={entry.key} series={entry} color={TRACKED_COLOR} timezone={timezone} />)}
        </div>
      )}
    </GroupsChapter>
  );
}

function TrackedFieldCell({ series, color, timezone }: { series: TrackedSeries; color: string; timezone: string }) {
  const t = useTranslations("unofficialGroups.analyses");
  const fmt = useGroupsFormat(timezone);
  return (
    <section className={cn(HAIRLINE_CELL, "p-4")}>
      <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
        <h3 className="truncate font-mono text-xs font-semibold text-foreground" title={series.key}>
          {series.key}
        </h3>
        <span className="shrink-0 text-2xs text-muted-foreground">{t(`form.fieldTypes.${series.type}`)}</span>
      </div>
      <div className="pt-3">
        {series.type === "text" ? (
          <TextSeries series={series} fmt={fmt} />
        ) : series.type === "boolean" ? (
          <BooleanSeries series={series} color={color} fmt={fmt} />
        ) : (
          <NumericSeries series={series} color={color} fmt={fmt} />
        )}
      </div>
    </section>
  );
}

function NoValues() {
  const t = useTranslations("unofficialGroups.analyses.tracked");
  return <p className="py-6 text-center text-xs text-muted-foreground">{t("noValues")}</p>;
}

function NumericSeries({ series, color, fmt }: { series: Extract<TrackedSeries, { type: "number" | "percentage" }>; color: string; fmt: GroupsFormat }) {
  const t = useTranslations("unofficialGroups.analyses.tracked");
  const tv = useTranslations("unofficialGroups.analyses.trackedV2");
  const percent = series.type === "percentage";
  const show = (value: number) => (percent ? fmt.pct(value) : fmt.num(Math.round(value * 100) / 100));
  const stats = numericStats(series.points);
  const data: TrendDatum[] = series.points.map((point, index) => ({
    key: `${point.cycle}-${index}`,
    label: tv("cycleShort", { cycle: point.cycle }),
    value: point.value,
    tip: [
      { key: "at", label: tv("when"), value: fmt.dateTime(point.at) },
      { key: "value", label: series.key, value: point.value === null ? tv("unanswered") : show(point.value), color },
    ],
  }));

  if (series.answered === 0 || !stats) return <NoValues />;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xs text-muted-foreground">{t("latest")}</span>
        <span className="readout font-display text-xl font-semibold tabular-nums text-foreground">{series.latest === null ? <EmptyValue /> : show(series.latest)}</span>
      </div>
      <TrendArea data={data} color={color} height={TREND_HEIGHT} domain={percent ? [0, 100] : undefined} formatY={(value) => (percent ? fmt.pct(value, 0) : fmt.compact(value))} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Readout label={tv("min")} value={show(stats.min)} />
        <Readout label={tv("avg")} value={show(stats.avg)} />
        <Readout label={tv("max")} value={show(stats.max)} />
      </div>
      <p className="text-2xs text-muted-foreground">{t("answered", { count: series.answered, total: series.points.length })}</p>
    </div>
  );
}

function BooleanSeries({ series, color, fmt }: { series: Extract<TrackedSeries, { type: "boolean" }>; color: string; fmt: GroupsFormat }) {
  const t = useTranslations("unofficialGroups.analyses.tracked");
  const tv = useTranslations("unofficialGroups.analyses.trackedV2");
  const tr = useTranslations("unofficialGroups.analyses.result");
  if (series.trueShare === null) return <NoValues />;
  const noCount = series.answered - series.trueCount;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <ProgressRing value={series.trueShare} size={72} strokeWidth={7} color={color} label={t("yesShare")}>
          <span className="readout font-display text-base font-semibold leading-none tabular-nums text-foreground">{fmt.pct(series.trueShare, 0)}</span>
        </ProgressRing>
        <div className="min-w-0 space-y-1 text-xs">
          <p className="readout text-foreground">{tv("yesNo", { yes: series.trueCount, no: noCount })}</p>
          <p className="text-muted-foreground">{t("answered", { count: series.answered, total: series.points.length })}</p>
        </div>
      </div>
      <div>
        <p className="mb-1 text-2xs text-muted-foreground">{tv("perCycle")}</p>
        <ol className="flex flex-wrap gap-1" aria-label={tv("perCycle")}>
          {series.points.map((point, index) => {
            const answer = point.value === null ? tv("unanswered") : point.value ? tr("yes") : tr("no");
            const label = tv("cycleAnswer", { cycle: point.cycle, answer });
            return (
              <li
                key={`${point.cycle}-${index}`}
                title={`${label} · ${fmt.dateTime(point.at)}`}
                aria-label={label}
                className={cn("h-3 w-3 rounded-[2px]", point.value === null && "border border-border bg-card")}
                style={point.value === null ? undefined : { backgroundColor: point.value ? color : GROUPS_CHART_COLOR.neutral }}
              />
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function TextSeries({ series, fmt }: { series: Extract<TrackedSeries, { type: "text" }>; fmt: GroupsFormat }) {
  const t = useTranslations("unofficialGroups.analyses.tracked");
  const tv = useTranslations("unofficialGroups.analyses.trackedV2");
  if (series.values.length === 0) return <NoValues />;
  return (
    <div className="space-y-1.5">
      <p className="text-2xs text-muted-foreground">{t("latestValues")}</p>
      <ul className="divide-y divide-border">
        {series.values.slice(0, TEXT_VALUES).map((entry) => (
          <li key={`${entry.cycle}-${entry.at}`} className="py-1.5">
            <p className="break-words text-xs text-foreground">{entry.value}</p>
            <p className="readout text-[11px] text-muted-foreground">
              {tv("cycleShort", { cycle: entry.cycle })} · {fmt.dateTime(entry.at)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
