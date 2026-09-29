"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { adminLiveDecisionSummaryAction } from "@/app/actions/live-decisions";
import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowsClockwise, CurrencyDollar, Lightning, Warning } from "@/components/icons";
import {
  failureRate,
  LIVE_DECISION_EFFECTS,
  type LiveDecisionSummary,
} from "@/lib/live-decisions/types";

const PERIODS = [1, 7, 30] as const;
type Period = (typeof PERIODS)[number];

export function LiveDecisionSummaryTable() {
  const t = useTranslations("adminLiveDecisions");
  const tEffects = useTranslations("adminLiveDecisions.effects");
  const format = useFormatter();

  const [days, setDays] = useState<Period>(7);
  const [summaries, setSummaries] = useState<LiveDecisionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void adminLiveDecisionSummaryAction(days).then((result) => {
      if (cancelled) return;
      setSummaries(result.summaries);
      setError(result.error ? result.error.message : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [days, reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const usd = (micros: number) => format.number(micros / 1_000_000, { style: "currency", currency: "USD", maximumFractionDigits: 4 });
  const total = summaries.reduce(
    (sum, s) => ({ decisions: sum.decisions + s.decisions, failures: sum.failures + s.failures, cost: sum.cost + s.costMicros }),
    { decisions: 0, failures: 0, cost: 0 },
  );
  const stat = (value: string) => (loading ? "..." : value);

  const columns: DashboardTableColumn<LiveDecisionSummary>[] = [
    {
      header: t("table.workspace"),
      key: "workspace",
      render: (row) => <p className="truncate text-sm font-semibold text-foreground">{row.workspaceName || row.workspaceId}</p>,
    },
    {
      header: t("table.decisions"),
      key: "decisions",
      className: "text-right",
      render: (row) => <span className="tabular-nums">{format.number(row.decisions)}</span>,
    },
    {
      header: t("table.failures"),
      key: "failures",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {format.number(row.failures)} · {format.number(failureRate(row), { style: "percent", maximumFractionDigits: 1 })}
        </span>
      ),
    },
    {
      header: t("table.latency"),
      key: "latency",
      className: "text-right",
      render: (row) => <span className="tabular-nums">{t("table.latencyValue", { ms: row.avgLatencyMs })}</span>,
    },
    {
      header: t("table.cost"),
      key: "cost",
      className: "text-right",
      render: (row) => <span className="tabular-nums">{usd(row.costMicros)}</span>,
    },
    {
      header: t("table.effects"),
      key: "effects",
      render: (row) => {
        const taken = LIVE_DECISION_EFFECTS.filter((effect) => (row.effects[effect] ?? 0) > 0);
        if (taken.length === 0) return <span className="text-xs text-muted-foreground">{t("table.noEffects")}</span>;
        return (
          <div className="flex max-w-md flex-wrap gap-1">
            {taken.map((effect) => (
              <span key={effect} className="rounded-[--radius] bg-muted px-1.5 py-0.5 text-2xs text-foreground">
                {tEffects(effect)} · {format.number(row.effects[effect] ?? 0)}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <DashboardTable<LiveDecisionSummary>
        stats={[
          {
            label: t("stats.decisions"),
            value: stat(format.number(total.decisions)),
            icon: <Lightning className="h-4 w-4 text-info-ink" weight="fill" />,
          },
          {
            label: t("stats.failures"),
            value: stat(format.number(total.failures)),
            icon: <Warning className="h-4 w-4 text-warning-ink" weight="fill" />,
          },
          {
            label: t("stats.cost"),
            value: stat(usd(total.cost)),
            icon: <CurrencyDollar className="h-4 w-4 text-healthy-ink" weight="fill" />,
          },
        ]}
        headerLeft={
          <ElevatedPillToggle
            size="md"
            value={String(days)}
            onChange={(value) => {
              setLoading(true);
              setDays(Number(value) as Period);
            }}
            aria-label={t("period.label")}
            options={PERIODS.map((value) => ({ value: String(value), label: t("period.days", { days: value }) }))}
          />
        }
        headerRight={
          <Button
            icon={<ArrowsClockwise className="h-4 w-4" weight="bold" />}
            iconVisible
            disabled={loading}
            onClick={reload}
            title={t("actions.refresh")}
            variant="outline"
          />
        }
        data={error ? [] : summaries}
        columns={columns}
        rowKey={(row) => row.workspaceId}
        loading={loading}
        emptyState={
          error
            ? {
                icon: <Lightning className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("errors.load"),
                description: error,
                action: <Button variant="outline" title={t("actions.refresh")} onClick={reload} />,
              }
            : {
                icon: <Lightning className="h-7 w-7 text-muted-foreground" weight="fill" />,
                title: t("empty.title"),
                description: t("empty.description"),
              }
        }
      />
    </div>
  );
}
