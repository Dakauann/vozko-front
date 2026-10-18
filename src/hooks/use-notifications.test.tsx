import { QueryClient, QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  listNotificationsAction: vi.fn(),
  getNotificationSummaryAction: vi.fn(),
  markNotificationsReadAction: vi.fn(),
  markNotificationsUnreadAction: vi.fn(),
  markAllNotificationsReadAction: vi.fn(),
  getNotificationPreferencesAction: vi.fn(),
  saveNotificationPreferencesAction: vi.fn(),
}));

const adminActions = vi.hoisted(() => ({
  listNotificationBroadcastsAction: vi.fn(),
  createNotificationBroadcastAction: vi.fn(),
  uploadNotificationImageAction: vi.fn(),
  previewNotificationBroadcastAction: vi.fn(),
  listBroadcastRecipientsAction: vi.fn(),
}));

vi.mock("@/app/actions/notifications", () => actions);
vi.mock("@/app/actions/admin-notifications", () => adminActions);
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }) }));

import { emitNotificationCreated } from "@/lib/notifications/bus";
import type { BroadcastRecipientStatus, BroadcastRequest } from "@/lib/notifications/broadcast";
import type { NotificationItem, NotificationPage, NotificationSummary } from "@/lib/notifications/types";

import {
  notificationKeys,
  useBroadcastArrival,
  useBroadcastReach,
  useBroadcastRecipients,
  useNotificationActions,
  useNotificationBroadcasts,
  useNotificationList,
  useNotificationRealtime,
  useNotificationSummary,
} from "./use-notifications";

function notification(id: string, category: NotificationItem["category"], readAt?: string): NotificationItem {
  return { id, category, severity: "info", title: id, body: "", createdAt: "2026-10-16T12:00:00Z", ...(readAt ? { readAt } : {}) };
}

function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

function seed(client: QueryClient, items: NotificationItem[], summary: NotificationSummary) {
  const all = { category: "all" as const, unreadOnly: false };
  const billing = { category: "billing" as const, unreadOnly: false };
  client.setQueryData<InfiniteData<NotificationPage, string>>(notificationKeys.list("ws-1", all), { pages: [{ items, next: "" }], pageParams: [""] });
  client.setQueryData<InfiniteData<NotificationPage, string>>(notificationKeys.list("ws-1", billing), {
    pages: [{ items: items.filter((item) => item.category === "billing"), next: "" }],
    pageParams: [""],
  });
  client.setQueryData(notificationKeys.summary("ws-1"), summary);
  return { all, billing };
}

function idsIn(client: QueryClient, key: readonly unknown[]): string[] {
  const data = client.getQueryData<InfiniteData<NotificationPage, string>>(key);
  return (data?.pages ?? []).flatMap((page) => page.items.map((item) => item.id));
}

function itemIn(client: QueryClient, key: readonly unknown[], id: string): NotificationItem | undefined {
  const data = client.getQueryData<InfiniteData<NotificationPage, string>>(key);
  return data?.pages.flatMap((page) => page.items).find((item) => item.id === id);
}

describe("notification queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the summary of the current workspace", async () => {
    actions.getNotificationSummaryAction.mockResolvedValue({ data: { unread: 2, byCategory: { team: 2 }, capped: false } });
    const { wrapper } = harness();

    const { result } = renderHook(() => useNotificationSummary(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ unread: 2, byCategory: { team: 2 }, capped: false }));
  });

  it("pages the list with the filter and the cursor", async () => {
    actions.listNotificationsAction
      .mockResolvedValueOnce({ data: { items: [notification("a", "billing")], next: "c2" } })
      .mockResolvedValueOnce({ data: { items: [notification("b", "billing")], next: "" } });
    const { wrapper } = harness();

    const { result } = renderHook(() => useNotificationList({ category: "billing", unreadOnly: true }, true), { wrapper });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(actions.listNotificationsAction).toHaveBeenNthCalledWith(1, { category: "billing", unread: true, cursor: undefined, limit: 20 }, expect.any(AbortSignal));
    expect(actions.listNotificationsAction).toHaveBeenNthCalledWith(2, { category: "billing", unread: true, cursor: "c2", limit: 20 }, expect.any(AbortSignal));
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("raises a coded section error when the list fails", async () => {
    actions.listNotificationsAction.mockResolvedValue({ error: "bad", status: 400, code: "notification_cursor_invalid" });
    const { wrapper } = harness();

    const { result } = renderHook(() => useNotificationList({ category: "all", unreadOnly: false }, true), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { code?: string }).code).toBe("notification_cursor_invalid");
  });
});

describe("useNotificationRealtime", () => {
  it("prepends an arrival into the lists it matches and counts it", () => {
    const { client, wrapper } = harness();
    const { all, billing } = seed(client, [notification("a", "billing")], { unread: 1, byCategory: { billing: 1 }, capped: false });
    renderHook(() => useNotificationRealtime(), { wrapper });

    act(() => emitNotificationCreated({ workspaceId: "ws-1", item: notification("z", "team") }));

    expect(idsIn(client, notificationKeys.list("ws-1", all))).toEqual(["z", "a"]);
    expect(idsIn(client, notificationKeys.list("ws-1", billing))).toEqual(["a"]);
    expect(client.getQueryData(notificationKeys.summary("ws-1"))).toEqual({ unread: 2, byCategory: { billing: 1, team: 1 }, capped: false });
  });

  it("ignores another workspace", () => {
    const { client, wrapper } = harness();
    const { all } = seed(client, [notification("a", "billing")], { unread: 1, byCategory: { billing: 1 }, capped: false });
    renderHook(() => useNotificationRealtime(), { wrapper });

    act(() => emitNotificationCreated({ workspaceId: "ws-2", item: notification("z", "team") }));

    expect(idsIn(client, notificationKeys.list("ws-1", all))).toEqual(["a"]);
  });
});

describe("useNotificationActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks read at once and keeps it when the server agrees", async () => {
    actions.markNotificationsReadAction.mockResolvedValue({ data: { updated: 1 } });
    const { client, wrapper } = harness();
    const { all } = seed(client, [notification("a", "billing"), notification("b", "team")], { unread: 2, byCategory: { billing: 1, team: 1 }, capped: false });
    const { result } = renderHook(() => useNotificationActions(), { wrapper });

    let failure: unknown;
    await act(async () => {
      failure = await result.current.markRead([notification("a", "billing")]);
    });

    expect(failure).toBeNull();
    expect(actions.markNotificationsReadAction).toHaveBeenCalledWith(["a"]);
    expect(itemIn(client, notificationKeys.list("ws-1", all), "a")?.readAt).toEqual(expect.any(String));
    expect(client.getQueryData(notificationKeys.summary("ws-1"))).toEqual({ unread: 1, byCategory: { billing: 0, team: 1 }, capped: false });
  });

  it("skips the request when nothing is unread", async () => {
    const { client, wrapper } = harness();
    seed(client, [], { unread: 0, byCategory: {}, capped: false });
    const { result } = renderHook(() => useNotificationActions(), { wrapper });

    await act(async () => {
      await result.current.markRead([notification("a", "billing", "2026-10-16T13:00:00Z")]);
    });

    expect(actions.markNotificationsReadAction).not.toHaveBeenCalled();
  });

  it("marks unread and refetches everything when the server refuses", async () => {
    actions.markNotificationsUnreadAction.mockResolvedValue({ error: "nope", code: "notification_ids_invalid" });
    const { client, wrapper } = harness();
    seed(client, [notification("a", "billing", "2026-10-16T13:00:00Z")], { unread: 0, byCategory: {}, capped: false });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useNotificationActions(), { wrapper });

    let failure: unknown;
    await act(async () => {
      failure = await result.current.markUnread([notification("a", "billing", "2026-10-16T13:00:00Z")]);
    });

    expect(failure).toEqual({ error: "nope", code: "notification_ids_invalid" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationKeys.all("ws-1") });
  });

  it("marks all read within the active category", async () => {
    actions.markAllNotificationsReadAction.mockResolvedValue({ data: { updated: 1 } });
    const { client, wrapper } = harness();
    const { all } = seed(client, [notification("a", "billing"), notification("b", "team")], { unread: 2, byCategory: { billing: 1, team: 1 }, capped: false });
    const { result } = renderHook(() => useNotificationActions(), { wrapper });

    await act(async () => {
      await result.current.markAllRead("billing");
    });

    expect(actions.markAllNotificationsReadAction).toHaveBeenCalledWith("billing");
    expect(itemIn(client, notificationKeys.list("ws-1", all), "a")?.readAt).toEqual(expect.any(String));
    expect(itemIn(client, notificationKeys.list("ws-1", all), "b")?.readAt).toBeUndefined();
    expect(client.getQueryData(notificationKeys.summary("ws-1"))).toEqual({ unread: 1, byCategory: { billing: 0, team: 1 }, capped: false });
  });

  it("saves preferences and stores the answer", async () => {
    const saved = { categories: ["billing", "team"], emailMuted: ["team"], emailDigest: true };
    actions.saveNotificationPreferencesAction.mockResolvedValue({ data: saved });
    const { client, wrapper } = harness();
    client.setQueryData(notificationKeys.preferences("ws-1"), { categories: ["billing", "team"], emailMuted: [], emailDigest: false });
    const { result } = renderHook(() => useNotificationActions(), { wrapper });

    await act(async () => {
      await result.current.savePreferences({ emailMuted: ["team"], emailDigest: true });
    });

    expect(actions.saveNotificationPreferencesAction).toHaveBeenCalledWith({ emailMuted: ["team"], emailDigest: true });
    expect(client.getQueryData(notificationKeys.preferences("ws-1"))).toEqual(saved);
  });

  it("shows the new choice before the server answers", async () => {
    let answer: (value: unknown) => void = () => undefined;
    actions.saveNotificationPreferencesAction.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { client, wrapper } = harness();
    client.setQueryData(notificationKeys.preferences("ws-1"), { categories: ["billing"], emailMuted: [], emailDigest: false });
    const { result } = renderHook(() => useNotificationActions(), { wrapper });

    let saving: Promise<unknown> = Promise.resolve();
    act(() => {
      saving = result.current.savePreferences({ emailMuted: [], emailDigest: true });
    });

    expect(client.getQueryData(notificationKeys.preferences("ws-1"))).toEqual({ categories: ["billing"], emailMuted: [], emailDigest: true });
    await act(async () => {
      answer({ data: { categories: ["billing"], emailMuted: [], emailDigest: true } });
      await saving;
    });
  });

  it("puts the old preferences back when saving fails", async () => {
    actions.saveNotificationPreferencesAction.mockResolvedValue({ error: "down" });
    const { client, wrapper } = harness();
    const before = { categories: ["billing", "team"], emailMuted: [], emailDigest: false };
    client.setQueryData(notificationKeys.preferences("ws-1"), before);
    const { result } = renderHook(() => useNotificationActions(), { wrapper });

    await act(async () => {
      await result.current.savePreferences({ emailMuted: ["team"], emailDigest: true });
    });

    expect(client.getQueryData(notificationKeys.preferences("ws-1"))).toEqual(before);
  });
});

describe("broadcast queries", () => {
  const broadcast = (id: string) => ({
    id,
    target: { all: true },
    audience: { kind: "everyone" },
    category: "announcements" as const,
    severity: "info" as const,
    title: id,
    createdAt: "2026-10-16T12:00:00Z",
  });

  beforeEach(() => vi.clearAllMocks());

  it("pages the broadcasts by cursor", async () => {
    adminActions.listNotificationBroadcastsAction.mockResolvedValue({ data: { items: [broadcast("b1")], next: "" } });
    const { wrapper } = harness();

    const { result } = renderHook(() => useNotificationBroadcasts(), { wrapper });

    await waitFor(() => expect(result.current.data?.pages[0].items.map((item) => item.id)).toEqual(["b1"]));
    expect(adminActions.listNotificationBroadcastsAction).toHaveBeenCalledWith({ cursor: undefined, limit: 20 }, expect.any(AbortSignal));
  });

  it("puts a created broadcast on top of the list", async () => {
    adminActions.listNotificationBroadcastsAction.mockResolvedValue({ data: { items: [broadcast("b1")], next: "" } });
    const { wrapper } = harness();
    const { result } = renderHook(() => ({ list: useNotificationBroadcasts(), arrive: useBroadcastArrival() }), { wrapper });
    await waitFor(() => expect(result.current.list.data).toBeDefined());

    act(() => result.current.arrive(broadcast("b2")));

    await waitFor(() => expect(result.current.list.data?.pages[0].items.map((item) => item.id)).toEqual(["b2", "b1"]));
  });
});

describe("broadcast reach", () => {
  const request: BroadcastRequest = {
    target: { all: true, workspaceIds: [] },
    audience: { kind: "everyone" },
    category: "announcements",
    severity: "info",
    title: "Oi",
    body: "",
    email: false,
  };
  const reach = { workspaces: 3, recipients: 40, people: 38, emails: 0 };

  beforeEach(() => {
    vi.clearAllMocks();
    adminActions.previewNotificationBroadcastAction.mockResolvedValue({ data: reach });
  });

  it("asks nothing while the form is incomplete", async () => {
    const { wrapper } = harness();

    const { result } = renderHook(() => useBroadcastReach(null), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(result.current.settling).toBe(false);
    expect(adminActions.previewNotificationBroadcastAction).not.toHaveBeenCalled();
  });

  function renderReach(wrapper: ({ children }: { children: ReactNode }) => ReactNode) {
    return renderHook(({ current }: { current: BroadcastRequest | null }) => useBroadcastReach(current), {
      wrapper,
      initialProps: { current: null as BroadcastRequest | null },
    });
  }

  it("asks once the choices settle, with the body create would send", async () => {
    const { wrapper } = harness();
    const { result, rerender } = renderReach(wrapper);

    rerender({ current: request });

    expect(result.current.settling).toBe(true);
    expect(adminActions.previewNotificationBroadcastAction).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.query.data).toEqual(reach));
    expect(adminActions.previewNotificationBroadcastAction).toHaveBeenCalledTimes(1);
    expect(adminActions.previewNotificationBroadcastAction).toHaveBeenCalledWith(request, expect.any(AbortSignal));
  });

  it("asks only for the last of quick changes and ignores content edits", async () => {
    const { wrapper } = harness();
    const { result, rerender } = renderReach(wrapper);

    rerender({ current: request });
    rerender({ current: { ...request, category: "billing" } });
    rerender({ current: { ...request, category: "billing", email: true } });
    await waitFor(() => expect(result.current.query.data).toEqual(reach));
    rerender({ current: { ...request, category: "billing", email: true, title: "Outro título" } });
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(adminActions.previewNotificationBroadcastAction).toHaveBeenCalledTimes(1);
    expect(adminActions.previewNotificationBroadcastAction).toHaveBeenCalledWith({ ...request, category: "billing", email: true }, expect.any(AbortSignal));
  });
});

describe("broadcast recipients", () => {
  const recipient = (userId: string) => ({ userId, name: userId, email: `${userId}@example.com`, workspaceId: "w1", workspaceName: "Loja" });

  beforeEach(() => vi.clearAllMocks());

  it("pages the recipients of one broadcast by status", async () => {
    adminActions.listBroadcastRecipientsAction.mockResolvedValue({ data: { items: [recipient("u1")], next: "c2" } });
    const { wrapper } = harness();

    const { result } = renderHook(() => useBroadcastRecipients("b1", "unread"), { wrapper });

    await waitFor(() => expect(result.current.data?.pages[0].items.map((item) => item.userId)).toEqual(["u1"]));
    expect(result.current.hasNextPage).toBe(true);
    expect(adminActions.listBroadcastRecipientsAction).toHaveBeenCalledWith("b1", { status: "unread", cursor: undefined, limit: 30 }, expect.any(AbortSignal));
  });

  it("asks again when the status changes and stays idle without a broadcast", async () => {
    adminActions.listBroadcastRecipientsAction.mockResolvedValue({ data: { items: [], next: "" } });
    const { wrapper } = harness();
    const { rerender } = renderHook(({ id, status }: { id: string | null; status: BroadcastRecipientStatus }) => useBroadcastRecipients(id, status), {
      wrapper,
      initialProps: { id: null as string | null, status: "all" as BroadcastRecipientStatus },
    });
    expect(adminActions.listBroadcastRecipientsAction).not.toHaveBeenCalled();

    rerender({ id: "b1", status: "read" });

    await waitFor(() =>
      expect(adminActions.listBroadcastRecipientsAction).toHaveBeenCalledWith("b1", { status: "read", cursor: undefined, limit: 30 }, expect.any(AbortSignal)),
    );
  });
});
