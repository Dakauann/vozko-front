"use client";

import {
  ArrowCounterClockwise,
  MagnifyingGlass,
  Robot,
} from "@/components/icons";
import {
  listArchivedAgentsAction,
  unarchiveAgentAction,
} from "@/app/actions/agents";
import { useEffect, useMemo, useState } from "react";

import type { AgentListItem } from "@/lib/agents/types";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

export default function ArchivedAgentsPage() {
  const t = useTranslations("agents");
  const tSidebar = useTranslations("sidebar");
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceLoading || !currentWorkspace?.id) return;

    async function fetchArchivedAgents() {
      setLoading(true);
      setError(null);
      try {
        const result = await listArchivedAgentsAction();
        if (result.error) {
          setError(result.error);
        } else {
          setAgents(result.agents);
        }
      } catch {
        setError("Failed to load archived agents");
      } finally {
        setLoading(false);
      }
    }
    fetchArchivedAgents();
  }, [currentWorkspace?.id, workspaceLoading]);

  const handleUnarchive = async (agentId: string) => {
    const result = await unarchiveAgentAction(agentId);
    if (!result.error) {
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    }
  };

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const columns = useMemo<DashboardTableColumn<AgentListItem>[]>(
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
        key: "provider",
        header: t("card.provider"),
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {row.provider || "—"}
          </span>
        ),
      },
      {
        key: "messagingModel",
        header: t("card.model"),
        render: (row) => (
          <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
            {row.messagingModel || "—"}
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
        icon={<Robot className="h-6 w-6" weight="fill" />}
        badge={tSidebar("nav.archivedAgents")}
        description={t("archived.description")}
      />

      <DashboardTable<AgentListItem>
        data={filteredAgents}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        stats={[
          {
            label: t("stats.total"),
            value: loading ? "..." : agents.length,
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
              handleUnarchive(row.id);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowCounterClockwise className="h-3.5 w-3.5" weight="bold" />
            {t("archived.unarchive")}
          </button>
        )}
        emptyState={
          error
            ? {
                icon: <Robot className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("error.title"),
                description: error,
              }
            : {
                icon: (
                  <Robot
                    className="h-7 w-7 text-muted-foreground/40"
                    weight="fill"
                  />
                ),
                title: t("archived.emptyTitle"),
                description: t("archived.emptyDescription"),
              }
        }
      />
    </motion.main>
  );
}
