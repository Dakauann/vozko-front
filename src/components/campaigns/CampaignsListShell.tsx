"use client";

import { MagnifyingGlass, Plus } from "@/components/icons";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import type { ReactNode } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedInput from "@/components/elevated-design/elevated-input";


export interface CampaignsListLabels {
  badge: string;
  description: string;
  newButton: string;
  searchPlaceholder: string;
  filterAll: string;
  statusLabels: Record<string, string>;
  stats: { total: string; active: string; contacts: string; paused: string };
  emptyTitle: string;
  emptyDescription: string;
  errorTitle: string;
}

export interface CampaignsListShellProps<T extends { id: string; status: string }> {
  labels: CampaignsListLabels;
  icon: ReactNode;
  headerColorClass?: string;

  rows: T[];
  columns: DashboardTableColumn<T>[];
  loading: boolean;
  error?: string | null;

  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;

  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;

  contactCount: number;

  onRowClick: (row: T) => void;
  renderRowActions?: (row: T) => ReactNode;

  summary?: ReactNode;

  canCreate: boolean;
  createHref: string;
  notice?: ReactNode;
}

const STATUSES = ["RUNNING", "PAUSED", "STOPPED", "COMPLETED"] as const;

export function CampaignsListShell<T extends { id: string; status: string }>({
  labels,
  icon,
  headerColorClass = "text-healthy-ink",
  rows,
  columns,
  loading,
  error,
  totalItems,
  totalPages,
  page,
  pageSize,
  onPageChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  contactCount,
  onRowClick,
  renderRowActions,
  summary,
  canCreate,
  createHref,
  notice,
}: CampaignsListShellProps<T>) {
  const activeCount = rows.filter((r) => r.status === "RUNNING").length;
  const pausedCount = rows.filter((r) => r.status === "PAUSED").length;

  const newButton = canCreate ? (
    <Button
      variant="primary"
      title={labels.newButton}
      icon={<Plus className="h-4 w-4" weight="bold" />}
      iconVisible
      iconSide="left"
      link={createHref}
      newTab={false}
    />
  ) : undefined;

  return (
    <main className="w-full space-y-4">
      <DashboardPageHeader
        icon={icon}
        badge={labels.badge}
        description={labels.description}
        colorClass={headerColorClass}
        actions={newButton}
      />

      {notice}
      {summary}

      <DashboardTable<T>
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={onRowClick}
        stats={[
          { label: labels.stats.total, value: loading ? "..." : totalItems },
          { label: labels.stats.active, value: loading ? "..." : activeCount },
          {
            label: labels.stats.contacts,
            value: loading ? "..." : contactCount.toLocaleString(),
          },
          { label: labels.stats.paused, value: loading ? "..." : pausedCount },
        ]}
        headerLeft={
          <div className="relative w-full max-w-xs">
            <ElevatedInput
              type="text"
              label={labels.searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
              className="w-full"
            />
          </div>
        }
        toolbar={
          <ElevatedSelect
            value={statusFilter}
            onValueChange={onStatusFilterChange}
            className="w-auto min-w-[140px]"
          >
            <ElevatedSelectItem value="all">{labels.filterAll}</ElevatedSelectItem>
            {STATUSES.map((status) => (
              <ElevatedSelectItem key={status} value={status}>
                {labels.statusLabels[status] ?? status}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        }
        renderRowActions={renderRowActions}
        pagination={
          totalPages > 1
            ? {
                currentPage: page,
                totalPages,
                pageSize,
                totalItems,
                onPageChange,
              }
            : undefined
        }
        emptyState={
          error
            ? { icon, title: labels.errorTitle, description: error }
            : {
                icon,
                title: labels.emptyTitle,
                description: labels.emptyDescription,
                action: newButton,
              }
        }
      />
    </main>
  );
}
