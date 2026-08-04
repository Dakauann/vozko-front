"use client";

import {
  Archive,
  ChatCircle,
  Lightning,
  MagnifyingGlass,
  Plus,
  Robot,
  Sparkle,
} from "@/components/icons";
import {
  archiveAgentAction,
  assignAgentDepartmentAction,
  listAgentsAction,
} from "@/app/actions/agents";
import { useEffect, useMemo, useState } from "react";

import type { Agent, AgentListItem } from "@/lib/agents/types";
import { DepartmentRowSwitcher } from "@/components/dashboard/DepartmentRowSwitcher";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ModelBrandIcon } from "@/components/elevated-design/model-brand-icon";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";
import { useDepartment } from "@/contexts/department-context";

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;

export default function AgentsPage() {
  const t = useTranslations("agents");
  const tTemplates = useTranslations("resourceTemplates.emptyState");
  const { can, currentWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const { currentDepartment } = useDepartment();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ page: 1, search: "" });
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = searchInput.trim();
      setFilters((prev) =>
        prev.search === nextSearch
          ? prev
          : { ...prev, page: 1, search: nextSearch },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setFilters((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [currentWorkspace?.id, currentDepartment?.id]);

  useEffect(() => {
    if (workspaceLoading || !currentWorkspace?.id) return;

    let cancelled = false;

    async function fetchAgents() {
      setLoading(true);
      setError(null);
      try {
        const result = await listAgentsAction({
          page: filters.page,
          pageSize: PAGE_SIZE,
          search: filters.search || undefined,
        });

        if (cancelled) {
          return;
        }

        if (result.error) {
          setError(result.error);
          setAgents([]);
          setTotalPages(1);
          setTotalItems(0);
        } else {
          setAgents(result.agents ?? []);
          setTotalPages(result.meta.totalPages);
          setTotalItems(result.meta.totalItems);
        }
      } catch {
        if (cancelled) {
          return;
        }
        setError(t("error.default"));
        setAgents([]);
        setTotalPages(1);
        setTotalItems(0);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchAgents();

    return () => {
      cancelled = true;
    };
  }, [
    currentWorkspace?.id,
    currentDepartment?.id,
    workspaceLoading,
    filters.page,
    filters.search,
    reloadKey,
    t,
  ]);

  const handleArchive = async (agentId: string) => {
    const result = await archiveAgentAction(agentId);
    if (!result.error) {
      if (agents.length === 1 && filters.page > 1) {
        setFilters((prev) => ({ ...prev, page: prev.page - 1 }));
        return;
      }
      setReloadKey((prev) => prev + 1);
    }
  };

  const handleAssignDepartment = async (
    agentId: string,
    departmentId: string,
  ) => {
    const result = await assignAgentDepartmentAction(agentId, departmentId);
    if (!result.error && result.agent) {
      const updated: Agent = result.agent;
      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === agentId
            ? { ...agent, departmentId: updated.departmentId ?? null }
            : agent,
        ),
      );
    }
    return result;
  };

  const activeAgents = agents.filter((a) => a.isActive).length;
  const totalAgents = totalItems;
  const inactiveAgents = agents.filter((a) => !a.isActive).length;

  const canReadDetails = can("agents", "read_details");

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
        key: "status",
        header: t("card.status.label"),
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium",
              row.isActive
                ? "bg-healthy text-white"
                : "bg-muted text-white",
            )}
          >
            {row.isActive ? t("card.status.active") : t("card.status.inactive")}
          </span>
        ),
      },
      {
        key: "model",
        header: t("card.model"),
        render: (row) => {
          const messaging = row.messagingModel?.trim();
          if (!messaging) {
            return <span className="text-sm text-muted-foreground">,</span>;
          }
          return (
            <div className="flex flex-col gap-1 max-w-[260px]">
              {messaging ? (
                <span
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  title={t("detail.messagingModel")}
                >
                  <ChatCircle
                    className="h-3 w-3 shrink-0 text-healthy"
                    weight="fill"
                  />
                  <ModelBrandIcon modelId={messaging} size={12} />
                  <span className="truncate">{messaging.split("/").pop()}</span>
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "tags",
        header: t("card.tags"),
        render: (row) => {
          const tags = row.tags ?? [];
          if (tags.length === 0) {
            return <span className="text-sm text-muted-foreground">,</span>;
          }
          return (
            <div className="flex flex-wrap gap-1 max-w-[260px]">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-[--radius] bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 3 ? (
                <span className="text-xs text-muted-foreground">
                  +{tags.length - 3}
                </span>
              ) : null}
            </div>
          );
        },
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
      {
        key: "updatedAt",
        header: t("card.updatedAt"),
        render: (row) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {new Date(row.updatedAt).toLocaleDateString()}
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
              link="/dashboard/agents/new"
              newTab={false}
            />
          ) : undefined
        }
      />

      <DashboardTable<AgentListItem>
        data={agents}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={
          canReadDetails
            ? (row) => router.push(`/dashboard/agents/${row.id}`)
            : undefined
        }
        stats={[
          {
            label: t("stats.total"),
            value: loading ? "..." : totalAgents,
          },
          {
            label: t("stats.active"),
            value: loading ? "..." : activeAgents,
          },
          {
            label: t("stats.inactive"),
            value: loading ? "..." : inactiveAgents,
          },
        ]}
        headerLeft={
          <div className="relative w-full max-w-xs">
            <ElevatedInput
              type="text"
              label={t("search.placeholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
              className="w-full"
            />
          </div>
        }
        pagination={{
          currentPage: filters.page,
          totalPages,
          pageSize: PAGE_SIZE,
          totalItems,
          onPageChange: (page) => setFilters((prev) => ({ ...prev, page })),
        }}
        renderRowActions={(row) => (
          <>
            <DepartmentRowSwitcher
              departmentId={row.departmentId}
              onAssign={(departmentId) =>
                handleAssignDepartment(row.id, departmentId).then((result) => ({
                  item: result.agent,
                  error: result.error,
                }))
              }
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleArchive(row.id);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <Archive className="h-3.5 w-3.5" weight="bold" />
              {t("card.archive")}
            </button>
          </>
        )}
        emptyState={
          error
            ? {
                icon: <Robot className="h-7 w-7 text-destructive" weight="fill" />,
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
                title: t("empty.title"),
                action: (
                  <div className="flex flex-col items-center gap-3">
                    {can("agents", "create") && (
                      <Button
                        variant="primary"
                        title={t("button")}
                        icon={<Plus className="h-4 w-4" weight="bold" />}
                        iconVisible
                        iconSide="left"
                        link="/dashboard/agents/new"
                        newTab={false}
                      />
                    )}
                    <Button
                      variant="ghost"
                      title={tTemplates("browseAction")}
                      icon={<Sparkle className="h-4 w-4" weight="fill" />}
                      iconVisible
                      iconSide="left"
                      link="/dashboard/resource-templates?resourceType=agent"
                      newTab={false}
                    />
                  </div>
                ),
              }
        }
      />
    </motion.main>
  );
}
