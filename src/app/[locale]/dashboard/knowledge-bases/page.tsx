"use client";

import { Files, MagnifyingGlass, Plus, Trash } from "@/components/icons";
import { useEffect, useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import type { KnowledgeBase } from "@/lib/knowledge-base/types";
import { apiClient } from "@/lib/api/browser-client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

async function fetchKnowledgeBases(): Promise<{
  knowledgeBases: KnowledgeBase[];
  error?: string;
}> {
  const { data, error } = await apiClient<{
    data?: KnowledgeBase[];
    knowledgeBases?: KnowledgeBase[];
  }>("/knowledge-bases");
  if (error) {
    return { knowledgeBases: [], error: error.message || "Failed to fetch" };
  }
  return { knowledgeBases: data?.data || data?.knowledgeBases || [] };
}

async function deleteKnowledgeBase(id: string): Promise<{ error?: string }> {
  const { error } = await apiClient(`/knowledge-bases/${id}`, {
    method: "DELETE",
  });
  if (error) {
    return { error: error.message || "Failed to delete" };
  }
  return {};
}

const statusColor: Record<string, string> = {
  active: "bg-healthy text-healthy-foreground",
  processing: "bg-warning text-warning-foreground",
  error: "bg-destructive text-destructive-foreground",
};

export default function KnowledgeBasesPage() {
  const t = useTranslations("knowledgeBase");
  const { can, currentWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceLoading || !currentWorkspace?.id) return;

    async function loadKnowledgeBases() {
      setLoading(true);
      setError(null);
      const result = await fetchKnowledgeBases();
      if (result.error) {
        setError(result.error);
      } else {
        setKnowledgeBases(result.knowledgeBases);
      }
      setLoading(false);
    }
    loadKnowledgeBases();
  }, [currentWorkspace?.id, workspaceLoading]);

  const handleDelete = async (id: string) => {
    const result = await deleteKnowledgeBase(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
      toast.success(t("form.toast.deleted"));
    }
  };

  const filteredKnowledgeBases = knowledgeBases.filter(
    (kb) =>
      kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (kb.description?.toLowerCase() || "").includes(searchQuery.toLowerCase()),
  );

  const activeKnowledgeBases = knowledgeBases.filter(
    (kb) => kb.status === "active",
  ).length;
  const totalKnowledgeBases = knowledgeBases.length;
  const totalDocuments = knowledgeBases.reduce(
    (acc, kb) => acc + (kb.documentCount || 0),
    0,
  );
  const totalChunks = knowledgeBases.reduce(
    (acc, kb) => acc + (kb.chunkCount || 0),
    0,
  );

  const columns = useMemo<DashboardTableColumn<KnowledgeBase>[]>(
    () => [
      {
        key: "name",
        header: t("header.badge"),
        render: (row) => (
          <span className="text-sm font-medium text-foreground">
            {row.name}
          </span>
        ),
      },
      {
        key: "status",
        header: t("stats.status"),
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
              statusColor[row.status] ?? "bg-gray-500 text-white",
            )}
          >
            {row.status}
          </span>
        ),
      },
      {
        key: "documents",
        header: t("stats.documents"),
        render: (row) => (
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {row.documentCount ?? 0}
          </span>
        ),
      },
      {
        key: "chunks",
        header: t("stats.chunks"),
        render: (row) => (
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {row.chunkCount ?? 0}
          </span>
        ),
      },
      {
        key: "sizeMB",
        header: t("stats.size"),
        render: (row) => (
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {row.totalSizeMB?.toFixed(1) ?? "0"} MB
          </span>
        ),
      },
      {
        key: "createdAt",
        header: t("card.createdAt"),
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
        icon={<Files className="h-5 w-5" weight="fill" />}
        badge={t("header.badge")}
        description={t("header.description")}
        actions={
          can("agents", "create") ? (
            <Button
              variant="primary"
              title={t("button")}
              icon={<Plus className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
              link="/dashboard/knowledge-bases/new"
              newTab={false}
            />
          ) : undefined
        }
      />

      <DashboardTable<KnowledgeBase>
        data={filteredKnowledgeBases}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={(row) =>
          router.push(`/dashboard/knowledge-bases/${row.id}`)
        }
        stats={[
          {
            label: t("stats.total"),
            value: loading ? "..." : totalKnowledgeBases,
          },
          {
            label: t("stats.active"),
            value: loading ? "..." : activeKnowledgeBases,
          },
          {
            label: t("stats.documents"),
            value: loading ? "..." : totalDocuments,
          },
          {
            label: t("stats.chunks"),
            value: loading ? "..." : totalChunks,
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
              handleDelete(row.id);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <Trash className="h-3.5 w-3.5" weight="bold" />
            {t("form.delete")}
          </button>
        )}
        emptyState={
          error
            ? {
                icon: <Files className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("error.title"),
                description: error,
              }
            : {
                icon: (
                  <Files
                    className="h-7 w-7 text-muted-foreground"
                    weight="fill"
                  />
                ),
                title: t("empty.title"),
                action: can("agents", "create") ? (
                  <Button
                    variant="primary"
                    title={t("button")}
                    icon={<Plus className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    link="/dashboard/knowledge-bases/new"
                    newTab={false}
                  />
                ) : undefined,
              }
        }
      />
    </motion.main>
  );
}
