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

import { cancelLeadSendAction, reviewLeadSendAction, startLeadSendAction } from "../lead-sends";

const review = {
  channel: "official",
  parts: [{ campaignId: "c-1", name: "Matrículas", status: "STOPPED", entries: 10, eligible: 9 }],
  entries: 10,
  eligible: 9,
  skipped: { blocked: 1 },
  counted: { window_open: 2 },
  quote: {
    count: 9,
    parts: 1,
    splitRequired: false,
    maxPerCampaign: 150000,
    unitPriceMicros: 62500,
    costMicros: 562500,
    balanceMicros: 1000000,
    currency: "USD",
    affordable: true,
    fits: 9,
  },
  started: false,
};

const request = { channel: "official" as const, campaignIds: ["c-1"] };

beforeEach(() => {
  api.calls = [];
  api.result = { data: review };
});

describe("lead send actions", () => {
  it("re-reads the prepared send", async () => {
    const result = await reviewLeadSendAction(request);
    expect(api.calls[0]).toEqual({ path: "/leads/actions/sends/review", method: "POST", body: request });
    expect(result.data?.eligible).toBe(9);
  });

  it("starts the send with the first N when asked", async () => {
    await startLeadSendAction({ ...request, firstN: 5 });
    expect(api.calls[0]).toEqual({ path: "/leads/actions/sends/start", method: "POST", body: { ...request, firstN: 5 } });
  });

  it("returns the coded refusal of a start", async () => {
    api.result = { error: { status: 409, code: "unaffordable", message: "x" } };
    expect(await startLeadSendAction(request)).toEqual({ data: null, error: { status: 409, code: "unaffordable", message: "x" } });
  });

  it("cancels the stopped campaigns and refuses a malformed answer", async () => {
    api.result = { data: { cancelled: true } };
    expect(await cancelLeadSendAction(request)).toEqual({ data: { cancelled: true }, error: null });
    expect(api.calls[0].path).toBe("/leads/actions/sends/cancel");
    api.result = { data: { cancelled: "yes" } };
    expect((await cancelLeadSendAction(request)).error).not.toBeNull();
  });

  it("never reads a broken review as a send", async () => {
    api.result = { data: { ...review, channel: "sms" } };
    expect((await reviewLeadSendAction(request)).data).toBeNull();
  });
});
