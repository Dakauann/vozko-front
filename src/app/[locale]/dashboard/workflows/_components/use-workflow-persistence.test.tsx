import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { DraftWriteAnswer } from "@/lib/workflows/draft-save";
import type { LintIssue, NodeDefinition, Workflow, WorkflowGraph } from "@/lib/workflows/types";

const actions = vi.hoisted(() => ({
  updateWorkflowAction: vi.fn(),
  createWorkflowAction: vi.fn(),
  getWorkflowAction: vi.fn(),
  restoreWorkflowVersionAction: vi.fn(),
  pinNodeFromRunAction: vi.fn(),
  publishWorkflowAction: vi.fn(),
  activateWorkflowAction: vi.fn(),
  pauseWorkflowAction: vi.fn(),
  deleteWorkflowAction: vi.fn(),
}));

vi.mock("@/app/actions/workflows", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";

import { useWorkflowPersistence } from "./use-workflow-persistence";

const TRIGGER: NodeDefinition = { type: "trigger_webhook", category: "trigger", scopes: ["shared"] } as NodeDefinition;
const DEF_MAP = new Map([[TRIGGER.type, TRIGGER]]);
const GRAPH: WorkflowGraph = { nodes: [{ id: "t1", type: "trigger_webhook", position: { x: 0, y: 0 }, config: {} }], edges: [] };

function stored(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-1",
    workspaceId: "ws",
    name: "Matrícula",
    description: "",
    status: "active",
    type: "messages",
    graph: GRAPH,
    version: 3,
    createdAt: "2026-10-20T10:00:00Z",
    updatedAt: "2026-10-20T11:00:00Z",
    ...overrides,
  };
}

interface Props {
  draftKey: string;
  name: string;
}

const spies = {
  setWorkflowState: vi.fn(),
  takeSnapshot: vi.fn(),
  setNodes: vi.fn(),
  setEdges: vi.fn(),
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

function mount(initial: Workflow | null = stored()) {
  return renderHook(
    ({ draftKey, name }: Props) =>
      useWorkflowPersistence({
        name,
        description: "",
        workflowType: "messages",
        graph: GRAPH,
        draftKey,
        lintRevision: "",
        canSave: true,
        workflowState: initial,
        setWorkflowState: spies.setWorkflowState,
        defMap: DEF_MAP,
        triggerLabelByType: new Map(),
        takeSnapshot: spies.takeSnapshot,
        outputLabels: { defaultPath: "", textResponse: "", noMatch: "", error: "", form: { completed: "", no_reply: "", send_failed: "" } },
        resolvedHandles: {},
        setNodes: spies.setNodes,
        setEdges: spies.setEdges,
        setName: vi.fn(),
        setDescription: vi.fn(),
        setWorkflowType: vi.fn(),
        setConfigNodeId: vi.fn(),
        onPublished: vi.fn(),
        lintSubjects: { nodeLabel: (nodeId: string) => (nodeId === "t1" ? "Primeira mensagem" : undefined) },
      }),
    { wrapper, initialProps: { draftKey: "k1", name: "Matrícula" } },
  );
}

async function elapse(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function saved(version: number): DraftWriteAnswer {
  return { workflow: stored({ version }) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
  for (const fn of Object.values(actions)) fn.mockReset();
  for (const fn of Object.values(spies)) fn.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("draft autosave", () => {
  it("saves 1.5 s after an edit with the revision it read, then the next edit with the revision the server returned", async () => {
    actions.updateWorkflowAction.mockResolvedValueOnce(saved(4)).mockResolvedValueOnce(saved(5));
    const { result, rerender } = mount();
    expect(result.current.saveStatus.kind).toBe("saved");

    rerender({ draftKey: "k2", name: "Matrícula 2" });
    await elapse(1499);
    expect(actions.updateWorkflowAction).not.toHaveBeenCalled();
    await elapse(1);
    expect(actions.updateWorkflowAction).toHaveBeenCalledWith("wf-1", expect.objectContaining({ name: "Matrícula 2", revision: 3 }));
    expect(result.current.saveStatus.kind).toBe("saved");
    expect(result.current.unsaved).toBe(false);

    rerender({ draftKey: "k3", name: "Matrícula 3" });
    await elapse(1500);
    expect(actions.updateWorkflowAction).toHaveBeenLastCalledWith("wf-1", expect.objectContaining({ name: "Matrícula 3", revision: 4 }));
  });

  it("never overlaps requests and sends the latest state after the running save", async () => {
    const first = deferred<DraftWriteAnswer>();
    actions.updateWorkflowAction.mockReturnValueOnce(first.promise).mockResolvedValueOnce(saved(5));
    const { result, rerender } = mount();

    rerender({ draftKey: "k2", name: "A" });
    await elapse(1500);
    expect(result.current.saveStatus.kind).toBe("saving");
    rerender({ draftKey: "k3", name: "B" });
    await elapse(5000);
    expect(actions.updateWorkflowAction).toHaveBeenCalledTimes(1);

    await act(async () => first.resolve(saved(4)));
    await elapse(1500);
    expect(actions.updateWorkflowAction).toHaveBeenCalledTimes(2);
    expect(actions.updateWorkflowAction).toHaveBeenLastCalledWith("wf-1", expect.objectContaining({ name: "B", revision: 4 }));
  });

  it("retries a transient failure with backoff", async () => {
    actions.updateWorkflowAction.mockResolvedValueOnce({ workflow: null, error: "Network error" }).mockResolvedValueOnce(saved(4));
    const { result, rerender } = mount();

    rerender({ draftKey: "k2", name: "A" });
    await elapse(1500);
    expect(result.current.saveStatus).toEqual({ kind: "failed", message: "Network error", retryable: true });
    await elapse(1000);
    expect(actions.updateWorkflowAction).toHaveBeenCalledTimes(2);
    expect(result.current.saveStatus.kind).toBe("saved");
  });

  it("saves right away on Ctrl+S without waiting for the debounce", async () => {
    actions.updateWorkflowAction.mockResolvedValueOnce(saved(4));
    const { result, rerender } = mount();
    rerender({ draftKey: "k2", name: "A" });
    await act(async () => {
      result.current.saveNow();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(actions.updateWorkflowAction).toHaveBeenCalledTimes(1);
  });

  it("does not save an invalid draft and says why", async () => {
    const { result, rerender } = mount();
    rerender({ draftKey: "k2", name: "  " });
    await elapse(1500);
    expect(actions.updateWorkflowAction).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toEqual({ kind: "failed", message: ptMessages.workflowsPage.validation.nameRequired, retryable: false });
  });

  it("names a refused saved test scenario in the catalog copy and leaves the retry to the person", async () => {
    actions.updateWorkflowAction.mockResolvedValueOnce({ workflow: null, status: 422, code: "test_input_invalid", error: "raw scenario" });
    const { result, rerender } = mount();
    rerender({ draftKey: "k2", name: "A" });
    await elapse(1500);
    expect(result.current.saveStatus).toEqual({ kind: "failed", message: ptMessages.workflowsPage.errors.test_input_invalid, retryable: true });
    await elapse(30_000);
    expect(actions.updateWorkflowAction).toHaveBeenCalledTimes(1);
  });
});

describe("draft conflicts", () => {
  it("pause autosave and never overwrite until Sobrescrever, which saves on the stored revision", async () => {
    actions.updateWorkflowAction
      .mockResolvedValueOnce({ workflow: null, status: 409, code: "draft_conflict", error: "conflito", conflict: { revision: 9 } })
      .mockResolvedValueOnce(saved(10));
    const { result, rerender } = mount();

    rerender({ draftKey: "k2", name: "A" });
    await elapse(1500);
    expect(result.current.saveStatus.kind).toBe("conflict");
    expect(result.current.conflictOpen).toBe(true);

    rerender({ draftKey: "k3", name: "B" });
    await elapse(10_000);
    expect(actions.updateWorkflowAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.overwriteDraft();
    });
    expect(actions.updateWorkflowAction).toHaveBeenLastCalledWith("wf-1", expect.objectContaining({ name: "B", revision: 9 }));
    expect(result.current.conflictOpen).toBe(false);
    expect(result.current.saveStatus.kind).toBe("saved");
  });

  it("Recarregar reads the stored draft into the canvas as one undoable step", async () => {
    actions.updateWorkflowAction.mockResolvedValueOnce({ workflow: null, status: 409, code: "draft_conflict", error: "conflito", conflict: { revision: 9 } });
    actions.getWorkflowAction.mockResolvedValueOnce({ workflow: stored({ version: 9, name: "Deles" }) });
    const { result, rerender } = mount();

    rerender({ draftKey: "k2", name: "A" });
    await elapse(1500);
    await act(async () => {
      await result.current.reloadDraft();
    });
    expect(actions.getWorkflowAction).toHaveBeenCalledWith("wf-1");
    expect(spies.takeSnapshot).toHaveBeenCalledTimes(1);
    expect(spies.setNodes).toHaveBeenCalledTimes(1);
    expect(result.current.conflictOpen).toBe(false);
  });
});

describe("publishing", () => {
  const issues: LintIssue[] = [
    { code: "TRIGGER_NOT_CONNECTED", severity: "blocking", nodeId: "t1", message: "trigger not connected" },
    { code: "NODE_INVALID_RESOURCE_REF", severity: "blocking", nodeId: "lbl", message: "label gone" },
  ];

  function refuseWithIssues() {
    actions.publishWorkflowAction.mockResolvedValueOnce({
      workflow: null,
      failure: { message: "Não foi possível publicar", code: "workflow_not_publishable", status: 422, issues },
    });
  }

  it("keeps every blocking issue, opens the alerts and toasts the count and the first problem in plain words, with Ver problemas", async () => {
    refuseWithIssues();
    const { result } = mount();
    await act(async () => {
      await result.current.handlePublish();
    });

    expect(result.current.publishIssues).toEqual(issues);
    expect(result.current.alertsRequest).toBe(1);
    const [title, options] = vi.mocked(toast.error).mock.calls.at(-1)!;
    expect(title).toBe("Não foi possível publicar: 2 problemas");
    expect((options as { description?: string }).description).toBe("“Primeira mensagem” não está ligado ao fluxo");
    const action = (options as { action: { label: string; onClick: () => void } }).action;
    expect(action.label).toBe(ptMessages.workflowsPage.publication.showProblems);
    act(() => action.onClick());
    expect(result.current.alertsRequest).toBe(2);
  });

  it("forgets the publish issues once the draft changes, since they described the old draft", async () => {
    refuseWithIssues();
    actions.updateWorkflowAction.mockResolvedValueOnce(saved(4));
    const { result, rerender } = mount();
    await act(async () => {
      await result.current.handlePublish();
    });
    rerender({ draftKey: "k2", name: "Matrícula" });
    expect(result.current.publishIssues).toEqual([]);
  });

  it("shows the backend message for any other refusal", async () => {
    actions.publishWorkflowAction.mockResolvedValueOnce({ workflow: null, failure: { message: "Saldo insuficiente", status: 402 } });
    const { result } = mount();
    await act(async () => {
      await result.current.handlePublish();
    });
    expect(toast.error).toHaveBeenLastCalledWith("Saldo insuficiente", undefined);
    expect(result.current.alertsRequest).toBe(0);
  });
});

describe("other draft writers", () => {
  it("restore a version over the revision the editor holds", async () => {
    actions.restoreWorkflowVersionAction.mockResolvedValueOnce(saved(4));
    actions.getWorkflowAction.mockResolvedValueOnce({ workflow: stored({ version: 4 }) });
    const { result } = mount();
    await act(async () => {
      await result.current.handleRestoreVersion(2);
    });
    expect(actions.restoreWorkflowVersionAction).toHaveBeenCalledWith("wf-1", 2, 3);
  });

  it("pin a run step over the revision the editor holds", async () => {
    actions.pinNodeFromRunAction.mockResolvedValueOnce(saved(4));
    const { result } = mount();
    await act(async () => {
      await result.current.pinRunStep("r1", { id: "s1", nodeId: "t1" } as Parameters<typeof result.current.pinRunStep>[1]);
    });
    expect(actions.pinNodeFromRunAction).toHaveBeenCalledWith("wf-1", "t1", { runId: "r1", stepId: "s1", revision: 3 });
  });

  it("create a new workflow on the first valid save and update it afterwards", async () => {
    actions.createWorkflowAction.mockResolvedValueOnce({ workflow: stored({ id: "wf-new", version: 1 }) });
    actions.updateWorkflowAction.mockResolvedValueOnce({ workflow: stored({ id: "wf-new", version: 2 }) });
    const { result, rerender } = mount(null);
    expect(result.current.saveStatus.kind).toBe("idle");

    rerender({ draftKey: "k2", name: "Novo" });
    await elapse(1500);
    expect(actions.createWorkflowAction).toHaveBeenCalledTimes(1);
    rerender({ draftKey: "k3", name: "Novo 2" });
    await elapse(1500);
    expect(actions.updateWorkflowAction).toHaveBeenCalledWith("wf-new", expect.objectContaining({ revision: 1 }));
  });
});

describe("refusals in the editor speak the catalog, not the backend", () => {
  const errors = ptMessages.workflowsPage.errors;

  it("on pause", async () => {
    actions.pauseWorkflowAction.mockResolvedValueOnce({ workflow: null, error: "raw pause", code: "workflow_not_active", status: 409 });
    const { result } = mount();
    await act(async () => {
      await result.current.handlePause();
    });
    expect(toast.error).toHaveBeenLastCalledWith(errors.workflow_not_active);
  });

  it("on delete", async () => {
    actions.deleteWorkflowAction.mockResolvedValueOnce({ error: "raw delete", code: "workflow_access_denied", status: 403 });
    const { result } = mount();
    await act(async () => {
      await result.current.handleDelete();
    });
    expect(toast.error).toHaveBeenLastCalledWith(errors.workflow_access_denied);
  });

  it("on a refused pin, under the pin failure title", async () => {
    actions.pinNodeFromRunAction.mockResolvedValueOnce({ workflow: null, error: "raw pin", code: "run_not_found", status: 404 });
    const { result } = mount();
    await act(async () => {
      await result.current.pinRunStep("r1", { id: "s1", nodeId: "t1" } as Parameters<typeof result.current.pinRunStep>[1]);
    });
    expect(toast.error).toHaveBeenLastCalledWith(ptMessages.workflowDebug.step.pinFailed, { description: errors.run_not_found });
  });

  it("keeps the backend copy for a code the catalog does not know", async () => {
    actions.pauseWorkflowAction.mockResolvedValueOnce({ workflow: null, error: "Pausa recusada", code: "something_new" });
    const { result } = mount();
    await act(async () => {
      await result.current.handlePause();
    });
    expect(toast.error).toHaveBeenLastCalledWith("Pausa recusada");
  });
});
