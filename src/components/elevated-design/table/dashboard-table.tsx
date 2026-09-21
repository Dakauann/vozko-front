"use client";

import {
  CaretLeft,
  CaretRight,
  Check,
  Minus,
} from "@/components/icons";
import { Fragment, ReactNode, useCallback } from "react";

import { CircuitTraces } from "@/components/brand/circuit";
import { SortableColumnHead } from "@/components/elevated-design/table/sortable-column-head";
import { LightPool } from "@/components/brand/light-pool";
import { cn } from "@/lib/utils";


export interface DashboardTableColumn<T> {
  header: string;
  key: string;
  className?: string;
  render?: (row: T, rowIndex: number) => ReactNode;
  accessor?: (row: T) => ReactNode;
  sortKey?: string;
}

export type DashboardTableSortDirection = "asc" | "desc";

export interface DashboardTableSort {
  key: string;
  direction: DashboardTableSortDirection;
}

export interface DashboardTableSorting {
  sorts: DashboardTableSort[];
  onToggle: (key: string, options: { additive: boolean }) => void;
}

export interface DashboardTablePagination {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
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
  label?: (count: number) => ReactNode;
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
      {}
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

      {}
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

      {}
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
          {toolbar}
        </div>
      )}

      {}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {caption ? (
            <caption className="px-4 py-3 text-left text-sm text-muted-foreground">
              {caption}
            </caption>
          ) : null}

          <thead>
            {
}
            <tr className="bg-muted border-b border-border-strong">
              {hasSelection && (
                <th className="w-10 px-3 py-2" scope="col">
                  <button
                    type="button"
                    role="checkbox"
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
              {columns.map((column) => (
                <SortableColumnHead
                  key={column.key}
                  label={column.header}
                  sortKey={column.sortKey}
                  sorts={sorting?.sorts}
                  onToggle={sorting?.onToggle}
                  className={cn(
                    "px-4 py-2 text-2xs font-semibold text-muted-foreground",
                    column.className,
                  )}
                />
              ))}
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

      {}
      {!hasData && !loading && (
        <div className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
          <LightPool />
          {
}
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

      {}
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
          {
}
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
