"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  BacklogXraySection,
  PeriodProgressStrip,
  ProjectionGrid,
  QualitySection,
  RevenueCard,
  ReworkSection,
  TeamRankingTable,
  TrendSection,
} from "@/components/dashboard/attendance/executive-panels";
import {
  SectionLabel,
  useMetricsFmt,
} from "@/components/dashboard/attendance/primitives";
import {
  ChartLineUp,
  ClockCounterClockwise,
  CurrencyDollar,
  Hourglass,
  Pulse,
  SealCheck,
  Target,
} from "@/components/icons";
import { GLYPH_PLATE } from "@/components/icons/glyph-plates";
import { getApiBaseUrl } from "@/lib/api/browser-client";
import type { AttendanceOverview } from "@/lib/attendance/types";
import type { ReportJob } from "@/lib/reports/types";

interface PrintFilters {
  dateFrom?: string;
  dateTo?: string;
  workspaceName?: string;
  departmentLabel?: string;
  memberLabel?: string;
  channelLabel?: string;
}

interface PrintTable {
  columns: string[];
  rows: string[][];
  total: number;
  truncated: boolean;
}

interface PrintPayload {
  job: ReportJob;
  data: {
    overview?: AttendanceOverview;
    filters?: PrintFilters;
    table?: PrintTable;
  };
}

declare global {
  interface Window {
    __REPORT_READY__?: boolean;
  }
}

const READY_POLL_MS = 150;
const READY_MIN_ATTEMPTS = 3;
const READY_MAX_ATTEMPTS = 80;

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 12mm; }

  html, body { background: #fff; }

  .report-print {
    width: 100%;
    color-scheme: light;
  }

  .report-print section {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }

  .report-print table { font-size: 10px; }
  .report-print th, .report-print td { padding-top: 3px; padding-bottom: 3px; }

  .report-print details { display: none; }

  .report-print svg { max-width: 100%; }
`;

export default function ReportPrintPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const t = useTranslations("metricsOps.export");
  const tk = useTranslations("reports.kind");
  const ts = useTranslations("metricsOps.attendance.sections");
  const tc = useTranslations("metricsOps.common");
  const fmt = useMetricsFmt();

  const [payload, setPayload] = useState<PrintPayload | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const id = params?.id;
  const token = search?.get("token") ?? "";

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!id || !token) {
        if (active) setFailure("missing_token");
        return;
      }

      try {
        const response = await fetch(
          `${getApiBaseUrl()}/reports/${encodeURIComponent(id)}/print-data?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          if (active) setFailure(`status_${response.status}`);
          return;
        }
        const body = (await response.json()) as PrintPayload;
        if (active) setPayload(body);
      } catch {
        if (active) setFailure("network");
      }
    })();

    return () => {
      active = false;
    };
  }, [id, token]);

  useEffect(() => {
    if (!payload && !failure) return;

    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    const chartsPainted = () =>
      Array.from(document.querySelectorAll<HTMLElement>('[role="img"][aria-label]')).every(
        (host) => host.querySelector("svg") !== null,
      );

    const settle = async () => {
      if (cancelled) return;
      attempts += 1;

      if (attempts >= READY_MIN_ATTEMPTS && chartsPainted()) {
        try {
          await document.fonts?.ready;
        } catch {
          // a browser without the font API still prints; it just may swap a face
        }
        if (!cancelled) window.__REPORT_READY__ = true;
        return;
      }
      if (attempts >= READY_MAX_ATTEMPTS) {
        if (!cancelled) window.__REPORT_READY__ = true;
        return;
      }
      timer = window.setTimeout(() => void settle(), READY_POLL_MS);
    };

    timer = window.setTimeout(() => void settle(), READY_POLL_MS);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [payload, failure]);

  if (failure) {
    return (
      <main className="p-10">
        <p className="text-sm text-muted-foreground">{t("failed")}</p>
      </main>
    );
  }

  if (!payload) {
    return <main className="p-10" />;
  }

  const { overview, filters, table } = payload.data;

  if (table) {
    return (
      <main className="report-print mx-auto w-full space-y-4 bg-background">
        <style>{PRINT_STYLES}</style>
        <PrintHeader title={tk(payload.job.kind)} filters={filters} generatedAt={payload.job.createdAt} />
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border">
              {table.columns.map((column) => (
                <th key={column} className="px-2 py-1.5 font-semibold text-foreground">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index} className="border-b border-border/60">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-2 py-1 tabular-nums text-muted-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-2xs text-muted-foreground">
          {table.truncated
            ? t("truncated", { shown: table.rows.length, total: table.total })
            : t("rowTotal", { total: table.total })}
        </p>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="p-10">
        <p className="text-sm text-muted-foreground">{t("failed")}</p>
      </main>
    );
  }

  return (
    <main className="report-print mx-auto w-full space-y-4 bg-background">
      <style>{PRINT_STYLES}</style>
      <PrintHeader
        title={t("title")}
        filters={filters}
        generatedAt={overview.generated_at}
      />

      <section className="space-y-3">
        <SectionLabel
          icon={<Target className="h-4 w-4" weight="fill" />}
          iconBg={GLYPH_PLATE.Target}
          title={ts("tactical")}
          subtitle={ts("tacticalSub")}
        />
        <PeriodProgressStrip
          fmt={fmt}
          period={overview.period}
          standing={overview.standing}
          loading={false}
        />
        <ProjectionGrid fmt={fmt} projections={overview.projections} loading={false} />
      </section>

      <section className="space-y-3 break-inside-avoid">
        <SectionLabel
          icon={<ChartLineUp className="h-4 w-4" weight="fill" />}
          iconBg={GLYPH_PLATE.ChartLineUp}
          title={ts("history")}
          subtitle={ts("historySub")}
        />
        <TrendSection fmt={fmt} trend={overview.trend} loading={false} />
      </section>

      <section className="space-y-3 break-inside-avoid">
        <SectionLabel
          icon={<CurrencyDollar className="h-4 w-4" weight="fill" />}
          iconBg={GLYPH_PLATE.CurrencyDollar}
          title={ts("money")}
          subtitle={ts("moneySub")}
        />
        <RevenueCard fmt={fmt} revenue={overview.revenue} loading={false} />
      </section>

      <section className="space-y-3 break-inside-avoid">
        <SectionLabel
          icon={<Hourglass className="h-4 w-4" weight="fill" />}
          iconBg={GLYPH_PLATE.Hourglass}
          title={ts("backlog")}
          subtitle={ts("backlogSub")}
        />
        <BacklogXraySection
          backlog={overview.backlog_xray}
          loading={false}
          fmt={fmt}
          channelLabel={(channel) => tc(channel)}
        />
      </section>

      <section className="space-y-3 break-inside-avoid">
        <SectionLabel
          icon={<SealCheck className="h-4 w-4" weight="fill" />}
          iconBg={GLYPH_PLATE.SealCheck}
          title={ts("quality")}
          subtitle={ts("qualitySub")}
        />
        <QualitySection fmt={fmt} quality={overview.quality} loading={false} />
      </section>

      <section className="space-y-3 break-inside-avoid">
        <SectionLabel
          icon={<Pulse className="h-4 w-4" weight="fill" />}
          iconBg={GLYPH_PLATE.Pulse}
          title={ts("teamXray")}
          subtitle={ts("teamXraySub")}
        />
        <TeamRankingTable
          ranking={overview.team_ranking}
          loading={false}
          fmt={fmt}
          rankMetric={overview.team_ranking?.rank_metric_key ?? "resolved"}
          onRankMetricChange={() => {}}
        />
      </section>

      <section className="space-y-3 break-inside-avoid">
        <SectionLabel
          icon={<ClockCounterClockwise className="h-4 w-4" weight="fill" />}
          iconBg={GLYPH_PLATE.ClockCounterClockwise}
          title={ts("rework")}
          subtitle={ts("reworkSub")}
        />
        <ReworkSection fmt={fmt} rework={overview.rework} loading={false} />
      </section>
    </main>
  );
}

function PrintHeader({
  title,
  filters,
  generatedAt,
}: {
  title: string;
  filters: PrintFilters | undefined;
  generatedAt: string | undefined;
}) {
  const t = useTranslations("metricsOps.export");
  const scope = [filters?.workspaceName, filters?.departmentLabel, filters?.channelLabel]
    .filter(Boolean)
    .join(" · ");
  const period = [filters?.dateFrom, filters?.dateTo].filter(Boolean).join(" — ");

  return (
    <header className="space-y-1 border-b border-border pb-3">
      <h1 className="font-display text-xl font-semibold text-foreground">{title}</h1>
      {scope ? <p className="text-xs text-muted-foreground">{scope}</p> : null}
      <p className="text-2xs text-muted-foreground">
        {period}
        {generatedAt
          ? `${period ? " · " : ""}${t("filters.generatedAt")}: ${new Date(generatedAt).toLocaleString()}`
          : ""}
      </p>
    </header>
  );
}
