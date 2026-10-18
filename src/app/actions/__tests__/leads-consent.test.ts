import { beforeEach, describe, expect, it, vi } from "vitest";

type ApiError = { status?: number; message: string; code?: string };

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method?: string; body: unknown }>,
  result: {} as { data?: unknown; error?: ApiError },
}));

vi.mock("@/lib/api/browser-client", () => ({
  apiClient: async (path: string, init: { method?: string; body?: string }) => {
    api.calls.push({ path, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    return api.result;
  },
}));

import { grantLeadConsentAction } from "../leads";

const lead = { id: "lead-1", workspaceId: "ws-1", number: "5511900010142", version: 7 };

beforeEach(() => {
  api.calls = [];
  api.result = {};
});

describe("grantLeadConsentAction", () => {
  it("records a manual grant through the consent route with the operator's note as the proof", async () => {
    api.result = { data: { lead, changed: true, eventId: "ev-1" } };
    const result = await grantLeadConsentAction("lead-1", { note: "Pediu para voltar a receber por telefone", purpose: "ofertas" });
    expect(api.calls).toEqual([
      {
        path: "/leads/lead-1/consent",
        method: "POST",
        body: {
          kind: "grant",
          source: "manual",
          purpose: "ofertas",
          evidence: { type: "note", excerpt: "Pediu para voltar a receber por telefone" },
        },
      },
    ]);
    expect(result).toEqual({ lead, changed: true, error: null });
  });

  it("leaves the purpose out when none was given", async () => {
    api.result = { data: { lead, changed: false } };
    await grantLeadConsentAction("lead-1", { note: "Nota", purpose: "  " });
    expect(api.calls[0].body).toEqual({ kind: "grant", source: "manual", evidence: { type: "note", excerpt: "Nota" } });
  });

  it("keeps the coded refusal", async () => {
    api.result = { error: { status: 403, code: "forbidden", message: "no" } };
    expect(await grantLeadConsentAction("lead-1", { note: "Nota" })).toEqual({
      lead: null,
      error: { message: "no", code: "forbidden", status: 403 },
    });
  });
});
