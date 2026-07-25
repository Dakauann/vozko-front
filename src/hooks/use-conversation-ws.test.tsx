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
