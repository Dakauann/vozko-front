import { act, renderHook, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }),
}));
vi.mock("@/contexts/department-context", () => ({
  useDepartment: () => ({ currentDepartment: null }),
}));
vi.mock("@/lib/auth/client-cookies", () => ({ hasUserDataCookie: () => false }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

import { toast } from "sonner";

import { useCallSessionWs } from "@/hooks/use-call-session-ws";
import { FakeWebSocket } from "@/test/fake-websocket";

const errors = pt.calling.dialer.errors;

function withMessages({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={pt}>
      {children}
    </NextIntlClientProvider>
  );
}

async function connectedHook() {
  const hook = renderHook(() => useCallSessionWs({ token: "user-1", enabled: true }), { wrapper: withMessages });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 70));
  });
  return { hook, socket: FakeWebSocket.instances[0] };
}

async function openSocket() {
  const { hook, socket } = await connectedHook();
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
    expect(start).not.toHaveProperty("lead_id");
  });

  it("tells the server which lead the call is about", async () => {
    const { hook, socket } = await openSocket();
    act(() => hook.result.current.startCall("100", { trunkId: "trunk-1", leadId: "lead-1" }));
    const [start] = socket.sentOfType("start_call");
    expect(start).toMatchObject({ phone_number: "100", trunk_id: "trunk-1", lead_id: "lead-1" });
  });

  it("names the call list item the call works on, next to its lead", async () => {
    const { hook, socket } = await openSocket();
    act(() => hook.result.current.startCall("5511987654321", { trunkId: "trunk-1", leadId: "lead-1", callListItemId: "item-1" }));
    const [start] = socket.sentOfType("start_call");
    expect(start).toMatchObject({ phone_number: "5511987654321", trunk_id: "trunk-1", lead_id: "lead-1", call_list_item_id: "item-1" });
  });

  it("uses the request id the caller chose and keeps it while the server rewrites the number", async () => {
    const { hook, socket } = await openSocket();
    act(() => hook.result.current.startCall("551187654321", { trunkId: "trunk-1", requestId: "req-1" }));
    const [start] = socket.sentOfType("start_call");
    expect(start).toMatchObject({ phone_number: "551187654321", request_id: "req-1" });
    expect(hook.result.current.callState).toMatchObject({ requestId: "req-1", status: "ringing" });

    act(() => socket.receive("call:status", { status: "answered", call_id: "call-1", phone_number: "5511987654321" }));
    expect(hook.result.current.callState).toMatchObject({ requestId: "req-1", phoneNumber: "5511987654321", callId: "call-1" });
  });

  it("carries the lead on a WhatsApp call too", async () => {
    const { hook, socket } = await openSocket();
    act(() => hook.result.current.startCall("5511999990000", { whatsAppPhoneId: "wa-1", leadId: "lead-1" }));
    const [start] = socket.sentOfType("start_call");
    expect(start).toMatchObject({ whatsapp_phone_id: "wa-1", lead_id: "lead-1" });
    expect(start).not.toHaveProperty("trunk_id");
  });

  describe("refusing to start a call", () => {
    beforeEach(() => vi.mocked(toast.error).mockClear());

    it("asks for a number in the member's language", async () => {
      const { hook, socket } = await openSocket();
      act(() => hook.result.current.startCall("   ", { trunkId: "trunk-1" }));
      expect(socket.sentOfType("start_call")).toEqual([]);
      expect(hook.result.current.lastErrorCode).toBe("number_required");
      expect(hook.result.current.lastError).toBe(errors.number_required);
      expect(toast.error).toHaveBeenCalledWith(errors.number_required);
    });

    it("says the call service is offline in the member's language", async () => {
      const { hook, socket } = await connectedHook();
      act(() => hook.result.current.startCall("100", { trunkId: "trunk-1" }));
      expect(socket.sentOfType("start_call")).toEqual([]);
      expect(hook.result.current.lastErrorCode).toBe("call_service_offline");
      expect(toast.error).toHaveBeenCalledWith(errors.call_service_offline);
    });

    it("refuses a second call in the member's language without touching the live call's error", async () => {
      const { hook, socket } = await openSocket();
      act(() => socket.receive("call:status", { status: "answered", call_id: "call-1", phone_number: "200" }));
      act(() => socket.receive("conversation:error", { code: "target_unavailable", message: "busy" }));
      act(() => hook.result.current.startCall("100", { trunkId: "trunk-1" }));
      expect(socket.sentOfType("start_call")).toEqual([]);
      expect(hook.result.current.lastErrorCode).toBe("target_unavailable");
      expect(hook.result.current.lastError).toBe("busy");
      expect(toast.error).toHaveBeenCalledWith(errors.already_in_call);
    });

    it("refuses to accept an offer during a call in the member's language", async () => {
      const { hook, socket } = await openSocket();
      act(() => socket.receive("call:status", { status: "answered", call_id: "call-1", phone_number: "200" }));
      act(() => socket.receive("call:incoming", offer("offer-1", 15_000)));
      act(() => hook.result.current.acceptIncomingCall("offer-1"));
      expect(socket.sentOfType("call:incoming_accept")).toEqual([]);
      expect(hook.result.current.callState).toMatchObject({ callId: "call-1", status: "answered" });
      expect(toast.error).toHaveBeenCalledWith(errors.already_in_call);
    });
  });

  describe("the microphone", () => {
    beforeEach(() => vi.mocked(toast.error).mockClear());

    const failures = [
      { name: "a refused permission", failure: "NotAllowedError", code: "microphone_denied" },
      { name: "a blocked page", failure: "SecurityError", code: "microphone_denied" },
      { name: "a missing microphone", failure: "NotFoundError", code: "microphone_not_found" },
      { name: "a microphone another app holds", failure: "NotReadableError", code: "microphone_busy" },
      { name: "an unknown failure", failure: "UnknownError", code: "microphone_failed" },
    ] as const;

    for (const { name, failure, code } of failures) {
      it(`explains ${name} in the member's language and hangs up`, async () => {
        vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(() => Promise.reject(new DOMException("browser words", failure))) } });
        const { hook, socket } = await openSocket();
        act(() => hook.result.current.startCall("100", { trunkId: "trunk-1" }));
        await waitFor(() => expect(hook.result.current.lastErrorCode).toBe(code));
        expect(hook.result.current.lastError).toBe(errors[code]);
        expect(toast.error).toHaveBeenCalledWith(errors[code]);
        expect(socket.sentOfType("end_call")).toHaveLength(1);
      });
    }

    it("says the browser cannot reach a microphone at all", async () => {
      vi.stubGlobal("navigator", {});
      const { hook } = await openSocket();
      act(() => hook.result.current.startCall("100", { trunkId: "trunk-1" }));
      await waitFor(() => expect(hook.result.current.lastErrorCode).toBe("microphone_unsupported"));
      expect(hook.result.current.lastError).toBe(errors.microphone_unsupported);
      expect(toast.error).toHaveBeenCalledWith(errors.microphone_unsupported);
    });
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

  it("explains a refused lead call in the member's language", async () => {
    vi.mocked(toast.error).mockClear();
    const { hook, socket } = await openSocket();
    act(() => hook.result.current.startCall("100", { trunkId: "trunk-1", leadId: "lead-1" }));
    act(() => socket.receive("conversation:error", { code: "lead_blocked", message: "lead is blocked" }));
    expect(toast.error).toHaveBeenCalledWith(errors.lead_blocked);
    expect(hook.result.current.lastErrorCode).toBe("lead_blocked");

    act(() => hook.result.current.startCall("100", { trunkId: "trunk-1", leadId: "lead-1" }));
    act(() => socket.receive("conversation:error", { code: "something_new", message: "server words" }));
    expect(toast.error).toHaveBeenLastCalledWith("server words");
  });

  it("keeps a live call when the page hands the provider fresh messages", async () => {
    let messages: typeof pt = pt;
    const refreshedMessages = ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale="pt" messages={messages}>
        {children}
      </NextIntlClientProvider>
    );
    const hook = renderHook(() => useCallSessionWs({ token: "user-1", enabled: true }), { wrapper: refreshedMessages });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 70));
    });
    const socket = FakeWebSocket.instances[0];
    act(() => socket.simulateOpen());
    act(() => socket.receive("call:status", { status: "answered", call_id: "call-1", phone_number: "100" }));
    messages = { ...pt };
    hook.rerender();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 70));
    });
    expect(socket.closed).toBe(false);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(hook.result.current.callState).toMatchObject({ status: "answered", callId: "call-1" });

    vi.mocked(toast.error).mockClear();
    act(() => socket.receive("conversation:error", { code: "lead_blocked", message: "lead is blocked" }));
    expect(toast.error).toHaveBeenCalledWith(errors.lead_blocked);
  });

  it("ends a live call in the UI when the socket is closed on purpose", async () => {
    const hook = renderHook((props) => useCallSessionWs(props), {
      initialProps: { token: "user-1", enabled: true },
      wrapper: withMessages,
    });
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

  describe("transfers", () => {
    async function inCall() {
      const opened = await openSocket();
      act(() => opened.socket.receive("call:status", { status: "answered", call_id: "call-1", phone_number: "100" }));
      return opened;
    }

    it("asks the server to transfer to a colleague and to cancel by call id", async () => {
      const { hook, socket } = await inCall();
      act(() => hook.result.current.transferCall({ kind: "member", userId: "u2" }, " quer cancelar "));
      expect(socket.sentOfType("call:transfer")).toEqual([{ target_kind: "member", user_id: "u2", notes: "quer cancelar" }]);

      act(() => socket.receive("call:transfer_status", { transfer_id: "t1", call_id: "sip-in-1", status: "ringing", target_name: "Bia" }));
      expect(hook.result.current.transfer).toMatchObject({ status: "ringing", targetName: "Bia" });
      act(() => hook.result.current.cancelTransfer());
      expect(socket.sentOfType("call:transfer_cancel")).toEqual([{ call_id: "sip-in-1" }]);
    });

    it("ends the operator's call once the colleague takes it", async () => {
      const { hook, socket } = await inCall();
      act(() => socket.receive("call:transfer_status", { transfer_id: "t1", call_id: "sip-in-1", status: "connected" }));
      expect(hook.result.current.callState).toMatchObject({ status: "ended", reason: "transferred" });
    });

    it("keeps the call timer running when the call comes back", async () => {
      const { hook, socket } = await inCall();
      const startedAt = hook.result.current.callState?.answeredAt;
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });
      act(() => socket.receive("call:status", { status: "answered", call_id: "call-1", phone_number: "100" }));
      act(() => socket.receive("call:transfer_status", { transfer_id: "t1", call_id: "sip-in-1", status: "returned", reason: "no_answer" }));
      expect(hook.result.current.callState).toMatchObject({ status: "answered", answeredAt: startedAt });
      expect(hook.result.current.transfer).toMatchObject({ status: "returned", reason: "no_answer" });
    });

    it("keeps the call when a transfer is refused", async () => {
      const { hook, socket } = await inCall();
      act(() => socket.receive("conversation:error", { code: "target_unavailable", message: "busy" }));
      expect(hook.result.current.callState).toMatchObject({ status: "answered" });
      expect(hook.result.current.lastErrorCode).toBe("target_unavailable");
    });

    it("marks the offer that gives a held call back after a reload", async () => {
      const { hook, socket } = await openSocket();
      act(() => socket.receive("call:incoming", { ...offer("offer-1", 15_000), resume: true }));
      expect(hook.result.current.incomingCall?.resume).toBe(true);
    });

    it("reads who transferred an incoming call and keeps it on the accepted call", async () => {
      const { hook, socket } = await openSocket();
      act(() =>
        socket.receive("call:incoming", {
          ...offer("offer-1", 15_000),
          transfer: { from_user_id: "u1", from_name: "Ana", queue_name: "Suporte", notes: "segunda via" },
        }),
      );
      expect(hook.result.current.incomingCall?.transfer).toEqual({
        fromUserId: "u1",
        fromName: "Ana",
        queueId: undefined,
        queueName: "Suporte",
        notes: "segunda via",
      });
    });
  });
});

