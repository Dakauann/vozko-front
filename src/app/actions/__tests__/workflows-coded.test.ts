import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ result: {} as { data?: unknown; error?: { status?: number; message: string; code?: string } } }));

vi.mock("@/lib/api/browser-client", () => ({
  apiClient: async () => api.result,
}));

import * as secrets from "../workflow-secrets";
import * as workflows from "../workflows";
import { activateWorkflowAction, createWorkflowAction, publishWorkflowAction, updateWorkflowAction } from "../workflows";

const refusal = { status: 422, code: "workflow_consent_grant_needs_reply", message: "Registrar consentimento só vale depois da resposta." };
const payload = { name: "Régua", type: "messages" as const, graph: { nodes: [], edges: [] } };

beforeEach(() => {
  api.result = { error: refusal };
});

describe("workflow save refusals keep their code", () => {
  it("on create, update and activate", async () => {
    for (const result of [await createWorkflowAction(payload), await updateWorkflowAction("wf-1", { ...payload, revision: 1 }), await activateWorkflowAction("wf-1")]) {
      expect(result).toMatchObject({ workflow: null, error: refusal.message, code: refusal.code });
    }
  });

  it("on publish", async () => {
    expect(await publishWorkflowAction("wf-1")).toEqual({
      workflow: null,
      failure: { message: refusal.message, code: refusal.code, status: refusal.status },
    });
  });
});

describe("every other workflow area refusal keeps its code", () => {
  it.each([
    ["list", () => workflows.listWorkflowsAction()],
    ["get", () => workflows.getWorkflowAction("wf-1")],
    ["assign department", () => workflows.assignWorkflowDepartmentAction("wf-1", "d-1")],
    ["delete", () => workflows.deleteWorkflowAction("wf-1")],
    ["pause", () => workflows.pauseWorkflowAction("wf-1")],
    ["import", () => workflows.importWorkflowAction("{}")],
    ["webhook read", () => workflows.getWorkflowWebhookAction("wf-1")],
    ["webhook create", () => workflows.createWorkflowWebhookAction("wf-1", { authMode: "none" } as never)],
    ["webhook update", () => workflows.updateWorkflowWebhookAction("wf-1", { authMode: "none" } as never)],
    ["webhook rotate", () => workflows.rotateWorkflowWebhookAction("wf-1")],
    ["webhook delete", () => workflows.deleteWorkflowWebhookAction("wf-1")],
    ["webhook deliveries", () => workflows.listWorkflowWebhookDeliveriesAction("wf-1")],
    ["runs", () => workflows.listWorkflowRunsAction("wf-1")],
    ["run", () => workflows.getWorkflowRunAction("run-1")],
    ["conversation runs", () => workflows.listConversationWorkflowRunsAction("whatsapp", "e-1")],
    ["alerts", () => workflows.listWorkflowAlertsAction("wf-1")],
    ["cancel run", () => workflows.cancelWorkflowRunAction("run-1")],
    ["versions", () => workflows.listWorkflowVersionsAction("wf-1")],
    ["version", () => workflows.getWorkflowVersionAction("wf-1", 2)],
    ["node analysis", () => workflows.analyzeNodeAction("wf-1", "n-1")],
    ["node test", () => workflows.testNodeAction("wf-1", "n-1", {})],
    ["secrets", () => secrets.listWorkflowSecretsAction()],
    ["secret put", () => secrets.putWorkflowSecretAction("api_key", "x")],
    ["secret delete", () => secrets.deleteWorkflowSecretAction("api_key")],
  ])("on %s", async (_name, call) => {
    api.result = { error: { status: 403, code: "workflow_access_denied", message: "Você não tem acesso a este workflow" } };
    expect(await call()).toMatchObject({ error: "Você não tem acesso a este workflow", code: "workflow_access_denied", status: 403 });
  });
});
