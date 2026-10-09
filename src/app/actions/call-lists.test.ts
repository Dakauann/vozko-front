import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.fn();
vi.mock("@/lib/api/browser-client", () => ({ apiClient: (...args: unknown[]) => apiClient(...args) }));

import {
  closeCallListItemAction,
  deleteCallListAction,
  getCallListAction,
  listCallListItemsAction,
  listCallListsAction,
  nextCallListItemAction,
  releaseCallListItemAction,
  updateCallListAction,
} from "./call-lists";

const list = {
  id: "list-1",
  name: "Retorno",
  status: "active",
  createdBy: "u1",
  assigneeIds: ["u1"],
  phone: { source: "identity" },
  selected: 3,
  itemCount: 3,
  closedCount: 1,
  openCount: 2,
  calledCount: 1,
  callbackCount: 0,
  acceptsOutcomes: true,
  statusMoves: ["paused", "archived"],
  skipped: {},
  createdAt: "2026-10-07T12:00:00Z",
  updatedAt: "2026-10-07T12:00:00Z",
};

const item = {
  id: "item 1",
  listId: "list-1",
  leadId: "lead-1",
  phone: "5511987654321",
  position: 1,
  state: "reserved",
  reservedBy: "u1",
  reservedUntil: "2026-10-08T12:15:00Z",
  closable: false,
  createdAt: "2026-10-07T12:00:00Z",
  updatedAt: "2026-10-08T12:00:00Z",
};

describe("call list actions", () => {
  beforeEach(() => apiClient.mockReset());

  it("pages the lists with the status filter", async () => {
    apiClient.mockResolvedValue({ data: { items: [list], total: 1, page: 2, pageSize: 20 } });
    const controller = new AbortController();

    const answer = await listCallListsAction({ page: 2, pageSize: 20, status: "paused" }, controller.signal);

    expect(apiClient).toHaveBeenCalledWith("/call-lists?page=2&pageSize=20&status=paused", { method: "GET", signal: controller.signal });
    expect(answer).toEqual({ data: { items: [list], total: 1, page: 2, pageSize: 20 }, error: null });
  });

  it("reads one list and changes it with only the given fields", async () => {
    apiClient.mockResolvedValue({ data: list });
    await getCallListAction("list-1");
    expect(apiClient).toHaveBeenLastCalledWith("/call-lists/list-1", { method: "GET", signal: undefined });

    await updateCallListAction("list-1", { status: "paused" });
    expect(apiClient).toHaveBeenLastCalledWith("/call-lists/list-1", { method: "PATCH", body: JSON.stringify({ status: "paused" }) });
  });

  it("deletes a list and reads the empty answer as done", async () => {
    apiClient.mockResolvedValue({});
    expect(await deleteCallListAction("list-1")).toEqual({ data: true, error: null });
    expect(apiClient).toHaveBeenCalledWith("/call-lists/list-1", { method: "DELETE" });
  });

  it("pages the items of a tab from the position cursor", async () => {
    apiClient.mockResolvedValue({ data: { items: [item], next: 50 } });
    const answer = await listCallListItemsAction("list-1", { state: "closed", cursor: { after: 25 }, limit: 25 });
    expect(apiClient.mock.calls[0][0]).toBe("/call-lists/list-1/items?state=closed&limit=25&after=25");
    expect(answer.data).toEqual({ items: [item], next: { after: 50 } });
  });

  it("asks for the first pending page with its state and size only", async () => {
    apiClient.mockResolvedValue({ data: { items: [item] } });
    await listCallListItemsAction("list-1", { state: "pending", limit: 50 });
    expect(apiClient.mock.calls[0][0]).toBe("/call-lists/list-1/items?state=pending&limit=50");
  });

  it("sends back the whole cursor the server gave for the next page of the agenda", async () => {
    const asOf = "2026-10-08T12:00:00Z";
    apiClient.mockResolvedValue({ data: { items: [item], next: 9, nextAt: "2026-10-08T11:00:00Z", asOf } });
    const answer = await listCallListItemsAction("list-1", { state: "pending", limit: 50, cursor: { after: 7, afterAt: "2026-10-08T10:00:00Z", asOf } });
    const url = new URL(apiClient.mock.calls[0][0], "http://x");
    expect(url.pathname).toBe("/call-lists/list-1/items");
    expect(Object.fromEntries(url.searchParams)).toEqual({ state: "pending", limit: "50", after: "7", afterAt: "2026-10-08T10:00:00Z", asOf });
    expect(answer.data?.next).toEqual({ after: 9, afterAt: "2026-10-08T11:00:00Z", asOf });
  });

  it("claims the next item and works the claimed one", async () => {
    apiClient.mockResolvedValue({ data: { list, trunks: [], refused: 0, more: false } });
    await nextCallListItemAction("list-1");
    expect(apiClient).toHaveBeenLastCalledWith("/call-lists/list-1/next", { method: "POST" });

    apiClient.mockResolvedValue({ data: item });
    await releaseCallListItemAction("item 1");
    expect(apiClient).toHaveBeenLastCalledWith("/call-list-items/item%201/release", { method: "POST" });

    await closeCallListItemAction("item 1", { disposition: "_callback", note: "Depois das 18h", callbackAt: "2026-10-09T21:00:00.000Z" });
    expect(apiClient).toHaveBeenLastCalledWith("/call-list-items/item%201/close", {
      method: "POST",
      body: JSON.stringify({ disposition: "_callback", note: "Depois das 18h", callbackAt: "2026-10-09T21:00:00.000Z" }),
    });
  });

  it("keeps the server's refusal code and status", async () => {
    apiClient.mockResolvedValue({ error: { message: "nope", status: 409, code: "call_list_not_active" } });
    expect(await nextCallListItemAction("list-1")).toEqual({
      data: null,
      error: { message: "nope", status: 409, code: "call_list_not_active" },
    });
  });

  it("refuses an answer it cannot read", async () => {
    apiClient.mockResolvedValue({ data: { items: "nope" } });
    const answer = await listCallListItemsAction("list-1", {});
    expect(answer.data).toBeNull();
    expect(answer.error).toMatchObject({ message: expect.any(String) });
  });
});
