"use client";

import { Archive, Headset, MagnifyingGlass, Plus } from "@/components/icons";
import type {
  SupportInbox,
  SupportInboxListMeta,
} from "@/lib/support-inboxes/types";
import {
  archiveSupportInboxAction,
  listSupportInboxesAction,
} from "@/app/actions/support-inboxes";
import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

const ITEMS_PER_PAGE = 15;

export default function SupportInboxesPage() {
  const t = useTranslations("supportInboxesPage");
  const { can, currentWorkspace } = useWorkspace();
  const router = useRouter();
  const [inboxes, setInboxes] = useState<SupportInbox[]>([]);
  const [meta, setMeta] = useState<SupportInboxListMeta>({
    page: 1,
    pageSize: ITEMS_PER_PAGE,
    totalPages: 0,
    totalItems: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchInboxes = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSupportInboxesAction(
        pageNum,
        ITEMS_PER_PAGE,
        undefined,
        false,
      );
      if (result.error) {
        setError(result.error);
      } else {
        setInboxes(result.inboxes);
        setMeta(result.meta);
      }
    } catch {
      setError("Failed to load support inboxes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    fetchInboxes(page);
  }, [currentWorkspace?.id, fetchInboxes, page]);

  const handleArchive = async (inboxId: string) => {
    const result = await archiveSupportInboxAction(inboxId);
    if (!result.error) {
      setInboxes((prev) => prev.filter((i) => i.id !== inboxId));
    }
  };

  const filteredInboxes = inboxes.filter((inbox) =>
    inbox.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const columns = useMemo<DashboardTableColumn<SupportInbox>[]>(
    () => [
      {
        key: "name",
        header: t("columns.name"),
        render: (row) => (
          <span className="text-sm font-medium text-foreground">
            {row.name}
          </span>
        ),
      },
      {
        key: "greetingMessage",
        header: t("columns.greeting"),
        render: (row) => (
          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
            {row.greetingMessage || "—"}
          </span>
        ),
      },
      {
        key: "agentEnabled",
        header: t("columns.aiAgent"),
        render: (row) => (
          <span
            className={`inline-flex items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium ${
              row.enableAgentResponses
                ? "bg-healthy text-healthy-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {row.enableAgentResponses ? t("enabled") : t("disabled")}
          </span>
        ),
      },
      {
        key: "origins",
        header: t("columns.origins"),
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {row.allowedOrigins.length === 0
              ? t("allOrigins")
              : row.allowedOrigins.length === 1
                ? row.allowedOrigins[0]
                : `${row.allowedOrigins.length} ${t("origins")}`}
          </span>
        ),
      },
      {
        key: "createdAt",
        header: t("columns.createdAt"),
        render: (row) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {new Date(row.createdAt).toLocaleDateString()}
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
        icon={<Headset className="h-6 w-6" weight="fill" />}
        badge={t("header.badge")}
        description={t("header.description")}
        colorClass="text-muted-foreground"
        actions={
          can("support_inboxes", "create") ? (
            <Button
              variant="primary"
              title={t("newButton")}
              icon={<Plus className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
              link="/dashboard/support-inboxes/new"
              newTab={false}
            />
          ) : undefined
        }
      />

      <DashboardTable<SupportInbox>
        data={filteredInboxes}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={(row) =>
          router.push(`/dashboard/support-inboxes/${row.id}`)
        }
        stats={[
          {
            label: t("stats.total"),
            value: loading ? "..." : meta.totalItems,
          },
          {
            label: t("stats.withAgent"),
            value: loading
              ? "..."
              : inboxes.filter((i) => i.enableAgentResponses).length,
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
        renderRowActions={(row) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleArchive(row.id);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <Archive className="h-3.5 w-3.5" weight="bold" />
            {t("archive")}
          </button>
        )}
        pagination={
          meta.totalPages > 1
            ? {
                currentPage: page,
                totalPages: meta.totalPages,
                pageSize: ITEMS_PER_PAGE,
                totalItems: meta.totalItems,
                onPageChange: setPage,
              }
            : undefined
        }
        emptyState={
          error
            ? {
                icon: (
                  <Headset className="h-7 w-7 text-destructive-ink" weight="fill" />
                ),
                title: t("error.title"),
                description: error,
              }
            : {
                icon: (
                  <Headset
                    className="h-7 w-7 text-muted-foreground/40"
                    weight="fill"
                  />
                ),
                title: t("empty.title"),
                description: t("empty.description"),
                action: can("support_inboxes", "create") ? (
                  <Button
                    variant="primary"
                    title={t("newButton")}
                    icon={<Plus className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    link="/dashboard/support-inboxes/new"
                    newTab={false}
                  />
                ) : undefined,
              }
        }
      />
    </motion.main>
  );
}
