"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useFormatter, useTranslations } from "next-intl";

import { ChartSkeleton, KpiGroup, SectionError, Surface, SectionTitle, type KpiTile } from "@/components/dashboard/attendance/primitives";
import { ChartLegend, DataChart } from "@/components/charts/dense-charts";
import { ShareRows } from "@/components/charts/share-rows";
import { VOZ_SERIES } from "@/components/charts/vozko";
import { useEmptyValue } from "@/components/elevated-design/empty-value";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ChartPie, ChatCircle, CheckCircle, Eye, Info, PaperPlaneTilt, Timer } from "@/components/icons";
import { GLYPH_PLATE } from "@/components/icons/glyph-plates";
import { Notice } from "@/components/ui/notice";
import { useFieldDistribution, useFormStats } from "@/hooks/use-whatsapp-forms";
import { isBusySectionError } from "@/lib/analytics/section-query";
import type { PeriodQuery } from "@/app/actions/whatsapp-forms";
import { hasOptions } from "@/lib/whatsapp-forms/document-edit";
import { dayEnd, dayStart } from "@/lib/whatsapp-forms/filters";
import type { Field, FormDetail, Stats } from "@/lib/whatsapp-forms/types";

interface PeriodState {
  param: (name: string) => string;
  setParams: (changes: Record<string, string | number | null | undefined>) => void;
}

export interface StatSummary {
  delivered: number;
  sent: number;
  read: number;
  responses: number;
  failed: number;
  rate: number | null;
  medianSeconds: number | null;
}

export function summarizeStats(stats: Stats): StatSummary {
  const sent = (stats.sends.sent ?? 0) + (stats.sends.responded ?? 0);
  return {
    sent,
    delivered: stats.delivered,
    read: stats.read,
    responses: stats.responses,
    failed: stats.sends.failed ?? 0,
    rate: sent > 0 ? (stats.responses / sent) * 100 : null,
    medianSeconds: stats.medianSecondsToRespond ?? null,
  };
}

function useDuration() {
  const format = useFormatter();
  const t = useTranslations("whatsappForms.performance");
  return (seconds: number) => {
    if (seconds < 60) return t("seconds", { value: format.number(Math.round(seconds)) });
    if (seconds < 3600) return t("minutes", { value: format.number(seconds / 60, { maximumFractionDigits: 1 }) });
    if (seconds < 86400) return t("hours", { value: format.number(seconds / 3600, { maximumFractionDigits: 1 }) });
    return t("days", { value: format.number(seconds / 86400, { maximumFractionDigits: 1 }) });
  };
}

function Distribution({ formId, field, period }: { formId: string; field: Field; period: PeriodQuery }) {
  const format = useFormatter();
  const query = useFieldDistribution(formId, field.key, period);
  const empty = useEmptyValue();
  const t = useTranslations("whatsappForms.performance");
  const counts = query.data;
  const rows = (field.options ?? []).map((option, index) => ({ key: option.id, label: option.title, value: counts?.[option.id] ?? 0, color: VOZ_SERIES[index % VOZ_SERIES.length] }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <Surface>
      <SectionTitle title={field.label || field.key} subtitle={t("distributionHint", { count: format.number(total) })} />
      {query.isPending ? <ChartSkeleton height={120} /> : null}
      {query.isError && !counts ? <SectionError busy={isBusySectionError(query.error)} retrying={query.isFetching} onRetry={() => void query.refetch()} /> : null}
      {counts ? (
        total === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">{t("noAnswers")}</p>
        ) : (
          <ShareRows rows={rows} total={total} formatValue={(value) => format.number(value)} formatShare={(pct) => (pct === null ? empty : format.number(pct / 100, { style: "percent", maximumFractionDigits: 1 }))} />
        )
      ) : null}
    </Surface>
  );
}

export function PerformanceTab({ detail, filters }: { detail: FormDetail; filters: PeriodState }) {
  const t = useTranslations("whatsappForms");
  const format = useFormatter();
  const empty = useEmptyValue();
  const duration = useDuration();
  const fromDay = filters.param("from");
  const toDay = filters.param("to");
  const period = useMemo<PeriodQuery>(() => {
    const from = dayStart(fromDay);
    const to = dayEnd(toDay);
    return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
  }, [fromDay, toDay]);
  const query = useFormStats(detail.form.id, period);
  const stats = query.data;
  const summary = stats ? summarizeStats(stats) : null;
  const loading = query.isPending;
  const number = (value: number | undefined) => (value === undefined ? empty : format.number(value));
  const document = (detail.published ?? detail.draft).document;
  const choiceFields = document.screens.flatMap((screen) => screen.blocks.flatMap((block) => (block.field && hasOptions(block.field.kind) ? [block.field] : [])));

  const tiles: KpiTile[] = [
    { key: "sent", label: t("performance.tiles.sent"), short: t("performance.tiles.sentShort", { failed: number(summary?.failed) }), value: loading ? t("common.loading") : number(summary?.sent), hint: t("performance.tiles.sentHint"), icon: PaperPlaneTilt, bg: GLYPH_PLATE.PaperPlaneTilt },
    { key: "delivered", label: t("performance.tiles.delivered"), short: t("performance.tiles.deliveredShort"), value: loading ? t("common.loading") : number(summary?.delivered), hint: t("performance.tiles.deliveredHint"), icon: CheckCircle, bg: GLYPH_PLATE.CheckCircle },
    { key: "read", label: t("performance.tiles.read"), short: t("performance.tiles.readShort"), value: loading ? t("common.loading") : number(summary?.read), hint: t("performance.tiles.readHint"), icon: Eye, bg: GLYPH_PLATE.ChatCircle },
    { key: "responses", label: t("performance.tiles.responses"), short: t("performance.tiles.responsesShort"), value: loading ? t("common.loading") : number(summary?.responses), hint: t("performance.tiles.responsesHint"), icon: ChatCircle, bg: GLYPH_PLATE.ChatCircle },
    {
      key: "rate",
      label: t("performance.tiles.rate"),
      short: t("performance.tiles.rateShort"),
      value: loading ? t("common.loading") : summary?.rate === null || summary === null ? empty : format.number(summary.rate / 100, { style: "percent", maximumFractionDigits: 1 }),
      hint: t("performance.tiles.rateHint"),
      icon: ChartPie,
      bg: GLYPH_PLATE.Percent,
    },
  ];
  const timing: KpiTile[] = [
    {
      key: "median",
      label: t("performance.tiles.median"),
      short: t("performance.tiles.medianShort"),
      value: loading ? t("common.loading") : summary?.medianSeconds === null || summary === null ? empty : duration(summary.medianSeconds),
      hint: t("performance.tiles.medianHint"),
      icon: Timer,
      bg: GLYPH_PLATE.Timer,
    },
  ];

  const days = useMemo(() => [...(stats?.byDay ?? [])].sort((a, b) => a.day.localeCompare(b.day)), [stats]);
  const dayFormat = useMemo(() => new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }), []);
  const dailyOption = useMemo<EChartsOption>(
    () => ({
      grid: { left: 35, right: 6, top: 10, bottom: 25 },
      xAxis: {
        type: "time",
        minInterval: 86400000,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: "hsl(var(--muted-foreground))", fontSize: 10, hideOverlap: true, formatter: (value: number) => dayFormat.format(new Date(value)) },
      },
      yAxis: { type: "value", minInterval: 1, axisLabel: { color: "hsl(var(--muted-foreground))", fontSize: 10 }, splitLine: { lineStyle: { color: "hsl(var(--border))", type: "dashed" } } },
      tooltip: { trigger: "axis" },
      series: [
        { type: "bar", name: t("performance.tiles.sent"), barMaxWidth: 16, itemStyle: { color: VOZ_SERIES[0] }, data: days.map((day) => [Date.parse(`${day.day}T00:00:00Z`), day.sent]) },
        { type: "bar", name: t("performance.tiles.responses"), barMaxWidth: 16, itemStyle: { color: VOZ_SERIES[1] }, data: days.map((day) => [Date.parse(`${day.day}T00:00:00Z`), day.responses]) },
      ],
    }),
    [days, dayFormat, t],
  );
  const totalSent = days.reduce((sum, day) => sum + day.sent, 0);
  const totalResponses = days.reduce((sum, day) => sum + day.responses, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <ElevatedInput label={t("responses.filters.from")} type="date" controlSize="sm" value={filters.param("from")} onChange={(event) => filters.setParams({ from: event.target.value || null })} />
        </div>
        <div className="w-40">
          <ElevatedInput label={t("responses.filters.to")} type="date" controlSize="sm" value={filters.param("to")} onChange={(event) => filters.setParams({ to: event.target.value || null })} />
        </div>
      </div>

      {query.isError && !stats ? <SectionError busy={isBusySectionError(query.error)} retrying={query.isFetching} onRetry={() => void query.refetch()} /> : null}

      <KpiGroup title={t("performance.funnel")} cards={tiles} loading={loading} />
      <KpiGroup title={t("performance.timing")} cards={timing} loading={loading} />

      <Notice tone="info" icon={<Info weight="fill" />} title={t("performance.dropOffTitle")}>
        {t("performance.dropOff")}
      </Notice>

      <div className="grid gap-4 xl:grid-cols-3">
        <Surface className="xl:col-span-2">
          <SectionTitle title={t("performance.daily")} subtitle={t("performance.dailyHint")} />
          {loading ? <ChartSkeleton /> : null}
          {stats && days.length === 0 ? <p className="py-3 text-xs text-muted-foreground">{t("performance.noData")}</p> : null}
          {days.length > 0 ? (
            <div className="space-y-2">
              <DataChart
                option={dailyOption}
                label={t("performance.daily")}
                height={220}
                columns={[t("performance.day"), t("performance.tiles.sent"), t("performance.tiles.responses")]}
                rows={days.map((day) => [day.day, day.sent, day.responses])}
              />
              <ChartLegend
                data={[
                  { key: "sent", label: t("performance.tiles.sent"), value: totalSent, color: VOZ_SERIES[0] },
                  { key: "responses", label: t("performance.tiles.responses"), value: totalResponses, color: VOZ_SERIES[1] },
                ]}
              />
            </div>
          ) : null}
        </Surface>
        <Surface>
          <SectionTitle title={t("performance.byOrigin")} subtitle={t("performance.byOriginHint")} />
          {loading ? <ChartSkeleton height={160} /> : null}
          {stats && stats.byOrigin.length === 0 ? <p className="py-3 text-xs text-muted-foreground">{t("performance.noData")}</p> : null}
          {stats && stats.byOrigin.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="py-1.5 font-medium">{t("responses.columns.origin")}</th>
                  <th scope="col" className="py-1.5 text-right font-medium">{t("performance.tiles.sent")}</th>
                  <th scope="col" className="py-1.5 text-right font-medium">{t("performance.tiles.responses")}</th>
                  <th scope="col" className="py-1.5 text-right font-medium">{t("performance.tiles.rate")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.byOrigin.map((row) => (
                  <tr key={row.origin} className="border-t border-border">
                    <td className="py-1.5 text-foreground">{t(`origin.${row.origin}`)}</td>
                    <td className="py-1.5 text-right tabular-nums">{format.number(row.sent)}</td>
                    <td className="py-1.5 text-right tabular-nums">{format.number(row.responses)}</td>
                    <td className="py-1.5 text-right tabular-nums">{row.sent > 0 ? format.number(row.responses / row.sent, { style: "percent", maximumFractionDigits: 1 }) : empty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Surface>
      </div>

      {choiceFields.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{t("performance.distribution")}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {choiceFields.map((field) => (
              <Distribution key={field.key} formId={detail.form.id} field={field} period={period} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
