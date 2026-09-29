import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }),
}));
vi.mock("@/contexts/department-context", () => ({
  useDepartment: () => ({ currentDepartment: null }),
}));
vi.mock("@/lib/auth/client-cookies", () => ({ hasUserDataCookie: () => false }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

import { useCallSessionWs } from "@/hooks/use-call-session-ws";
import { FakeWebSocket } from "@/test/fake-websocket";

async function openSocket() {
  const hook = renderHook(() => useCallSessionWs({ token: "user-1", enabled: true }));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 70));
  });
  const socket = FakeWebSocket.instances[0];
  act(() => socket.simulateOpen());
  return { hook, socket };
}

function offer(offerId: string, expiresInMs: number) {
  return {
    offer_id: offerId,
    call_id: "call-1",
    workspace_id: "ws-1",
    from_number: "+5511999990000",
    channel: "sip",
    expires_at: new Date(Date.now() + expiresInMs).toISOString(),
  };
}

describe("useCallSessionWs call state", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(() => Promise.reject(new Error("no mic"))) } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dials through the chosen trunk", async () => {
    const { hook, socket } = await openSocket();
    act(() => hook.result.current.startCall("+55 11 99999-0000", { trunkId: "trunk-1" }));
    const [start] = socket.sentOfType("start_call");
    expect(start).toMatchObject({ phone_number: "+55 11 99999-0000", trunk_id: "trunk-1" });
    expect(start.whatsapp_phone_id).toBeUndefined();
  });

  it("drops an incoming offer the server withdraws", async () => {
    const { hook, socket } = await openSocket();
    act(() => socket.receive("call:incoming", offer("offer-1", 15_000)));
    expect(hook.result.current.incomingCall?.offerId).toBe("offer-1");
    act(() => socket.receive("call:incoming_withdrawn", { offer_id: "offer-2", reason: "no_answer" }));
    expect(hook.result.current.incomingCall?.offerId).toBe("offer-1");
    act(() => socket.receive("call:incoming_withdrawn", { offer_id: "offer-1", reason: "caller_hung_up" }));
    expect(hook.result.current.incomingCall).toBeNull();
  });

  it("drops an incoming offer once it expires even if the server stays silent", async () => {
    const { hook, socket } = await openSocket();
    act(() => socket.receive("call:incoming", offer("offer-1", 40)));
    expect(hook.result.current.incomingCall).not.toBeNull();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120));
    });
    expect(hook.result.current.incomingCall).toBeNull();
  });

  it("ends a live call in the UI when the socket drops", async () => {
    const { hook, socket } = await openSocket();
    act(() => socket.receive("call:status", { status: "answered", call_id: "call-1", phone_number: "100" }));
    expect(hook.result.current.callState?.status).toBe("answered");
    act(() => socket.close());
    expect(hook.result.current.callState).toMatchObject({ status: "ended", reason: "connection_lost" });
  });

  it("keeps a confirmed call when an unrelated error arrives", async () => {
    const { hook, socket } = await openSocket();
    act(() => socket.receive("call:status", { status: "answered", call_id: "call-1", phone_number: "100" }));
    act(() => socket.receive("conversation:error", { code: "offer_not_found", message: "gone" }));
    expect(hook.result.current.callState).toMatchObject({ status: "answered", callId: "call-1" });
    expect(hook.result.current.lastErrorCode).toBe("offer_not_found");
  });

  it("clears a call the server refused to start and keeps the reason code", async () => {
    const { hook, socket } = await openSocket();
    act(() => hook.result.current.startCall("100", { trunkId: "trunk-1" }));
    expect(hook.result.current.callState?.status).toBe("ringing");
    act(() => socket.receive("conversation:error", { code: "trunk_not_registered", message: "not registered" }));
    expect(hook.result.current.callState).toBeNull();
    expect(hook.result.current.lastErrorCode).toBe("trunk_not_registered");
  });

  it("ends a live call in the UI when the socket is closed on purpose", async () => {
    const hook = renderHook((props) => useCallSessionWs(props), { initialProps: { token: "user-1", enabled: true } });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 70));
    });
    const socket = FakeWebSocket.instances[0];
    act(() => socket.simulateOpen());
    act(() => socket.receive("call:status", { status: "answered", call_id: "call-1", phone_number: "100" }));
    hook.rerender({ token: "user-1", enabled: false });
    expect(hook.result.current.callState).toMatchObject({ status: "ended", reason: "connection_lost" });
  });

  it("clears a call the server no longer has", async () => {
    const { hook, socket } = await openSocket();
    act(() => socket.receive("call:status", { status: "answered", call_id: "call-1", phone_number: "100" }));
    act(() => socket.receive("conversation:error", { code: "no_active_call", message: "No active call to end" }));
    expect(hook.result.current.callState).toMatchObject({ status: "ended" });
  });

  it("mutes and unmutes the microphone", async () => {
    const { hook } = await openSocket();
    expect(hook.result.current.muted).toBe(false);
    act(() => hook.result.current.setMuted(true));
    expect(hook.result.current.muted).toBe(true);
  });
});
