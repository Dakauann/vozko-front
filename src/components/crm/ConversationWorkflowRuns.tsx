"use client";

import { memo, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";

import { FlowArrow } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { ListPager } from "@/components/elevated-design/list-pager";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { listConversationWorkflowRunsAction } from "@/app/actions/workflows";
import {
  DateTimeText,
  DurationText,
  LoadFailure,
  RunStatusChip,
  StartedByText,
  useAgentNames,
} from "@/app/[locale]/dashboard/workflows/_components/run-bits";
import { usePagedList } from "@/hooks/use-paged-list";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { versionTag } from "@/lib/workflows/publication";
import { hasLiveRuns, isTerminalRunStatus, workflowRunHref } from "@/lib/workflows/run-format";
import type { ConversationWorkflowRun } from "@/lib/workflows/types";

const PAGE_SIZE = 10;

interface ConversationWorkflowRunsProps {
  entryType: string;
  entryId: string;
  active: boolean;
}

export function ConversationWorkflowRuns(props: ConversationWorkflowRunsProps) {
  const canReadWorkflows = useSettledPermission("workflows", "read");
  if (!canReadWorkflows) return null;
  return <ConversationWorkflowRunsList {...props} />;
}

function ConversationWorkflowRunsList({ entryType, entryId, active }: ConversationWorkflowRunsProps) {
  const t = useTranslations("workflowRuns");
  const readRuns = useCallback(
    async (page: number) => {
      const res = await listConversationWorkflowRunsAction(entryType, entryId, { page, pageSize: PAGE_SIZE });
      return { items: res.runs, meta: res.meta, error: res.error, status: res.status };
    },
    [entryType, entryId],
  );
  const list = usePagedList({ scope: `${entryType}:${entryId}`, read: readRuns, enabled: active, pollWhile: hasLiveRuns });
  const { loading, page, setPage, totalPages } = list;

  const runs = useMemo(() => (loading ? [] : list.items), [loading, list.items]);
  const startedBys = useMemo(() => runs.map((run) => run.startedBy), [runs]);
  const agentName = useAgentNames(startedBys);

  return (
    <section aria-labelledby="conversation-workflow-runs" className="space-y-2">
      <h3 id="conversation-workflow-runs" className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <FlowArrow weight="bold" className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        {t("conversation.title")}
      </h3>
      {loading ? (
        <ScreenLoader fit="inline" />
      ) : list.error ? (
        <div className="space-y-2">
          <LoadFailure status={list.errorStatus} fallback={t("conversation.loadError")} />
          <ElevatedButton variant="outline-subtle" size="sm" title={t("panel.retry")} onClick={list.refresh} />
        </div>
      ) : runs.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("conversation.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {runs.map((run) => (
            <li key={run.id}>
              <ConversationRunRow run={run} agentName={agentName} />
            </li>
          ))}
        </ul>
      )}
      {!loading && !list.error && (
        <ListPager
          page={page}
          totalPages={totalPages}
          onPage={setPage}
          previousLabel={t("panel.previous")}
          nextLabel={t("panel.next")}
          pageLabel={t("panel.page", { page, total: totalPages })}
        />
      )}
    </section>
  );
}

const ConversationRunRow = memo(function ConversationRunRow({
  run,
  agentName,
}: {
  run: ConversationWorkflowRun;
  agentName: (agentId: string) => string | undefined;
}) {
  const t = useTranslations("workflowRuns");
  const workflowName = run.workflowName?.trim() || t("conversation.unnamedWorkflow");
  const step = !isTerminalRunStatus(run.status) ? run.currentNodeName?.trim() : undefined;

  return (
    <a
      href={workflowRunHref(run.workflowId, run.id)}
      target="_blank"
      rel="noreferrer"
      aria-label={t("conversation.openRun", { workflow: workflowName })}
      className="block space-y-1 rounded-[--radius] border border-border bg-card px-2.5 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center gap-2">
        <RunStatusChip status={run.status} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{workflowName}</span>
        {run.workflowVersion != null && (
          <span className="readout shrink-0 text-2xs tabular-nums text-foreground">{versionTag(run.workflowVersion)}</span>
        )}
      </span>
      <span className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
        <span className="min-w-0 truncate">
          <StartedByText raw={run.startedBy} agentName={agentName} />
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <DurationText ms={run.durationMs} />
          <DateTimeText value={run.startedAt} />
        </span>
      </span>
      {step ? <span className="block truncate text-2xs text-muted-foreground">{t("conversation.currentStep", { step })}</span> : null}
    </a>
  );
});
