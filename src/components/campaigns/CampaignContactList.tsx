"use client";

import { useMemo, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { MagnifyingGlass, UsersThree } from "@/components/icons";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import {
  DashboardTable,
  type DashboardTableColumn,
  type DashboardTableStat,
} from "@/components/elevated-design/table/dashboard-table";
import {
  CONTACT_LIST_PAGE_SIZE,
  OPEN_CONTACT_LIST_VIEW,
  contactPage,
  isNarrowed,
  narrowContacts,
  type ContactListView,
} from "@/lib/campaigns/contact-list-view";
import { cn } from "@/lib/utils";

const DENSE_CELL = "px-2 py-1.5 align-top first:pl-4";

const BOUNDED_SCROLL =
  "max-h-[min(32rem,65vh)] overflow-y-auto [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-muted";

type MissingFilter = "all" | "missing";

export interface CampaignContactListMissing<T> {
  count: number;
  isMissing: (row: T) => boolean;
}

export interface ContactListCount {
  label: string;
  count: number;
}

export interface CampaignContactListProps<T> {
  rows: T[];
  rowKey: (row: T) => string;
  number: (row: T) => ReactNode;
  name: (row: T) => ReactNode;
  valueColumns?: DashboardTableColumn<T>[];
  searchable: (row: T) => (string | undefined)[];
  missing?: CampaignContactListMissing<T>;
  view: ContactListView;
  onViewChange: (view: ContactListView) => void;
  extraCounts?: ContactListCount[];
  actions?: ReactNode;
  panel?: ReactNode;
  renderRowActions?: (row: T) => ReactNode;
}

export function MissingValueMark() {
  const t = useTranslations("campaignContactList");
  const label = t("missingValue");
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-block h-2 w-2 shrink-0 rounded-full bg-warning"
    />
  );
}

function orEmpty(value: ReactNode): ReactNode {
  return value === undefined || value === null || value === "" ? <EmptyValue /> : value;
}

export function CampaignContactList<T>({
  rows,
  rowKey,
  number,
  name,
  valueColumns = [],
  searchable,
  missing,
  view,
  onViewChange,
  extraCounts = [],
  actions,
  panel,
  renderRowActions,
}: CampaignContactListProps<T>) {
  const t = useTranslations("campaignContactList");
  const locale = useLocale();
  const isMissing = missing?.isMissing;

  const narrowed = useMemo(
    () => narrowContacts(rows, view, searchable, isMissing),
    [rows, view, searchable, isMissing],
  );
  const page = contactPage(narrowed, view.page);
  const narrowedView = isNarrowed(view);
  const format = (count: number) => count.toLocaleString(locale);

  const columns: DashboardTableColumn<T>[] = [
    {
      key: "number",
      header: t("number"),
      className: cn(DENSE_CELL, "min-w-[11rem] font-mono text-sm tabular-nums text-foreground"),
      render: (row) => orEmpty(number(row)),
    },
    {
      key: "name",
      header: t("name"),
      className: cn(DENSE_CELL, "min-w-[10rem] text-sm text-foreground"),
      render: (row) => orEmpty(name(row)),
    },
    ...valueColumns.map((column) => ({
      ...column,
      className: cn(DENSE_CELL, "min-w-[8rem] text-sm text-foreground", column.className),
      render: column.render ? (row: T, rowIndex: number) => orEmpty(column.render?.(row, rowIndex)) : undefined,
    })),
  ];

  const stats: DashboardTableStat[] = [
    {
      label: t("total"),
      value: format(rows.length),
      icon: <UsersThree className="h-4 w-4" weight="bold" />,
    },
    ...(missing
      ? [
          {
            label: t("missing"),
            value: format(missing.count),
            icon: (
              <span
                aria-hidden
                className={cn(
                  "block h-2 w-2 rounded-full",
                  missing.count > 0 ? "bg-warning" : "bg-healthy",
                )}
              />
            ),
          },
        ]
      : []),
    ...extraCounts.map(({ label, count }) => ({ label, value: format(count) })),
  ];

  const toolbar = (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
        <ElevatedInput
          type="search"
          aria-label={t("search")}
          placeholder={t("search")}
          value={view.query}
          onChange={(event) => onViewChange({ ...view, query: event.target.value, page: 0 })}
          icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
          controlSize="sm"
          className="min-w-0 flex-1 basis-56"
        />
        {missing ? (
          <ElevatedPillToggle<MissingFilter>
            aria-label={t("filter")}
            size="md"
            value={view.onlyMissing ? "missing" : "all"}
            onChange={(value) => onViewChange({ ...view, onlyMissing: value === "missing", page: 0 })}
            options={[
              { value: "all", label: t("all") },
              { value: "missing", label: t("onlyMissing") },
            ]}
          />
        ) : null}
        {narrowedView ? (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground tabular-nums">
              {t("showing", { count: narrowed.length })}
            </span>
            <button
              type="button"
              onClick={() => onViewChange(OPEN_CONTACT_LIST_VIEW)}
              className="font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
            >
              {t("clearFilters")}
            </button>
          </div>
        ) : null}
      </div>
      {panel}
    </div>
  );

  return (
    <DashboardTable<T>
      data={page.rows}
      columns={columns}
      rowKey={(row) => rowKey(row)}
      renderRowActions={renderRowActions}
      stats={stats}
      headerRight={actions}
      toolbar={toolbar}
      scrollClassName={BOUNDED_SCROLL}
      pagination={
        page.pages > 1
          ? {
              currentPage: page.page + 1,
              totalPages: page.pages,
              pageSize: CONTACT_LIST_PAGE_SIZE,
              totalItems: narrowed.length,
              onPageChange: (next) => onViewChange({ ...view, page: next - 1 }),
            }
          : undefined
      }
      paginationText={{ items: t("unit") }}
      emptyState={{
        title: t("emptyTitle"),
        description: narrowedView ? t("emptyFiltered") : undefined,
      }}
    />
  );
}
