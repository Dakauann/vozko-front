"use client";

import {
  ArrowClockwise,
  CheckCircle,
  Circle,
  Eye,
  MagnifyingGlass,
  SpinnerGap,
  Warning,
} from "@/components/icons";
import type { Icon } from "@/components/icons";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  adminListIssuesAction,
  adminUpdateIssueStatusAction,
} from "@/app/actions/issues";
import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import type { Issue, IssueListMeta, IssueStatus } from "@/lib/issues/types";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const ITEMS_PER_PAGE = 20;

const statusConfig: Record<string, { color: string; icon: Icon }> = {
  open: {
    color: "bg-muted text-muted-foreground",
    icon: Circle,
  },
  in_progress: {
    color: "bg-warning text-warning-foreground",
    icon: ArrowClockwise,
  },
  closed: {
    color: "bg-healthy text-healthy-foreground",
    icon: CheckCircle,
  },
};

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeTime(ts: number) {
  const now = Date.now();
  const diff = now - ts * 1000;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(ts);
}

export default function AdminIssuesPage() {
  const t = useTranslations("issuesPage");
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [meta, setMeta] = useState<IssueListMeta>({
    page: 1,
    pageSize: ITEMS_PER_PAGE,
    totalPages: 1,
    totalItems: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const fetchIssues = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await adminListIssuesAction({
          page: pageNum,
          pageSize: ITEMS_PER_PAGE,
          status:
            statusFilter === "all" ? undefined : (statusFilter as IssueStatus),
          search: searchQuery || undefined,
          sortBy: "createdAt",
          sortDir: "desc",
        });
        if (result.error) {
          setError(result.error);
        } else {
          setIssues(result.issues);
          setMeta(result.meta);
        }
      } catch {
        setError(t("error.loadFailed"));
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, searchQuery, t],
  );

  useEffect(() => {
    fetchIssues(page);
  }, [fetchIssues, page]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery]);

  const handleStatusChange = async (issueId: string, newStatus: string) => {
    setUpdatingStatus(issueId);
    try {
      const result = await adminUpdateIssueStatusAction(issueId, newStatus);
      if (result.error) {
        setError(result.error);
      } else if (result.issue) {
        setIssues((prev) =>
          prev.map((iss) => (iss.id === issueId ? result.issue! : iss)),
        );
      }
    } catch {
      setError(t("admin.error.statusUpdateFailed"));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const openCount = issues.filter((i) => i.status === "open").length;
  const inProgressCount = issues.filter(
    (i) => i.status === "in_progress",
  ).length;
  const closedCount = issues.filter((i) => i.status === "closed").length;

  const columns = useMemo<DashboardTableColumn<Issue>[]>(
    () => [
      {
        key: "title",
        header: t("table.title"),
        render: (row) => (
          <div className="min-w-0">
            <span className="block text-sm font-medium text-foreground truncate max-w-xs">
              {row.title}
            </span>
            {row.description && (
              <span className="block text-xs text-muted-foreground truncate max-w-xs mt-0.5">
                {row.description.length > 80
                  ? `${row.description.slice(0, 80)}…`
                  : row.description}
              </span>
            )}
            {row.imageUrls && row.imageUrls.length > 0 && (
              <span className="text-[10px] text-muted-foreground/60 mt-0.5">
                📎 {row.imageUrls.length} {t("admin.images")}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "workspace",
        header: t("admin.workspace"),
        render: (row) => (
          <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px] block">
            {row.workspaceId.slice(0, 8)}…
          </span>
        ),
      },
      {
        key: "status",
        header: t("table.status"),
        render: (row) => {
          const config = statusConfig[row.status] ?? statusConfig.open;
          const StatusIcon = config.icon;
          const isUpdating = updatingStatus === row.id;
          return (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
                  config.color,
                )}
              >
                {isUpdating ? (
                  <SpinnerGap className="h-3 w-3 animate-spin" />
                ) : (
                  <StatusIcon className="h-3 w-3" weight="bold" />
                )}
                {t(`status.${row.status}` as Parameters<typeof t>[0])}
              </span>
            </div>
          );
        },
      },
      {
        key: "actions",
        header: t("admin.actions"),
        render: (row) => (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {row.status !== "closed" && (
              <ElevatedSelect
                value={row.status}
                onValueChange={(value) => handleStatusChange(row.id, value)}
                className="w-auto min-w-[130px]"
              >
                <ElevatedSelectItem value="open">
                  {t("status.open")}
                </ElevatedSelectItem>
                <ElevatedSelectItem value="in_progress">
                  {t("status.in_progress")}
                </ElevatedSelectItem>
                <ElevatedSelectItem value="closed">
                  {t("status.closed")}
                </ElevatedSelectItem>
              </ElevatedSelect>
            )}
            <Button
              variant="ghost"
              title=""
              icon={<Eye className="h-4 w-4" />}
              iconVisible
              onClick={() => router.push(`/dashboard/issues/manage/${row.id}`)}
              className="shrink-0"
            />
          </div>
        ),
      },
      {
        key: "createdAt",
        header: t("table.created"),
        render: (row) => (
          <div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {formatDate(row.createdAt)}
            </span>
            <span className="block text-xs text-muted-foreground/70">
              {formatRelativeTime(row.createdAt)}
            </span>
          </div>
        ),
      },
    ],
    [t, updatingStatus, router],
  );

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      <DashboardPageHeader
        icon={<Warning className="h-6 w-6" weight="fill" />}
        badge={t("admin.badge")}
        description={t("admin.description")}
      />

      <DashboardTable<Issue>
        data={issues}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={(row) => router.push(`/dashboard/issues/manage/${row.id}`)}
        stats={[
          {
            label: t("stats.total"),
            value: loading ? "..." : meta.totalItems,
          },
          {
            label: t("stats.open"),
            value: loading ? "..." : openCount,
          },
          {
            label: t("stats.inProgress"),
            value: loading ? "..." : inProgressCount,
          },
          {
            label: t("stats.closed"),
            value: loading ? "..." : closedCount,
          },
        ]}
        headerLeft={
          <div className="relative w-full max-w-xs">
            <ElevatedInput
              type="text"
              label={t("search.placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
              className="w-full"
            />
          </div>
        }
        toolbar={
          <ElevatedSelect
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value)}
            className="w-auto min-w-[140px]"
          >
            <ElevatedSelectItem value="all">
              {t("filter.all")}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="open">
              {t("status.open")}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="in_progress">
              {t("status.in_progress")}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="closed">
              {t("status.closed")}
            </ElevatedSelectItem>
          </ElevatedSelect>
        }
        pagination={{
          currentPage: page,
          totalPages: meta.totalPages,
          pageSize: meta.pageSize,
          totalItems: meta.totalItems,
          onPageChange: setPage,
        }}
        paginationText={{
          showing: t("pagination.showing"),
          of: t("pagination.of"),
          items: t("pagination.items"),
        }}
        emptyState={{
          icon: <Warning className="h-12 w-12 text-muted-foreground/40" />,
          title: t("admin.empty.title"),
          description: t("admin.empty.description"),
        }}
      />

      {error && (
        <div className="rounded-[--radius] border border-destructive bg-destructive px-4 py-3 text-sm text-white">
          {error}
        </div>
      )}
    </motion.main>
  );
}
