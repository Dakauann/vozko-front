import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { hasUserDataCookie } = vi.hoisted(() => ({ hasUserDataCookie: vi.fn(() => true) }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => false }),
}));
vi.mock("@/contexts/department-context", () => ({
  useDepartment: () => ({ currentDepartment: null }),
}));
vi.mock("@/lib/auth/client-cookies", () => ({ hasUserDataCookie }));
vi.mock("@/lib/sounds/sound-player", () => ({ soundPlayer: { play: vi.fn() } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("next-intl", async () => (await import("@/test/next-intl-pt")).nextIntlInPortuguese());

import { toast } from "sonner";
import ptMessages from "@/i18n/messages/pt.json";
import { useConversationWs } from "@/hooks/use-conversation-ws";
import { otherViewers } from "@/lib/conversations/viewers";
import type { WsServerEvent } from "@/lib/conversations/types";
import { FakeWebSocket } from "@/test/fake-websocket";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const actionError = ptMessages.crmMessage.actionError;
const capabilities = { react: true, edit: true, delete: true, edit_window_seconds: 900, delete_window_seconds: 172800 };

async function mountOpenSocket() {
  const view = renderHook(() => useConversationWs({ token: "session-token", enabled: true }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  const socket = FakeWebSocket.instances[0];
  await act(async () => {
    socket.simulateOpen();
  });
  return { view, socket };
}

async function openPane(view: Awaited<ReturnType<typeof mountOpenSocket>>["view"], socket: FakeWebSocket) {
  act(() => view.result.current.subscribe("e1", "whatsapp"));
  await act(async () => {
    socket.receive("conversation:subscribed", {
      entry_id: "e1",
      entry_type: "whatsapp",
      lead_name: "Ana",
      lead_number: "5511",
      unread_count: 0,
      message_capabilities: capabilities,
    });
  });
}

const react = { kind: "react" as const, entryId: "e1", entryType: "whatsapp" as const, messageId: "m1", emoji: "👍" };

describe("message actions over the socket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeWebSocket.instances = [];
    hasUserDataCookie.mockReturnValue(true);
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps what the channel allows from the subscribe answer", async () => {
    const { view, socket } = await mountOpenSocket();
    await openPane(view, socket);
    expect(view.result.current.activeConversation?.message_capabilities).toEqual(capabilities);
  });

  it("sends a reaction with its own request id", async () => {
    const { view, socket } = await mountOpenSocket();
    await openPane(view, socket);
    let sent = false;
    act(() => {
      sent = view.result.current.runMessageAction(react);
    });
    expect(sent).toBe(true);
    const [frame] = socket.sentOfType("react_message");
    expect(frame).toMatchObject({ entry_id: "e1", entry_type: "whatsapp", message_id: "m1", emoji: "👍" });
    expect(frame.request_id).toMatch(UUID);
  });

  it("explains a refusal by its code, and an expired window on a reaction as the 24 hour rule", async () => {
    const { view, socket } = await mountOpenSocket();
    await openPane(view, socket);
    act(() => void view.result.current.runMessageAction(react));
    const [frame] = socket.sentOfType("react_message");
    await act(async () => {
      socket.receive("conversation:error", { code: "window_expired", message: "x", request_id: frame.request_id, entry_id: "e1", entry_type: "whatsapp" });
    });
    expect(toast.error).toHaveBeenCalledWith(actionError.reactWindowExpired);
  });

  it("answers a refused edit with the edit copy and leaves other refusals to their own handling", async () => {
    const { view, socket } = await mountOpenSocket();
    await openPane(view, socket);
    act(() => void view.result.current.runMessageAction({ kind: "edit", entryId: "e1", entryType: "whatsapp", messageId: "m1", text: "novo" }));
    const [frame] = socket.sentOfType("edit_message");
    await act(async () => {
      socket.receive("conversation:error", { code: "not_allowed", message: "x", request_id: frame.request_id, entry_id: "e1", entry_type: "whatsapp" });
      socket.receive("conversation:error", { code: "not_allowed", message: "x", request_id: "someone-else", entry_id: "e1", entry_type: "whatsapp" });
    });
    const actionToasts = vi.mocked(toast.error).mock.calls.filter(([message]) => message === actionError.notAllowed);
    expect(actionToasts).toHaveLength(1);
  });

  it("stops waiting for an answer once the server sends the changed message", async () => {
    const { view, socket } = await mountOpenSocket();
    await openPane(view, socket);
    act(() => void view.result.current.runMessageAction(react));
    const [frame] = socket.sentOfType("react_message");
    await act(async () => {
      socket.receive("conversation:message_updated", {
        entry_id: "e1",
        entry_type: "whatsapp",
        message: { id: "m1", entryId: "e1", entryType: "whatsapp", messageType: "user_message", text: "oi", createdAt: "2026-10-18T10:00:00Z" },
      });
      socket.receive("conversation:error", { code: "failed", message: "x", request_id: frame.request_id, entry_id: "e1", entry_type: "whatsapp" });
    });
    expect(toast.error).not.toHaveBeenCalledWith(actionError.failed);
  });

  it("keeps who else is viewing each conversation and forgets it once the conversation is left", async () => {
    const { view, socket } = await mountOpenSocket();
    await openPane(view, socket);
    await act(async () => {
      socket.receive("conversation:viewers", { entry_id: "e1", entry_type: "whatsapp", viewers: [{ user_id: "u-bruno", name: "Bruno" }] });
    });
    expect(otherViewers(view.result.current.viewersByEntry, "e1", "whatsapp", "u-ana")).toEqual([{ user_id: "u-bruno", name: "Bruno" }]);
    await act(async () => {
      socket.receive("conversation:unsubscribed", { entry_id: "e1", entry_type: "whatsapp" });
    });
    expect(otherViewers(view.result.current.viewersByEntry, "e1", "whatsapp", "u-ana")).toEqual([]);
  });

  it("hands every event to listeners, so notes can follow the socket without living in this hook", async () => {
    const { view, socket } = await mountOpenSocket();
    const seen: WsServerEvent[] = [];
    act(() => void view.result.current.subscribeServerEvents((event) => seen.push(event)));
    await act(async () => {
      socket.receive("conversation:note_deleted", { entry_id: "e1", entry_type: "whatsapp", note_id: "n1" });
    });
    expect(seen.map((event) => event.type)).toContain("conversation:note_deleted");
  });
});
