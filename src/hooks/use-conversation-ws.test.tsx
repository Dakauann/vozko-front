
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { hasUserDataCookie, playFn, getLeadByIdAction } = vi.hoisted(() => ({
  hasUserDataCookie: vi.fn(() => true),
  playFn: vi.fn(),
  getLeadByIdAction: vi.fn(),
}));

let mockWorkspace: { id: string } | null = { id: "ws-1" };
let mockDepartment: { id: string } | null = null;
let mockPermissions = new Set<string>();

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    currentWorkspace: mockWorkspace,
    can: (resource: string, action: string) => mockPermissions.has(`${resource}:${action}`),
  }),
}));
vi.mock("@/app/actions/leads", () => ({ getLeadByIdAction }));
vi.mock("@/contexts/department-context", () => ({
  useDepartment: () => ({ currentDepartment: mockDepartment }),
}));
vi.mock("@/lib/auth/client-cookies", () => ({ hasUserDataCookie }));
vi.mock("@/lib/sounds/sound-player", () => ({ soundPlayer: { play: playFn } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next-intl", async () => (await import("@/test/next-intl-pt")).nextIntlInPortuguese());

import { toast } from "sonner";
import ptMessages from "@/i18n/messages/pt.json";
import { useConversationWs } from "@/hooks/use-conversation-ws";

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  url: string;
  readyState = FakeWebSocket.CONNECTING;
  onopen: ((e?: unknown) => void) | null = null;
  onclose: ((e?: unknown) => void) | null = null;
  onerror: ((e?: unknown) => void) | null = null;
  onmessage: ((e?: unknown) => void) | null = null;
  sent: string[] = [];
  closed = false;
  private listeners: Record<string, Array<(e?: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, cb: (e?: unknown) => void) {
    (this.listeners[type] ??= []).push(cb);
  }
  removeEventListener() {}
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({});
    for (const cb of this.listeners["close"] ?? []) cb({});
  }
  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({});
  }
  simulateMessage(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

async function flushConnect() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
}

const baseProps: Parameters<typeof useConversationWs>[0] = {
  token: "session-token",
  enabled: true,
};

describe("useConversationWs socket lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeWebSocket.instances = [];
    mockWorkspace = { id: "ws-1" };
    mockDepartment = null;
    hasUserDataCookie.mockReturnValue(true);
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens exactly one socket on mount", async () => {
    renderHook((props) => useConversationWs(props), { initialProps: baseProps });
    await flushConnect();

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("does NOT reconnect on re-render with unchanged scope (the storm regression)", async () => {
    const { rerender } = renderHook((props) => useConversationWs(props), {
      initialProps: baseProps,
    });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(1);

    for (let i = 0; i < 5; i++) {
      rerender({ ...baseProps });
    }
    await flushConnect();

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("does NOT reconnect when only campaignId/campaignType change", async () => {
    const { rerender } = renderHook((props) => useConversationWs(props), {
      initialProps: baseProps,
    });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(1);

    rerender({ ...baseProps, campaignId: "camp-1", campaignType: "whatsapp" });
    rerender({ ...baseProps, campaignId: "camp-2", campaignType: "unofficial_whatsapp" });
    await flushConnect();

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("reconnects when the workspace scope actually changes", async () => {
    const { rerender } = renderHook((props) => useConversationWs(props), {
      initialProps: baseProps,
    });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(1);

    mockWorkspace = { id: "ws-2" };
    rerender({ ...baseProps });
    await flushConnect();

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.instances[0].closed).toBe(true);
  });

  it("does not connect while disabled, then connects once when enabled", async () => {
    const { rerender } = renderHook((props) => useConversationWs(props), {
      initialProps: { token: "session-token", enabled: false },
    });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(0);

    rerender({ token: "session-token", enabled: true });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("closes the socket on unmount", async () => {
    const { unmount } = renderHook((props) => useConversationWs(props), {
      initialProps: baseProps,
    });
    await flushConnect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();

    unmount();

    expect(socket.closed).toBe(true);
  });
});

describe("useConversationWs entry defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeWebSocket.instances = [];
    mockWorkspace = { id: "ws-1" };
    mockDepartment = null;
    hasUserDataCookie.mockReturnValue(true);
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const sparseEntry = {
    entry_id: "e-1",
    entry_type: "whatsapp",
    unread_count: 0,
    last_message_at: "2026-01-01T00:00:00Z",
    window_open: true,
    automation_enabled: true,
    blocked: false,
    ai_handler: { kind: "agent", agent_id: "a-1", agent_active: true },
  };

  async function openSocket() {
    const hook = renderHook((props) => useConversationWs(props), {
      initialProps: baseProps,
    });
    await flushConnect();
    const socket = FakeWebSocket.instances[0];
    await act(async () => {
      socket.simulateOpen();
    });
    return { hook, socket };
  }

  it("fills the omitted strings on inbox entries", async () => {
    const { hook, socket } = await openSocket();

    await act(async () => {
      socket.simulateMessage({
        type: "conversation:inbox",
        payload: { entries: [sparseEntry], page: 1, total_pages: 1, total_items: 1 },
      });
    });

    const entry = hook.result.current.inbox[0];
    expect(entry.lead_name).toBe("");
    expect(entry.lead_number).toBe("");
    expect(entry.last_message_preview).toBe("");
    expect(() =>
      [entry].filter((e) => e.lead_number.toLowerCase().includes("a")),
    ).not.toThrow();
  });

  it("fills the omitted strings on search results without dropping unknown fields", async () => {
    const { hook, socket } = await openSocket();

    await act(async () => {
      socket.simulateMessage({
        type: "conversation:search_results",
        payload: { entries: [sparseEntry], page: 1, total_pages: 1, total_items: 1 },
      });
    });

    const entry = hook.result.current.searchResults?.[0];
    expect(entry?.lead_number).toBe("");
    expect(entry?.ai_handler).toEqual(sparseEntry.ai_handler);
  });

  it("drops a conversation the user just lost everywhere, including the open pane", async () => {
    const { hook, socket } = await openSocket();
    await act(async () => {
      socket.simulateMessage({ type: "conversation:inbox", payload: { entries: [sparseEntry], page: 1, total_pages: 1, total_items: 1 } });
      socket.simulateMessage({ type: "conversation:search_results", payload: { entries: [sparseEntry], page: 1, total_pages: 1, total_items: 1 } });
    });
    await act(async () => {
      hook.result.current.subscribe("e-1", "whatsapp");
      socket.simulateMessage({
        type: "conversation:subscribed",
        payload: { entry_id: "e-1", entry_type: "whatsapp", messages: [], has_more: false, unread_count: 0, window_open: true, window_expires_at: null },
      });
    });
    expect(hook.result.current.activeConversation?.entry_id).toBe("e-1");

    await act(async () => {
      socket.simulateMessage({ type: "conversation:entry_removed", payload: { entry_id: "e-1", entry_type: "whatsapp", reason: "assigned" } });
    });

    expect(hook.result.current.inbox).toHaveLength(0);
    expect(hook.result.current.searchResults).toHaveLength(0);
    expect(hook.result.current.activeConversation).toBeNull();
  });

  it("keeps the live read a silent entry update carries, without the sound", async () => {
    const { hook, socket } = await openSocket();
    await act(async () => {
      socket.simulateMessage({ type: "conversation:inbox", payload: { entries: [sparseEntry], page: 1, total_pages: 1, total_items: 1 } });
    });
    const read = { qualification: "cold_lead", attendanceQuality: 36, decidedAt: "2026-09-28T12:00:00Z" };

    await act(async () => {
      socket.simulateMessage({ type: "conversation:entry_update", payload: { entry: { ...sparseEntry, live_read: read }, silent: true } });
    });

    expect(hook.result.current.inbox[0].live_read).toEqual(read);
    expect(playFn).not.toHaveBeenCalled();
  });

  it("chimes once for a new message and stays quiet while muted", async () => {
    const { socket } = await openSocket();
    await act(async () => {
      socket.simulateMessage({ type: "conversation:inbox", payload: { entries: [sparseEntry], page: 1, total_pages: 1, total_items: 1 } });
    });
    playFn.mockClear();

    await act(async () => {
      socket.simulateMessage({ type: "conversation:entry_update", payload: { entry: { ...sparseEntry } } });
    });
    expect(playFn).toHaveBeenCalledWith("message");

    playFn.mockClear();
    window.localStorage.setItem("crm_sound_muted", "true");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_100));
      socket.simulateMessage({ type: "conversation:entry_update", payload: { entry: { ...sparseEntry } } });
    });
    window.localStorage.removeItem("crm_sound_muted");
    expect(playFn).not.toHaveBeenCalled();
  });
});

describe("useConversationWs lead updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeWebSocket.instances = [];
    mockWorkspace = { id: "ws-1" };
    mockDepartment = null;
    mockPermissions = new Set(["leads:read"]);
    hasUserDataCookie.mockReturnValue(true);
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const conversationOf = (entryId: string, entryType: string, leadId: string) => ({
    entry_id: entryId,
    entry_type: entryType,
    lead_id: leadId,
    lead_version: 3,
    lead_name: "Ana",
    lead_number: "5511999990000",
    unread_count: 0,
    last_message_at: "2026-01-01T00:00:00Z",
    window_open: true,
    blocked: false,
  });

  const fetched = {
    id: "lead-1",
    workspaceId: "ws-1",
    number: "5511999990000",
    name: "Ana Paula",
    blocked: true,
    relativesCount: 0,
    referredCount: 0,
    version: 4,
  };

  async function openInbox() {
    const hook = renderHook((props) => useConversationWs(props), { initialProps: baseProps });
    await flushConnect();
    const socket = FakeWebSocket.instances[0];
    await act(async () => {
      socket.simulateOpen();
      socket.simulateMessage({
        type: "conversation:inbox",
        payload: {
          entries: [
            conversationOf("e-1", "whatsapp", "lead-1"),
            conversationOf("e-2", "instagram", "lead-1"),
            conversationOf("e-3", "whatsapp", "lead-2"),
          ],
          page: 1,
          total_pages: 1,
          total_items: 3,
        },
      });
    });
    return { hook, socket };
  }

  async function leadUpdate(socket: FakeWebSocket, payload: Record<string, unknown>) {
    await act(async () => {
      socket.simulateMessage({ type: "conversation:lead_update", payload });
      await new Promise((r) => setTimeout(r, 0));
    });
  }

  const sentOfType = (socket: FakeWebSocket, type: string) =>
    socket.sent.map((raw) => JSON.parse(raw) as { type: string; payload: unknown }).filter((m) => m.type === type);

  it("refetches a shown lead and patches every conversation of it, never with the event's values", async () => {
    getLeadByIdAction.mockResolvedValue({ lead: fetched, error: null });
    const { hook, socket } = await openInbox();

    await leadUpdate(socket, { leadId: "lead-1", version: 4, fields: ["name", "blocked"], name: "Injected" });

    expect(getLeadByIdAction).toHaveBeenCalledTimes(1);
    expect(getLeadByIdAction).toHaveBeenCalledWith("lead-1");
    const [first, second, other] = hook.result.current.inbox;
    expect([first.lead_name, second.lead_name]).toEqual(["Ana Paula", "Ana Paula"]);
    expect([first.blocked, first.lead_version]).toEqual([true, 4]);
    expect(other.lead_name).toBe("Ana");
  });

  it("tells every lead update subscriber about a well formed event, on screen or not, until it leaves", async () => {
    const { hook, socket } = await openInbox();
    const listener = vi.fn();
    let leave = () => {};
    act(() => {
      leave = hook.result.current.subscribeLeadUpdates(listener);
    });

    await leadUpdate(socket, { leadId: "lead-9", version: 2, fields: ["anonymized"] });
    await leadUpdate(socket, { leadId: "lead-9", version: 3 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ leadId: "lead-9", version: 2, fields: ["anonymized"] });

    act(() => leave());
    await leadUpdate(socket, { leadId: "lead-9", version: 4, fields: ["name"] });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("tells every bulk update subscriber about a run that changed leads, until it leaves", async () => {
    const { hook, socket } = await openInbox();
    const listener = vi.fn();
    let leave = () => {};
    act(() => {
      leave = hook.result.current.subscribeLeadsBulkUpdates(listener);
    });

    const bulkUpdate = async (payload: Record<string, unknown>) => {
      await act(async () => {
        socket.simulateMessage({ type: "conversation:leads_bulk_update", payload });
        await new Promise((r) => setTimeout(r, 0));
      });
    };

    await bulkUpdate({ runId: "run-1" });
    await bulkUpdate({});
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ runId: "run-1" });

    act(() => leave());
    await bulkUpdate({ runId: "run-2" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores a lead that is not on screen and a version already held", async () => {
    const { socket } = await openInbox();

    await leadUpdate(socket, { leadId: "lead-9", version: 2, fields: ["name"] });
    await leadUpdate(socket, { leadId: "lead-1", version: 3, fields: ["name"] });

    expect(getLeadByIdAction).not.toHaveBeenCalled();
  });

  it("advances the version without a fetch when nothing shown changed", async () => {
    getLeadByIdAction.mockResolvedValue({ lead: { ...fetched, version: 5 }, error: null });
    const { hook, socket } = await openInbox();

    await leadUpdate(socket, { leadId: "lead-1", version: 4, fields: ["email", "owner"] });
    expect(getLeadByIdAction).not.toHaveBeenCalled();
    expect(hook.result.current.inbox[0].lead_version).toBe(4);

    await leadUpdate(socket, { leadId: "lead-1", version: 5, fields: ["name"] });
    expect(getLeadByIdAction).toHaveBeenCalledTimes(1);
  });

  it("keeps what is on screen when the refetch fails", async () => {
    getLeadByIdAction.mockResolvedValue({ lead: null, error: { status: 403, code: "forbidden" } });
    const { hook, socket } = await openInbox();

    await leadUpdate(socket, { leadId: "lead-1", version: 4, fields: ["name"] });

    expect(hook.result.current.inbox[0]).toMatchObject({ lead_name: "Ana", lead_version: 3 });
  });

  it("re-reads the open conversation for a member without leads:read", async () => {
    mockPermissions = new Set();
    const { hook, socket } = await openInbox();
    await act(async () => {
      hook.result.current.subscribe("e-1", "whatsapp");
      socket.simulateMessage({
        type: "conversation:subscribed",
        payload: { entry_id: "e-1", entry_type: "whatsapp", lead_id: "lead-1", lead_version: 3, lead_name: "Ana", lead_number: "5511999990000", unread_count: 0, window_open: true },
      });
    });
    socket.sent = [];

    await leadUpdate(socket, { leadId: "lead-1", version: 4, fields: ["name"] });

    expect(getLeadByIdAction).not.toHaveBeenCalled();
    expect(sentOfType(socket, "subscribe")).toEqual([
      { type: "subscribe", payload: { entry_id: "e-1", entry_type: "whatsapp" } },
    ]);

    await act(async () => {
      socket.simulateMessage({
        type: "conversation:subscribed",
        payload: { entry_id: "e-1", entry_type: "whatsapp", lead_id: "lead-1", lead_version: 4, lead_name: "Ana Paula", lead_number: "5511999990000", unread_count: 0, window_open: true },
      });
    });

    expect(hook.result.current.activeConversation).toMatchObject({ lead_name: "Ana Paula", lead_version: 4 });
    expect(hook.result.current.inbox.map((e) => e.lead_name)).toEqual(["Ana Paula", "Ana", "Ana"]);
  });

  const subscribedAnswer = (overrides: Record<string, unknown>) => ({
    type: "conversation:subscribed",
    payload: { entry_id: "e-1", entry_type: "whatsapp", lead_id: "lead-1", lead_version: 3, lead_name: "Ana", lead_number: "5511999990000", unread_count: 0, window_open: true, ...overrides },
  });

  async function openConversationWithHistory(hook: { result: { current: ReturnType<typeof useConversationWs> } }, socket: FakeWebSocket) {
    await act(async () => {
      hook.result.current.subscribe("e-1", "whatsapp");
      socket.simulateMessage(subscribedAnswer({}));
      socket.simulateMessage({
        type: "conversation:history",
        payload: {
          entry_id: "e-1",
          entry_type: "whatsapp",
          messages: [{ id: "m-1", entry_id: "e-1", entry_type: "whatsapp", content: "oi", created_at: "2026-01-01T00:00:00Z" }],
          has_more: false,
        },
      });
    });
  }

  it("does not stamp a version the re-read cannot vouch for, so the block change is not lost", async () => {
    mockPermissions = new Set();
    const { hook, socket } = await openInbox();
    await openConversationWithHistory(hook, socket);
    socket.sent = [];

    await leadUpdate(socket, { leadId: "lead-1", version: 4, fields: ["blocked"] });
    expect(sentOfType(socket, "subscribe")).toHaveLength(1);
    await act(async () => {
      socket.simulateMessage(subscribedAnswer({ lead_version: 4 }));
    });

    expect(hook.result.current.inbox[0].lead_version).toBe(3);
    expect(hook.result.current.activeConversation?.lead_version).toBe(3);

    await leadUpdate(socket, { leadId: "lead-1", version: 4, fields: ["blocked"] });
    expect(sentOfType(socket, "subscribe")).toHaveLength(2);
  });

  it("vouches every answer when two re-reads overlap, not only the first", async () => {
    mockPermissions = new Set();
    const { hook, socket } = await openInbox();
    await openConversationWithHistory(hook, socket);
    socket.sent = [];

    await leadUpdate(socket, { leadId: "lead-1", version: 4, fields: ["blocked"] });
    await leadUpdate(socket, { leadId: "lead-1", version: 5, fields: ["optedOut"] });
    expect(sentOfType(socket, "subscribe")).toHaveLength(2);

    await act(async () => {
      socket.simulateMessage(subscribedAnswer({ lead_version: 5 }));
    });
    await act(async () => {
      socket.simulateMessage(subscribedAnswer({ lead_version: 5 }));
    });

    expect(hook.result.current.activeConversation?.lead_version).toBe(3);
    expect(hook.result.current.inbox[0].lead_version).toBe(3);
  });

  it("does not let a plain subscribe already in flight settle a re-read", async () => {
    mockPermissions = new Set();
    const { hook, socket } = await openInbox();
    await openConversationWithHistory(hook, socket);
    await act(async () => {
      hook.result.current.subscribe("e-1", "whatsapp");
    });

    await leadUpdate(socket, { leadId: "lead-1", version: 4, fields: ["blocked"] });
    await act(async () => {
      socket.simulateMessage(subscribedAnswer({ lead_version: 4 }));
    });
    await act(async () => {
      socket.simulateMessage(subscribedAnswer({ lead_version: 4 }));
    });

    expect(hook.result.current.activeConversation?.lead_version).toBe(3);
    expect(hook.result.current.inbox[0].lead_version).toBe(3);
  });

  it("keeps waiting for the block state across a reconnect", async () => {
    mockPermissions = new Set();
    const { hook, socket } = await openInbox();
    await openConversationWithHistory(hook, socket);

    await leadUpdate(socket, { leadId: "lead-1", version: 4, fields: ["blocked"] });
    await act(async () => {
      socket.close();
      await new Promise((r) => setTimeout(r, 1100));
    });
    const reconnected = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    expect(reconnected).not.toBe(socket);
    await act(async () => {
      reconnected.simulateOpen();
    });
    expect(sentOfType(reconnected, "subscribe")).toHaveLength(1);

    await act(async () => {
      reconnected.simulateMessage(subscribedAnswer({ lead_version: 4 }));
    });

    expect(hook.result.current.activeConversation?.lead_version).toBe(3);
  });

  it("applies a block change the answer carries, to that conversation only", async () => {
    mockPermissions = new Set();
    const { hook, socket } = await openInbox();
    await openConversationWithHistory(hook, socket);

    await leadUpdate(socket, { leadId: "lead-1", version: 4, fields: ["blocked"] });
    await act(async () => {
      socket.simulateMessage(subscribedAnswer({ lead_version: 4, blocked: true }));
    });

    expect(hook.result.current.activeConversation).toMatchObject({ blocked: true, lead_version: 4 });
    expect(hook.result.current.inbox[0]).toMatchObject({ blocked: true, lead_version: 4 });
    expect(hook.result.current.inbox[1]).toMatchObject({ blocked: false, lead_version: 3 });
  });

  it("keeps a newer lead on the open conversation when an older subscribed answer arrives late", async () => {
    const { hook, socket } = await openInbox();
    await openConversationWithHistory(hook, socket);

    await act(async () => {
      hook.result.current.applyLeadPatch("lead-1", { lead_name: "Bia", lead_version: 5 });
    });
    await act(async () => {
      socket.simulateMessage(subscribedAnswer({ lead_version: 4, lead_name: "Ana Paula" }));
    });

    expect(hook.result.current.activeConversation).toMatchObject({ lead_name: "Bia", lead_version: 5 });
    expect(hook.result.current.inbox[0]).toMatchObject({ lead_name: "Bia", lead_version: 5 });
  });

  it("keeps the lead version an entry update carries", async () => {
    const { hook, socket } = await openInbox();

    await act(async () => {
      socket.simulateMessage({
        type: "conversation:entry_update",
        payload: { entry: { ...conversationOf("e-1", "whatsapp", "lead-1"), lead_version: 7 }, silent: true },
      });
    });

    const entry = hook.result.current.inbox.find((e) => e.entry_id === "e-1");
    expect(entry?.lead_version).toBe(7);
  });

  it("applies a saved change with its version and refuses an older one", async () => {
    const { hook } = await openInbox();

    await act(async () => {
      hook.result.current.applyLeadPatch("lead-1", { lead_name: "Bia", lead_version: 4 });
    });
    await act(async () => {
      hook.result.current.applyLeadPatch("lead-1", { lead_name: "Old", lead_version: 3 });
    });

    expect(hook.result.current.inbox.map((e) => e.lead_name)).toEqual(["Bia", "Bia", "Ana"]);
  });
});

describe("useConversationWs template send refusals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeWebSocket.instances = [];
    mockWorkspace = { id: "ws-1" };
    mockDepartment = null;
    hasUserDataCookie.mockReturnValue(true);
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function refuse(payload: Record<string, unknown>) {
    renderHook((props) => useConversationWs(props), { initialProps: baseProps });
    await flushConnect();
    const socket = FakeWebSocket.instances[0];
    await act(async () => {
      socket.simulateOpen();
    });
    await act(async () => {
      socket.simulateMessage({ type: "conversation:error", payload });
    });
  }

  const refusal = { message: "Failed to send template", request_id: "req-1", entry_id: "e-1", entry_type: "whatsapp" };
  const errors = ptMessages.whatsappOutreach.errors;

  it.each([
    ["lead_opted_out", errors.lead_opted_out],
    ["lead_blocked", errors.lead_blocked],
    ["send_outcome_unknown", errors.send_outcome_unknown],
    ["template_send_failed", errors.send_failed],
  ])("shows the reason of a %s refusal", async (code, copy) => {
    await refuse({ ...refusal, code });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(copy);
  });

  it("keeps the status change refusal on its own path", async () => {
    await refuse({ ...refusal, code: "forbidden", status: "finished", previous_status: "ongoing", message: "status refused" });
    expect(toast.error).toHaveBeenCalledWith("status refused");
  });
});
