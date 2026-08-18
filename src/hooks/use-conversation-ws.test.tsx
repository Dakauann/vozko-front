/**
 * @vitest-environment happy-dom
 *
 * Regression coverage for the live-chat socket lifecycle. The bug these guard
 * against: the connection effect used to depend on campaignId/campaignType and
 * on the connect/disconnect callback identities, so a re-render (or a campaign
 * switch, which is meant to ride the same socket via switchView) tore the socket
 * down and reconnected. Every reconnect rebuilds the socket, which is what showed
 * up as a flood of repeated "live-chat" requests in the network panel.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { hasUserDataCookie, playFn } = vi.hoisted(() => ({
  hasUserDataCookie: vi.fn(() => true),
  playFn: vi.fn(),
}));

// Workspace/department are read through context; expose them as mutable module
// state so a test can flip the scope between renders.
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

/** Minimal WebSocket double that records every instance the hook opens. */
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
  /** Test helper: drive the socket to OPEN as a real server would. */
  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({});
  }
  /** Test helper: push one server frame, exactly as the transport delivers it. */
  simulateMessage(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

/** Advance past the 50ms connect timer and let the awaited token resolve. */
async function flushConnect() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
}

// Type as the hook's full options so rerender() can add optional fields like
// campaignId/campaignType without tripping excess-property checks.
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

    // A burst of re-renders with identical connection scope must not touch the
    // socket. If the effect re-ran it would disconnect + open a fresh socket,
    // exactly the repeated "live-chat" requests reported.
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

    // Campaign / filter switching rides the same socket via switchView().
    rerender({ ...baseProps, campaignId: "camp-1", campaignType: "whatsapp" });
    rerender({ ...baseProps, campaignId: "camp-2", campaignType: "voice" });
    await flushConnect();

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("reconnects when the workspace scope actually changes", async () => {
    const { rerender } = renderHook((props) => useConversationWs(props), {
      initialProps: baseProps,
    });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(1);

    // A genuine scope change must still rebuild the socket.
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

/**
 * The server tags lead_name, lead_number and the last_message_* strings
 * `omitempty`, so an unnamed group arrives with those keys absent while
 * InboxEntry declares them as `string`. Inbox and search payloads used to land
 * in state untouched, and the first keystroke in the CRM search — which filters
 * locally until the query is long enough to hit the server — called
 * `entry.lead_number.toLowerCase()` on `undefined` and took the list down.
 */
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

  /** An entry as the wire actually delivers it: every empty string omitted. */
  const sparseEntry = {
    entry_id: "e-1",
    entry_type: "whatsapp",
    unread_count: 0,
    last_message_at: "2026-01-01T00:00:00Z",
    window_open: true,
    automation_enabled: true,
    blocked: false,
    // Carried by the server but named nowhere in normalizeEntry's allowlist —
    // present here to prove the fill preserves what it does not know about.
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
    // The filter the crash lived in, run against the entry that caused it.
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
});
