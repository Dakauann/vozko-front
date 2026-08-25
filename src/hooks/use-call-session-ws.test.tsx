/**
 * @vitest-environment happy-dom
 *
 * Regression coverage for the call session socket lifecycle. The bug this guards
 * against: the connection effect depended on the `token` string, so every
 * /auth/refresh (which rotates the token every few minutes) tore the socket
 * down and reopened it. Each teardown runs the backend session Shutdown, which
 * HANGS UP the agent's live call, and the reconnect opens a fresh session that
 * owns nothing. The agent's frontend was then left showing a call the backend no
 * longer had ("call no longer exists" on end), and they got rung while
 * "busy". The fix keys the effect on a stable hasToken boolean (login/logout),
 * not the token string; auth now rides the httpOnly cookie on the handshake.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { hasUserDataCookie } = vi.hoisted(() => ({
  hasUserDataCookie: vi.fn(() => true),
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
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

import { useCallSessionWs } from "@/hooks/use-call-session-ws";

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
  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({});
  }
}

/** Advance past the 50ms connect timer and let the awaited token resolve. */
async function flushConnect() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 70));
  });
}

const baseProps = { token: "session-token", enabled: true };

describe("useCallSessionWs socket lifecycle", () => {
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
    renderHook((props) => useCallSessionWs(props), { initialProps: baseProps });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("does NOT reconnect when only the token string changes (the /auth/refresh churn that dropped calls)", async () => {
    const { rerender } = renderHook((props) => useCallSessionWs(props), {
      initialProps: baseProps,
    });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(1);

    // Simulate a series of token refreshes. Each MUST ride the existing socket:
    // tearing it down here is exactly what used to hang up the live call.
    rerender({ ...baseProps, token: "refreshed-1" });
    rerender({ ...baseProps, token: "refreshed-2" });
    rerender({ ...baseProps, token: "refreshed-3" });
    await flushConnect();

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].closed).toBe(false);
  });

  it("does NOT reconnect on re-render with unchanged scope", async () => {
    const { rerender } = renderHook((props) => useCallSessionWs(props), {
      initialProps: baseProps,
    });
    await flushConnect();
    for (let i = 0; i < 5; i++) rerender({ ...baseProps });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("reconnects when the workspace scope actually changes", async () => {
    const { rerender } = renderHook((props) => useCallSessionWs(props), {
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

  it("goes from token present to absent -> disconnects (logout)", async () => {
    const { rerender } = renderHook((props) => useCallSessionWs(props), {
      initialProps: baseProps,
    });
    await flushConnect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();

    // Logout clears the token: hasToken flips true -> false, socket closes.
    rerender({ token: "", enabled: true });
    await flushConnect();
    expect(socket.closed).toBe(true);
  });

  it("does not connect while disabled, then connects once when enabled", async () => {
    const { rerender } = renderHook((props) => useCallSessionWs(props), {
      initialProps: { token: "session-token", enabled: false },
    });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(0);

    rerender({ token: "session-token", enabled: true });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
