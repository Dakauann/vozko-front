import { describe, expect, it } from "vitest";

import { accountHandle, accountNotices, accountStatusKey, accountStatusTone, reconnectable, updateBodyOf } from "@/lib/mercadolivre/account";
import type { MercadoLivreAccount } from "@/lib/mercadolivre/types";

function account(overrides: Partial<MercadoLivreAccount> = {}): MercadoLivreAccount {
  return {
    id: "acc-1",
    workspaceId: "ws-1",
    mlUserId: "123",
    siteId: "MLB",
    nickname: "LOJA",
    displayName: "LOJA",
    status: "CONNECTED",
    needsReconnect: false,
    grantedScopes: ["offline_access", "read", "write"],
    canReadQuestions: true,
    canAnswerQuestions: true,
    canReadMessages: true,
    canSendMessages: true,
    enableAgentResponses: false,
    enableWorkflow: false,
    automationDisclosure: "",
    createdAt: "2026-10-19T10:00:00Z",
    updatedAt: "2026-10-19T10:00:00Z",
    ...overrides,
  };
}

describe("accountHandle", () => {
  it("is the nickname when the seller name differs from it", () => {
    expect(accountHandle(account({ displayName: "Café do Vale", nickname: "DGCAFEDHB50478" }))).toBe("DGCAFEDHB50478");
  });

  it("is absent when the name already is the nickname", () => {
    expect(accountHandle(account({ displayName: "DGCAFEDHB50478", nickname: "DGCAFEDHB50478" }))).toBeNull();
  });

  it("is absent when there is no nickname", () => {
    expect(accountHandle(account({ displayName: "Café do Vale", nickname: "" }))).toBeNull();
  });
});

describe("accountStatusTone", () => {
  it("gives each status a solid mark", () => {
    expect(accountStatusTone("CONNECTED")).toBe("healthy");
    expect(accountStatusTone("NEEDS_RECONNECT")).toBe("fault");
    expect(accountStatusTone("REVOKED")).toBe("fault");
    expect(accountStatusTone("DISCONNECTED")).toBe("muted");
  });
});

describe("accountStatusKey", () => {
  it("names the copy key of each status", () => {
    expect(accountStatusKey("CONNECTED")).toBe("status.connected");
    expect(accountStatusKey("NEEDS_RECONNECT")).toBe("status.needs_reconnect");
    expect(accountStatusKey("REVOKED")).toBe("status.revoked");
    expect(accountStatusKey("DISCONNECTED")).toBe("status.disconnected");
  });
});

describe("accountNotices", () => {
  it("has nothing to say about a healthy account", () => {
    expect(accountNotices(account())).toEqual([]);
  });

  it("asks for a reconnect when the grant died", () => {
    expect(accountNotices(account({ status: "NEEDS_RECONNECT", needsReconnect: true }))).toEqual([{ kind: "reconnect" }]);
  });

  it("announces the purge date of a disconnected account", () => {
    expect(accountNotices(account({ status: "DISCONNECTED", purgeAfter: "2026-11-18T10:00:00Z" }))).toEqual([
      { kind: "purge", purgeAfter: "2026-11-18T10:00:00Z" },
    ]);
  });

  it("asks for a reconnect and announces the purge of a revoked account", () => {
    expect(
      accountNotices(account({ status: "REVOKED", needsReconnect: true, purgeAfter: "2026-11-18T10:00:00Z" })),
    ).toEqual([{ kind: "reconnect" }, { kind: "purge", purgeAfter: "2026-11-18T10:00:00Z" }]);
  });

  it("still says a disconnected account is off when no purge date came back", () => {
    expect(accountNotices(account({ status: "DISCONNECTED" }))).toEqual([{ kind: "disconnected" }]);
  });
});

describe("reconnectable", () => {
  it("offers a reconnect to dead grants and disconnected accounts only", () => {
    expect(reconnectable(account())).toBe(false);
    expect(reconnectable(account({ status: "NEEDS_RECONNECT", needsReconnect: true }))).toBe(true);
    expect(reconnectable(account({ status: "REVOKED", needsReconnect: true }))).toBe(true);
    expect(reconnectable(account({ status: "DISCONNECTED" }))).toBe(true);
  });
});

describe("updateBodyOf", () => {
  it("sends an empty string to clear a reference, since the backend ignores null", () => {
    expect(updateBodyOf({ agentId: null, workflowId: null, pipelineId: null, departmentId: null })).toEqual({
      agentId: "",
      workflowId: "",
      pipelineId: "",
      departmentId: "",
    });
  });

  it("keeps set values and leaves out what did not change", () => {
    expect(updateBodyOf({ agentId: "agent-1", enableAgentResponses: true })).toEqual({ agentId: "agent-1", enableAgentResponses: true });
    expect(updateBodyOf({ enableWorkflow: false, automationDisclosure: "" })).toEqual({ enableWorkflow: false, automationDisclosure: "" });
  });

  it("never carries the analysis toggles Mercado Livre does not have", () => {
    const body = updateBodyOf({ agentId: "a", enableAnalysis: true, enableAutoMemory: true, enableAutoStaging: true } as never);
    expect(body).toEqual({ agentId: "a" });
  });
});
