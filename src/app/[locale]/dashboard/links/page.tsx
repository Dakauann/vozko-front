"use client";

import { useEffect, useState } from "react";

import {
  CursorClick,
  LinkSimple,
  PencilSimple,
  Trash,
  Users,
} from "@/components/icons";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import { deleteLink, listLinks, getLinkStats } from "@/app/actions/links";
import type { ShortLink, WorkspaceLinkStats } from "@/lib/links/types";
import { useWorkspace } from "@/contexts/workspace-context";

import { CopyButton } from "./_components/CopyButton";

const PAGE_SIZE = 15;

export default function LinksPage() {
  const t = useTranslations("links");
  const router = useRouter();
  const { can, currentWorkspace, isLoading: workspaceLoading } = useWorkspace();

  const [links, setLinks] = useState<ShortLink[]>([]);
  const [stats, setStats] = useState<WorkspaceLinkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const canCreate = can("short_links", "create");
  const canUpdate = can("short_links", "update");
  const canDelete = can("short_links", "delete");

  useEffect(() => {
    if (workspaceLoading || !currentWorkspace?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [listResult, statsResult] = await Promise.all([
        listLinks({ page, pageSize: PAGE_SIZE }),
        getLinkStats(),
      ]);
      if (cancelled) return;
      if (listResult.error) {
        setError(listResult.error);
      } else {
        setError(null);
        setLinks(listResult.items);
        setTotalPages(listResult.meta.totalPages);
        setTotalItems(listResult.meta.totalItems);
      }
      if (!statsResult.error && statsResult.stats) {
        setStats(statsResult.stats);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentWorkspace?.id, workspaceLoading, page]);

  const handleDelete = async (link: ShortLink) => {
    const { error: delError } = await deleteLink(link.id);
    if (delError) {
      toast.error(delError);
      return;
    }
    toast.success(t("toast.deleted"));
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const columns: DashboardTableColumn<ShortLink>[] = [
    {
      header: t("table.link"),
      key: "link",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.title || row.targetUrl}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.targetUrl}</p>
        </div>
      ),
    },
    {
      header: t("table.shortUrl"),
      key: "shortUrl",
      render: (row) => (
        <div className="flex items-center gap-2">
          <code className="rounded-md bg-muted px-2 py-1 text-xs text-foreground">
            /{row.code}
          </code>
          <CopyButton
            value={row.shortUrl ?? ""}
            label={t("actions.copy")}
            copiedLabel={t("toast.copied")}
          />
        </div>
      ),
    },
    {
      header: t("table.clicks"),
      key: "clicks",
      render: (row) => (
        <div className="text-sm">
          <span className="font-semibold text-foreground">{row.clickCount}</span>
          <span className="text-muted-foreground">
            {" "}
            / {row.uniqueClickCount} {t("table.unique")}
          </span>
        </div>
      ),
    },
    {
      header: t("table.status"),
      key: "status",
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              row.status === "active" ? "bg-healthy" : "bg-muted"
            }`}
          />
          {t(`status.${row.status}`)}
          {row.hasPassword && (
            <span className="text-muted-foreground">{t("table.locked")}</span>
          )}
        </span>
      ),
    },
    {
      header: t("table.created"),
      key: "created",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full space-y-6"
    >
      <DashboardPageHeader
        icon={<LinkSimple className="h-5 w-5" weight="bold" />}
        badge={t("header.badge")}
        description={t("header.description")}
        actions={
          canCreate ? (
            <Button
              variant="primary"
              title={t("header.create")}
              icon={<LinkSimple className="h-4 w-4" weight="bold" />}
              iconVisible
              onClick={() => router.push("/dashboard/links/new")}
            />
          ) : undefined
        }
      />

      <DashboardTable<ShortLink>
        stats={[
          {
            label: t("stats.totalLinks"),
            value: loading ? "..." : String(stats?.totalLinks ?? totalItems),
            icon: <LinkSimple className="h-4 w-4 text-info-ink" weight="fill" />,
          },
          {
            label: t("stats.totalClicks"),
            value: loading ? "..." : String(stats?.totalClicks ?? 0),
            icon: <CursorClick className="h-4 w-4 text-healthy" weight="fill" />,
          },
        ]}
        data={links}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={(row) => router.push(`/dashboard/links/${row.id}`)}
        renderRowActions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {canUpdate && (
              <button
                type="button"
                aria-label={t("actions.edit")}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/links/${row.id}/edit`);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <PencilSimple className="h-4 w-4" weight="bold" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                aria-label={t("actions.delete")}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(row);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash className="h-4 w-4" weight="bold" />
              </button>
            )}
          </div>
        )}
        pagination={
          totalPages > 1
            ? {
                currentPage: page,
                totalPages,
                pageSize: PAGE_SIZE,
                totalItems,
                onPageChange: setPage,
              }
            : undefined
        }
        emptyState={
          error
            ? {
                icon: <LinkSimple className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("empty.errorTitle"),
                description: error,
              }
            : {
                icon: <Users className="h-7 w-7 text-muted-foreground" weight="fill" />,
                title: t("empty.title"),
                description: t("empty.description"),
                action: canCreate ? (
                  <Button
                    variant="primary"
                    title={t("header.create")}
                    icon={<LinkSimple className="h-4 w-4" weight="bold" />}
                    iconVisible
                    onClick={() => router.push("/dashboard/links/new")}
                  />
                ) : undefined,
              }
        }
      />
    </motion.main>
  );
}
