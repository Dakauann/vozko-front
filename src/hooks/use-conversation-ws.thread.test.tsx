import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { hasUserDataCookie } = vi.hoisted(() => ({ hasUserDataCookie: vi.fn(() => true) }));

let mockWorkspace: { id: string } = { id: "ws-1" };

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: mockWorkspace, can: () => false }),
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
import { windowKey } from "@/lib/conversations/window-deck";
import { FakeWebSocket } from "@/test/fake-websocket";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function at(minute: number): string {
  return new Date(Date.UTC(2026, 9, 18, 10, minute)).toISOString();
}

function wire(id: string, minute: number, over: Record<string, unknown> = {}) {
  return {
    id,
    entryId: "e1",
    entryType: "whatsapp",
    channel: "whatsapp",
    messageType: "user_message",
    from: "5511",
    to: "me",
    text: id,
    read: true,
    createdAt: at(minute),
    updatedAt: at(minute),
    ...over,
  };
}

function history(
  direction: "latest" | "before" | "around" | "after",
  messages: unknown[],
  over: Record<string, unknown> = {},
  entryId = "e1",
) {
  return {
    entry_id: entryId,
    entry_type: "whatsapp",
    direction,
    messages,
    has_more: false,
    has_after: false,
    page_size: messages.length,
    ...over,
  };
}

async function flushConnect() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
}

async function mountOpenSocket() {
  const view = renderHook(() => useConversationWs({ token: "session-token", enabled: true }));
  await flushConnect();
  const socket = FakeWebSocket.instances[0];
  await act(async () => {
    socket.simulateOpen();
  });
  return { view, socket };
}

async function openPane(view: Awaited<ReturnType<typeof mountOpenSocket>>["view"], socket: FakeWebSocket, entryId = "e1") {
  act(() => view.result.current.subscribe(entryId, "whatsapp"));
  await act(async () => {
    socket.receive("conversation:subscribed", {
      entry_id: entryId,
      entry_type: "whatsapp",
      lead_name: "Ana",
      lead_number: "5511",
      unread_count: 0,
    });
    socket.receive("conversation:history", history("latest", [wire(`${entryId}-a`, 1, { entryId }), wire(`${entryId}-b`, 2, { entryId })], { has_more: true, total: 40 }, entryId));
  });
}

async function reconnect(socket: FakeWebSocket) {
  await act(async () => {
    socket.close();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 1200));
  });
  const next = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  await act(async () => {
    next.simulateOpen();
  });
  return next;
}

const ids = (messages: { id: string }[] | undefined) => (messages ?? []).map((m) => m.id);

describe("thread transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspace = { id: "ws-1" };
    FakeWebSocket.instances = [];
    hasUserDataCookie.mockReturnValue(true);
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("pending sends", () => {
    it("shows every send as pending under its request id until the server confirms it", async () => {
      const { view, socket } = await mountOpenSocket();
      await openPane(view, socket);

      act(() => view.result.current.sendMessage("oi", true));
      const [frame] = socket.sentOfType("send");
      expect(frame.request_id).toMatch(UUID);
      expect(view.result.current.outbox).toEqual([
        expect.objectContaining({ requestId: frame.request_id, entryId: "e1", state: "pending" }),
      ]);

      await act(async () => {
        socket.receive("conversation:message_sent", {
          request_id: frame.request_id,
          entry_id: "e1",
          entry_type: "whatsapp",
          message: wire("m-sent", 3, { messageType: "operator", client_request_id: frame.request_id }),
        });
      });

      expect(view.result.current.outbox).toEqual([]);
      expect(ids(view.result.current.activeConversation?.messages)).toEqual(["e1-a", "e1-b", "m-sent"]);
    });

    it("settles a pending send whose message arrives in a page before the confirmation", async () => {
      const { view, socket } = await mountOpenSocket();
      await openPane(view, socket);
      act(() => view.result.current.sendButtonMessage({ bodyText: "Escolha", buttons: [{ id: "b1", title: "Sim" }] }));
      const [frame] = socket.sentOfType("send_button");

      await act(async () => {
        socket.receive("conversation:message", {
          entry_id: "e1",
          entry_type: "whatsapp",
          message: wire("m-btn", 3, { messageType: "operator", client_request_id: frame.request_id }),
        });
      });

      expect(view.result.current.outbox).toEqual([]);
    });

    it("turns a refused send failed and retries it with the same request id", async () => {
      const { view, socket } = await mountOpenSocket();
      await openPane(view, socket);
      act(() => view.result.current.sendMediaMessage("foto", "md1", "image", true));
      const [frame] = socket.sentOfType("send");

      await act(async () => {
        socket.receive("conversation:message_error", {
          request_id: frame.request_id,
          entry_id: "e1",
          entry_type: "whatsapp",
          error: "provider down",
          code: "send_failed",
        });
      });
      expect(view.result.current.outbox[0]).toMatchObject({ state: "failed", failure: "send_failed" });

      act(() => view.result.current.retrySend(frame.request_id as string));
      const frames = socket.sentOfType("send");
      expect(frames).toHaveLength(2);
      expect(frames[1]).toEqual(frame);
      expect(view.result.current.outbox[0].state).toBe("pending");
    });

    it("replays sends still waiting when the socket dropped, with the same request id", async () => {
      const { view, socket } = await mountOpenSocket();
      await openPane(view, socket);
      act(() => view.result.current.sendMessage("oi", false));
      const [frame] = socket.sentOfType("send");

      const next = await reconnect(socket);

      expect(next.sentOfType("send")).toEqual([frame]);
    });

    it("resends a stored failed message with a new request id and tells the operator when the server refuses", async () => {
      const { view, socket } = await mountOpenSocket();
      await openPane(view, socket);

      act(() => view.result.current.resendMessage("e1", "whatsapp", "e1-b"));
      const [frame] = socket.sentOfType("resend_message");
      expect(frame).toEqual({ entry_id: "e1", entry_type: "whatsapp", message_id: "e1-b", request_id: expect.stringMatching(UUID) });

      act(() => view.result.current.resendMessage("e1", "whatsapp", "e1-b"));
      expect(socket.sentOfType("resend_message")).toHaveLength(1);

      await act(async () => {
        socket.receive("conversation:error", {
          code: "window_expired",
          message: "window closed",
          request_id: frame.request_id,
          entry_id: "e1",
          entry_type: "whatsapp",
        });
      });

      expect(view.result.current.outbox).toEqual([]);
      expect(toast.error).toHaveBeenCalledWith(ptMessages.crmConversation.sendError.windowExpired);
    });
  });

  describe("history pages read by direction", () => {
    it("jumps to a quoted message with one load_around by id, then pages forward and back to the present", async () => {
      const { view, socket } = await mountOpenSocket();
      await openPane(view, socket);

      act(() => view.result.current.loadAround({ messageId: "old" }));
      expect(socket.sentOfType("load_around")).toEqual([{ entry_id: "e1", entry_type: "whatsapp", message_id: "old" }]);

      await act(async () => {
        socket.receive("conversation:history", history("around", [wire("old", -60)], { has_more: true, has_after: true, total: 40 }));
      });
      expect(ids(view.result.current.activeConversation?.messages)).toEqual(["old"]);
      expect(view.result.current.activeConversation?.has_after).toBe(true);

      act(() => view.result.current.loadNewer());
      expect(socket.sentOfType("load_after")).toEqual([
        { entry_id: "e1", entry_type: "whatsapp", after: at(-60), page_size: 100 },
      ]);
      await act(async () => {
        socket.receive("conversation:history", history("after", [wire("next", -59)], { has_after: true }));
      });
      expect(ids(view.result.current.activeConversation?.messages)).toEqual(["old", "next"]);

      act(() => view.result.current.returnToPresent());
      const [, present] = socket.sentOfType("load_around");
      expect(present).toMatchObject({ entry_id: "e1", entry_type: "whatsapp", page_size: 100 });
      expect(Date.parse(present.timestamp as string)).toBeGreaterThan(Date.now());
    });

    it("forgets an open jump the server cannot find, so the spinner stops", async () => {
      const { view, socket } = await mountOpenSocket();
      await openPane(view, socket);
      act(() => view.result.current.loadAround({ messageId: "gone" }));
      expect(view.result.current.loadingHistory).toBe(true);

      await act(async () => {
        socket.receive("conversation:error", { code: "not_found", message: "nope", entry_id: "e1", entry_type: "whatsapp" });
      });

      expect(view.result.current.loadingHistory).toBe(false);
    });

    it("applies a changed message to the open conversation and to a window holding it", async () => {
      const { view, socket } = await mountOpenSocket();
      await openPane(view, socket);
      act(() => view.result.current.openConversationWindow({ entryId: "e1", entryType: "whatsapp" }));
      await act(async () => {
        socket.receive("conversation:history", history("before", [wire("e1-a", 1), wire("e1-b", 2)]));
      });

      await act(async () => {
        socket.receive("conversation:message_updated", {
          entry_id: "e1",
          entry_type: "whatsapp",
          message: wire("e1-b", 2, { text: "", retracted_at: at(9) }),
        });
      });

      expect(view.result.current.activeConversation?.messages[1].retracted_at).toBe(at(9));
      expect(view.result.current.windowConversations.get(windowKey("e1", "whatsapp"))!.conversation.messages[1].retracted_at).toBe(at(9));
    });

    it("does not splice the pane's older page into a window on the same conversation", async () => {
      const { view, socket } = await mountOpenSocket();
      await openPane(view, socket);
      act(() => view.result.current.openConversationWindow({ entryId: "e1", entryType: "whatsapp" }));
      await act(async () => {
        socket.receive("conversation:history", history("before", [wire("e1-a", 1), wire("e1-b", 2)]));
      });

      act(() => view.result.current.loadHistory());
      await act(async () => {
        socket.receive("conversation:history", history("before", [wire("ancient", -500)], { has_more: true }));
      });

      expect(ids(view.result.current.activeConversation?.messages)).toEqual(["ancient", "e1-a", "e1-b"]);
      expect(ids(view.result.current.windowConversations.get(windowKey("e1", "whatsapp"))!.conversation.messages)).toEqual(["e1-a", "e1-b"]);
    });
  });

  describe("reconnecting", () => {
    it("catches every held thread up with load_after and refreshes the first inbox page", async () => {
      const { view, socket } = await mountOpenSocket();
      await openPane(view, socket);
      act(() => view.result.current.openConversationWindow({ entryId: "e2", entryType: "whatsapp" }));
      await act(async () => {
        socket.receive("conversation:history", history("before", [wire("e2-a", 5, { entryId: "e2" })], {}, "e2"));
      });

      const next = await reconnect(socket);

      expect(next.sentOfType("load_after")).toEqual(
        expect.arrayContaining([
          { entry_id: "e1", entry_type: "whatsapp", after: at(2), page_size: 100 },
          { entry_id: "e2", entry_type: "whatsapp", after: at(5), page_size: 100 },
        ]),
      );
      expect(next.sentOfType("switch_view")).toEqual([]);
    });

    it("restores a filtered inbox view before resubscribing, so the first page refreshes for that view and the subscriptions survive", async () => {
      const { view, socket } = await mountOpenSocket();
      act(() => view.result.current.switchView(undefined, undefined, undefined, "new"));
      await openPane(view, socket);

      const next = await reconnect(socket);

      const frames = next.sent.map((raw) => JSON.parse(raw) as { type: string; payload: Record<string, unknown> });
      const restored = frames.findIndex((frame) => frame.type === "switch_view");
      const resubscribed = frames.findIndex((frame) => frame.type === "subscribe");
      expect(frames[restored].payload).toMatchObject({ conversation_status: "new" });
      expect(restored).toBeLessThan(resubscribed);
    });

    it("does not resend the view the inbox is already on, which would drop every subscription", async () => {
      const { view, socket } = await mountOpenSocket();
      act(() => view.result.current.switchView(undefined, undefined, undefined, "new"));
      act(() => view.result.current.switchView(undefined, undefined, undefined, "new"));
      expect(socket.sentOfType("switch_view")).toHaveLength(1);
    });
  });

  describe("prefetch and the thread cache", () => {
    it("prefetches the latest page without subscribing or marking anything read", async () => {
      const { view, socket } = await mountOpenSocket();

      act(() => view.result.current.prefetchConversation("e2", "whatsapp"));
      act(() => view.result.current.prefetchConversation("e2", "whatsapp"));

      const frames = socket.sentOfType("load_history");
      expect(frames).toHaveLength(1);
      expect(frames[0]).toMatchObject({ entry_id: "e2", entry_type: "whatsapp" });
      expect(Number.isNaN(Date.parse(frames[0].before as string))).toBe(false);

      await act(async () => {
        socket.receive("conversation:history", history("before", [wire("e2-a", 1, { entryId: "e2", read: false })], { has_more: true }, "e2"));
      });

      expect(socket.sentOfType("subscribe")).toEqual([]);
      expect(socket.sentOfType("mark_read")).toEqual([]);
    });

    it("shows a cached conversation at once, then subscribes and catches up from its newest message", async () => {
      const { view, socket } = await mountOpenSocket();
      act(() => view.result.current.prefetchConversation("e2", "whatsapp"));
      await act(async () => {
        socket.receive("conversation:history", history("before", [wire("e2-a", 1, { entryId: "e2" }), wire("e2-b", 4, { entryId: "e2" })], { has_more: true }, "e2"));
      });

      act(() => view.result.current.subscribe("e2", "whatsapp"));

      expect(ids(view.result.current.activeConversation?.messages)).toEqual(["e2-a", "e2-b"]);
      expect(view.result.current.loadingConversation).toBe(true);
      expect(socket.sentOfType("subscribe")).toEqual([{ entry_id: "e2", entry_type: "whatsapp" }]);
      expect(socket.sentOfType("load_after")).toEqual([{ entry_id: "e2", entry_type: "whatsapp", after: at(4), page_size: 100 }]);
    });

    it("remembers the conversation the pane leaves, so switching back is instant", async () => {
      const { view, socket } = await mountOpenSocket();
      await openPane(view, socket, "e1");
      await openPane(view, socket, "e2");

      act(() => view.result.current.subscribe("e1", "whatsapp"));

      expect(ids(view.result.current.activeConversation?.messages)).toEqual(["e1-a", "e1-b"]);
    });

    it("never serves a cached thread after the workspace changes", async () => {
      const { view, socket } = await mountOpenSocket();
      act(() => view.result.current.prefetchConversation("e2", "whatsapp"));
      await act(async () => {
        socket.receive("conversation:history", history("before", [wire("e2-a", 1, { entryId: "e2" })], {}, "e2"));
      });

      mockWorkspace = { id: "ws-2" };
      view.rerender();
      await flushConnect();
      const next = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
      await act(async () => {
        next.simulateOpen();
      });

      act(() => view.result.current.subscribe("e2", "whatsapp"));
      expect(view.result.current.activeConversation?.messages ?? []).toEqual([]);
      expect(next.sentOfType("load_after")).toEqual([]);
    });
  });
});

describe("sending a template now", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspace = { id: "ws-1" };
    FakeWebSocket.instances = [];
    hasUserDataCookie.mockReturnValue(true);
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reopens the window with the chosen template under a fresh request id and opens the composer when the server confirms", async () => {
    const { view, socket } = await mountOpenSocket();
    await openPane(view, socket);

    act(() => view.result.current.reopenWindow("e1", "whatsapp", "t1", ["Ana"]));
    expect(socket.sentOfType("reopen_window")).toEqual([
      { entry_id: "e1", entry_type: "whatsapp", template_id: "t1", parameters: ["Ana"], request_id: expect.stringMatching(UUID) },
    ]);

    await act(async () => {
      socket.receive("conversation:window_reopened", {
        entry_id: "e1",
        entry_type: "whatsapp",
        template_id: "t1",
        template_name: "retomada",
        message_id: "m9",
        window_expires_at: "2026-10-19T10:00:00Z",
      });
    });

    expect(view.result.current.activeConversation).toMatchObject({ window_open: true, window_expires_at: "2026-10-19T10:00:00Z" });
  });
});
