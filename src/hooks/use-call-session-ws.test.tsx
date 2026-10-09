
import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";

function withMessages({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={pt}>
      {children}
    </NextIntlClientProvider>
  );
}

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
import { FakeWebSocket } from "@/test/fake-websocket";


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
    renderHook((props) => useCallSessionWs(props), { initialProps: baseProps, wrapper: withMessages });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("does NOT reconnect when only the token string changes (the /auth/refresh churn that dropped calls)", async () => {
    const { rerender } = renderHook((props) => useCallSessionWs(props), {
      wrapper: withMessages,
      initialProps: baseProps,
    });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(1);

    rerender({ ...baseProps, token: "refreshed-1" });
    rerender({ ...baseProps, token: "refreshed-2" });
    rerender({ ...baseProps, token: "refreshed-3" });
    await flushConnect();

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].closed).toBe(false);
  });

  it("does NOT reconnect on re-render with unchanged scope", async () => {
    const { rerender } = renderHook((props) => useCallSessionWs(props), {
      wrapper: withMessages,
      initialProps: baseProps,
    });
    await flushConnect();
    for (let i = 0; i < 5; i++) rerender({ ...baseProps });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("reconnects when the workspace scope actually changes", async () => {
    const { rerender } = renderHook((props) => useCallSessionWs(props), {
      wrapper: withMessages,
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

  it("forgets the last refusal when the workspace scope changes", async () => {
    const hook = renderHook((props) => useCallSessionWs(props), {
      wrapper: withMessages,
      initialProps: baseProps,
    });
    await flushConnect();
    act(() => hook.result.current.startCall("100", { trunkId: "trunk-1" }));
    expect(hook.result.current.lastErrorCode).toBe("call_service_offline");

    mockWorkspace = { id: "ws-2" };
    hook.rerender({ ...baseProps });
    await flushConnect();

    expect(hook.result.current.lastErrorCode).toBeNull();
    expect(hook.result.current.lastError).toBeNull();
  });

  it("goes from token present to absent -> disconnects (logout)", async () => {
    const { rerender } = renderHook((props) => useCallSessionWs(props), {
      wrapper: withMessages,
      initialProps: baseProps,
    });
    await flushConnect();
    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();

    rerender({ token: "", enabled: true });
    await flushConnect();
    expect(socket.closed).toBe(true);
  });

  it("does not connect while disabled, then connects once when enabled", async () => {
    const { rerender } = renderHook((props) => useCallSessionWs(props), {
      wrapper: withMessages,
      initialProps: { token: "session-token", enabled: false },
    });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(0);

    rerender({ token: "session-token", enabled: true });
    await flushConnect();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
