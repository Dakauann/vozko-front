
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiClient } = vi.hoisted(() => ({
  apiClient: vi.fn(),
}));

vi.mock("@/lib/api/browser-client", () => ({ apiClient }));

import {
  activateWorkflowAction,
  analyzeNodeAction,
  getNodeVariablesAction,
  getTriggerLastInputAction,
  getWorkflowChoiceStatsAction,
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

  it("asks the server for the flows a button can start", async () => {
    apiClient.mockResolvedValue({ data: { data: [], meta: { page: 1, pageSize: 100, totalPages: 1, totalItems: 0 } } });

    await listWorkflowsAction({ pageSize: 100, startsFromMessage: true });
    expect(apiClient).toHaveBeenCalledWith("/workflows?pageSize=100&startsFromMessage=true", { method: "GET" });
  });
});

describe("trigger input actions", () => {
  beforeEach(() => apiClient.mockReset());

  it("reads the last real call of a trigger", async () => {
    apiClient.mockResolvedValue({ data: { input: { cpf: "•••", nome: "Ana" }, maskedKeys: ["cpf"], runId: "r1", startedAt: "2026-10-22T10:00:00Z" } });
    await expect(getTriggerLastInputAction("wf 1", "t/1")).resolves.toEqual({
      lastInput: { input: { cpf: "•••", nome: "Ana" }, maskedKeys: ["cpf"], runId: "r1", startedAt: "2026-10-22T10:00:00Z" },
    });
    expect(apiClient).toHaveBeenCalledWith("/workflows/wf%201/triggers/t%2F1/last-input", { method: "GET" });
  });

  it("passes the coded 404 on when there is no recent real call", async () => {
    apiClient.mockResolvedValue({ error: { message: "Nenhuma chamada", status: 404, code: "no_recent_input" } });
    await expect(getTriggerLastInputAction("wf-1", "t1")).resolves.toEqual({
      lastInput: null,
      error: "Nenhuma chamada",
      code: "no_recent_input",
      status: 404,
    });
  });

  it.each([
    ["trigger_not_found", 404],
    ["trigger_input_unavailable", 503],
  ] as const)("passes the coded %s refusal on", async (code, status) => {
    apiClient.mockResolvedValue({ error: { message: "raw", status, code } });
    await expect(getTriggerLastInputAction("wf-1", "t1")).resolves.toEqual({ lastInput: null, error: "raw", code, status });
  });

  it("reads the last input only at the top level, never unwrapping a data envelope", async () => {
    apiClient.mockResolvedValue({ data: { data: { input: { nome: "Ana" }, maskedKeys: [], runId: "r1", startedAt: "2026-10-22T10:00:00Z" } } });
    const answer = await getTriggerLastInputAction("wf-1", "t1");
    expect(answer.lastInput).toBeNull();
    expect(answer.code).toBeUndefined();
  });

  it("refuses an answer it cannot read instead of loading an empty input", async () => {
    apiClient.mockResolvedValue({ data: { input: {} } });
    const answer = await getTriggerLastInputAction("wf-1", "t1");
    expect(answer.lastInput).toBeNull();
    expect(answer.error).toBeTruthy();
    expect(answer.code).toBeUndefined();
  });

  it("sends the trigger input with a node test and returns the refused fields", async () => {
    apiClient.mockResolvedValue({
      error: { message: "Dados inválidos", status: 422, code: "trigger_input_invalid", details: { issues: [{ code: "required", key: "cpf" }] } },
    });
    const payload = { mockedState: {}, trigger: { nodeId: "t1", input: { nome: "Ana" } } };
    await expect(testNodeAction("wf-1", "n4", payload)).resolves.toEqual({
      result: null,
      error: "Dados inválidos",
      code: "trigger_input_invalid",
      status: 422,
      issues: [{ code: "required", key: "cpf" }],
    });
    expect(apiClient).toHaveBeenCalledWith("/workflows/wf-1/nodes/n4/test", { method: "POST", body: JSON.stringify(payload) });
  });
});

describe("getWorkflowChoiceStatsAction", () => {
  beforeEach(() => apiClient.mockReset());

  const body = { from: "2026-10-16", to: "2026-10-22", timezone: "America/Sao_Paulo", version: null, nodes: [] };

  it("asks for the period once for the whole canvas", async () => {
    apiClient.mockResolvedValue({ data: body });
    const answer = await getWorkflowChoiceStatsAction("wf 1", { from: "2026-10-16", to: "2026-10-22" });
    expect(answer.status).toBe("ready");
    expect(apiClient).toHaveBeenCalledWith("/workflows/wf%201/choice-stats?from=2026-10-16&to=2026-10-22", { method: "GET" });
  });

  it("adds the version filter only when one is chosen", async () => {
    apiClient.mockResolvedValue({ data: { ...body, version: 2 } });
    await getWorkflowChoiceStatsAction("wf-1", { from: "2026-10-16", to: "2026-10-22", version: 2 });
    expect(apiClient).toHaveBeenCalledWith("/workflows/wf-1/choice-stats?from=2026-10-16&to=2026-10-22&version=2", { method: "GET" });
  });

  it("reports a body it cannot read as unreadable", async () => {
    apiClient.mockResolvedValue({ data: { nodes: "many" } });
    await expect(getWorkflowChoiceStatsAction("wf-1", { from: "2026-10-16", to: "2026-10-22" })).resolves.toEqual({ status: "unreadable" });
  });

  it("passes a coded refusal on", async () => {
    apiClient.mockResolvedValue({ error: { message: "raw", status: 400, code: "invalid_period" } });
    await expect(getWorkflowChoiceStatsAction("wf-1", { from: "x", to: "y" })).resolves.toEqual({ status: "failed", message: "raw", code: "invalid_period", httpStatus: 400 });
  });
});

describe("getNodeVariablesAction", () => {
  beforeEach(() => apiClient.mockReset());

  it("reads the variable catalog the backend computed for the node", async () => {
    apiClient.mockResolvedValue({
      data: { variables: [{ ref: "sys.date", label: "Data de hoje", group: "system", kind: "system", source: null, type: "date", example: null, availability: "always" }] },
    });
    const answer = await getNodeVariablesAction("wf 1", "n/1");
    expect(answer).toEqual({
      catalog: {
        variables: [{ ref: "sys.date", label: "Data de hoje", group: "system", kind: "system", source: null, type: "date", example: null, availability: "always" }],
        unreadable: 0,
      },
    });
    expect(apiClient).toHaveBeenCalledWith("/workflows/wf%201/nodes/n%2F1/variables", { method: "GET" });
  });

  it("passes a coded refusal on", async () => {
    apiClient.mockResolvedValue({ error: { message: "raw", status: 404, code: "node_not_found" } });
    await expect(getNodeVariablesAction("wf-1", "n1")).resolves.toEqual({ error: "raw", code: "node_not_found", status: 404 });
  });

  it("answers an error for an unreadable body instead of an empty catalog", async () => {
    apiClient.mockResolvedValue({ data: { items: [] } });
    await expect(getNodeVariablesAction("wf-1", "n1")).resolves.toEqual({ error: "unreadable variable catalog" });
  });
});
