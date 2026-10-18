import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ result: {} as { data?: unknown; error?: { status?: number; message: string; code?: string } } }));

vi.mock("@/lib/api/browser-client", () => ({
  apiClient: async () => api.result,
}));

import { activateWorkflowAction, createWorkflowAction, updateWorkflowAction } from "../workflows";

const refusal = { status: 422, code: "workflow_consent_grant_needs_reply", message: "Registrar consentimento só vale depois da resposta." };
const payload = { name: "Régua", type: "messages" as const, graph: { nodes: [], edges: [] } };

beforeEach(() => {
  api.result = { error: refusal };
});

describe("workflow save refusals keep their code", () => {
  it("on create, update and activate", async () => {
    for (const result of [await createWorkflowAction(payload), await updateWorkflowAction("wf-1", payload), await activateWorkflowAction("wf-1")]) {
      expect(result).toEqual({ workflow: null, error: refusal.message, code: refusal.code });
    }
  });
});
