"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ProgressRing, VozAreaGradient, vozGrid, vozLineMark, vozRing, vozXAxis, vozYAxis } from "@/components/charts/vozko";
import { ProgressBar, SentimentBadge } from "@/components/dashboard/analysis-primitives";
import { InstrumentStrip, type Instrument } from "@/components/console/page-shapes";
import type { CommentAnalysisStats, CommentStance, TrendPoint } from "@/lib/comment-analysis/types";
import { COMMENT_STANCES, HIGH_SEVERITY_THRESHOLD } from "@/lib/comment-analysis/types";
import { EmptyState, Panel, STANCE_COLOR, Skeleton, percent } from "@/components/instagram/comment-analysis-shared";
import { ChartLineUp } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
 * The "Audiência" overview. Every figure here is the same arithmetic the
 * back-end domain ran: the acceptance ring shows `acceptanceScore` as
 * delivered, the stance ring is the four counters, and the trend is the
 * daily rollup series. Nothing is recomputed on the client.
 */

const LOCALE_TAG: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", de: "de-DE" };

export function CommentAnalysisOverview({
  stats,
  trend,
  loading,
  layout = "page",
}: {
  stats: CommentAnalysisStats | null;
  trend: TrendPoint[];
  loading: boolean;
  /**
   * "page" lays the panels out by viewport breakpoints (the account tab and
   * the Métricas page). "narrow" is for a column that stays narrow on every
   * viewport, such as the post dialog: everything stacks, the ring sits above
   * its explainer, and the strip is two across. Tailwind 3 has no container
   * queries here, so the caller says which it is.
   */
  layout?: "page" | "narrow";
}) {
  const narrow = layout === "narrow";
  const t = useTranslations("commentAnalysis.overview");
  const tStance = useTranslations("commentAnalysis.enums.stance");
  const tSent = useTranslations("commentAnalysis.enums.sentiment");
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_TAG[locale] ?? "pt-BR"), [locale]);

  const analyzed = stats?.analyzed ?? 0;

  const stanceSlices = useMemo(() => {
    if (!stats) return [];
    const values: Record<CommentStance, number> = {
      supporter: stats.stanceSupporter,
      neutral: stats.stanceNeutral,
      critic: stats.stanceCritic,
      hostile: stats.stanceHostile,
    };
    // Fixed order, never re-mapped by a filter: colour follows the entity.
    return COMMENT_STANCES.map((s) => ({ key: s, name: tStance(s), value: values[s], color: STANCE_COLOR[s] })).filter(
      (s) => s.value > 0,
    );
  }, [stats, tStance]);

  const stanceConfig: ChartConfig = useMemo(
    () => Object.fromEntries(COMMENT_STANCES.map((s) => [s, { label: tStance(s), color: STANCE_COLOR[s] }])),
    [tStance],
  );

  const trendConfig: ChartConfig = useMemo(
    () => ({
      analyzed: { label: t("trend.series"), color: "hsl(var(--chart-1))" },
    }),
    [t],
  );

  const trendData = useMemo(
    () =>
      trend.map((p) => ({
        date: p.bucketDate.slice(5).replace("-", "/"),
        analyzed: p.analyzed,
        hostile: p.stanceHostile,
        score: p.acceptanceScore,
      })),
    [trend],
  );

  const instruments: Instrument[] = [
    { label: t("tiles.analyzed"), value: nf.format(analyzed), detail: t("tiles.analyzedDetail", { total: nf.format(stats?.total ?? 0) }) },
    {
      label: t("tiles.requiresAction"),
      value: nf.format(stats?.requiresActionCount ?? 0),
      detail: t("tiles.requiresActionDetail"),
      tone: (stats?.requiresActionCount ?? 0) > 0 ? "warning" : "default",
    },
    {
      label: t("tiles.highSeverity"),
      value: nf.format(stats?.severityHighCount ?? 0),
      detail: t("tiles.highSeverityDetail", { threshold: HIGH_SEVERITY_THRESHOLD }),
      tone: (stats?.severityHighCount ?? 0) > 0 ? "fault" : "default",
    },
    {
      label: t("tiles.flaggedAuthors"),
      value: nf.format(stats?.flaggedAuthors ?? 0),
      detail: t("tiles.flaggedAuthorsDetail", { authors: nf.format(stats?.distinctAuthors ?? 0) }),
      tone: (stats?.flaggedAuthors ?? 0) > 0 ? "fault" : "default",
    },
  ];

  if (loading && !stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <InstrumentStrip instruments={instruments} columns={narrow ? 2 : 4} compact loading={loading} />

      <div className={cn("grid gap-4", !narrow && "lg:grid-cols-2")}>
        <Panel title={t("score.title")} description={t("score.description")}>
          <div className={cn("flex flex-col items-center gap-4", !narrow && "sm:flex-row sm:items-center sm:gap-8")}>
            <ProgressRing
              value={stats?.acceptanceScore ?? 50}
              label={t("score.label")}
              size={136}
              strokeWidth={12}
              color={scoreColor(stats?.acceptanceScore ?? 50)}
            />
            <div className="min-w-0 flex-1 space-y-2 text-sm text-muted-foreground">
              <p>{t("score.explainer")}</p>
              {analyzed < 30 ? <p className="text-xs">{t("score.smallSample", { count: analyzed })}</p> : null}
              {(stats?.pending ?? 0) > 0 ? (
                <p className="text-xs">{t("score.pending", { count: nf.format(stats?.pending ?? 0) })}</p>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel title={t("stance.title")} description={t("stance.description")}>
          {stanceSlices.length === 0 ? (
            <EmptyState icon={<ChartLineUp weight="duotone" />} title={t("empty.title")} description={t("empty.description")} />
          ) : (
            <div className={cn("grid grid-cols-1 items-center gap-3", !narrow && "sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.9fr)]")}>
              <ChartContainer config={stanceConfig} className="mx-auto h-[180px] w-full max-w-[200px]">
                <PieChart>
                  <Pie data={stanceSlices} dataKey="value" nameKey="name" cx="50%" cy="50%" {...vozRing(72, 60)}>
                    {stanceSlices.map((s) => (
                      <Cell key={s.key} fill={s.color} />
                    ))}
                  </Pie>
                  <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground font-display text-xl font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {nf.format(analyzed)}
                  </text>
                  <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-[hsl(var(--muted-foreground))] text-[10px] font-medium">
                    {t("stance.center")}
                  </text>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        nameKey="name"
                        formatter={(value, name) => (
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">{String(name)}</span>
                            <span className="font-semibold tabular-nums">
                              {nf.format(Number(value))} ({percent(Number(value), analyzed)}%)
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                </PieChart>
              </ChartContainer>
              {/* The legend is never colour-alone: name, count and share. */}
              <ul className="space-y-1.5">
                {COMMENT_STANCES.map((s) => {
                  const value = stats
                    ? { supporter: stats.stanceSupporter, neutral: stats.stanceNeutral, critic: stats.stanceCritic, hostile: stats.stanceHostile }[s]
                    : 0;
                  return (
                    <li key={s} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STANCE_COLOR[s] }} aria-hidden />
                        {tStance(s)}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {nf.format(value)} <span className="font-normal text-muted-foreground">({percent(value, analyzed)}%)</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <div className={cn("grid gap-4", !narrow && "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]")}>
        <Panel title={t("sentiment.title")} description={t("sentiment.description")}>
          <div className="grid grid-cols-3 gap-2">
            <SentimentBadge type="positive" value={stats?.sentimentPositive ?? 0} total={analyzed} />
            <SentimentBadge type="neutral" value={stats?.sentimentNeutral ?? 0} total={analyzed} delay={0.05} />
            <SentimentBadge type="negative" value={stats?.sentimentNegative ?? 0} total={analyzed} delay={0.1} />
          </div>
          <div className="mt-4 space-y-3">
            <ProgressBar label={tSent("positive")} value={stats?.sentimentPositive ?? 0} total={analyzed} color="hsl(var(--healthy))" />
            <ProgressBar label={tSent("neutral")} value={stats?.sentimentNeutral ?? 0} total={analyzed} color="hsl(var(--muted-foreground))" delay={0.05} />
            <ProgressBar label={tSent("negative")} value={stats?.sentimentNegative ?? 0} total={analyzed} color="hsl(var(--destructive))" delay={0.1} />
          </div>
        </Panel>

        <Panel title={t("trend.title")} description={t("trend.description")}>
          {trendData.length === 0 ? (
            <EmptyState icon={<ChartLineUp weight="duotone" />} title={t("trend.emptyTitle")} description={t("trend.emptyDescription")} />
          ) : (
            <ChartContainer config={trendConfig} className="h-[220px] w-full">
              <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <VozAreaGradient id="ca-trend" color="hsl(var(--chart-1))" />
                </defs>
                <CartesianGrid {...vozGrid} />
                <XAxis {...vozXAxis} dataKey="date" minTickGap={24} />
                <YAxis {...vozYAxis} allowDecimals={false} width={32} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) => {
                        const row = item?.payload as { hostile?: number; score?: number } | undefined;
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold tabular-nums">
                              {nf.format(Number(value))} {t("trend.series").toLowerCase()}
                            </span>
                            <span className="text-muted-foreground">
                              {t("trend.tooltipHostile", { count: nf.format(row?.hostile ?? 0) })} · {t("trend.tooltipScore", { score: row?.score ?? 0 })}
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Area {...vozLineMark} dataKey="analyzed" type="monotone" stroke="hsl(var(--chart-1))" fill="url(#voz-fill-ca-trend)" />
              </AreaChart>
            </ChartContainer>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** The ring reports a state, so it takes a status token by band. */
function scoreColor(score: number): string {
  if (score >= 70) return "hsl(var(--healthy))";
  if (score >= 45) return "hsl(var(--warning))";
  return "hsl(var(--destructive))";
}
