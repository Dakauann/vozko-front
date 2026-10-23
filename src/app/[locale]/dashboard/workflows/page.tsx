/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  GitBranch,
  Plus,
  MagnifyingGlass,
  UploadSimple,
  Key,
} from "@/components/icons";

import { openScoped } from "@/lib/browser/scoped-download-url";
import { getApiBaseUrl } from "@/lib/api/browser-client";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
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
import { useWorkspace } from "@/contexts/workspace-context";
import { toast } from "sonner";

import type { EntryPointKind, Workflow } from "@/lib/workflows/types";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { publishFailureCopy, type PublishFailure } from "@/lib/workflows/publication";
import { ENTRY_POINT_KINDS, type EntryPointFix } from "@/lib/workflows/entry-points";
import { workflowHref, workflowNodeHref } from "@/lib/workflows/run-format";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import {
  listWorkflowsAction,
  deleteWorkflowAction,
  activateWorkflowAction,
  pauseWorkflowAction,
  publishWorkflowAction,
  importWorkflowAction,
  assignWorkflowDepartmentAction,
} from "@/app/actions/workflows";
import { useDepartment } from "@/contexts/department-context";
import { useStableCallback } from "@/hooks/use-stable-callback";
import { WorkflowPublicationChips } from "./_components/publication-chips";
import { WorkflowRowActions } from "./_components/workflow-row-actions";
import { EntryPointChips } from "./_components/entry-point-chips";

const ALL_ENTRY_KINDS = "all";

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
    entryKind: ALL_ENTRY_KINDS as EntryPointKind | typeof ALL_ENTRY_KINDS,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const canUpdate = useSettledPermission("workflows", "update");

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
    async (pageNum: number, search: string, status: string, entryKind: EntryPointKind | typeof ALL_ENTRY_KINDS) => {
      if (!currentWorkspace?.id) return;
      setLoading(true);
      setError(null);
      const result = await listWorkflowsAction({
        page: pageNum,
        pageSize: PAGE_SIZE,
        status: status !== "all" ? status : undefined,
        search: search || undefined,
        entryKind: entryKind !== ALL_ENTRY_KINDS ? entryKind : undefined,
      });
      if (result.error) {
        const message = codedErrorMessage(t, result, result.error);
        setError(message);
        setWorkflows([]);
        setTotalPages(1);
        setTotalItems(0);
        toast.error(message);
      } else {
        setWorkflows(result.workflows ?? []);
        setTotalPages(result.meta.totalPages);
        setTotalItems(result.meta.totalItems);
      }
      setLoading(false);
    },
    [currentWorkspace?.id, t],
  );

  useEffect(() => {
    fetchWorkflows(filters.page, filters.search, filters.status, filters.entryKind);
  }, [
    currentWorkspace?.id,
    currentDepartment?.id,
    filters.page,
    filters.search,
    filters.status,
    filters.entryKind,
    reloadKey,
    fetchWorkflows,
  ]);

  const toastRefusal = (failure: PublishFailure | undefined, fallback: string) => {
    const copy = publishFailureCopy(failure ?? { message: "" }, t, fallback);
    toast.error(copy.title, copy.description ? { description: copy.description } : undefined);
  };

  const handlePublish = async (id: string) => {
    const result = await publishWorkflowAction(id);
    if (result.failure || !result.workflow) {
      toastRefusal(result.failure, t("publication.publishFailed"));
      return;
    }
    const version = result.workflow.publishedVersion;
    toast.success(version ? t("publication.published", { version }) : t("publication.publishedNoVersion"));
    setReloadKey((prev) => prev + 1);
  };

  const handleResume = async (id: string) => {
    const result = await activateWorkflowAction(id);
    if (result.failure || !result.workflow) {
      toastRefusal(result.failure, t("publication.resumeFailed"));
      return;
    }
    toast.success(t("publication.resumed"));
    setReloadKey((prev) => prev + 1);
  };

  const handlePause = async (id: string) => {
    const result = await pauseWorkflowAction(id);
    if (result.error) {
      toast.error(codedErrorMessage(t, result, result.error));
    } else {
      toast.success(t("paused"));
      setReloadKey((prev) => prev + 1);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteWorkflowAction(id);
    if (result.error) {
      toast.error(codedErrorMessage(t, result, result.error));
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

  const fixEntryPoint = useStableCallback((workflowId: string, fix: EntryPointFix) => {
    switch (fix.kind) {
      case "publish":
        void handlePublish(workflowId);
        return;
      case "resume":
        void handleResume(workflowId);
        return;
      case "open_node":
        router.push(workflowNodeHref(workflowId, fix.nodeId));
        return;
      case "open_editor":
        router.push(workflowHref(workflowId));
        return;
      case "link":
        router.push(fix.href);
        return;
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportWorkflow = (id: string) => {
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
          toast.error(codedErrorMessage(t, result, result.error));
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
        render: (row) => <WorkflowPublicationChips workflow={row} compact />,
      },
      {
        key: "entryPoints",
        header: t("table.entryPoints"),
        render: (row) => (
          <EntryPointChips
            entries={row.entryPoints}
            canUpdate={canUpdate}
            onFix={(fix) => fixEntryPoint(row.id, fix)}
          />
        ),
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
        key: "updatedAt",
        header: t("table.updatedAt"),
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.updatedAt).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [t, canUpdate, fixEntryPoint],
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
              onClick={() => router.push("/dashboard/workflows/secrets")}
              variant="outline-subtle"
              className="gap-2"
              icon={<Key size={16} weight="bold" />}
              title={t("header.secrets")}
              iconVisible
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
          <div className="flex items-center gap-2">
          <ElevatedSelect
            value={filters.entryKind}
            onValueChange={(val) =>
              setFilters((prev) => ({ ...prev, entryKind: val as EntryPointKind | typeof ALL_ENTRY_KINDS, page: 1 }))
            }
            aria-label={t("entryPoints.title")}
            className="w-48"
          >
            <ElevatedSelectItem value={ALL_ENTRY_KINDS}>
              {t("entryPoints.filterAll")}
            </ElevatedSelectItem>
            {ENTRY_POINT_KINDS.map((kind) => (
              <ElevatedSelectItem key={kind} value={kind}>
                {t(`entryPoints.kinds.${kind}`)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
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
          </div>
        }
        renderRowActions={(row) => (
          <WorkflowRowActions
            row={row}
            onPublish={handlePublish}
            onResume={handleResume}
            onPause={handlePause}
            onExport={handleExportWorkflow}
            onDelete={handleDelete}
            onAssignDepartment={(id, departmentId) =>
              handleAssignDepartment(id, departmentId).then((result) => ({
                item: result.workflow,
                error: result.error ? codedErrorMessage(t, result, result.error) : result.error,
              }))
            }
          />
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
