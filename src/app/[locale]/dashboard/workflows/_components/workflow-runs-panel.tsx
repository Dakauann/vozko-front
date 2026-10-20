"use client";

import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

import { ArrowsClockwise, CaretLeft, CircleNotch, X } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ListPager } from "@/components/elevated-design/list-pager";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { listWorkflowRunsAction, type ListWorkflowRunsParams } from "@/app/actions/workflows";
import { usePagedList } from "@/hooks/use-paged-list";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { versionTag } from "@/lib/workflows/publication";
import { hasLiveRuns, runDurationMs } from "@/lib/workflows/run-format";
import type { RunDetail, RunStatus } from "@/lib/workflows/types";

import { ConversationLink, DateTimeText, DurationText, LoadFailure, RunStatusChip, StartedByText, useAgentNames } from "./run-bits";
import type { TestNodeSeed } from "./test-node-section";
import { WorkflowRunDetail, type RunDebugActions } from "./workflow-run-detail";

const RUN_STATUSES: RunStatus[] = ["running", "waiting", "completed", "error", "cancelled"];
const ALL_STATUSES = "all";
const PAGE_SIZE = 20;

export interface WorkflowRunsPanelProps {
  workflowId: string;
  selectedRunId: string | null;
  onSelectRun: (runId: string | null) => void;
  onRunDetail: (detail: RunDetail) => void;
  triggerLabel: (triggerType: string) => string | undefined;
  nodeLabel: (nodeId: string) => string | undefined;
  nodeExists: (nodeId: string) => boolean;
  onFocusNode: (nodeId: string) => void;
  onTestStep: (nodeId: string, seed: TestNodeSeed) => void;
  runDiffersFromCanvas: (runVersion: number | undefined) => boolean;
  debug?: RunDebugActions;
  onClose: () => void;
}

export function WorkflowRunsPanel({
  workflowId,
  selectedRunId,
  onSelectRun,
  onRunDetail,
  triggerLabel,
  nodeLabel,
  nodeExists,
  onFocusNode,
  onTestStep,
  runDiffersFromCanvas,
  debug,
  onClose,
}: WorkflowRunsPanelProps) {
  const t = useTranslations("workflowRuns");
  const canCancel = useSettledPermission("workflows", "update");
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [entryDraft, setEntryDraft] = useState("");
  const [entryId, setEntryId] = useState("");
  const filters: ListWorkflowRunsParams = useMemo(
    () => ({ pageSize: PAGE_SIZE, status: status ?? undefined, entryId: entryId || undefined }),
    [status, entryId],
  );
  const readRuns = useCallback(
    async (page: number) => {
      const res = await listWorkflowRunsAction(workflowId, { ...filters, page });
      return { items: res.runs, meta: res.meta, error: res.error, status: res.status };
    },
    [workflowId, filters],
  );
  const list = usePagedList({
    scope: `${workflowId}|${JSON.stringify(filters)}`,
    read: readRuns,
    pollWhile: hasLiveRuns,
    pollPaused: selectedRunId !== null,
  });
  const { items: runs, loading, page, setPage, totalPages, refresh } = list;

  const startedBys = useMemo(() => runs.map((run) => run.startedBy), [runs]);
  const agentName = useAgentNames(startedBys);
  const filtered = status !== null || entryId !== "";

  const applyEntryFilter = () => {
    setEntryId(entryDraft.trim());
    setPage(1);
  };

  const onEntryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyEntryFilter();
  };

  const clearFilters = () => {
    setStatus(null);
    setEntryDraft("");
    setEntryId("");
    setPage(1);
  };

  return (
    <aside aria-label={t("panel.title")} className="flex w-[360px] shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        {selectedRunId ? (
          <button
            type="button"
            onClick={() => onSelectRun(null)}
            className="inline-flex min-w-0 items-center gap-1 rounded-[--radius] text-sm font-semibold text-foreground hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CaretLeft size={14} weight="bold" />
            {t("panel.back")}
          </button>
        ) : (
          <span className="text-sm font-semibold text-foreground">{t("panel.title")}</span>
        )}
        <div className="flex-1" />
        <ElevatedButton
          variant="ghost"
          size="icon"
          iconVisible
          icon={<ArrowsClockwise size={14} />}
          aria-label={t("panel.refresh")}
          title=""
          onClick={refresh}
          className="h-7 w-7"
        />
        <ElevatedButton
          variant="ghost"
          size="icon"
          iconVisible
          icon={<X size={14} />}
          aria-label={t("panel.close")}
          title=""
          onClick={onClose}
          className="h-7 w-7"
        />
      </div>

      {selectedRunId ? (
        <WorkflowRunDetail
          key={selectedRunId}
          runId={selectedRunId}
          refreshToken={list.reloadToken}
          canCancel={canCancel}
          triggerLabel={triggerLabel}
          nodeLabel={nodeLabel}
          nodeExists={nodeExists}
          onFocusNode={onFocusNode}
          onTestStep={onTestStep}
          onDetail={onRunDetail}
          onCancelled={refresh}
          runDiffersFromCanvas={runDiffersFromCanvas}
          debug={debug}
        />
      ) : (
        <>
          <div className="space-y-2 border-b border-border px-3 py-3">
            <ElevatedSelect
              label={t("panel.statusFilter")}
              value={status ?? ALL_STATUSES}
              onValueChange={(value) => {
                setStatus(value === ALL_STATUSES ? null : (value as RunStatus));
                setPage(1);
              }}
            >
              <ElevatedSelectItem value={ALL_STATUSES}>{t("panel.allStatuses")}</ElevatedSelectItem>
              {RUN_STATUSES.map((value) => (
                <ElevatedSelectItem key={value} value={value}>
                  {t(`status.${value}`)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
            <ElevatedInput
              label={t("panel.conversationFilter")}
              value={entryDraft}
              onChange={(event) => setEntryDraft(event.target.value)}
              onKeyDown={onEntryKeyDown}
              onBlur={applyEntryFilter}
              controlSize="sm"
              inputClassName="font-mono text-xs"
            />
            <p className="text-2xs text-muted-foreground">{t("panel.conversationFilterHint")}</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                <CircleNotch size={14} className="animate-spin" />
              </div>
            )}
            {!loading && list.error && (
              <div className="space-y-2 p-3">
                <LoadFailure status={list.errorStatus} fallback={t("panel.loadError")} />
                <ElevatedButton variant="outline-subtle" size="sm" title={t("panel.retry")} onClick={refresh} />
              </div>
            )}
            {!loading && !list.error && runs.length === 0 && (
              <div className="space-y-2 px-3 py-6 text-center text-xs text-muted-foreground">
                <p>{filtered ? t("panel.emptyFiltered") : t("panel.empty")}</p>
                {filtered && <ElevatedButton variant="ghost" size="sm" title={t("panel.clearFilters")} onClick={clearFilters} />}
              </div>
            )}
            {!loading && !list.error && runs.length > 0 && (
              <ul className="divide-y divide-border">
                {runs.map((run) => (
                  <li key={run.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectRun(run.id)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        onSelectRun(run.id);
                      }}
                      className="block w-full cursor-pointer space-y-1.5 px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <div className="flex items-center gap-2">
                        <RunStatusChip status={run.status} />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                          <StartedByText raw={run.startedBy} agentName={agentName} />
                        </span>
                        <DurationText ms={runDurationMs(run)} className="text-2xs text-muted-foreground" />
                      </div>
                      <div className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
                        <span className="min-w-0 truncate">{run.triggerType ? (triggerLabel(run.triggerType) ?? run.triggerType) : null}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          {run.workflowVersion != null && (
                            <span className="readout tabular-nums text-foreground">{versionTag(run.workflowVersion)}</span>
                          )}
                          <DateTimeText value={run.startedAt} />
                        </span>
                      </div>
                      <ConversationLink entryId={run.entryId} entryType={run.entryType} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ListPager
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            disabled={loading}
            previousLabel={t("panel.previous")}
            nextLabel={t("panel.next")}
            pageLabel={t("panel.page", { page, total: totalPages })}
            className="border-t border-border px-3 py-2"
          />
        </>
      )}
    </aside>
  );
}
