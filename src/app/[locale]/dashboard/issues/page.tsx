"use client";

import {
  MagnifyingGlass,
  Plus,
  Warning,
  Clock,
  CheckCircle,
  Circle,
  ArrowClockwise,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { listIssuesAction } from "@/app/actions/issues";
import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import type { Issue, IssueListMeta } from "@/lib/issues/types";
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
import { useWorkspace } from "@/contexts/workspace-context";

const ITEMS_PER_PAGE = 15;

const statusConfig: Record<string, { color: string; icon: Icon }> = {
  open: {
    color: "bg-blue-500 text-white",
    icon: Circle,
  },
  in_progress: {
    color: "bg-amber-500 text-white",
    icon: ArrowClockwise,
  },
  closed: {
    color: "bg-emerald-500 text-white",
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

export default function IssuesPage() {
  const t = useTranslations("issuesPage");
  const { can, currentWorkspace } = useWorkspace();
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

  const fetchIssues = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listIssuesAction({
          workspaceId: currentWorkspace?.id,
          page: pageNum,
          pageSize: ITEMS_PER_PAGE,
          status:
            statusFilter === "all"
              ? undefined
              : (statusFilter as Issue["status"]),
          search: searchQuery || undefined,
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
    [currentWorkspace?.id, statusFilter, searchQuery, t],
  );

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    fetchIssues(page);
  }, [currentWorkspace?.id, fetchIssues, page]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQuery]);

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
          </div>
        ),
      },
      {
        key: "status",
        header: t("table.status"),
        render: (row) => {
          const config = statusConfig[row.status] ?? statusConfig.open;
          const StatusIcon = config.icon;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                config.color,
              )}
            >
              <StatusIcon className="h-3 w-3" weight="bold" />
              {t(`status.${row.status}` as Parameters<typeof t>[0])}
            </span>
          );
        },
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
      {
        key: "updatedAt",
        header: t("table.updated"),
        render: (row) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(row.updatedAt)}
          </span>
        ),
      },
    ],
    [t],
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
        badge={t("header.badge")}
        description={t("header.description")}
        actions={
          can("issues", "create") ? (
            <Button
              variant="primary"
              title={t("action.create")}
              icon={<Plus className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
              link="/dashboard/issues/new"
              newTab={false}
            />
          ) : undefined
        }
      />

      <DashboardTable<Issue>
        data={issues}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={(row) => router.push(`/dashboard/issues/${row.id}`)}
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
          title: t("empty.title"),
          description: t("empty.description"),
        }}
      />

      {error && (
        <div className="rounded-xl border border-red-600 bg-red-500 px-4 py-3 text-sm text-white">
          {error}
        </div>
      )}
    </motion.main>
  );
}
