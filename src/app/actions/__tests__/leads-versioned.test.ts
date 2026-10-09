import { beforeEach, describe, expect, it, vi } from "vitest";

type ApiError = { status?: number; message: string; code?: string; current?: unknown };

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method?: string; headers: Record<string, string>; body: unknown }>,
  result: {} as { data?: unknown; error?: ApiError },
}));

vi.mock("@/lib/api/browser-client", () => ({
  apiClient: async (path: string, init: { method?: string; headers?: Record<string, string>; body?: string }) => {
    api.calls.push({
      path,
      method: init.method,
      headers: init.headers ?? {},
      body: init.body ? JSON.parse(init.body) : undefined,
    });
    return api.result;
  },
}));

import { blockLeadAction, getLeadByIdAction, renameLeadAction } from "../leads";

const stored = {
  id: "lead-1",
  workspaceId: "ws-1",
  number: "5511999990000",
  name: "Ana Paula",
  blocked: false,
  relativesCount: 0,
  referredCount: 0,
  version: 4,
};

beforeEach(() => {
  api.calls = [];
  api.result = { data: stored };
});

describe("renameLeadAction", () => {
  it("sends the version the screen was showing in If-Match", async () => {
    await renameLeadAction("lead-1", "Ana Paula", 3);
    expect(api.calls[0]).toMatchObject({
      path: "/leads/lead-1",
      method: "PATCH",
      headers: { "If-Match": "3" },
      body: { name: "Ana Paula" },
    });
  });

  it("answers the saved record with its new version", async () => {
    const result = await renameLeadAction("lead-1", "Ana Paula", 3);
    expect(result).toEqual({ status: "saved", lead: stored });
  });

  it("sends no If-Match when the screen has no version and reports the 428", async () => {
    api.result = { error: { status: 428, code: "version_required", message: "Informe a versão" } };
    const result = await renameLeadAction("lead-1", "Ana Paula", undefined);
    expect(api.calls[0].headers).not.toHaveProperty("If-Match");
    expect(result).toEqual({
      status: "failed",
      error: { status: 428, code: "version_required", message: "Informe a versão" },
    });
  });

  it("answers the current record from the 409 body so the person can retry", async () => {
    const current = { ...stored, name: "Ana Souza", version: 5 };
    api.result = { error: { status: 409, code: "version_conflict", message: "alterado", current } };
    const result = await renameLeadAction("lead-1", "Ana Paula", 3);
    expect(result).toEqual({ status: "conflict", current });
  });

  it("refuses a 409 whose body carries no usable record", async () => {
    api.result = { error: { status: 409, code: "version_conflict", message: "alterado", current: { name: "X" } } };
    const result = await renameLeadAction("lead-1", "Ana Paula", 3);
    expect(result.status).toBe("failed");
  });

  it("treats another 409 as a failure, not a conflict", async () => {
    api.result = { error: { status: 409, code: "lead_identity_taken", message: "taken", current: stored } };
    const result = await renameLeadAction("lead-1", "Ana Paula", 3);
    expect(result).toEqual({
      status: "failed",
      error: { status: 409, code: "lead_identity_taken", message: "taken" },
    });
  });

  it("refuses an empty success", async () => {
    api.result = {};
    const result = await renameLeadAction("lead-1", "Ana Paula", 3);
    expect(result.status).toBe("failed");
  });
});

describe("blockLeadAction", () => {
  it("sends the targeted command without a version and reads the flat answer", async () => {
    api.result = { data: { leadId: "lead-1", blocked: true, metaApplied: true, version: 6 } };
    const result = await blockLeadAction("lead-1", true, "phone-1");
    expect(api.calls[0]).toMatchObject({
      path: "/leads/lead-1/block",
      method: "POST",
      body: { blocked: true, businessPhoneId: "phone-1" },
    });
    expect(api.calls[0].headers).not.toHaveProperty("If-Match");
    expect(result).toEqual({ outcome: { leadId: "lead-1", blocked: true, metaApplied: true, version: 6 }, error: null });
  });

  it("reports a coded refusal", async () => {
    api.result = { error: { status: 403, code: "forbidden", message: "nope" } };
    const result = await blockLeadAction("lead-1", true);
    expect(result).toEqual({ outcome: null, error: { status: 403, code: "forbidden", message: "nope" } });
  });

  it("refuses an answer without a version", async () => {
    api.result = { data: { leadId: "lead-1", blocked: true, metaApplied: false } };
    const result = await blockLeadAction("lead-1", true);
    expect(result.outcome).toBeNull();
  });
});

describe("getLeadByIdAction", () => {
  it("reads the flat lead detail", async () => {
    const result = await getLeadByIdAction("lead-1");
    expect(result).toEqual({ lead: stored, error: null });
  });

  it("refuses an answer without a version", async () => {
    api.result = { data: { id: "lead-1", name: "Ana" } };
    const result = await getLeadByIdAction("lead-1");
    expect(result.lead).toBeNull();
  });
});
