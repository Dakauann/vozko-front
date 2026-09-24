
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { hasUserDataCookie, playFn } = vi.hoisted(() => ({
  hasUserDataCookie: vi.fn(() => true),
  playFn: vi.fn(),
}));

let mockWorkspace: { id: string } | null = { id: "ws-1" };
let mockDepartment: { id: string } | null = null;

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: mockWorkspace }),
}));
vi.mock("@/contexts/department-context", () => ({
  useDepartment: () => ({ currentDepartment: mockDepartment }),
}));
vi.mock("@/lib/auth/client-cookies", () => ({ hasUserDataCookie }));
vi.mock("use-sound", () => ({ default: () => [playFn] }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

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

  // Losing a conversation (reassigned to someone else, handed back to an agent)
  // takes it off every list and closes it: the server stops sending its
  // messages and would refuse a reply.
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
});
