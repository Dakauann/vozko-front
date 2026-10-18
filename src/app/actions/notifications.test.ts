import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.fn();
vi.mock("@/lib/api/browser-client", () => ({ apiClient: (...args: unknown[]) => apiClient(...args) }));

import {
  getNotificationPreferencesAction,
  getNotificationSummaryAction,
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationsReadAction,
  markNotificationsUnreadAction,
  saveNotificationPreferencesAction,
} from "./notifications";
import {
  createNotificationBroadcastAction,
  listBroadcastRecipientsAction,
  listNotificationBroadcastsAction,
  previewNotificationBroadcastAction,
  uploadNotificationImageAction,
} from "./admin-notifications";

const item = {
  id: "n1",
  category: "billing",
  severity: "critical",
  title: "Saldo baixo",
  body: "Recarregue.",
  createdAt: "2026-10-16T12:00:00Z",
};

const broadcast = {
  id: "b1",
  target: { all: true },
  audience: { kind: "everyone" },
  category: "announcements",
  severity: "info",
  title: "Oi",
  body: "",
  email: false,
  status: "queued",
  workspaceCount: 0,
  createdAt: "2026-10-16T12:00:00Z",
};

describe("notification inbox actions", () => {
  beforeEach(() => apiClient.mockReset());

  it("lists with the filter, cursor and limit in the query", async () => {
    apiClient.mockResolvedValue({ data: { items: [item], next: "c2" } });
    const controller = new AbortController();

    const answer = await listNotificationsAction({ category: "billing", unread: true, cursor: "c1", limit: 20 }, controller.signal);

    expect(apiClient).toHaveBeenCalledWith("/notifications?category=billing&unread=true&cursor=c1&limit=20", {
      method: "GET",
      signal: controller.signal,
    });
    expect(answer).toEqual({ data: { items: [item], next: "c2" } });
  });

  it("leaves the open filter out of the query and fills a missing cursor", async () => {
    apiClient.mockResolvedValue({ data: { items: [] } });

    const answer = await listNotificationsAction({ limit: 20 });

    expect(apiClient).toHaveBeenCalledWith("/notifications?limit=20", { method: "GET", signal: undefined });
    expect(answer).toEqual({ data: { items: [], next: "" } });
  });

  it("refuses an answer that is not a page", async () => {
    apiClient.mockResolvedValue({ data: { items: [{ id: "n1" }] } });

    expect(await listNotificationsAction({})).toEqual({ error: "Unexpected notification page answer" });
  });

  it("passes the coded refusal through", async () => {
    apiClient.mockResolvedValue({ error: { message: "bad cursor", status: 400, code: "notification_cursor_invalid" } });

    expect(await listNotificationsAction({ cursor: "x" })).toEqual({
      error: "bad cursor",
      status: 400,
      code: "notification_cursor_invalid",
      expected: undefined,
    });
  });

  it("reads the summary", async () => {
    apiClient.mockResolvedValue({ data: { unread: 4, byCategory: { billing: 4 }, capped: false } });

    expect(await getNotificationSummaryAction()).toEqual({ data: { unread: 4, byCategory: { billing: 4 }, capped: false } });
    expect(apiClient).toHaveBeenCalledWith("/notifications/summary", { method: "GET", signal: undefined });
  });

  it("marks read and unread by ids", async () => {
    apiClient.mockResolvedValue({ data: { updated: 2 } });

    expect(await markNotificationsReadAction(["a", "b"])).toEqual({ data: { updated: 2 } });
    expect(apiClient).toHaveBeenLastCalledWith("/notifications/read", { method: "POST", body: JSON.stringify({ ids: ["a", "b"] }) });

    await markNotificationsUnreadAction(["a"]);
    expect(apiClient).toHaveBeenLastCalledWith("/notifications/unread", { method: "POST", body: JSON.stringify({ ids: ["a"] }) });
  });

  it("marks all read, scoped to a category when one is given", async () => {
    apiClient.mockResolvedValue({ data: { updated: 9 } });

    await markAllNotificationsReadAction("billing");
    expect(apiClient).toHaveBeenLastCalledWith("/notifications/read-all", { method: "POST", body: JSON.stringify({ category: "billing" }) });

    await markAllNotificationsReadAction(null);
    expect(apiClient).toHaveBeenLastCalledWith("/notifications/read-all", { method: "POST", body: "{}" });
  });

  it("reads and saves the email preferences with the digest choice", async () => {
    const preferences = { categories: ["billing", "team"], emailMuted: ["team"], emailDigest: true };
    apiClient.mockResolvedValue({ data: preferences });

    expect(await getNotificationPreferencesAction()).toEqual({ data: preferences });
    expect(apiClient).toHaveBeenLastCalledWith("/notifications/preferences", { method: "GET", signal: undefined });

    expect(await saveNotificationPreferencesAction({ emailMuted: ["team"], emailDigest: true })).toEqual({ data: preferences });
    expect(apiClient).toHaveBeenLastCalledWith("/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify({ emailMuted: ["team"], emailDigest: true }),
    });
  });
});

describe("notification admin actions", () => {
  const reachRequest = {
    target: { all: false, workspaceIds: ["w1", "w2"] },
    audience: { kind: "managers" as const },
    category: "billing" as const,
    severity: "warning" as const,
    title: "Oi",
    body: "",
    email: true,
  };

  beforeEach(() => apiClient.mockReset());

  it("uploads the image as the multipart file field", async () => {
    apiClient.mockResolvedValue({ data: { url: "https://cdn/n.png" } });
    const file = new File(["x"], "n.png", { type: "image/png" });

    const answer = await uploadNotificationImageAction(file);

    const [path, init] = apiClient.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/admin/notifications/images");
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("file")).toBe(file);
    expect(answer).toEqual({ data: { url: "https://cdn/n.png" } });
  });

  it("refuses an upload answer without a url", async () => {
    apiClient.mockResolvedValue({ data: {} });

    expect(await uploadNotificationImageAction(new File(["x"], "n.png", { type: "image/png" }))).toEqual({
      error: "Unexpected notification image answer",
    });
  });

  it("creates a broadcast from the request body", async () => {
    apiClient.mockResolvedValue({ data: broadcast });
    const request = {
      target: { all: true, workspaceIds: [] },
      audience: { kind: "everyone" as const },
      category: "announcements" as const,
      severity: "info" as const,
      title: "Oi",
      body: "",
      email: false,
    };

    expect(await createNotificationBroadcastAction(request)).toEqual({ data: broadcast });
    expect(apiClient).toHaveBeenCalledWith("/admin/notifications/broadcasts", { method: "POST", body: JSON.stringify(request) });
  });

  it("pages the broadcasts by cursor", async () => {
    apiClient.mockResolvedValue({ data: { items: [broadcast], next: "" } });

    expect(await listNotificationBroadcastsAction({ cursor: "c1", limit: 20 })).toEqual({ data: { items: [broadcast], next: "" } });
    expect(apiClient).toHaveBeenCalledWith("/admin/notifications/broadcasts?cursor=c1&limit=20", { method: "GET", signal: undefined });
  });

  it("previews the reach with the same body as create and can be cancelled", async () => {
    const reach = { workspaces: 2, recipients: 30, people: 28, emails: 20 };
    apiClient.mockResolvedValue({ data: reach });
    const controller = new AbortController();

    expect(await previewNotificationBroadcastAction(reachRequest, controller.signal)).toEqual({ data: reach });
    expect(apiClient).toHaveBeenCalledWith("/admin/notifications/broadcasts/preview", {
      method: "POST",
      body: JSON.stringify(reachRequest),
      signal: controller.signal,
    });
  });

  it("refuses a reach answer without the email count", async () => {
    apiClient.mockResolvedValue({ data: { workspaces: 2, recipients: 30, people: 28 } });

    expect(await previewNotificationBroadcastAction(reachRequest)).toEqual({ error: "Unexpected notification broadcast reach answer" });
  });

  it("pages who received a broadcast by status and cursor", async () => {
    const recipient = { userId: "u1", name: "Ana", email: "ana@example.com", workspaceId: "w1", workspaceName: "Loja", readAt: "2026-10-16T13:00:00Z" };
    apiClient.mockResolvedValue({ data: { items: [recipient] } });
    const controller = new AbortController();

    const answer = await listBroadcastRecipientsAction("b 1", { status: "read", cursor: "c1", limit: 30 }, controller.signal);

    expect(apiClient).toHaveBeenCalledWith("/admin/notifications/broadcasts/b%201/recipients?status=read&cursor=c1&limit=30", {
      method: "GET",
      signal: controller.signal,
    });
    expect(answer).toEqual({ data: { items: [recipient], next: "" } });
  });

  it("asks for every recipient without a cursor on the first page", async () => {
    apiClient.mockResolvedValue({ data: { items: [], next: "" } });

    await listBroadcastRecipientsAction("b1", { status: "all" });

    expect(apiClient).toHaveBeenCalledWith("/admin/notifications/broadcasts/b1/recipients?status=all", { method: "GET", signal: undefined });
  });
});
