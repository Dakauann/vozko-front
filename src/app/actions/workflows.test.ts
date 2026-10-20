
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiClient } = vi.hoisted(() => ({
  apiClient: vi.fn(),
}));

vi.mock("@/lib/api/browser-client", () => ({ apiClient }));

import {
  activateWorkflowAction,
  analyzeNodeAction,
  cancelWorkflowRunAction,
  getWorkflowRunAction,
  listConversationWorkflowRunsAction,
  listWorkflowRunsAction,
  listWorkflowVersionsAction,
  listWorkflowWebhookDeliveriesAction,
  listWorkflowsAction,
  pinNodeFromRunAction,
  publishWorkflowAction,
  restoreWorkflowVersionAction,
  testNodeAction,
  updateWorkflowAction,
} from "@/app/actions/workflows";

const analysis = {
  node_id: "node-1",
  node_type: "action_set_variable",
  node_label: "Definir Variavel",
  test_mode: "mock",
  mock_fields: [
    {
      key: "_last_body",
      display_name: "last.body",
      source: "previous_node",
    },
  ],
  can_run_direct: false,
  has_ai_deps: false,
  message: "Precisa de mocks",
} as const;

const testResult = {
  node_id: "node-1",
  node_type: "action_set_variable",
  success: true,
  interpolated_config: { value: "ok" },
  execution_output: { value: "ok" },
  execution_duration_ms: 12,
} as const;

describe("workflow test-node server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propagates auth errors for analyzeNodeAction", async () => {
    apiClient.mockResolvedValue({ error: { message: "Auth required", status: 401 } });

    await expect(analyzeNodeAction("wf-1", "node-1")).resolves.toEqual({
      analysis: null,
      error: "Auth required",
      status: 401,
    });
  });

  it("returns analyze payload on success", async () => {
    apiClient.mockResolvedValue({ data: analysis });

    await expect(analyzeNodeAction("wf-1", "node-1")).resolves.toEqual({
      analysis,
    });
    expect(apiClient).toHaveBeenCalledTimes(1);
  });

  it("returns execution errors for testNodeAction", async () => {
    apiClient.mockResolvedValue({ error: { message: "boom" } });

    await expect(
      testNodeAction("wf-1", "node-1", { mockedState: { _last_body: "x" } }),
    ).resolves.toEqual({
      result: null,
      error: "boom",
    });
  });

  it("returns test payload on success", async () => {
    apiClient.mockResolvedValue({ data: testResult });

    await expect(
      testNodeAction("wf-1", "node-1", {
        mockedState: { _last_body: "body" },
        triggerVars: { message: "oi" },
        skipExecution: false,
      }),
    ).resolves.toEqual({
      result: testResult,
    });
  });
});

describe("workflow publication server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts to the publish route and returns the published workflow", async () => {
    apiClient.mockResolvedValue({ data: { id: "wf-1", publishedVersion: 4 } });

    await expect(publishWorkflowAction("wf-1")).resolves.toEqual({ workflow: { id: "wf-1", publishedVersion: 4 } });
    expect(apiClient).toHaveBeenCalledWith("/workflows/wf-1/publish", { method: "POST" });
  });

  it("keeps the blocking detail of a refused publish so the editor can show it", async () => {
    apiClient.mockResolvedValue({
      error: { message: "Campo obrigatório não preenchido", status: 422, details: { detail: "node n2: url" } },
    });

    await expect(publishWorkflowAction("wf-1")).resolves.toEqual({
      workflow: null,
      failure: { message: "Campo obrigatório não preenchido", status: 422, detail: "node n2: url" },
    });
  });

  it("keeps the blocking detail of a refused resume", async () => {
    apiClient.mockResolvedValue({ error: { message: "Erro", status: 422, details: { detail: "node n3" } } });

    await expect(activateWorkflowAction("wf-1")).resolves.toEqual({
      workflow: null,
      error: "Erro",
      code: undefined,
      failure: { message: "Erro", status: 422, detail: "node n3" },
    });
  });

  it("lists the published versions page by page", async () => {
    apiClient.mockResolvedValue({
      data: { data: [{ id: "v-2", version: 2 }], meta: { page: 1, pageSize: 20, totalPages: 3, totalItems: 41 } },
    });

    await expect(listWorkflowVersionsAction("wf-1", { page: 1, pageSize: 20 })).resolves.toEqual({
      versions: [{ id: "v-2", version: 2 }],
      meta: { page: 1, pageSize: 20, totalPages: 3, totalItems: 41 },
    });
    expect(apiClient).toHaveBeenCalledWith("/workflows/wf-1/versions?page=1&pageSize=20", { method: "GET" });
  });

  it("reports an unreadable version list instead of an empty history", async () => {
    apiClient.mockResolvedValue({ error: { message: "boom" } });

    const result = await listWorkflowVersionsAction("wf-1");
    expect(result.error).toBe("boom");
    expect(result.versions).toEqual([]);
  });

  it("restores a version over the draft revision the editor holds", async () => {
    apiClient.mockResolvedValue({ data: { id: "wf-1", hasUnpublishedChanges: true, version: 5 } });

    await expect(restoreWorkflowVersionAction("wf-1", 2, 4)).resolves.toEqual({ workflow: { id: "wf-1", hasUnpublishedChanges: true, version: 5 } });
    expect(apiClient).toHaveBeenCalledWith("/workflows/wf-1/versions/2/restore", { method: "POST", body: JSON.stringify({ revision: 4 }) });
  });

  it("returns the restore refusal", async () => {
    apiClient.mockResolvedValue({ error: { message: "Versão do workflow não encontrada", status: 404 } });

    await expect(restoreWorkflowVersionAction("wf-1", 9, 4)).resolves.toEqual({
      workflow: null,
      error: "Versão do workflow não encontrada",
      status: 404,
    });
  });
});

describe("draft writers send the revision they read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const draft = { name: "Matrícula", type: "messages" as const, graph: { nodes: [], edges: [] }, revision: 3 };
  const conflict = { message: "Este rascunho foi alterado por outra pessoa.", status: 409, code: "draft_conflict", details: { revision: 7 } };

  it("puts the draft with its revision and returns the saved workflow", async () => {
    apiClient.mockResolvedValue({ data: { id: "wf-1", version: 4 } });

    await expect(updateWorkflowAction("wf-1", draft)).resolves.toEqual({ workflow: { id: "wf-1", version: 4 } });
    expect(apiClient).toHaveBeenCalledWith("/workflows/wf-1", { method: "PUT", body: JSON.stringify(draft) });
  });

  it("reports a draft conflict with the revision stored now", async () => {
    apiClient.mockResolvedValue({ error: conflict });

    await expect(updateWorkflowAction("wf-1", draft)).resolves.toEqual({
      workflow: null,
      error: conflict.message,
      code: "draft_conflict",
      status: 409,
      conflict: { revision: 7 },
    });
  });

  it("reports a conflict on restore and on pin from a run", async () => {
    apiClient.mockResolvedValue({ error: conflict });

    await expect(restoreWorkflowVersionAction("wf-1", 2, 3)).resolves.toMatchObject({ workflow: null, conflict: { revision: 7 } });
    await expect(pinNodeFromRunAction("wf-1", "n1", { runId: "r1", revision: 3 })).resolves.toMatchObject({ workflow: null, conflict: { revision: 7 } });
  });

  it("pins a run step over the draft revision the editor holds", async () => {
    apiClient.mockResolvedValue({ data: { id: "wf-1", version: 4 } });

    await expect(pinNodeFromRunAction("wf-1", "n 1", { runId: "r1", stepId: "s1", revision: 3 })).resolves.toEqual({ workflow: { id: "wf-1", version: 4 } });
    expect(apiClient).toHaveBeenCalledWith("/workflows/wf-1/nodes/n%201/pin-from-run", {
      method: "POST",
      body: JSON.stringify({ runId: "r1", stepId: "s1", revision: 3 }),
    });
    await pinNodeFromRunAction("wf-1", "n1", { runId: "r1", revision: 3 });
    expect(apiClient).toHaveBeenLastCalledWith("/workflows/wf-1/nodes/n1/pin-from-run", { method: "POST", body: JSON.stringify({ runId: "r1", revision: 3 }) });
  });
});

describe("run reads page their steps and tell refusals apart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const run = { id: "r1", workflowId: "wf-1", status: "running" };
  const window = { offset: 500, limit: 500, total: 1200, hasMore: true };

  it("asks for one page of steps and keeps the step window", async () => {
    apiClient.mockResolvedValue({ data: { run, logs: [{ id: "s501" }], steps: window } });

    await expect(getWorkflowRunAction("r 1", 2)).resolves.toEqual({ detail: { run, logs: [{ id: "s501" }], steps: window } });
    expect(apiClient).toHaveBeenCalledWith("/workflow-runs/r%201?stepsOffset=500&stepsLimit=500", { method: "GET" });
  });

  it("reads the first page when no page is given", async () => {
    apiClient.mockResolvedValue({ data: { run, logs: null } });

    await expect(getWorkflowRunAction("r1")).resolves.toEqual({ detail: { run, logs: [] } });
    expect(apiClient).toHaveBeenCalledWith("/workflow-runs/r1?stepsOffset=0&stepsLimit=500", { method: "GET" });
  });

  it("keeps the HTTP status of every refused read so the screen can say why", async () => {
    apiClient.mockResolvedValue({ error: { message: "You don't have access to this workflow", status: 403 } });

    await expect(getWorkflowRunAction("r1")).resolves.toMatchObject({ detail: null, status: 403 });
    await expect(listWorkflowRunsAction("wf-1")).resolves.toMatchObject({ runs: [], status: 403 });
    await expect(listWorkflowWebhookDeliveriesAction("wf-1")).resolves.toMatchObject({ deliveries: [], status: 403 });
    await expect(listConversationWorkflowRunsAction("whatsapp", "e1")).resolves.toMatchObject({ runs: [], status: 403 });
    await expect(testNodeAction("wf-1", "n1", {})).resolves.toMatchObject({ result: null, status: 403 });
    await expect(analyzeNodeAction("wf-1", "n1")).resolves.toMatchObject({ analysis: null, status: 403 });
    await expect(cancelWorkflowRunAction("r1")).resolves.toMatchObject({ status: 403 });
  });
});

describe("workflow list filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters by entry point kind on the server, so every page is filtered", async () => {
    apiClient.mockResolvedValue({ data: { data: [], meta: { page: 1, pageSize: 15, totalPages: 1, totalItems: 0 } } });

    await listWorkflowsAction({ page: 2, pageSize: 15, entryKind: "webhook" });
    expect(apiClient).toHaveBeenCalledWith("/workflows?page=2&pageSize=15&entryKind=webhook", { method: "GET" });
  });
});
