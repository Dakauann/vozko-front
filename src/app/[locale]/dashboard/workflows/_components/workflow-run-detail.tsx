"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ArrowCounterClockwise, CircleNotch, DownloadSimple, Eye, PushPin, Stop, Target, TestTube } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { cancelWorkflowRunAction, downloadWorkflowRunAction, getWorkflowRunAction } from "@/app/actions/workflows";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { usePagedList, type PageAnswer } from "@/hooks/use-paged-list";
import { versionTag } from "@/lib/workflows/publication";
import { isPinnableStep } from "@/lib/workflows/node-pin";
import { isPinnableBehavior, isTestableBehavior } from "@/lib/workflows/node-test-behavior";
import { recordedStepValues } from "@/lib/workflows/recorded-test-values";
import { isTerminalRunStatus, runDurationMs, stepWaterfall } from "@/lib/workflows/run-format";
import { runStepsMeta } from "@/lib/workflows/run-steps";
import type { RunDetail, WorkflowRun, WorkflowRunLog } from "@/lib/workflows/types";

import {
  ConversationLink,
  DateTimeText,
  DurationText,
  FieldLine,
  JsonBlock,
  LoadFailure,
  RunErrorText,
  RunStatusChip,
  StartedByText,
  useAgentNames,
  useLoadFailureText,
} from "./run-bits";
import { useTestBehaviorOf } from "./node-previews/node-definitions";
import { StepDetail, StepRow } from "./step-detail";
import type { TestNodeSeed } from "./test-node-section";

export interface RunDebugActions {
  pinStep?: (runId: string, step: WorkflowRunLog) => Promise<boolean>;
  pinBlockedReason?: string | null;
  reproduce?: (runId: string) => void;
  viewVersion?: (version: number) => void;
}

interface WorkflowRunDetailProps {
  runId: string;
  refreshToken: number;
  canCancel: boolean;
  triggerLabel: (triggerType: string) => string | undefined;
  nodeLabel: (nodeId: string) => string | undefined;
  nodeExists: (nodeId: string) => boolean;
  onFocusNode: (nodeId: string) => void;
  onTestStep: (nodeId: string, seed: TestNodeSeed) => void;
  onDetail: (detail: RunDetail) => void;
  onCancelled: () => void;
  runDiffersFromCanvas: (runVersion: number | undefined) => boolean;
  debug?: RunDebugActions;
}

const NO_DEBUG: RunDebugActions = {};

const runIsLive = (_steps: readonly WorkflowRunLog[], run: WorkflowRun | null) => run !== null && !isTerminalRunStatus(run.status);

export function WorkflowRunDetail({
  runId,
  refreshToken,
  canCancel,
  triggerLabel,
  nodeLabel,
  nodeExists,
  onFocusNode,
  onTestStep,
  onDetail,
  onCancelled,
  runDiffersFromCanvas,
  debug = NO_DEBUG,
}: WorkflowRunDetailProps) {
  const t = useTranslations("workflowRuns");
  const tDebug = useTranslations("workflowDebug");
  const tPage = useTranslations("workflowsPage");
  const behaviorOf = useTestBehaviorOf();
  const failureText = useLoadFailureText();
  const [pinningStep, setPinningStep] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const readSteps = useCallback(
    async (page: number): Promise<PageAnswer<WorkflowRunLog, WorkflowRun>> => {
      const res = await getWorkflowRunAction(runId, page);
      if (!res.detail) return { items: [], meta: runStepsMeta(undefined, 0), error: res.error ?? "unavailable", status: res.status };
      return { items: res.detail.logs, meta: runStepsMeta(res.detail.steps, res.detail.logs.length), head: res.detail.run };
    },
    [runId],
  );
  const list = usePagedList<WorkflowRunLog, WorkflowRun>({
    scope: `${runId}|${refreshToken}`,
    read: readSteps,
    accumulate: true,
    pollWhile: runIsLive,
  });
  const { items: steps, head: loadedRun, loading } = list;
  const detail = useMemo<RunDetail | null>(() => (loadedRun ? { run: loadedRun, logs: steps } : null), [loadedRun, steps]);

  useEffect(() => {
    if (detail) onDetail(detail);
  }, [detail, onDetail]);

  const bars = useMemo(() => stepWaterfall(steps, loadedRun ?? undefined), [steps, loadedRun]);
  const startedBys = useMemo(() => [loadedRun?.startedBy], [loadedRun]);
  const agentName = useAgentNames(startedBys);

  if (!detail) {
    if (loading) {
      return (
        <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
          <CircleNotch size={14} className="animate-spin" />
        </div>
      );
    }
    return (
      <div className="space-y-2 p-3">
        <LoadFailure status={list.errorStatus} fallback={t("detail.loadError")} />
        <ElevatedButton variant="outline-subtle" size="sm" title={t("panel.retry")} onClick={list.refresh} />
      </div>
    );
  }

  const { run } = detail;
  const cancellable = canCancel && !isTerminalRunStatus(run.status);

  const handleCancel = async () => {
    const res = await cancelWorkflowRunAction(run.id);
    if (res.error) {
      toast.error(failureText(res.status, t("detail.cancelFailed")));
      return false;
    }
    toast.success(t("detail.cancelled"));
    list.refresh();
    onCancelled();
    return true;
  };

  const downloadJson = async () => {
    if (downloading) return;
    setDownloading(true);
    const { error } = await downloadWorkflowRunAction(run.id);
    setDownloading(false);
    if (error) toast.error(codedErrorMessage(tPage, error, t("detail.downloadFailed")));
  };

  const toggleStep = (step: WorkflowRunLog) => {
    setExpandedStep((current) => (current === step.id ? null : step.id));
    if (nodeExists(step.nodeId)) onFocusNode(step.nodeId);
  };

  const pinStep = async (step: WorkflowRunLog) => {
    if (!debug.pinStep || pinningStep) return;
    setPinningStep(step.id);
    await debug.pinStep(run.id, step);
    setPinningStep(null);
  };

  const differs = runDiffersFromCanvas(run.workflowVersion);

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <section className="space-y-2 border-b border-border px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <RunStatusChip status={run.status} />
          {loading && <CircleNotch size={12} className="animate-spin text-muted-foreground" />}
          <div className="flex-1" />
          <ElevatedButton
            variant="outline-subtle"
            size="sm"
            iconVisible
            icon={downloading ? <CircleNotch size={12} className="animate-spin" /> : <DownloadSimple size={12} />}
            title={t("detail.downloadJson")}
            disabled={downloading}
            onClick={() => void downloadJson()}
          />
          {debug.reproduce && (
            <ElevatedButton
              variant="outline-subtle"
              size="sm"
              iconVisible
              icon={<ArrowCounterClockwise size={12} />}
              title={tDebug("reproduce.action")}
              aria-description={tDebug("reproduce.hint")}
              onClick={() => debug.reproduce?.(run.id)}
            />
          )}
          {cancellable && (
            <ElevatedButton
              variant="outline-subtle"
              size="sm"
              iconVisible
              icon={<Stop size={12} weight="fill" />}
              title={t("detail.cancel")}
              onClick={() => setConfirmCancel(true)}
              className="text-destructive-ink"
            />
          )}
        </div>
        <FieldLine label={t("fields.startedBy")}>
          <StartedByText raw={run.startedBy} agentName={agentName} />
        </FieldLine>
        <FieldLine label={t("fields.trigger")}>
          {run.triggerType ? (triggerLabel(run.triggerType) ?? run.triggerType) : <EmptyValue />}
        </FieldLine>
        <FieldLine label={t("fields.conversation")}>
          <ConversationLink entryId={run.entryId} entryType={run.entryType} />
        </FieldLine>
        <FieldLine label={t("fields.startedAt")}>
          <DateTimeText value={run.startedAt} />
        </FieldLine>
        <FieldLine label={t("fields.duration")}>
          <DurationText ms={runDurationMs(run)} />
        </FieldLine>
        <FieldLine label={t("fields.version")}>
          {run.workflowVersion != null ? (
            <span className="readout tabular-nums">{versionTag(run.workflowVersion)}</span>
          ) : (
            <EmptyValue />
          )}
        </FieldLine>
        {differs && (
          <Notice tone="info">
            <span className="block">{t("detail.versionNote")}</span>
            {debug.viewVersion && run.workflowVersion != null && (
              <button
                type="button"
                onClick={() => debug.viewVersion?.(run.workflowVersion!)}
                className="mt-1 inline-flex items-center gap-1 rounded-[--radius] text-xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Eye size={12} />
                {tDebug("reproduce.viewVersion", { version: versionTag(run.workflowVersion) })}
              </button>
            )}
          </Notice>
        )}
        {run.error && (
          <Notice tone="fault" title={t("detail.runError")}>
            <span className="break-words">
              <RunErrorText error={run.error} />
            </span>
          </Notice>
        )}
        {run.agentResult && Object.keys(run.agentResult).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">{t("detail.agentResult")}</p>
            <JsonBlock value={run.agentResult} />
          </div>
        )}
      </section>

      <section className="px-3 py-3">
        <p className="mb-2 text-xs font-semibold text-foreground">{t("detail.steps")}</p>
        {steps.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("detail.noSteps")}</p>
        ) : (
          <ol className="space-y-1">
            {steps.map((step, index) => {
              const exists = nodeExists(step.nodeId);
              const behavior = behaviorOf(step.nodeType);
              const testable = exists && isTestableBehavior(behavior);
              const pinnable = Boolean(debug.pinStep) && exists && isPinnableBehavior(behavior) && isPinnableStep(step);
              return (
                <StepRow
                  key={step.id}
                  step={step}
                  bar={bars[index]}
                  label={nodeLabel(step.nodeId)}
                  expanded={expandedStep === step.id}
                  onToggle={() => toggleStep(step)}
                >
                  <StepDetail
                    step={step}
                    nodeName={nodeLabel(step.nodeId)}
                    actions={
                      exists ? (
                        <>
                          <ElevatedButton variant="ghost" size="sm" iconVisible icon={<Target size={12} />} title={t("detail.showInFlow")} onClick={() => onFocusNode(step.nodeId)} />
                          {testable && (
                            <ElevatedButton
                              variant="outline-subtle"
                              size="sm"
                              iconVisible
                              icon={<TestTube size={12} />}
                              title={t("detail.testWithData")}
                              onClick={() => onTestStep(step.nodeId, { id: `${run.id}:${step.id}`, valueFor: recordedStepValues(detail, index) })}
                            />
                          )}
                          {pinnable && (
                            <ElevatedButton
                              variant="outline-subtle"
                              size="sm"
                              iconVisible
                              icon={pinningStep === step.id ? <CircleNotch size={12} className="animate-spin" /> : <PushPin size={12} />}
                              title={tDebug("step.pin")}
                              disabled={Boolean(debug.pinBlockedReason) || pinningStep !== null}
                              onClick={() => void pinStep(step)}
                            />
                          )}
                        </>
                      ) : undefined
                    }
                  >
                    {!exists && <p className="text-2xs text-muted-foreground">{t("detail.nodeMissing")}</p>}
                    {pinnable && debug.pinBlockedReason && <p className="text-2xs text-muted-foreground">{debug.pinBlockedReason}</p>}
                    {testable && <p className="text-2xs leading-relaxed text-muted-foreground">{t("detail.testHint")}</p>}
                  </StepDetail>
                </StepRow>
              );
            })}
          </ol>
        )}
        {list.error && !loading && (
          <div className="mt-2 space-y-2">
            <LoadFailure status={list.errorStatus} fallback={t("detail.loadError")} />
            <ElevatedButton variant="outline-subtle" size="sm" title={t("panel.retry")} onClick={list.refresh} />
          </div>
        )}
        {list.hasMore && (
          <div className="mt-2 flex items-center justify-between gap-2">
            {list.meta && (
              <span className="text-2xs text-muted-foreground">
                {t("detail.stepsLoaded", { shown: steps.length, total: list.meta.totalItems })}
              </span>
            )}
            <ElevatedButton
              variant="ghost"
              size="sm"
              title={t("detail.moreSteps")}
              disabled={loading}
              onClick={() => list.setPage(list.page + 1)}
            />
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("detail.cancelTitle")}
        description={t("detail.cancelDescription")}
        confirmLabel={t("detail.cancelConfirm")}
        cancelLabel={t("detail.cancelKeep")}
        tone="danger"
        onConfirm={handleCancel}
      />
    </div>
  );
}
