"use client";

import { useMemo, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChatsCircle,
  CheckCircle,
  CurrencyDollar,
  Megaphone,
  PaperPlaneTilt,
  SealCheck,
  Target,
  Users,
  WarningCircle,
  WhatsappLogo,
} from "@/components/icons";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { vozGrid, vozXAxis, vozYAxis } from "@/components/charts/vozko";
import { DonutBreakdown, type DonutSlice } from "@/components/charts/donut-breakdown";
import { ShareRows } from "@/components/charts/share-rows";
import { channelPlate } from "@/components/channels/channel-tile";
import { getWhatsAppCampaignStatsAction } from "@/app/actions/analysis";
import { useWorkspace } from "@/contexts/workspace-context";
import { useDispatchReportSection } from "@/hooks/use-dispatch-report-section";
import { useInView } from "@/hooks/use-in-view";
import { useSectionQuery } from "@/hooks/use-section-query";
import { SectionError as SectionQueryError } from "@/lib/analytics/section-query";
import type { AnalysisStats } from "@/lib/analysis/types";
import {
  clampToReportWindow,
  dispatchReportSectionKey,
  DISPATCH_REPORT_MAX_DAYS,
  funnelStages,
  ratio,
  type CampaignFunnel,
  type DispatchFunnel,
  type DispatchReportDaily,
  type DispatchReportParams,
  type FunnelStage,
} from "@/lib/whatsapp-campaigns/dispatch-report";
import { resolveWhatsAppCampaignErrorDisplay } from "@/lib/whatsapp-campaigns/error-display";

import {
  Chapter,
  ChartSkeleton,
  EmptyChart,
  SectionNotice,
  SectionTitle,
  Surface,
  localeTagFor,
  useMetricsFmt,
  type MetricsFmt,
} from "./primitives";
import { SectionState } from "./section-state";

type StageKey = FunnelStage["key"];

const STAGE_COLOR: Record<StageKey, string> = {
  base: "hsl(var(--muted-foreground) / 0.55)",
  sent: "hsl(var(--chart-2))",
  delivered: "hsl(var(--chart-1))",
  read: "hsl(var(--info))",
  replied: "hsl(var(--chart-5))",
  interested: "hsl(var(--healthy))",
};

const STAGE_ICON: Record<StageKey, typeof Users> = {
  base: Users,
  sent: PaperPlaneTilt,
  delivered: CheckCircle,
  read: SealCheck,
  replied: ChatsCircle,
  interested: Target,
};

const DAILY_SERIES = {
  sent: STAGE_COLOR.base,
  delivered: STAGE_COLOR.delivered,
  read: STAGE_COLOR.read,
  replied: STAGE_COLOR.replied,
} as const;

const REASON_LIMIT = 5;
const FUNNEL_ROW = 38;
const FUNNEL_MIN_WIDTH = 8;

function ShareTable({
  head,
  rows,
  total,
  fmt,
}: {
  head: { label: string; count: string; share: string };
  rows: { key: string; label: string; value: number; color?: string }[];
  total: number;
  fmt: MetricsFmt;
}) {
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="border-b border-border text-2xs text-muted-foreground">
          <th className="py-1.5 pr-2 text-left font-semibold">{head.label}</th>
          <th className="w-20 py-1.5 pl-2 text-right font-semibold">{head.count}</th>
          <th className="w-16 py-1.5 pl-2 text-right font-semibold">{head.share}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-border last:border-0">
            <td className="py-1.5 pr-2">
              <span className="flex min-w-0 items-center gap-1.5">
                {row.color ? (
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: row.color }} />
                ) : null}
                <span className="truncate text-foreground" title={row.label}>
                  {row.label}
                </span>
              </span>
            </td>
            <td className="readout py-1.5 pl-2 text-right tabular-nums text-foreground">{fmt.num(row.value)}</td>
            <td className="readout py-1.5 pl-2 text-right tabular-nums text-muted-foreground">
              {fmt.pct(ratio(row.value, total))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScopeTag({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-[--radius] bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

type KpiCell = { key: string; icon: typeof Users; color: string; label: string; value: string; note: string };

function KpiStrip({ cells }: { cells: KpiCell[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[--radius] border border-border bg-border sm:grid-cols-4 xl:grid-cols-7 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
      {cells.map((cell) => (
        <div key={cell.key} className="min-w-0 bg-card px-4 py-3">
          <dt className="flex items-center gap-1.5">
            <cell.icon className="h-5 w-5 shrink-0" weight="fill" style={{ color: cell.color }} />
            <span className="truncate text-xs font-semibold text-muted-foreground">{cell.label}</span>
          </dt>
          <dd className="readout mt-2 truncate font-display text-[1.75rem] leading-none font-semibold tracking-tight text-foreground">
            {cell.value}
          </dd>
          <dd className="truncate text-2xs text-muted-foreground" title={cell.note}>
            {cell.note}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function FunnelChart({ stages, fmt }: { stages: FunnelStage[]; fmt: MetricsFmt }) {
  const t = useTranslations("metricsOps.attendance.dispatch");
  const widths = stages.map((s) => Math.max(FUNNEL_MIN_WIDTH, Math.min(100, s.pctOfBase ?? 0)));
  const height = stages.length * FUNNEL_ROW;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-start gap-3">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
        {stages.map((stage, i) => {
          const top = widths[i];
          const bottom = i + 1 < widths.length ? widths[i + 1] : top * 0.7;
          const y = i * FUNNEL_ROW + 1;
          const h = FUNNEL_ROW - 3;
          return (
            <polygon
              key={stage.key}
              points={`${50 - top / 2},${y} ${50 + top / 2},${y} ${50 + bottom / 2},${y + h} ${50 - bottom / 2},${y + h}`}
              fill={STAGE_COLOR[stage.key]}
            />
          );
        })}
      </svg>
      <ul>
        {stages.map((stage) => (
          <li
            key={stage.key}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-sm"
            style={{ height: FUNNEL_ROW }}
          >
            <span className="readout w-16 text-right font-semibold tabular-nums text-foreground">
              {stage.value === null ? "·" : fmt.num(stage.value)}
            </span>
            <span className="truncate text-muted-foreground">{t(`stage.${stage.key}.label`)}</span>
            <span className="readout tabular-nums text-muted-foreground">{fmt.pct(stage.pctOfBase)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DailyChart({ daily, fmt }: { daily: DispatchReportDaily; fmt: MetricsFmt }) {
  const t = useTranslations("metricsOps.attendance.dispatch.daily");
  const config: ChartConfig = {
    sent: { label: t("sent"), color: DAILY_SERIES.sent },
    delivered: { label: t("delivered"), color: DAILY_SERIES.delivered },
    read: { label: t("read"), color: DAILY_SERIES.read },
    replied: { label: t("replied"), color: DAILY_SERIES.replied },
  };
  const data = useMemo(
    () => daily.days.map((d) => ({ ...d, label: `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}` })),
    [daily.days],
  );

  if (!daily.days.some((d) => d.sent + d.delivered + d.read + d.replied > 0)) {
    return <EmptyChart icon={<PaperPlaneTilt className="h-8 w-8" weight="fill" />} message={t("empty")} height={260} />;
  }
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }} barGap={1}>
        <CartesianGrid {...vozGrid} />
        <XAxis dataKey="label" minTickGap={12} {...vozXAxis} />
        <YAxis allowDecimals={false} {...vozYAxis} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span className="flex w-full justify-between gap-3">
                  <span className="text-muted-foreground">{config[String(name)]?.label}</span>
                  <span className="font-semibold tabular-nums">{fmt.num(Number(value))}</span>
                </span>
              )}
            />
          }
        />
        <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
        {(Object.keys(DAILY_SERIES) as (keyof typeof DAILY_SERIES)[]).map((key) => (
          <Bar key={key} dataKey={key} fill={DAILY_SERIES[key]} radius={[2, 2, 0, 0]} maxBarSize={10} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

function StatusDonut({ funnel, fmt }: { funnel: DispatchFunnel; fmt: MetricsFmt }) {
  const t = useTranslations("metricsOps.attendance.dispatch.status");
  const slices: DonutSlice[] = [
    { key: "delivered", label: t("delivered"), value: funnel.delivered, color: STAGE_COLOR.delivered },
    { key: "awaiting", label: t("awaiting"), value: funnel.awaitingDelivery, color: "hsl(var(--warning))" },
    { key: "failed", label: t("failed"), value: funnel.failed, color: "hsl(var(--destructive))" },
    { key: "pending", label: t("pending"), value: funnel.pending, color: "hsl(var(--muted-foreground) / 0.55)" },
    { key: "notEligible", label: t("notEligible"), value: funnel.notEligible, color: "hsl(var(--muted-foreground) / 0.3)" },
  ].filter((slice) => slice.value > 0 || slice.key === "delivered" || slice.key === "failed");

  return (
    <DonutBreakdown
      slices={slices}
      total={funnel.base}
      centerValue={fmt.num(funnel.sent)}
      centerLabel={t("center")}
      formatValue={fmt.num}
      formatShare={fmt.pct}
    />
  );
}

function FailureReasons({ params, failed, fmt }: { params: DispatchReportParams; failed: number; fmt: MetricsFmt }) {
  const t = useTranslations("metricsOps.attendance.dispatch.status");
  const tc = useTranslations("whatsappCampaignsPage");
  const failures = useDispatchReportSection("failures", params, { enabled: true });

  return (
    <SectionState query={failures}>
      {failures.isPending ? (
        <ChartSkeleton height={72} />
      ) : !failures.data?.reasons.length ? (
        <p className="py-2 text-xs text-muted-foreground">{t("noFailures")}</p>
      ) : (
        <ShareTable
          head={{ label: t("reasons"), count: t("count"), share: "%" }}
          total={failed}
          fmt={fmt}
          rows={failures.data.reasons.map((reason) => ({
            key: String(reason.code),
            label: resolveWhatsAppCampaignErrorDisplay({
              errorCode: reason.code,
              hasTranslation: (key) => tc.has(key),
              translate: (key) => tc(key),
              unknownMessage: tc("detail.metaErrors.0"),
            }).description,
            value: reason.count,
          }))}
        />
      )}
    </SectionState>
  );
}

function CampaignComparison({
  rows,
  total,
  fmt,
  onSelect,
}: {
  rows: CampaignFunnel[];
  total: DispatchFunnel;
  fmt: MetricsFmt;
  onSelect: (campaignId: string) => void;
}) {
  const t = useTranslations("metricsOps.attendance.dispatch.compare");
  const rate = (part: number, whole: number) => fmt.pct(ratio(part, whole));
  const columns = [t("base"), t("sent"), t("delivery"), t("read"), t("reply"), t("failed")];

  return (
    <div className="max-h-[440px] overflow-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border text-2xs text-muted-foreground">
            <th className="py-1.5 pr-2 text-left font-semibold">{t("campaign")}</th>
            {columns.map((label) => (
              <th key={label} className="py-1.5 pl-2 text-right font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.campaignId} className="border-b border-border hover:bg-muted">
              <td className="py-1.5 pr-2">
                <button
                  type="button"
                  onClick={() => onSelect(row.campaignId)}
                  className="block max-w-[16rem] truncate text-left font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={row.campaignName}
                >
                  {row.campaignName}
                </button>
              </td>
              <td className="readout py-1.5 pl-2 text-right tabular-nums text-foreground">{fmt.num(row.base)}</td>
              <td className="readout py-1.5 pl-2 text-right tabular-nums text-foreground">{fmt.num(row.sent)}</td>
              <td className="readout py-1.5 pl-2 text-right tabular-nums text-foreground">{rate(row.delivered, row.sent)}</td>
              <td className="readout py-1.5 pl-2 text-right tabular-nums text-foreground">{rate(row.read, row.delivered)}</td>
              <td className="readout py-1.5 pl-2 text-right tabular-nums text-foreground">{rate(row.replied, row.read)}</td>
              <td className="readout py-1.5 pl-2 text-right tabular-nums text-destructive-ink">
                {row.failed > 0 ? fmt.num(row.failed) : <span className="text-muted-foreground">0</span>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 bg-muted font-semibold">
          <tr>
            <td className="py-1.5 pr-2 text-foreground">{t("total")}</td>
            <td className="readout py-1.5 pl-2 text-right tabular-nums">{fmt.num(total.base)}</td>
            <td className="readout py-1.5 pl-2 text-right tabular-nums">{fmt.num(total.sent)}</td>
            <td className="readout py-1.5 pl-2 text-right tabular-nums">{rate(total.delivered, total.sent)}</td>
            <td className="readout py-1.5 pl-2 text-right tabular-nums">{rate(total.read, total.delivered)}</td>
            <td className="readout py-1.5 pl-2 text-right tabular-nums">{rate(total.replied, total.read)}</td>
            <td className="readout py-1.5 pl-2 text-right tabular-nums">{fmt.num(total.failed)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function OutcomePanel({ stats, fmt }: { stats: AnalysisStats; fmt: MetricsFmt }) {
  const t = useTranslations("metricsOps.attendance.dispatch.outcome");
  const ta = useTranslations("whatsappCampaignsPage.analysis");
  if (stats.totalAnalyses === 0) {
    return <EmptyChart icon={<Target className="h-8 w-8" weight="fill" />} message={t("empty")} height={180} />;
  }
  return (
    <div className="space-y-3">
      <ShareRows
        total={stats.totalAnalyses}
        formatValue={fmt.num}
        formatShare={fmt.pct}
        rows={[
          { key: "interested", label: ta("interest.interested"), value: stats.interestInterested, color: "hsl(var(--healthy))" },
          { key: "notInterested", label: ta("interest.notInterested"), value: stats.interestNotInterested, color: "hsl(var(--destructive))" },
          { key: "undecided", label: ta("interest.undecided"), value: stats.interestUndecided, color: "hsl(var(--warning))" },
        ]}
      />
      <div className="border-t border-border pt-2.5">
        <ShareRows
          total={stats.totalAnalyses}
          formatValue={fmt.num}
          formatShare={fmt.pct}
          rows={[
            { key: "sale", label: ta("disposition.sale"), value: stats.dispositionSale, color: "hsl(var(--chart-1))" },
            { key: "callback", label: ta("disposition.callback"), value: stats.dispositionCallback, color: "hsl(var(--info))" },
            { key: "declined", label: ta("disposition.declined"), value: stats.dispositionDeclined, color: "hsl(var(--destructive))" },
            { key: "noAnswer", label: ta("disposition.noAnswer"), value: stats.dispositionNoAnswer, color: "hsl(var(--muted-foreground) / 0.55)" },
            { key: "pending", label: ta("disposition.pending"), value: stats.dispositionPending, color: "hsl(var(--warning))" },
          ]}
        />
      </div>
      <p className="text-2xs text-muted-foreground">{t("analyzed", { count: fmt.num(stats.totalAnalyses) })}</p>
    </div>
  );
}

async function fetchCampaignOutcomes(campaignId: string): Promise<AnalysisStats> {
  const { stats, error } = await getWhatsAppCampaignStatsAction(campaignId);
  if (error) throw new SectionQueryError(error);
  return stats;
}

export function DispatchReportChapter({
  campaignId,
  departmentId,
  dateFrom,
  dateTo,
  conversions,
  canReadAnalysis,
  onSelectCampaign,
}: {
  campaignId?: string;
  departmentId?: string;
  dateFrom: string;
  dateTo: string;
  conversions: number | null;
  canReadAnalysis: boolean;
  onSelectCampaign: (campaignId: string) => void;
}) {
  const t = useTranslations("metricsOps.attendance.dispatch");
  const te = useTranslations("metricsOps.attendance.executive");
  const locale = useLocale();
  const fmt = useMetricsFmt();
  const { currentWorkspace } = useWorkspace();
  const [lowerRef, lowerInView] = useInView<HTMLDivElement>();
  const period = clampToReportWindow(dateFrom, dateTo);
  const params: DispatchReportParams = { campaignId, departmentId, dateFrom: period.from, dateTo: period.to };
  const single = Boolean(campaignId);

  const summary = useDispatchReportSection("summary", params, { enabled: true });
  const daily = useDispatchReportSection("daily", params, { enabled: true });
  const breakdown = useDispatchReportSection("campaigns", params, { enabled: !single });
  const tags = useDispatchReportSection("tags", params, { enabled: lowerInView });
  const outcomes = useSectionQuery<AnalysisStats>({
    queryKey: dispatchReportSectionKey(currentWorkspace?.id ?? "", "outcomes", params),
    queryFn: () => fetchCampaignOutcomes(campaignId ?? ""),
    enabled: single && canReadAnalysis && Boolean(currentWorkspace?.id),
  });

  const funnel = summary.data?.funnel;
  const interested = !single ? undefined : canReadAnalysis && outcomes.data ? outcomes.data.interestInterested : null;
  const stages = funnel ? funnelStages(funnel, interested) : [];
  const trackedSince = funnel?.trackedSince
    ? new Date(funnel.trackedSince).toLocaleDateString(localeTagFor(locale))
    : null;
  const snapshotScope = single ? t("scopeCampaign") : t("scopePeriod");

  const cells: KpiCell[] = stages.map((stage) => ({
    key: stage.key,
    icon: STAGE_ICON[stage.key],
    color: STAGE_COLOR[stage.key],
    label: t(`stage.${stage.key}.label`),
    value: stage.value === null ? t("unknown") : fmt.num(stage.value),
    note:
      stage.key === "base"
        ? single
          ? t("stage.base.rate")
          : t("stage.base.rateAll")
        : stage.pctOfPrevious === null
          ? t("unknown")
          : t(`stage.${stage.key}.rate`, { pct: fmt.pct(stage.pctOfPrevious) }),
  }));
  if (funnel && single) {
    cells.push({
      key: "converted",
      icon: CurrencyDollar,
      color: "hsl(var(--healthy))",
      label: t("conversions.label"),
      value: conversions === null ? t("unknown") : fmt.num(conversions),
      note: t("conversions.rate"),
    });
  }
  if (funnel && !single) {
    cells.push(
      {
        key: "failed",
        icon: WarningCircle,
        color: "hsl(var(--destructive))",
        label: t("stage.failed.label"),
        value: fmt.num(funnel.failed),
        note: t("stage.failed.rate", { pct: fmt.pct(ratio(funnel.failed, funnel.base)) }),
      },
      {
        key: "campaigns",
        icon: Megaphone,
        color: "hsl(var(--chart-3))",
        label: t("campaignsCount.label"),
        value: breakdown.data ? fmt.num(breakdown.data.campaigns.length) : "·",
        note: t("campaignsCount.rate"),
      },
    );
  }

  const heading = {
    id: "att-dispatch",
    icon: <WhatsappLogo className="h-4 w-4" weight="fill" />,
    iconBg: channelPlate("whatsapp"),
    title: `${t("title")} · ${single ? summary.data?.campaignName || t("unknown") : t("allCampaigns")}`,
    subtitle: single ? t("sub", { template: summary.data?.templateName || t("unknown") }) : t("subAll"),
  };

  if (funnel && funnel.base === 0) {
    return (
      <Chapter {...heading}>
        <SectionNotice title={t("empty.title")} message={single ? t("empty.campaign") : t("empty.all")} />
      </Chapter>
    );
  }

  return (
    <Chapter {...heading}>
      <SectionState query={summary}>
        {summary.isPending || !funnel ? <ChartSkeleton height={88} /> : <KpiStrip cells={cells} />}

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-12">
          <Surface className="xl:col-span-4">
            <SectionTitle title={t("funnel.title")} subtitle={t("funnel.sub")} action={<ScopeTag>{snapshotScope}</ScopeTag>} />
            {funnel ? <FunnelChart stages={stages} fmt={fmt} /> : <ChartSkeleton height={180} />}
          </Surface>

          <Surface className="lg:col-span-2 lg:row-start-2 xl:col-span-5 xl:row-start-auto">
            <SectionTitle title={t("daily.title")} subtitle={t("daily.sub")} action={<ScopeTag>{t("scopePeriod")}</ScopeTag>} />
            <SectionState query={daily}>
              {daily.isPending ? <ChartSkeleton height={260} /> : <DailyChart daily={daily.data!} fmt={fmt} />}
            </SectionState>
            <p className="mt-1.5 text-2xs text-muted-foreground">
              {trackedSince ? t("daily.trackedSince", { date: trackedSince }) : funnel ? t("daily.notTracked") : null}
              {period.clamped ? ` · ${t("daily.clamped", { days: DISPATCH_REPORT_MAX_DAYS })}` : null}
              {daily.data ? ` · ${te("timezoneNote", { timezone: daily.data.timezone })}` : null}
            </p>
          </Surface>

          <Surface className="xl:col-span-3">
            <SectionTitle title={t("status.title")} subtitle={t("status.sub")} action={<ScopeTag>{snapshotScope}</ScopeTag>} />
            {funnel ? (
              <div className="space-y-3">
                <StatusDonut funnel={funnel} fmt={fmt} />
                <div className="border-t border-border pt-2">
                  <FailureReasons params={params} failed={funnel.failed} fmt={fmt} />
                </div>
              </div>
            ) : (
              <ChartSkeleton height={260} />
            )}
          </Surface>
        </div>
      </SectionState>

      <div ref={lowerRef} className="grid gap-3 lg:grid-cols-2 xl:grid-cols-12">
        {single ? (
          <>
            <Surface className="xl:col-span-4">
              <SectionTitle title={t("outcome.title")} subtitle={t("outcome.sub")} action={<ScopeTag>{t("scopeCampaign")}</ScopeTag>} />
              {!canReadAnalysis ? (
                <p className="py-6 text-center text-xs text-muted-foreground">{t("outcome.noAccess")}</p>
              ) : (
                <SectionState query={outcomes}>
                  {outcomes.isPending ? <ChartSkeleton height={180} /> : <OutcomePanel stats={outcomes.data!} fmt={fmt} />}
                </SectionState>
              )}
            </Surface>

            <Surface className="xl:col-span-4">
              <SectionTitle title={t("reasons.title")} subtitle={t("reasons.sub")} />
              {!canReadAnalysis ? (
                <p className="py-6 text-center text-xs text-muted-foreground">{t("outcome.noAccess")}</p>
              ) : (
                <SectionState query={outcomes}>
                  {outcomes.isPending ? (
                    <ChartSkeleton height={180} />
                  ) : !outcomes.data!.subjects.length ? (
                    <EmptyChart icon={<ChatsCircle className="h-8 w-8" weight="fill" />} message={t("reasons.empty")} height={180} />
                  ) : (
                    <ShareTable
                      head={{ label: t("reasons.reason"), count: t("reasons.count"), share: t("reasons.share") }}
                      total={outcomes.data!.totalAnalyses}
                      fmt={fmt}
                      rows={outcomes.data!.subjects.slice(0, REASON_LIMIT).map((subject) => ({
                        key: subject.key,
                        label: subject.label || subject.key,
                        value: subject.count,
                      }))}
                    />
                  )}
                </SectionState>
              )}
            </Surface>
          </>
        ) : (
          <Surface className="lg:col-span-2 xl:col-span-8">
            <SectionTitle title={t("compare.title")} subtitle={t("compare.sub")} action={<ScopeTag>{t("scopePeriod")}</ScopeTag>} />
            <SectionState query={breakdown}>
              {breakdown.isPending || !funnel ? (
                <ChartSkeleton height={220} />
              ) : breakdown.data!.campaigns.length === 0 ? (
                <EmptyChart icon={<Megaphone className="h-8 w-8" weight="fill" />} message={t("compare.empty")} height={180} />
              ) : (
                <CampaignComparison rows={breakdown.data!.campaigns} total={funnel} fmt={fmt} onSelect={onSelectCampaign} />
              )}
            </SectionState>
          </Surface>
        )}

        <Surface className={single ? "xl:col-span-4" : "lg:col-span-2 xl:col-span-4"}>
          <SectionTitle title={t("tags.title")} subtitle={t("tags.sub")} action={<ScopeTag>{snapshotScope}</ScopeTag>} />
          <SectionState query={tags}>
            {tags.isPending || !funnel ? (
              <ChartSkeleton height={180} />
            ) : tags.data!.tags.length === 0 ? (
              <EmptyChart icon={<Target className="h-8 w-8" weight="fill" />} message={t("tags.empty")} height={180} />
            ) : (
              <ShareTable
                head={{ label: t("tags.tag"), count: t("tags.count"), share: t("tags.share") }}
                total={funnel.base}
                fmt={fmt}
                rows={tags.data!.tags.map((tag) => ({
                  key: tag.labelId,
                  label: tag.name,
                  value: tag.count,
                  color: tag.color || "hsl(var(--chart-3))",
                }))}
              />
            )}
          </SectionState>
        </Surface>
      </div>
    </Chapter>
  );
}
