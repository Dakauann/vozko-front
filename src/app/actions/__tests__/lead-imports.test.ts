import { beforeEach, describe, expect, it, vi } from "vitest";

type ApiError = { status?: number; message: string; code?: string };

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method?: string }>,
  result: {} as { data?: unknown; error?: ApiError },
}));

vi.mock("@/lib/api/browser-client", () => ({
  apiClient: async (path: string, init: { method?: string }) => {
    api.calls.push({ path, method: init.method });
    return api.result;
  },
}));

vi.mock("@/lib/api/download-file", () => ({ downloadApiFile: vi.fn() }));

import { LEAD_IMPORT_RATE_LIMITED, LEAD_IMPORT_UNREADABLE, listLeadImportsAction } from "../lead-imports";

const limits = { maxBytes: 20971520, maxMegabytes: 20, maxRows: 200000, maxSeededConversations: 200, retentionDays: 7, maxUnusedUploads: 5 };
const item = {
  id: "imp-1",
  status: "done",
  fileName: "base.csv",
  sizeBytes: 10,
  totalRows: 3,
  processed: 3,
  createdAt: "2026-10-08T12:00:00Z",
  expiresAt: "2026-10-15T12:00:00Z",
};

beforeEach(() => {
  api.calls = [];
  api.result = { data: { items: [item], limits } };
});

describe("listLeadImportsAction", () => {
  it("asks the server for the caller's own recent imports", async () => {
    const result = await listLeadImportsAction();
    expect(api.calls).toEqual([{ path: "/leads/imports?mine=true", method: "GET" }]);
    expect(result).toEqual({ list: { items: [item], limits } });
  });

  it("refuses a body it cannot read", async () => {
    api.result = { data: { limits } };
    const result = await listLeadImportsAction();
    expect(result).toEqual({ error: expect.objectContaining({ code: LEAD_IMPORT_UNREADABLE }) });
  });

  it("names a rate limit the server answered without a code", async () => {
    api.result = { error: { status: 429, message: "slow down" } };
    const result = await listLeadImportsAction();
    expect(result).toEqual({ error: expect.objectContaining({ code: LEAD_IMPORT_RATE_LIMITED, status: 429 }) });
  });
});
