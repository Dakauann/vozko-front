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

import { applyDealAutomation } from "../client";

const campaign = { entryType: "whatsapp", kind: "campaign" as const, containerId: "camp-1" };

beforeEach(() => {
  api.calls = [];
  api.result = { data: { pipelineId: "deals", enabled: true } };
});

describe("applyDealAutomation", () => {
  it("saves the funnel chosen before the campaign existed", async () => {
    expect(await applyDealAutomation(campaign, "deals")).toBe(true);
    expect(api.calls).toEqual([{ path: "/deal-automation/whatsapp/campaign/camp-1", body: { pipelineId: "deals" } }]);
  });

  it("does nothing when automatic deals were left off", async () => {
    expect(await applyDealAutomation(campaign, "")).toBe(true);
    expect(api.calls).toEqual([]);
  });

  it("reports a failed save so the caller can say it is still off", async () => {
    api.result = { error: { status: 403, message: "forbidden" } };
    expect(await applyDealAutomation(campaign, "deals")).toBe(false);
  });
});
