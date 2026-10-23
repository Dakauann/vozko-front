"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Edge, Node } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  activateWorkflowAction,
  createWorkflowAction,
  deleteWorkflowAction,
  getWorkflowAction,
  pauseWorkflowAction,
  pinNodeFromRunAction,
  publishWorkflowAction,
  restoreWorkflowVersionAction,
  updateWorkflowAction,
} from "@/app/actions/workflows";
import { useLeaveGuard } from "@/hooks/use-leave-guard";
import { useStableCallback } from "@/hooks/use-stable-callback";
import { codedErrorMessage } from "@/lib/api/coded-error";
import {
  autosaveDelay,
  canOverwriteDraft,
  canSendDraft,
  draftFailureKindOf,
  draftSaveReducer,
  draftSaveStatus,
  hasUnsavedDraft,
  initialDraftSave,
  isDraftRevision,
  type DraftSaveEvent,
  type DraftSaveState,
  type DraftWriteAnswer,
} from "@/lib/workflows/draft-save";
import type { LintSubjects } from "@/lib/workflows/lint-copy";
import { publishFailureCopy, runPublishFlow } from "@/lib/workflows/publication";
import type {
  CreateWorkflowPayload,
  HandleDefinition,
  LintIssue,
  NodeDefinition,
  Workflow,
  WorkflowGraph,
  WorkflowRunLog,
  WorkflowTriggerType,
  WorkflowType,
} from "@/lib/workflows/types";
import { workflowTypeOfTrigger, workflowTypeOfTriggerDefinition } from "@/lib/workflows/workflow-types";

import { domainToFlow, type OutputLabels } from "./editor-flow";
import { workflowDraftSnapshot } from "./workflow-graph";

interface WorkflowPersistenceInput {
  name: string;
  description: string;
  workflowType: WorkflowType;
  graph: WorkflowGraph;
  draftKey: string;
  lintRevision: string;
  canSave: boolean;
  workflowState: Workflow | null;
  setWorkflowState: Dispatch<SetStateAction<Workflow | null>>;
  onWorkflowUpdate?: (workflow: Workflow) => void;
  defMap: Map<string, NodeDefinition>;
  triggerLabelByType: Map<string, string>;
  takeSnapshot: () => void;
  outputLabels: OutputLabels;
  resolvedHandles: Record<string, HandleDefinition[]>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setName: Dispatch<SetStateAction<string>>;
  setDescription: Dispatch<SetStateAction<string>>;
  setWorkflowType: Dispatch<SetStateAction<WorkflowType>>;
  setConfigNodeId: Dispatch<SetStateAction<string | null>>;
  onPublished: () => void;
  lintSubjects?: LintSubjects;
}

type PreparedDraft = { key: string; payload: CreateWorkflowPayload } | { key: string; invalid: string };

type OverwriteRetry = { kind: "restore"; version: number } | { kind: "pin"; runId: string; step: WorkflowRunLog };

const MAX_FLUSH_ROUNDS = 3;

const NO_ISSUES: LintIssue[] = [];

function savedAtOf(workflow: Workflow | null): number | null {
  const at = workflow?.updatedAt ? Date.parse(workflow.updatedAt) : Number.NaN;
  return Number.isNaN(at) ? null : at;
}

function revisionOf(workflow: Workflow | null | undefined): number | null {
  return isDraftRevision(workflow?.version) ? workflow.version : null;
}

export function useWorkflowPersistence({
  name,
  description,
  workflowType,
  graph,
  draftKey,
  lintRevision,
  canSave,
  workflowState,
  setWorkflowState,
  onWorkflowUpdate,
  defMap,
  triggerLabelByType,
  takeSnapshot,
  outputLabels,
  resolvedHandles,
  setNodes,
  setEdges,
  setName,
  setDescription,
  setWorkflowType,
  setConfigNodeId,
  onPublished,
  lintSubjects,
}: WorkflowPersistenceInput) {
  const t = useTranslations("workflowsPage");
  const tDebug = useTranslations("workflowDebug");
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [machine, setMachine] = useState<DraftSaveState>(() =>
    initialDraftSave(
      workflowState?.id
        ? { key: draftKey, revision: revisionOf(workflowState), savedAt: savedAtOf(workflowState) }
        : { key: draftKey, revision: null, savedAt: null },
    ),
  );
  const machineRef = useRef(machine);
  const workflowRef = useRef(workflowState);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const afterOverwrite = useRef<OverwriteRetry | null>(null);
  const [blocked, setBlocked] = useState<{ key: string; revision: string; issues: LintIssue[] } | null>(null);
  const [alertsRequest, setAlertsRequest] = useState(0);
  const showProblems = useCallback(() => setAlertsRequest((request) => request + 1), []);
  const publishIssues = blocked && blocked.key === draftKey && blocked.revision === lintRevision ? blocked.issues : NO_ISSUES;

  const apply = useCallback((event: DraftSaveEvent) => {
    machineRef.current = draftSaveReducer(machineRef.current, event);
    setMachine(machineRef.current);
  }, []);

  const enqueue = useCallback(<T,>(op: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(op, op);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  const validateGraphForType = (candidate: WorkflowGraph): string | null => {
    const triggerNodes = candidate.nodes.filter(
      (n) => workflowTypeOfTriggerDefinition(defMap.get(n.type)) !== null,
    );
    const seen = new Set<string>();
    for (const node of triggerNodes) {
      const nodeWfType = workflowTypeOfTriggerDefinition(defMap.get(node.type));
      if (nodeWfType !== workflowType) {
        const triggerLabel = triggerLabelByType.get(node.type) ?? node.type;
        const typeLabel = t(`workflowTypeOption.${workflowType}`);
        return t("validation.incompatibleTrigger", {
          trigger: triggerLabel,
          type: typeLabel,
        });
      }
      if (seen.has(node.type)) {
        const triggerLabel = triggerLabelByType.get(node.type) ?? node.type;
        return t("validation.duplicateTrigger", { trigger: triggerLabel });
      }
      seen.add(node.type);
    }
    if (triggerNodes.length === 0) {
      return t("validation.missingTrigger");
    }
    return null;
  };

  const derivePrimaryTriggerType = (
    candidate: WorkflowGraph,
  ): WorkflowTriggerType | undefined => {
    const priority: WorkflowTriggerType[] = [
      "trigger_first_message",
      "trigger_message_received",
    ];
    const present = new Set(candidate.nodes.map((n) => n.type as string));
    for (const tt of priority) {
      if (present.has(tt)) return tt;
    }
    for (const n of candidate.nodes) {
      if (defMap.get(n.type)?.category === "trigger") {
        return n.type as WorkflowTriggerType;
      }
    }
    return undefined;
  };

  const adoptWorkflow = useStableCallback((next: Workflow) => {
    const merged = { ...next, entryPoints: next.entryPoints ?? workflowRef.current?.entryPoints };
    workflowRef.current = merged;
    setWorkflowState(merged);
    onWorkflowUpdate?.(next);
  });

  const adoptFromOtherWriter = (next: Workflow) => {
    const revision = revisionOf(next);
    if (revision !== null) apply({ type: "revised", revision });
    adoptWorkflow(next);
  };

  const refreshEntryPoints = useStableCallback(async (workflowId: string) => {
    const latest = await getWorkflowAction(workflowId);
    const entryPoints = latest.workflow?.entryPoints;
    const current = workflowRef.current;
    if (!current || current.id !== workflowId) return;
    const refreshed = { ...current, entryPoints };
    workflowRef.current = refreshed;
    setWorkflowState(refreshed);
  });

  const prepareDraft = useStableCallback((): PreparedDraft => {
    if (!name.trim()) return { key: draftKey, invalid: t("validation.nameRequired") };
    const invalid = validateGraphForType(graph);
    if (invalid) return { key: draftKey, invalid };
    return {
      key: draftKey,
      payload: {
        name: name.trim(),
        description: description.trim(),
        type: workflowType,
        triggerType: derivePrimaryTriggerType(graph),
        graph,
      },
    };
  });

  const writeFailure = (answer: DraftWriteAnswer): string =>
    codedErrorMessage(t, { code: answer.code }, answer.error || t("draftSave.unknownError"));

  const sendDraft = useStableCallback(async (): Promise<void> => {
    const prepared = prepareDraft();
    if (!canSendDraft(machineRef.current, prepared.key)) return;
    if ("invalid" in prepared) {
      apply({ type: "failed", key: prepared.key, kind: "invalid", message: prepared.invalid, autoRetry: false });
      return;
    }
    const workflowId = workflowRef.current?.id ?? null;
    const revision = machineRef.current.revision;
    if (workflowId && revision === null) {
      apply({ type: "failed", key: prepared.key, kind: "refused", message: t("draftSave.overwriteUnavailable"), autoRetry: false });
      return;
    }
    apply({ type: "sent" });
    const answer = workflowId
      ? await updateWorkflowAction(workflowId, { ...prepared.payload, revision: revision! })
      : await createWorkflowAction(prepared.payload);
    if (answer.workflow) {
      apply({ type: "saved", key: prepared.key, revision: revisionOf(answer.workflow), at: Date.now() });
      adoptWorkflow(answer.workflow);
      if (!workflowId && typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname.replace(/\/new\/?$/, `/${answer.workflow.id}`));
      }
      return;
    }
    if (answer.conflict) {
      afterOverwrite.current = null;
      apply({ type: "conflicted", revision: answer.conflict.revision });
      return;
    }
    const kind = draftFailureKindOf(answer);
    apply({ type: "failed", key: prepared.key, kind, message: writeFailure(answer), autoRetry: kind === "transient" && workflowId !== null });
  });

  const flushDraft = useStableCallback(async (): Promise<boolean> => {
    apply({ type: "retry" });
    for (let round = 0; round < MAX_FLUSH_ROUNDS; round += 1) {
      await enqueue(sendDraft);
      const state = machineRef.current;
      const key = prepareDraft().key;
      if (!hasUnsavedDraft(state, key)) return true;
      if (state.conflict || (state.failure && state.failure.key === key)) return false;
    }
    return !hasUnsavedDraft(machineRef.current, prepareDraft().key);
  });

  const delay = useMemo(() => (canSave ? autosaveDelay(machine, draftKey) : null), [canSave, machine, draftKey]);
  useEffect(() => {
    if (delay === null) return;
    const timer = window.setTimeout(() => void enqueue(sendDraft), delay);
    return () => window.clearTimeout(timer);
  }, [delay, draftKey, machine, enqueue, sendDraft]);

  const unsaved = useMemo(() => hasUnsavedDraft(machine, draftKey), [machine, draftKey]);
  useLeaveGuard(canSave && unsaved);

  const saveStatus = useMemo(() => draftSaveStatus(machine, draftKey), [machine, draftKey]);

  const loadDraftIntoCanvas = (draft: Workflow) => {
    takeSnapshot();
    const flow = domainToFlow(draft.graph, defMap, outputLabels, resolvedHandles);
    setNodes(flow.nodes);
    setEdges(flow.edges);
    setName(draft.name ?? "");
    setDescription(draft.description ?? "");
    setWorkflowType(
      draft.type ?? (draft.triggerType ? workflowTypeOfTrigger(draft.triggerType) : "messages"),
    );
    setConfigNodeId(null);
    apply({ type: "loaded", key: workflowDraftSnapshot(draft), revision: revisionOf(draft), at: Date.now() });
    adoptWorkflow(draft);
  };

  const writeOverDraft = (
    write: (revision: number) => Promise<DraftWriteAnswer>,
    retry: OverwriteRetry,
  ): Promise<Workflow | "conflict" | DraftWriteAnswer> =>
    enqueue(async () => {
      const revision = machineRef.current.revision;
      if (revision === null || machineRef.current.conflict) return { workflow: null, error: t("draftSave.overwriteUnavailable") };
      apply({ type: "sent" });
      const answer = await write(revision);
      if (answer.conflict) {
        afterOverwrite.current = retry;
        apply({ type: "conflicted", revision: answer.conflict.revision });
        return "conflict" as const;
      }
      if (!answer.workflow) {
        apply({ type: "settled" });
        return answer;
      }
      return answer.workflow;
    });

  const pinRunStep = useStableCallback(async (runId: string, step: WorkflowRunLog): Promise<boolean> => {
    const workflowId = workflowRef.current?.id;
    if (!workflowId) return false;
    if (!(await flushDraft())) {
      toast.error(tDebug("step.pinNeedsSave"));
      return false;
    }
    const outcome = await writeOverDraft(
      (revision) => pinNodeFromRunAction(workflowId, step.nodeId, { runId, stepId: step.id, revision }),
      { kind: "pin", runId, step },
    );
    if (outcome === "conflict") return false;
    if (!("id" in outcome)) {
      toast.error(tDebug("step.pinFailed"), outcome.error ? { description: codedErrorMessage(t, outcome, outcome.error) } : undefined);
      return false;
    }
    loadDraftIntoCanvas(outcome);
    toast.success(tDebug("step.pinFromRunDone"));
    return true;
  });

  const handleRestoreVersion = useStableCallback(async (version: number): Promise<boolean> => {
    const workflowId = workflowRef.current?.id;
    if (!workflowId) return false;
    const tVersions = (key: string, values?: Record<string, number>) => t(`versions.${key}`, values);
    const outcome = await writeOverDraft(
      (revision) => restoreWorkflowVersionAction(workflowId, version, revision),
      { kind: "restore", version },
    );
    if (outcome === "conflict") return false;
    if (!("id" in outcome)) {
      toast.error(codedErrorMessage(t, { code: outcome.code }, outcome.error || tVersions("restoreFailed")));
      return false;
    }
    const latest = await getWorkflowAction(workflowId);
    loadDraftIntoCanvas(latest.workflow ?? outcome);
    toast.success(tVersions("restored", { version }));
    return true;
  });

  const reloadDraft = useStableCallback(async () => {
    const workflowId = workflowRef.current?.id;
    if (!workflowId) return;
    await enqueue(async () => {
      const latest = await getWorkflowAction(workflowId);
      if (!latest.workflow) {
        toast.error(t("draftSave.reloadFailed"));
        return;
      }
      afterOverwrite.current = null;
      loadDraftIntoCanvas(latest.workflow);
    });
  });

  const overwriteDraft = useStableCallback(async () => {
    if (!canOverwriteDraft(machineRef.current)) {
      toast.error(t("draftSave.overwriteUnavailable"));
      return;
    }
    const retry = afterOverwrite.current;
    afterOverwrite.current = null;
    apply({ type: "overwrite" });
    if (retry?.kind === "restore") await handleRestoreVersion(retry.version);
    else if (retry?.kind === "pin") await pinRunStep(retry.runId, retry.step);
    else await flushDraft();
  });

  const saveNow = useStableCallback(() => {
    if (!canSave) return;
    void flushDraft();
  });

  const dismissConflict = useCallback(() => apply({ type: "dismissConflict" }), [apply]);
  const showConflict = useCallback(() => apply({ type: "showConflict" }), [apply]);

  const handlePublish = useStableCallback(async () => {
    if (publishing) return;
    setPublishing(true);
    const outcome = await runPublishFlow({
      workflowId: workflowRef.current?.id ?? null,
      dirty: hasUnsavedDraft(machineRef.current, prepareDraft().key) || machineRef.current.sending,
      save: async () => ((await flushDraft()) ? workflowRef.current : null),
      publish: publishWorkflowAction,
    });
    setPublishing(false);
    if (outcome.ok) {
      setBlocked(null);
      adoptFromOtherWriter(outcome.workflow);
      void refreshEntryPoints(outcome.workflow.id);
      onPublished();
      toast.success(
        outcome.version !== null
          ? t("publication.published", { version: outcome.version })
          : t("publication.publishedNoVersion"),
      );
      return;
    }
    if (outcome.stage !== "publish") return;
    const failure = outcome.failure ?? { message: "" };
    const copy = publishFailureCopy(failure, t, t("publication.publishFailed"), lintSubjects);
    if (failure.issues && failure.issues.length > 0) {
      setBlocked({ key: prepareDraft().key, revision: lintRevision, issues: failure.issues });
      showProblems();
      toast.error(copy.title, {
        description: copy.description,
        action: { label: t("publication.showProblems"), onClick: showProblems },
      });
      return;
    }
    toast.error(copy.title, copy.description ? { description: copy.description } : undefined);
  });

  const handleResume = useStableCallback(async () => {
    const workflowId = workflowRef.current?.id;
    if (!workflowId) return;
    const result = await activateWorkflowAction(workflowId);
    if (result.failure || !result.workflow) {
      const copy = publishFailureCopy(result.failure ?? { message: "" }, t, t("publication.resumeFailed"));
      toast.error(copy.title, copy.description ? { description: copy.description } : undefined);
      return;
    }
    toast.success(t("publication.resumed"));
    adoptFromOtherWriter(result.workflow);
    void refreshEntryPoints(workflowId);
  });

  const handlePause = useStableCallback(async () => {
    const workflowId = workflowRef.current?.id;
    if (!workflowId) return;
    const result = await pauseWorkflowAction(workflowId);
    if (result.error) {
      toast.error(codedErrorMessage(t, result, result.error));
      return;
    }
    toast.success(t("paused"));
    if (result.workflow) adoptFromOtherWriter(result.workflow);
    void refreshEntryPoints(workflowId);
  });

  const handleDelete = useStableCallback(async () => {
    const workflowId = workflowRef.current?.id;
    if (!workflowId) return;
    const result = await deleteWorkflowAction(workflowId);
    if (result.error) {
      toast.error(codedErrorMessage(t, result, result.error));
    } else {
      toast.success(t("deleted"));
      router.push("/dashboard/workflows");
    }
  });

  const conflict = machine.conflict;
  return {
    saveStatus,
    unsaved,
    conflictOpen: conflict !== null && !conflict.dismissed,
    canOverwrite: canOverwriteDraft(machine),
    publishing,
    publishIssues,
    alertsRequest,
    showProblems,
    saveNow,
    retrySave: saveNow,
    reloadDraft,
    overwriteDraft,
    dismissConflict,
    showConflict,
    handlePublish,
    handleResume,
    handlePause,
    handleDelete,
    handleRestoreVersion,
    pinRunStep,
  };
}
