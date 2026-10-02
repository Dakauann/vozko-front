"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { DashboardTable, type DashboardTableColumn, type DashboardTableEmptyState } from "@/components/elevated-design/table/dashboard-table";
import { Image as ImageGlyph, Warning } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MetricColumn, ReportColumn, RowSort, SortableColumn } from "@/lib/advertising/columns";
import { resultCount, resultKind, rowIssues } from "@/lib/advertising/delivery";
import { isLiveColumn, liveValue, type LiveColumn, type ManagerRow } from "@/lib/advertising/live";
import { EMPTY_VALUE } from "@/lib/advertising/money";
import type { AdLevel, AdMetrics, AdOutcome, AdPeriod, AdRow } from "@/lib/advertising/types";

import { AdImage } from "./ad-image";
import { BudgetCell } from "./budget-cell";
import { DeliveryStatus } from "./status-dot";
import { useAdsFormat, type AdsFormat } from "./use-ads-format";

export interface AdsTablePermissions {
  canStart: boolean;
  canStop: boolean;
  canUpdate: boolean;
}

export interface AdsTableSelection {
  selected: Set<string>;
  onChange: (keys: Set<string>) => void;
  actions?: (rows: ManagerRow[]) => ReactNode;
}

type TotalColumn = Exclude<ReportColumn, "delivery" | "budget">;

const NUMERIC = "text-right";

function Numeric({ children }: { children: ReactNode }) {
  return <span className="block text-right text-sm tabular-nums text-foreground">{children}</span>;
}

function ResultValue({ metrics, fmt }: { metrics: AdMetrics; fmt: AdsFormat }) {
  const t = useTranslations("adsManager.results");
  const kind = resultKind(metrics);
  if (!kind) return <Numeric>{EMPTY_VALUE}</Numeric>;
  return (
    <span className="flex flex-col items-end">
      <span className="text-sm tabular-nums text-foreground">{fmt.count(resultCount(metrics))}</span>
      <span className="text-2xs text-muted-foreground">{t(kind)}</span>
    </span>
  );
}

function metricText(column: TotalColumn, metrics: AdMetrics, outcome: AdOutcome, fmt: AdsFormat): string {
  const currency = metrics.currency;
  switch (column) {
    case "results":
      return fmt.count(resultCount(metrics));
    case "costPerResult":
      return fmt.micros(resultKind(metrics) ? metrics.costPerResult : null, currency);
    case "spend":
      return fmt.micros(metrics.spend, currency);
    case "impressions":
      return fmt.count(metrics.impressions);
    case "linkClicks":
      return fmt.count(metrics.linkClicks);
    case "ctr":
      return fmt.percent(metrics.ctr);
    case "cpm":
      return fmt.micros(metrics.cpm, currency);
    case "crmConversations":
      return fmt.count(outcome.conversations);
    case "costPerLead":
      return fmt.micros(outcome.costPerLead, currency);
    case "roas":
      return fmt.roas(outcome.roas);
  }
}

function metricValue(column: TotalColumn, metrics: AdMetrics, outcome: AdOutcome, fmt: AdsFormat): ReactNode {
  if (column === "results") return <ResultValue metrics={metrics} fmt={fmt} />;
  return <Numeric>{metricText(column, metrics, outcome, fmt)}</Numeric>;
}

function liveText(column: LiveColumn, row: ManagerRow, currency: string, fmt: AdsFormat, seconds: (value: string) => string): string {
  const value = liveValue(row.live, column);
  switch (column) {
    case "frequency":
      return fmt.decimal(value);
    case "costPerThruPlay":
      return fmt.micros(value, currency);
    case "avgWatchSeconds":
      return value === null ? EMPTY_VALUE : seconds(fmt.decimal(value, 1));
    default:
      return fmt.count(value);
  }
}

function IssuesBadge({ row }: { row: AdRow }) {
  const t = useTranslations("adsManager.table");
  const issues = rowIssues(row);
  if (issues.length === 0) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-[--radius] px-1 text-2xs font-semibold text-warning-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("issues", { count: issues.length })}
          >
            <Warning className="h-3.5 w-3.5" weight="fill" aria-hidden />
            {t("issues", { count: issues.length })}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <ul className="space-y-1.5">
            {issues.map((issue, index) => (
              <li key={index} className="text-xs">
                {issue.title ? <span className="block font-semibold">{issue.title}</span> : null}
                {issue.message ? <span className="block">{issue.message}</span> : null}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function NameCell({ row }: { row: AdRow }) {
  const thumbnail = row.creative?.thumbnailUrl || row.creative?.imageUrl;
  return (
    <div className="flex min-w-[220px] max-w-[360px] items-center gap-2.5">
      {row.level === "ad" ? (
        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-[--radius] bg-muted">
          {thumbnail ? (
            <AdImage src={thumbnail} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageGlyph className="h-4 w-4" aria-hidden />
            </span>
          )}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground" title={row.name}>
          {row.name}
        </span>
        <span className="flex items-center gap-2">
          <span className="truncate text-2xs tabular-nums text-muted-foreground">{row.metaId}</span>
          <IssuesBadge row={row} />
        </span>
      </div>
    </div>
  );
}

export function AdsTable({
  level,
  rows,
  totals,
  outcome,
  previous,
  visibleColumns,
  sort,
  onSort,
  selection,
  permissions,
  pending,
  loading,
  emptyState,
  onToggle,
  onBudget,
  rowActions,
}: {
  level: AdLevel;
  rows: ManagerRow[];
  totals: AdMetrics | null;
  outcome: AdOutcome | null;
  previous: AdPeriod | null;
  visibleColumns: MetricColumn[];
  sort: RowSort | null;
  onSort: (key: SortableColumn) => void;
  selection?: AdsTableSelection;
  permissions: AdsTablePermissions;
  pending: Set<string>;
  loading: boolean;
  emptyState: DashboardTableEmptyState;
  onToggle: (row: AdRow, on: boolean) => void;
  onBudget: (row: AdRow, amount: number) => Promise<string | null>;
  rowActions: (row: ManagerRow) => ReactNode;
}) {
  const t = useTranslations("adsManager.columns");
  const tTable = useTranslations("adsManager.table");
  const fmt = useAdsFormat();
  const currency = totals?.currency ?? "";

  const columns = useMemo<DashboardTableColumn<ManagerRow>[]>(() => {
    const seconds = (value: string) => tTable("seconds", { value });
    const toggle: DashboardTableColumn<ManagerRow> = {
      key: "toggle",
      header: t("toggle"),
      className: "w-16",
      render: (row) => {
        const allowed = row.isOn ? permissions.canStop : permissions.canStart;
        return (
          <span onClick={(event) => event.stopPropagation()} className="inline-flex">
            <ElevatedSwitch
              checked={row.isOn}
              disabled={!row.canToggle || !allowed || pending.has(row.metaId)}
              onCheckedChange={(on) => onToggle(row, on)}
              aria-label={tTable(row.isOn ? "turnOff" : "turnOn", { name: row.name })}
            />
          </span>
        );
      },
    };
    const name: DashboardTableColumn<ManagerRow> = {
      key: "name",
      header: t(`name.${level}`),
      sortKey: "name",
      render: (row) => <NameCell row={row} />,
    };
    const metrics = visibleColumns.map<DashboardTableColumn<ManagerRow>>((column) => ({
      key: column,
      header: t(column),
      sortKey: column,
      className: column === "delivery" || column === "budget" ? "whitespace-nowrap" : `${NUMERIC} whitespace-nowrap`,
      render: (row) => {
        if (isLiveColumn(column)) return <Numeric>{liveText(column, row, row.metrics.currency || currency, fmt, seconds)}</Numeric>;
        if (column === "delivery") return <DeliveryStatus delivery={row.delivery} />;
        if (column === "budget") {
          return (
            <BudgetCell
              dailyBudget={row.dailyBudget}
              lifetimeBudget={row.lifetimeBudget}
              currency={row.metrics.currency || currency}
              editable={permissions.canUpdate && row.level !== "ad"}
              onSave={(amount) => onBudget(row, amount)}
            />
          );
        }
        return metricValue(column, row.metrics, row.outcome, fmt);
      },
    }));
    return [toggle, name, ...metrics];
  }, [t, tTable, level, visibleColumns, permissions, pending, onToggle, onBudget, fmt, currency]);

  const footerCell = (column: MetricColumn) => {
    if (column === "delivery" || column === "budget") return null;
    if (isLiveColumn(column)) return <Numeric>{EMPTY_VALUE}</Numeric>;
    if (!totals || !outcome) return null;
    const before = previous ? metricText(column, previous.totals, previous.outcome, fmt) : null;
    return (
      <span title={before ? tTable("previousTotal", { value: before }) : undefined} className="block">
        {metricValue(column, totals, outcome, fmt)}
        {before ? <span className="sr-only">{tTable("previousTotal", { value: before })}</span> : null}
      </span>
    );
  };

  const footer =
    totals && outcome ? (
      <tr>
        {selection ? <td className="w-10 px-3 py-2.5" /> : null}
        <td className="px-4 py-2.5" />
        <td className="px-4 py-2.5 text-sm font-semibold text-foreground">
          {tTable(`totals.${level}`, { count: rows.length })}
        </td>
        {visibleColumns.map((column) => (
          <td key={column} className="whitespace-nowrap px-4 py-2.5 font-semibold">
            {footerCell(column)}
          </td>
        ))}
        <td className="px-4 py-2.5" />
      </tr>
    ) : null;

  return (
    <DashboardTable<ManagerRow>
      data={rows}
      columns={columns}
      rowKey={(row) => row.metaId}
      loading={loading}
      emptyState={emptyState}
      footer={footer}
      renderRowActions={rowActions}
      sorting={{
        sorts: sort ? [{ key: sort.key, direction: sort.direction }] : [],
        onToggle: (key) => onSort(key as SortableColumn),
      }}
      selection={
        selection
          ? {
              selectedKeys: selection.selected,
              onSelectionChange: selection.onChange,
              actions: selection.actions,
              label: (count) => tTable("selected", { count }),
              selectAllLabel: tTable("selectAll"),
              selectRowLabel: tTable("selectRow"),
            }
          : undefined
      }
      className="rounded-none border-0 shadow-none"
    />
  );
}
