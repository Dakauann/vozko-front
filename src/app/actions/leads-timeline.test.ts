import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.fn();
vi.mock("@/lib/api/browser-client", () => ({ apiClient: (...args: unknown[]) => apiClient(...args) }));

import { listLeadDealsAction, listLeadTimelineAction } from "./leads";

describe("listLeadTimelineAction", () => {
  beforeEach(() => apiClient.mockReset());

  it("asks for the first page of the lead with the caller's signal", async () => {
    apiClient.mockResolvedValue({
      data: { leadId: "lead 1", items: [{ id: "memory:m-1", kind: "memory", at: "2026-10-08T14:32:00Z", ref: { type: "memory", id: "m-1" }, summary: { text: "tem dois filhos" } }], next: "cur-1" },
    });
    const controller = new AbortController();

    const { page, error } = await listLeadTimelineAction("lead 1", { limit: 30 }, controller.signal);

    const [url, init] = apiClient.mock.calls[0];
    expect(url).toBe("/leads/lead%201/timeline?limit=30");
    expect(init).toMatchObject({ method: "GET", signal: controller.signal });
    expect(error).toBeNull();
    expect(page?.items.map((item) => item.id)).toEqual(["memory:m-1"]);
    expect(page?.next).toBe("cur-1");
  });

  it("asks for the next page with the cursor the server gave", async () => {
    apiClient.mockResolvedValue({ data: { leadId: "lead-1", items: [] } });

    await listLeadTimelineAction("lead-1", { before: "MjAy|x", limit: 30 });

    expect(apiClient.mock.calls[0][0]).toBe("/leads/lead-1/timeline?before=MjAy%7Cx&limit=30");
  });

  it("returns the coded refusal", async () => {
    apiClient.mockResolvedValue({ error: { message: "busy", status: 503, code: "lead_history_unavailable" } });

    const { page, error } = await listLeadTimelineAction("lead-1");

    expect(page).toBeNull();
    expect(error).toMatchObject({ status: 503, code: "lead_history_unavailable" });
  });

  it("refuses an answer that is not a timeline page", async () => {
    apiClient.mockResolvedValue({ data: { leadId: "lead-1" } });

    const { page, error } = await listLeadTimelineAction("lead-1");

    expect(page).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe("listLeadDealsAction", () => {
  beforeEach(() => apiClient.mockReset());

  it("asks for the deals of the lead page by page", async () => {
    apiClient.mockResolvedValue({ data: { leadId: "lead-1", deals: [{ id: "d-1", title: "Matrícula" }], next: "cur-1" } });

    const { page } = await listLeadDealsAction("lead-1", { before: "cur-0", limit: 30 });

    expect(apiClient.mock.calls[0][0]).toBe("/leads/lead-1/deals?before=cur-0&limit=30");
    expect(page?.deals.map((deal) => deal.id)).toEqual(["d-1"]);
    expect(page?.next).toBe("cur-1");
  });

  it("returns the refusal for a viewer without deal access", async () => {
    apiClient.mockResolvedValue({ error: { message: "no", status: 403, code: "deals_forbidden" } });

    const { page, error } = await listLeadDealsAction("lead-1");

    expect(page).toBeNull();
    expect(error).toMatchObject({ status: 403, code: "deals_forbidden" });
  });
});
