"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { DashboardTable, type DashboardTableColumn, type DashboardTableEmptyState } from "@/components/elevated-design/table/dashboard-table";
import type { MetricColumn, ReportColumn, RowSort, SortableColumn } from "@/lib/advertising/columns";
import { manageBlockerKey, resultCount, resultKind } from "@/lib/advertising/delivery";
import { isLiveColumn, liveValue, type LiveColumn, type ManagerRow } from "@/lib/advertising/live";
import type { TableRow } from "@/lib/advertising/manager-drafts";
import { EMPTY_VALUE } from "@/lib/advertising/money";
import type { AdAccount, AdBudgetMinimum, AdLevel, AdMetrics, AdOutcome, AdPeriod, AdRow } from "@/lib/advertising/types";

import { BudgetCell } from "./budget-cell";
import { DraftStatus } from "./manager/draft-status";
import { RowSwitch } from "./manager/row-switch";
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

export function AdsTable({
  account,
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
  renderName,
}: {
  account: AdAccount;
  level: AdLevel;
  rows: TableRow[];
  totals: AdMetrics | null;
  outcome: AdOutcome | null;
  previous: AdPeriod | null;
  visibleColumns: MetricColumn[];
  sort: RowSort | null;
  onSort: (key: SortableColumn) => void;
  selection: AdsTableSelection;
  permissions: AdsTablePermissions;
  pending: Set<string>;
  loading: boolean;
  emptyState: DashboardTableEmptyState;
  onToggle: (row: AdRow, on: boolean) => void;
  onBudget: (row: AdRow, amount: number, minimum: AdBudgetMinimum | null) => Promise<string | null>;
  renderName: (row: TableRow) => ReactNode;
}) {
  const t = useTranslations("adsManager.columns");
  const tTable = useTranslations("adsManager.table");
  const writable = manageBlockerKey(account) === null;
  const fmt = useAdsFormat();
  const currency = totals?.currency ?? "";
  const publishedCount = rows.filter((row) => !row.draft).length;

  const columns = useMemo<DashboardTableColumn<TableRow>[]>(() => {
    const seconds = (value: string) => tTable("seconds", { value });
    const toggle: DashboardTableColumn<TableRow> = {
      key: "toggle",
      header: t("toggle"),
      className: "w-16",
      render: (row) => <RowSwitch row={row} account={account} permissions={permissions} busy={pending.has(row.metaId)} onToggle={onToggle} />,
    };
    const name: DashboardTableColumn<TableRow> = {
      key: "name",
      header: t(`name.${level}`),
      sortKey: "name",
      render: renderName,
    };
    const metrics = visibleColumns.map<DashboardTableColumn<TableRow>>((column) => ({
      key: column,
      header: t(column),
      sortKey: column,
      className: column === "delivery" || column === "budget" ? "whitespace-nowrap" : `${NUMERIC} whitespace-nowrap`,
      render: (row) => {
        if (column === "delivery") return row.draft ? <DraftStatus draft={row.draft} /> : <DeliveryStatus delivery={row.delivery} />;
        if (column === "budget") {
          return (
            <BudgetCell
              dailyBudget={row.dailyBudget}
              lifetimeBudget={row.lifetimeBudget}
              currency={row.metrics.currency || currency}
              editable={!row.draft && permissions.canUpdate && writable && row.level !== "ad"}
              minimumQuery={row.level === "adset" && row.optimizationGoal ? { accountId: account.id, goal: row.optimizationGoal } : null}
              onSave={(amount, minimum) => onBudget(row, amount, minimum)}
            />
          );
        }
        if (row.draft) return <Numeric>{EMPTY_VALUE}</Numeric>;
        if (isLiveColumn(column)) return <Numeric>{liveText(column, row, row.metrics.currency || currency, fmt, seconds)}</Numeric>;
        return metricValue(column, row.metrics, row.outcome, fmt);
      },
    }));
    return [toggle, name, ...metrics];
  }, [t, tTable, account, writable, level, visibleColumns, permissions, pending, onToggle, onBudget, renderName, fmt, currency]);

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
        <td className="w-10 px-3 py-2.5" />
        <td className="px-4 py-2.5" />
        <td className="px-4 py-2.5 text-sm font-semibold text-foreground">{tTable(`totals.${level}`, { count: publishedCount })}</td>
        {visibleColumns.map((column) => (
          <td key={column} className="whitespace-nowrap px-4 py-2.5 font-semibold">
            {footerCell(column)}
          </td>
        ))}
      </tr>
    ) : null;

  return (
    <DashboardTable<TableRow>
      data={rows}
      columns={columns}
      rowKey={(row) => row.metaId}
      loading={loading}
      emptyState={emptyState}
      footer={footer}
      sorting={{
        sorts: sort ? [{ key: sort.key, direction: sort.direction }] : [],
        onToggle: (key) => onSort(key as SortableColumn),
      }}
      selection={{
        selectedKeys: selection.selected,
        onSelectionChange: selection.onChange,
        hideSummary: true,
        selectAllLabel: tTable("selectAll"),
        selectRowLabel: tTable("selectRow"),
      }}
      className="rounded-none border-0 shadow-none"
    />
  );
}
