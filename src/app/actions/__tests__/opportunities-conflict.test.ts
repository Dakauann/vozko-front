import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; body: unknown }>,
  result: {} as { data?: unknown; error?: { status: number; message: string } },
}));

vi.mock("@/lib/api/browser-client", () => ({
  apiClient: async (path: string, init: { body?: string }) => {
    api.calls.push({ path, body: init.body ? JSON.parse(init.body) : undefined });
    return api.result;
  },
}));

import { moveOpportunityAction, updateOpportunityAction } from "../opportunities";

beforeEach(() => {
  api.calls = [];
  api.result = { data: { id: "deal-1", version: 4 } };
});

describe("deal saves", () => {
  it("send the version the screen was showing", async () => {
    await updateOpportunityAction("deal-1", { valueCents: 150000, version: 3 });
    await moveOpportunityAction("deal-1", { stageId: "won", version: 3 });
    expect(api.calls.map((c) => (c.body as { version: number }).version)).toEqual([3, 3]);
  });

  it("report a conflict when someone else saved first", async () => {
    api.result = { error: { status: 409, message: "Esta oportunidade foi alterada agora. Recarregue para ver a versão atual." } };
    const update = await updateOpportunityAction("deal-1", { valueCents: 1, version: 3 });
    const move = await moveOpportunityAction("deal-1", { stageId: "won", version: 3 });
    expect(update.conflict).toBe(true);
    expect(move.conflict).toBe(true);
    expect(update.error).toContain("alterada agora");
  });

  it("do not treat other failures as conflicts", async () => {
    api.result = { error: { status: 400, message: "invalid" } };
    const update = await updateOpportunityAction("deal-1", { valueCents: -1 });
    expect(update.conflict).toBe(false);
  });
});
