/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  GitBranch,
  Plus,
  MagnifyingGlass,
  Play,
  Pause,
  Trash,
  DotsThree,
  DownloadSimple,
  UploadSimple,
} from "@/components/icons";

import { openScoped } from "@/lib/browser/scoped-download-url";
import { getApiBaseUrl } from "@/lib/api/browser-client";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DepartmentRowSwitcher } from "@/components/dashboard/DepartmentRowSwitcher";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/contexts/workspace-context";
import { toast } from "sonner";

import type { Workflow, WorkflowStatus } from "@/lib/workflows/types";
import {
  listWorkflowsAction,
  deleteWorkflowAction,
  activateWorkflowAction,
  pauseWorkflowAction,
  importWorkflowAction,
  assignWorkflowDepartmentAction,
} from "@/app/actions/workflows";
import { useDepartment } from "@/contexts/department-context";

const STATUS_COLORS: Record<WorkflowStatus, string> = {
  draft: "bg-[hsl(var(--plate-neutral))] text-white",
  active: "bg-healthy text-healthy-foreground",
  paused: "bg-warning text-warning-foreground",
  archived: "bg-destructive text-destructive-foreground",
};

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;

export default function WorkflowsPage() {
  const t = useTranslations("workflowsPage");
  const tSidebar = useTranslations("sidebar");
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const { currentDepartment } = useDepartment();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({
    page: 1,
    search: "",
    status: "all",
  });
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

  const fetchWorkflows = useCallback(
    async (pageNum: number, search: string, status: string) => {
      if (!currentWorkspace?.id) return;
      setLoading(true);
      setError(null);
      const result = await listWorkflowsAction({
        page: pageNum,
        pageSize: PAGE_SIZE,
        status: status !== "all" ? status : undefined,
        search: search || undefined,
      });
      if (result.error) {
        setError(result.error);
        setWorkflows([]);
        setTotalPages(1);
        setTotalItems(0);
        toast.error(result.error);
      } else {
        setWorkflows(result.workflows ?? []);
        setTotalPages(result.meta.totalPages);
        setTotalItems(result.meta.totalItems);
      }
      setLoading(false);
    },
    [currentWorkspace?.id],
  );

  useEffect(() => {
    fetchWorkflows(filters.page, filters.search, filters.status);
  }, [
    currentWorkspace?.id,
    currentDepartment?.id,
    filters.page,
    filters.search,
    filters.status,
    reloadKey,
    fetchWorkflows,
  ]);

  const handleActivate = async (id: string) => {
    const result = await activateWorkflowAction(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("activated"));
      setReloadKey((prev) => prev + 1);
    }
  };

  const handlePause = async (id: string) => {
    const result = await pauseWorkflowAction(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("paused"));
      setReloadKey((prev) => prev + 1);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteWorkflowAction(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("deleted"));
      if (workflows.length === 1 && filters.page > 1) {
        setFilters((prev) => ({ ...prev, page: prev.page - 1 }));
        return;
      }
      setReloadKey((prev) => prev + 1);
    }
  };

  const handleAssignDepartment = async (id: string, departmentId: string) => {
    const result = await assignWorkflowDepartmentAction(id, departmentId);
    if (!result.error && result.workflow) {
      setWorkflows((prev) =>
        prev.map((workflow) =>
          workflow.id === id ? (result.workflow ?? workflow) : workflow,
        ),
      );
    }
    return result;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportWorkflow = (id: string) => {
    // Same workspace-scoping fix as the balance export: a navigation carries no
    // X-Workspace-ID, so the API resolved the default workspace instead.
    openScoped(`${getApiBaseUrl()}/workflows/${encodeURIComponent(id)}/export`);
  };

  const handleImportWorkflow = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      if (file.size > 2 * 1024 * 1024) {
        toast.error(t("import.tooLarge"));
        return;
      }

      try {
        const text = await file.text();
        JSON.parse(text);
        const result = await importWorkflowAction(text);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(t("import.success"));
          setReloadKey((prev) => prev + 1);
        }
      } catch {
        toast.error(t("import.invalidJson"));
      }
    },
    [t],
  );

  const columns = useMemo<DashboardTableColumn<Workflow>[]>(
    () => [
      {
        key: "name",
        header: t("table.name"),
        render: (row) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">{row.name}</span>
            {row.description && (
              <span className="text-xs text-muted-foreground line-clamp-1">
                {row.description}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "status",
        header: t("table.status"),
        render: (row) => (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status]}`}
          >
            {t(`status.${row.status}`)}
          </span>
        ),
      },
      {
        key: "trigger",
        header: t("table.trigger"),
        render: (row) => {
          const triggerTypes = Array.from(
            new Set(
              (row.graph?.nodes ?? [])
                .map((n) => n.type)
                .filter((ty) => ty.startsWith("trigger_")),
            ),
          );
          const effective = triggerTypes.length
            ? triggerTypes
            : row.triggerType
              ? [row.triggerType]
              : [];
          if (effective.length === 0) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          return (
            <span className="flex flex-wrap gap-1">
              {effective.map((ty) => (
                <span
                  key={ty}
                  className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {t.has(`trigger.${ty}`) ? t(`trigger.${ty}`) : ty}
                </span>
              ))}
            </span>
          );
        },
      },
      {
        key: "nodes",
        header: t("table.nodes"),
        render: (row) => (
          <span className="text-sm tabular-nums">
            {row.graph?.nodes?.length ?? 0}
          </span>
        ),
      },
      {
        key: "version",
        header: t("table.version"),
        render: (row) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            v{row.version}
          </span>
        ),
      },
      {
        key: "updatedAt",
        header: t("table.updatedAt"),
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.updatedAt).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        icon={<GitBranch size={20} weight="duotone" />}
        badge={tSidebar("nav.workflows")}
        description={t("header.description")}
        actions={
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportWorkflow}
            />
            <ElevatedButton
              onClick={() => fileInputRef.current?.click()}
              variant="outline-subtle"
              className="gap-2"
              icon={<UploadSimple size={16} weight="bold" />}
              title={t("import.label")}
              iconVisible
            />
            <ElevatedButton
              onClick={() => router.push("/dashboard/workflows/new")}
              className="gap-2"
              icon={<Plus size={16} weight="bold" />}
              title={t("header.new")}
              iconVisible
            />
          </div>
        }
      />

      <DashboardTable
        data={workflows}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={(row) => router.push(`/dashboard/workflows/${row.id}`)}
        headerLeft={
          <ElevatedInput
            label={t("filters.search")}
            value={searchInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchInput(e.target.value)
            }
            className="pl-9 w-64"
            icon={
              <MagnifyingGlass size={14} className="text-muted-foreground" />
            }
          />
        }
        headerRight={
          <ElevatedSelect
            value={filters.status}
            onValueChange={(val) => {
              setFilters((prev) => ({ ...prev, status: val, page: 1 }));
            }}
            className="w-40"
          >
            <ElevatedSelectItem value="all">
              {t("filters.allStatus")}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="draft">
              {t("status.draft")}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="active">
              {t("status.active")}
            </ElevatedSelectItem>
            <ElevatedSelectItem value="paused">
              {t("status.paused")}
            </ElevatedSelectItem>
          </ElevatedSelect>
        }
        renderRowActions={(row) => (
          <>
            <DepartmentRowSwitcher
              departmentId={row.departmentId}
              onAssign={(departmentId) =>
                handleAssignDepartment(row.id, departmentId).then((result) => ({
                  item: result.workflow,
                  error: result.error,
                }))
              }
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(event) => event.stopPropagation()}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <DotsThree size={18} weight="bold" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {row.status === "draft" || row.status === "paused" ? (
                  <DropdownMenuItem onClick={() => handleActivate(row.id)}>
                    <Play size={14} className="mr-2" />
                    {t("actions.activate")}
                  </DropdownMenuItem>
                ) : row.status === "active" ? (
                  <DropdownMenuItem onClick={() => handlePause(row.id)}>
                    <Pause size={14} className="mr-2" />
                    {t("actions.pause")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => handleExportWorkflow(row.id)}>
                  <DownloadSimple size={14} className="mr-2" />
                  {t("actions.export")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDelete(row.id)}
                  className="text-destructive-ink"
                >
                  <Trash size={14} className="mr-2" />
                  {t("actions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        pagination={{
          currentPage: filters.page,
          totalPages,
          pageSize: PAGE_SIZE,
          totalItems,
          onPageChange: (page) => setFilters((prev) => ({ ...prev, page })),
        }}
        emptyState={{
          icon: (
            <GitBranch
              size={48}
              weight="duotone"
              className="text-muted-foreground"
            />
          ),
          title: t("empty.title"),
          description: error ?? t("empty.description"),
          action: (
            <div className="flex flex-col items-center gap-3">
              <ElevatedButton
                onClick={() => router.push("/dashboard/workflows/new")}
                className="gap-2 mt-4"
                icon={<Plus size={16} weight="bold" />}
                title={t("header.new")}
                iconVisible
              />
            </div>
          ),
        }}
      />
    </main>
  );
}
