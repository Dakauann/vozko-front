"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowsDownUp,
  CaretLeft,
  CaretRight,
  Check,
  Minus,
} from "@/components/icons";
import { Fragment, ReactNode, useCallback } from "react";

import { CircuitTraces } from "@/components/brand/circuit";
import { cn } from "@/lib/utils";


export interface DashboardTableColumn<T> {
  header: string;
  key: string;
  className?: string;
  render?: (row: T, rowIndex: number) => ReactNode;
  accessor?: (row: T) => ReactNode;
  /**
   * Server-side sort key for this column. Present means the header is a
   * control; absent means the column is not orderable, and says so by not
   * looking clickable.
   */
  sortKey?: string;
}

export type DashboardTableSortDirection = "asc" | "desc";

export interface DashboardTableSort {
  key: string;
  direction: DashboardTableSortDirection;
}

export interface DashboardTableSorting {
  /** Active sorts, in priority order. */
  sorts: DashboardTableSort[];
  /**
   * Cycle a column. `additive` (shift-click) appends the column as a secondary
   * key instead of replacing the current one.
   */
  onToggle: (key: string, options: { additive: boolean }) => void;
}

export interface DashboardTablePagination {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  /** Offering page sizes turns the footer into a density control too. */
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (pageSize: number) => void;
}

export interface DashboardTableEmptyState {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export interface DashboardTableStat {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}

export interface DashboardTableSelection<T> {
  selectedKeys: Set<string>;
  onSelectionChange: (keys: Set<string>) => void;
  actions?: (selectedRows: T[]) => ReactNode;
  // Localizable label for the selection bar count (defaults to English
  // "N selected"). Lets pt-BR callers render e.g. "3 selecionadas".
  label?: (count: number) => ReactNode;
  // Accessible names for the selection controls. They are drawn as bare
  // buttons, so without these a screen reader announces "button" with no name
  // and no checked state — on the one control that decides what a bulk action
  // is about to touch. English defaults, overridable per caller like `label`.
  selectAllLabel?: string;
  selectRowLabel?: string;
}

export interface DashboardTableProps<T> {
  data: T[];
  columns: DashboardTableColumn<T>[];
  rowKey: (row: T, index: number) => string;
  className?: string;
  emptyState?: ReactNode | DashboardTableEmptyState;
  caption?: ReactNode;
  renderRowActions?: (row: T) => ReactNode;

  stats?: DashboardTableStat[];
  headerLeft?: ReactNode;
  headerRight?: ReactNode;

  toolbar?: ReactNode;

  sorting?: DashboardTableSorting;

  selection?: DashboardTableSelection<T>;

  pagination?: DashboardTablePagination;
  paginationText?: {
    showing?: string;
    of?: string;
    items?: string;
    perPage?: string;
  };

  loading?: boolean;
  onRowClick?: (row: T, index: number) => void;
  isRowExpanded?: (row: T, index: number) => boolean;
  renderExpandedRow?: (row: T, index: number) => ReactNode;
  rowClassName?: (row: T, index: number) => string;
}


export function DashboardTable<T>({
  data,
  columns,
  rowKey,
  className,
  emptyState,
  caption,
  renderRowActions,
  stats,
  headerLeft,
  headerRight,
  toolbar,
  sorting,
  selection,
  pagination,
  paginationText,
  loading = false,
  onRowClick,
  isRowExpanded,
  renderExpandedRow,
  rowClassName,
}: DashboardTableProps<T>) {
  const hasData = data.length > 0;
  const hasHeader =
    !!headerLeft || !!headerRight || (stats && stats.length > 0);
  const hasToolbar = !!toolbar;
  const hasPagination = !!pagination;
  const hasSelection = !!selection;

  const allKeys = data.map((row, i) => rowKey(row, i));
  const selectedCount = selection?.selectedKeys.size ?? 0;
  const allSelected = hasData && selectedCount === data.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    if (!selection) return;
    if (allSelected) {
      selection.onSelectionChange(new Set());
    } else {
      selection.onSelectionChange(new Set(allKeys));
    }
  }, [selection, allSelected, allKeys]);

  const toggleRow = useCallback(
    (key: string) => {
      if (!selection) return;
      const next = new Set(selection.selectedKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      selection.onSelectionChange(next);
    },
    [selection],
  );

  const isEmptyStateObject = (
    state: ReactNode | DashboardTableEmptyState | undefined,
  ): state is DashboardTableEmptyState => {
    return (
      typeof state === "object" &&
      state !== null &&
      "title" in state &&
      !("type" in state)
    );
  };

  const getPaginationRange = () => {
    if (!pagination) return [];
    const { currentPage, totalPages } = pagination;
    const maxVisible = 5;
    if (totalPages <= maxVisible)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, 5];
    if (currentPage >= totalPages - 2)
      return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
    return [
      currentPage - 2,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      currentPage + 2,
    ];
  };

  const from = pagination
    ? (pagination.currentPage - 1) * pagination.pageSize + 1
    : 0;
  const to = pagination
    ? Math.min(
        pagination.currentPage * pagination.pageSize,
        pagination.totalItems,
      )
    : 0;

  const totalCols =
    columns.length + (renderRowActions ? 1 : 0) + (hasSelection ? 1 : 0);

  const selectedRows = hasSelection
    ? data.filter((row, i) => selection!.selectedKeys.has(rowKey(row, i)))
    : [];

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-[--radius] border border-border bg-card shadow-sm",
        className,
      )}
    >
      {/* ── Header: stats + search + actions ── */}
      {hasHeader && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
          {headerLeft}

          {stats && stats.length > 0 && (
            <div className="flex flex-1 flex-wrap items-center gap-4">
              {stats.map((stat) => (
                <div
                  key={String(stat.label)}
                  className="flex items-center gap-2"
                >
                  {stat.icon && (
                    <span className="text-muted-foreground">{stat.icon}</span>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {stat.label}
                  </span>
                  <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {headerRight && (
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {headerRight}
            </div>
          )}
        </div>
      )}

      {/* ── Selection bar ── */}
      {hasSelection && selectedCount > 0 && (
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <span className="text-sm font-medium text-primary-ink">
            {selection!.label
              ? selection!.label(selectedCount)
              : `${selectedCount} selected`}
          </span>
          {selection!.actions?.(selectedRows)}
        </div>
      )}

      {/* ── Toolbar (filters) ── */}
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
          {toolbar}
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {caption ? (
            <caption className="px-4 py-3 text-left text-sm text-muted-foreground">
              {caption}
            </caption>
          ) : null}

          <thead>
            {/* The head is the one row that gets a quiet fill and the stronger
                rule under it — that rule is what separates head from body once
                the body rows are white. */}
            <tr className="bg-muted border-b border-border-strong">
              {hasSelection && (
                <th className="w-10 px-3 py-2" scope="col">
                  <button
                    type="button"
                    role="checkbox"
                    // Tri-state: "mixed" is what makes the dash glyph mean
                    // something to a screen reader instead of reading as
                    // unchecked while the page shows a partial selection.
                    aria-checked={
                      allSelected ? true : someSelected ? "mixed" : false
                    }
                    aria-label={selection!.selectAllLabel ?? "Select all rows"}
                    onClick={toggleAll}
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                      allSelected || someSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-muted-foreground",
                    )}
                  >
                    {allSelected && <Check className="h-3 w-3" weight="bold" />}
                    {someSelected && (
                      <Minus className="h-3 w-3" weight="bold" />
                    )}
                  </button>
                </th>
              )}
              {columns.map((column) => {
                const sortable = !!(sorting && column.sortKey);
                const activeIndex = sortable
                  ? sorting!.sorts.findIndex((s) => s.key === column.sortKey)
                  : -1;
                const active = activeIndex >= 0 ? sorting!.sorts[activeIndex] : undefined;

                return (
                  <th
                    key={column.key}
                    className={cn(
                      "px-4 py-2 text-2xs font-semibold text-muted-foreground",
                      column.className,
                    )}
                    scope="col"
                    aria-sort={
                      active
                        ? active.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : sortable
                          ? "none"
                          : undefined
                    }
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={(e) =>
                          sorting!.onToggle(column.sortKey!, {
                            additive: e.shiftKey,
                          })
                        }
                        className={cn(
                          "group/sort -mx-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors",
                          "hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                          active && "text-foreground",
                        )}
                      >
                        <span>{column.header}</span>
                        {/* The neutral glyph shows only on hover: a column that
                            is not sorted must not look like it is. */}
                        {active ? (
                          active.direction === "asc" ? (
                            <ArrowUp weight="bold" className="h-3 w-3" />
                          ) : (
                            <ArrowDown weight="bold" className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowsDownUp
                            weight="bold"
                            className="h-3 w-3 opacity-0 transition-opacity group-hover/sort:opacity-60"
                          />
                        )}
                        {/* Rank, only while several keys are active, so a
                            multi-key order is readable rather than implied. */}
                        {active && sorting!.sorts.length > 1 ? (
                          <span className="text-2xs tabular-nums text-muted-foreground">
                            {activeIndex + 1}
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {renderRowActions ? (
                <th
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground text-right"
                  scope="col"
                />
              ) : null}
            </tr>
          </thead>

          <tbody className="divide-y divide-border/50">
            {loading
              ? Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`} className="animate-pulse">
                    {hasSelection && (
                      <td className="w-10 px-3 py-2.5">
                        <div className="h-4 w-4 rounded border border-border bg-muted" />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={`skeleton-${rowIndex}-${column.key}`}
                        className={cn("px-4 py-2.5", column.className)}
                      >
                        <div className="h-4 bg-border/60 rounded w-3/4" />
                      </td>
                    ))}
                    {renderRowActions ? (
                      <td className="px-4 py-2.5 text-right">
                        <div className="h-4 bg-border/60 rounded w-8 ml-auto" />
                      </td>
                    ) : null}
                  </tr>
                ))
              : hasData
                ? data.map((row, rowIndex) => {
                    const key = rowKey(row, rowIndex);
                    const clickable = !!onRowClick;
                    const expanded = isRowExpanded?.(row, rowIndex) ?? false;
                    const extraClass = rowClassName?.(row, rowIndex) ?? "";
                    const isSelected =
                      selection?.selectedKeys.has(key) ?? false;

                    return (
                      <Fragment key={key}>
                        <tr
                          onClick={
                            clickable
                              ? () => onRowClick(row, rowIndex)
                              : undefined
                          }
                          /*
                            No zebra. The previous attempt was
                            `shouldBeDarker ? "bg-muted" : "bg-muted"` — both
                            branches identical — so every row was grey AND the
                            hover state was the same grey, meaning row hover
                            did nothing at all on a 36-consumer table.

                            Rows sit on the sheet; hover tints; selection takes
                            the brand wash. Separation comes from the hairline
                            rules on <tbody>, which is how both reference
                            systems set a data table.
                          */
                          className={cn(
                            "group bg-card transition-colors duration-150",
                            clickable && "cursor-pointer",
                            "hover:bg-muted",
                            expanded && "bg-muted",
                            isSelected && "bg-muted hover:bg-[hsl(var(--accent-hover))]",
                            extraClass,
                          )}
                        >
                          {hasSelection && (
                            <td className="w-10 px-3 py-2.5">
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={isSelected}
                                aria-label={
                                  selection!.selectRowLabel ?? "Select row"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRow(key);
                                }}
                                className={cn(
                                  "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-card hover:border-muted-foreground",
                                )}
                              >
                                {isSelected && (
                                  <Check className="h-3 w-3" weight="bold" />
                                )}
                              </button>
                            </td>
                          )}

                          {columns.map((column) => {
                            const value =
                              column.render?.(row, rowIndex) ??
                              column.accessor?.(row) ??
                              (row as Record<string, unknown>)[column.key];

                            return (
                              <td
                                key={`${key}-${column.key}`}
                                className={cn("px-4 py-2.5", column.className)}
                              >
                                {(value as ReactNode) || null}
                              </td>
                            );
                          })}

                          {renderRowActions ? (
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {renderRowActions(row)}
                              </div>
                            </td>
                          ) : null}
                        </tr>

                        {expanded && renderExpandedRow && (
                          <tr>
                            <td colSpan={totalCols} className="p-0">
                              {renderExpandedRow(row, rowIndex)}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                : null}
          </tbody>
        </table>
      </div>

      {/* ── Empty state ── */}
      {!hasData && !loading && (
        <div className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
          {/* The brand's trace lines behind the plate — an empty state is an
              identity surface, the one place in a table where ornament
              doesn't sit behind data. */}
          <CircuitTraces
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-2 h-40 w-40 -translate-x-1/2 sm:h-48 sm:w-48"
          />
          {isEmptyStateObject(emptyState) ? (
            <>
              {emptyState.icon && (
                <div className="relative flex h-14 w-14 items-center justify-center rounded-[--radius] bg-muted mb-3">
                  {emptyState.icon}
                </div>
              )}
              <p className="relative font-display text-base font-semibold tracking-[0.01em] text-foreground mb-1">
                {emptyState.title}
              </p>
              {emptyState.description && (
                <p className="text-sm text-muted-foreground mb-5 max-w-md">
                  {emptyState.description}
                </p>
              )}
              {emptyState.action}
            </>
          ) : (
            <>
              <div className="relative flex h-14 w-14 items-center justify-center rounded-[--radius] bg-muted mb-3">
                <svg
                  className="h-7 w-7 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <p className="relative font-display font-semibold tracking-[0.01em] text-foreground mb-1">
                Nenhum registro encontrado
              </p>
              <p className="text-sm text-muted-foreground">
                {emptyState ??
                  "Tente ajustar os filtros ou adicione novos itens."}
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Pagination footer ── */}
      {hasPagination && (
        <div className="flex items-center justify-between border-t border-border bg-muted px-4 py-2">
          <div className="flex items-center gap-4">
            <p className="text-xs text-muted-foreground">
              {paginationText?.showing ?? "Mostrando"}{" "}
              <span className="font-semibold text-foreground">
                {from}–{to}
              </span>{" "}
              {paginationText?.of ?? "de"}{" "}
              <span className="font-semibold text-foreground">
                {pagination.totalItems}
              </span>{" "}
              {paginationText?.items ?? "itens"}
            </p>

            {pagination.pageSizeOptions && pagination.onPageSizeChange ? (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{paginationText?.perPage ?? "Por página"}</span>
                <select
                  value={pagination.pageSize}
                  onChange={(e) =>
                    pagination.onPageSizeChange?.(Number(e.target.value))
                  }
                  className="h-7 rounded border border-border bg-card px-1.5 text-xs font-medium text-foreground tabular-nums outline-none transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary"
                >
                  {pagination.pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {/* The page buttons go when there is one page; the footer stays,
              because it still carries the count and the density control. */}
          <div className={cn("flex gap-1", pagination.totalPages <= 1 && "hidden")}>
            <button
              onClick={() =>
                pagination.onPageChange(pagination.currentPage - 1)
              }
              disabled={pagination.currentPage === 1}
              className="w-7 h-7 flex items-center justify-center rounded border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CaretLeft className="h-3.5 w-3.5" weight="bold" />
            </button>

            {getPaginationRange().map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => pagination.onPageChange(pageNum)}
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition-colors",
                  pagination.currentPage === pageNum
                    ? "border border-primary bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {pageNum}
              </button>
            ))}

            <button
              onClick={() =>
                pagination.onPageChange(pagination.currentPage + 1)
              }
              disabled={pagination.currentPage === pagination.totalPages}
              className="w-7 h-7 flex items-center justify-center rounded border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CaretRight className="h-3.5 w-3.5" weight="bold" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
