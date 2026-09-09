/**
 * @vitest-environment happy-dom
 *
 * End to end over the socket: several conversations open at once.
 *
 * These drive the hook the way the floating chat windows do — open two, feed
 * each its own server frames, send from one — and assert what the operator
 * would see. The pure reducer is covered separately in
 * lib/conversations/windowed-conversations.test; what is under test here is the
 * wiring: which frames reach which window, and which subscribe/unsubscribe
 * frames go back out.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { hasUserDataCookie, playFn } = vi.hoisted(() => ({
  hasUserDataCookie: vi.fn(() => true),
  playFn: vi.fn(),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }),
}));
vi.mock("@/contexts/department-context", () => ({
  useDepartment: () => ({ currentDepartment: null }),
}));
vi.mock("@/lib/auth/client-cookies", () => ({ hasUserDataCookie }));
vi.mock("use-sound", () => ({ default: () => [playFn] }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { useConversationWs } from "@/hooks/use-conversation-ws";
import { MAX_OPEN_WINDOWS, windowKey } from "@/lib/conversations/window-deck";

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  onopen: ((e?: unknown) => void) | null = null;
  onclose: ((e?: unknown) => void) | null = null;
  onerror: ((e?: unknown) => void) | null = null;
  onmessage: ((e?: unknown) => void) | null = null;
  sent: string[] = [];
  private listeners: Record<string, Array<(e?: unknown) => void>> = {};

  constructor(public url: string) {
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
  /** Every frame of one type this client sent, decoded. */
  framesOfType(type: string) {
    return this.sent
      .map((raw) => JSON.parse(raw) as { type: string; payload: unknown })
      .filter((f) => f.type === type)
      .map((f) => f.payload as Record<string, unknown>);
  }
}

async function flushConnect() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
}

const msg = (id: string, entryId: string, over: Record<string, unknown> = {}) => ({
  id,
  entry_id: entryId,
  entry_type: "whatsapp",
  channel: "whatsapp",
  message_type: "user_message",
  from: "5511",
  to: "me",
  text: id,
  read: false,
  created_at: "2026-09-01T10:00:00Z",
  ...over,
});

async function mountOpenSocket() {
  const view = renderHook(() =>
    useConversationWs({ token: "session-token", enabled: true }),
  );
  await flushConnect();
  const socket = FakeWebSocket.instances[0];
  await act(async () => {
    socket.simulateOpen();
  });
  return { view, socket };
}

describe("conversations open in windows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeWebSocket.instances = [];
    hasUserDataCookie.mockReturnValue(true);
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("subscribes to each conversation a window opens", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
        leadName: "Ana",
      });
      view.result.current.openConversationWindow({
        entryId: "e2",
        entryType: "whatsapp",
        leadName: "Bruno",
      });
    });

    expect(socket.framesOfType("subscribe")).toEqual([
      { entry_id: "e1", entry_type: "whatsapp" },
      { entry_id: "e2", entry_type: "whatsapp" },
    ]);
    expect(view.result.current.windowConversations.size).toBe(2);
  });

  /**
   * The bug this pins, seen in production: both windows opened blank.
   *
   * The server remembers which message ids it already sent each CONNECTION per
   * entry and filters them out of a subscribe's history reply. The centre pane
   * had already been shown those conversations on the same socket, so the
   * window's subscribe answered with an empty list and the thread rendered
   * empty. The window therefore asks for its transcript explicitly.
   */
  it("asks for the transcript itself rather than relying on the subscribe reply", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
    });

    const [frame] = socket.framesOfType("load_history");
    expect(frame).toMatchObject({ entry_id: "e1", entry_type: "whatsapp" });
    expect(typeof frame.before).toBe("string");
    expect(Number.isNaN(Date.parse(frame.before as string))).toBe(false);
  });

  it("fills the window even when the subscribe history comes back empty", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
    });

    await act(async () => {
      // What the server actually sends for a conversation this connection has
      // already been shown: everything filtered out.
      socket.simulateMessage({
        type: "conversation:history",
        payload: {
          entry_id: "e1",
          entry_type: "whatsapp",
          messages: [],
          has_more: true,
          page_size: 0,
        },
      });
      // And the answer to the window's own request, which is not filtered.
      socket.simulateMessage({
        type: "conversation:history",
        payload: {
          entry_id: "e1",
          entry_type: "whatsapp",
          messages: [msg("a1", "e1"), msg("a2", "e1")],
          has_more: true,
          page_size: 2,
        },
      });
    });

    const w = view.result.current.windowConversations.get(
      windowKey("e1", "whatsapp"),
    )!;
    expect(w.conversation.messages.map((m) => m.id)).toEqual(["a1", "a2"]);
    expect(w.loadingConversation).toBe(false);
  });

  it("does not duplicate lines when both history answers carry them", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
    });

    const batch = {
      entry_id: "e1",
      entry_type: "whatsapp",
      messages: [msg("a1", "e1"), msg("a2", "e1")],
      has_more: false,
      page_size: 2,
    };
    await act(async () => {
      socket.simulateMessage({ type: "conversation:history", payload: batch });
      socket.simulateMessage({ type: "conversation:history", payload: batch });
    });

    expect(
      view.result.current.windowConversations
        .get(windowKey("e1", "whatsapp"))!
        .conversation.messages.map((m) => m.id),
    ).toEqual(["a1", "a2"]);
  });

  it("keeps 'there is more to load' when the empty answer arrives last", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
    });

    await act(async () => {
      socket.simulateMessage({
        type: "conversation:history",
        payload: {
          entry_id: "e1",
          entry_type: "whatsapp",
          messages: [msg("a1", "e1")],
          has_more: true,
          page_size: 1,
        },
      });
      socket.simulateMessage({
        type: "conversation:history",
        payload: {
          entry_id: "e1",
          entry_type: "whatsapp",
          messages: [],
          has_more: false,
          page_size: 0,
        },
      });
    });

    // An empty answer says nothing about older pages; it must not retract the
    // scroll-up affordance the operator was already offered.
    expect(
      view.result.current.windowConversations.get(windowKey("e1", "whatsapp"))!
        .conversation.has_more,
    ).toBe(true);
  });

  it("keeps each window's transcript to itself", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
      view.result.current.openConversationWindow({
        entryId: "e2",
        entryType: "whatsapp",
      });
    });

    await act(async () => {
      socket.simulateMessage({
        type: "conversation:history",
        payload: {
          entry_id: "e1",
          entry_type: "whatsapp",
          messages: [msg("a1", "e1")],
          has_more: false,
          page_size: 1,
        },
      });
      socket.simulateMessage({
        type: "conversation:history",
        payload: {
          entry_id: "e2",
          entry_type: "whatsapp",
          messages: [msg("b1", "e2"), msg("b2", "e2")],
          has_more: false,
          page_size: 2,
        },
      });
      socket.simulateMessage({
        type: "conversation:message",
        payload: {
          entry_id: "e2",
          entry_type: "whatsapp",
          message: msg("b3", "e2"),
        },
      });
    });

    const windows = view.result.current.windowConversations;
    expect(
      windows
        .get(windowKey("e1", "whatsapp"))!
        .conversation.messages.map((m) => m.id),
    ).toEqual(["a1"]);
    expect(
      windows
        .get(windowKey("e2", "whatsapp"))!
        .conversation.messages.map((m) => m.id),
    ).toEqual(["b1", "b2", "b3"]);
  });

  it("routes a send to the window it was typed in", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
      view.result.current.openConversationWindow({
        entryId: "e2",
        entryType: "whatsapp",
      });
    });

    act(() => {
      view.result.current.windowSendMessage(
        "e2",
        "whatsapp",
        "bom dia",
        false,
      );
    });

    expect(socket.framesOfType("send")).toEqual([
      {
        entry_id: "e2",
        entry_type: "whatsapp",
        signed: false,
        text: "bom dia",
      },
    ]);
  });

  it("stops the thread skeleton once that window's history lands", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
    });
    expect(
      view.result.current.windowConversations.get(windowKey("e1", "whatsapp"))!
        .loadingConversation,
    ).toBe(true);

    await act(async () => {
      socket.simulateMessage({
        type: "conversation:history",
        payload: {
          entry_id: "e1",
          entry_type: "whatsapp",
          messages: [msg("a1", "e1")],
          has_more: true,
          page_size: 1,
        },
      });
    });

    expect(
      view.result.current.windowConversations.get(windowKey("e1", "whatsapp"))!
        .loadingConversation,
    ).toBe(false);
  });

  it("marks a window's incoming messages read, because they are on screen", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
    });

    await act(async () => {
      socket.simulateMessage({
        type: "conversation:message",
        payload: {
          entry_id: "e1",
          entry_type: "whatsapp",
          message: msg("a1", "e1"),
        },
      });
    });

    expect(socket.framesOfType("mark_read")).toContainEqual({
      entry_id: "e1",
      entry_type: "whatsapp",
      message_ids: ["a1"],
    });
  });

  /**
   * The bug this pins: a PARKED window kept receipting everything it received,
   * so conversations were marked read that nobody had looked at — including
   * while the operator was working an entirely different conversation in the
   * centre pane. Holding a subscription is not the same as reading it.
   */
  describe("a parked window is not being read", () => {
    it("sends no read receipt while it sits in the dock", async () => {
      const { view, socket } = await mountOpenSocket();

      act(() => {
        view.result.current.openConversationWindow({
          entryId: "e1",
          entryType: "whatsapp",
        });
      });
      act(() => {
        view.result.current.setConversationWindowVisible("e1", "whatsapp", false);
      });

      await act(async () => {
        socket.simulateMessage({
          type: "conversation:message",
          payload: {
            entry_id: "e1",
            entry_type: "whatsapp",
            message: msg("a1", "e1"),
          },
        });
      });

      expect(
        socket.framesOfType("mark_read").some((p) => p.entry_id === "e1"),
      ).toBe(false);
    });

    it("counts what arrives instead, so the bar can show a badge", async () => {
      const { view, socket } = await mountOpenSocket();

      act(() => {
        view.result.current.openConversationWindow({
          entryId: "e1",
          entryType: "whatsapp",
        });
      });
      act(() => {
        view.result.current.setConversationWindowVisible("e1", "whatsapp", false);
      });

      await act(async () => {
        socket.simulateMessage({
          type: "conversation:message",
          payload: {
            entry_id: "e1",
            entry_type: "whatsapp",
            message: msg("a1", "e1"),
          },
        });
        socket.simulateMessage({
          type: "conversation:message",
          payload: {
            entry_id: "e1",
            entry_type: "whatsapp",
            message: msg("a2", "e1"),
          },
        });
      });

      expect(
        view.result.current.windowConversations.get(windowKey("e1", "whatsapp"))!
          .conversation.unread_count,
      ).toBe(2);
    });

    it("does not count the operator's own replies", async () => {
      const { view, socket } = await mountOpenSocket();

      act(() => {
        view.result.current.openConversationWindow({
          entryId: "e1",
          entryType: "whatsapp",
        });
      });
      act(() => {
        view.result.current.setConversationWindowVisible("e1", "whatsapp", false);
      });

      await act(async () => {
        socket.simulateMessage({
          type: "conversation:message_sent",
          payload: {
            entry_id: "e1",
            entry_type: "whatsapp",
            message: msg("out", "e1", { message_type: "operator" }),
          },
        });
      });

      expect(
        view.result.current.windowConversations.get(windowKey("e1", "whatsapp"))!
          .conversation.unread_count,
      ).toBe(0);
    });

    it("catches up on the receipts when it is restored", async () => {
      const { view, socket } = await mountOpenSocket();

      act(() => {
        view.result.current.openConversationWindow({
          entryId: "e1",
          entryType: "whatsapp",
        });
      });
      act(() => {
        view.result.current.setConversationWindowVisible("e1", "whatsapp", false);
      });
      await act(async () => {
        socket.simulateMessage({
          type: "conversation:message",
          payload: {
            entry_id: "e1",
            entry_type: "whatsapp",
            message: msg("a1", "e1"),
          },
        });
      });

      act(() => {
        view.result.current.setConversationWindowVisible("e1", "whatsapp", true);
      });

      expect(socket.framesOfType("mark_read")).toContainEqual({
        entry_id: "e1",
        entry_type: "whatsapp",
        message_ids: ["a1"],
      });
      // And the badge clears, because the operator is now looking at it.
      expect(
        view.result.current.windowConversations.get(windowKey("e1", "whatsapp"))!
          .conversation.unread_count,
      ).toBe(0);
    });

    it("still receipts for a window that IS on screen", async () => {
      const { view, socket } = await mountOpenSocket();

      act(() => {
        view.result.current.openConversationWindow({
          entryId: "e1",
          entryType: "whatsapp",
        });
      });

      await act(async () => {
        socket.simulateMessage({
          type: "conversation:message",
          payload: {
            entry_id: "e1",
            entry_type: "whatsapp",
            message: msg("a1", "e1"),
          },
        });
      });

      expect(socket.framesOfType("mark_read")).toContainEqual({
        entry_id: "e1",
        entry_type: "whatsapp",
        message_ids: ["a1"],
      });
    });
  });

  it("does not send a read receipt for a conversation no window holds", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
    });

    await act(async () => {
      socket.simulateMessage({
        type: "conversation:message",
        payload: {
          entry_id: "somewhere-else",
          entry_type: "whatsapp",
          message: msg("z1", "somewhere-else"),
        },
      });
    });

    expect(
      socket
        .framesOfType("mark_read")
        .some((p) => p.entry_id === "somewhere-else"),
    ).toBe(false);
  });

  it("unsubscribes when the last window on a conversation closes", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
    });
    act(() => {
      view.result.current.closeConversationWindow("e1", "whatsapp");
    });

    expect(socket.framesOfType("unsubscribe")).toEqual([
      { entry_id: "e1", entry_type: "whatsapp" },
    ]);
    expect(view.result.current.windowConversations.size).toBe(0);
  });

  // The refcount is the whole point: two views, one subscription.
  it("keeps the centre pane subscribed when a window on the same conversation closes", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.subscribe("e1", "whatsapp");
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
    });
    act(() => {
      view.result.current.closeConversationWindow("e1", "whatsapp");
    });

    expect(socket.framesOfType("unsubscribe")).toEqual([]);
  });

  it("keeps a window alive when the centre pane moves to another conversation", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.subscribe("e1", "whatsapp");
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
    });
    act(() => {
      view.result.current.subscribe("e2", "whatsapp");
    });

    // e1 is still on screen in its window, so it must not be dropped.
    expect(socket.framesOfType("unsubscribe")).toEqual([]);

    await act(async () => {
      socket.simulateMessage({
        type: "conversation:message",
        payload: {
          entry_id: "e1",
          entry_type: "whatsapp",
          message: msg("a1", "e1"),
        },
      });
    });
    expect(
      view.result.current.windowConversations
        .get(windowKey("e1", "whatsapp"))!
        .conversation.messages.map((m) => m.id),
    ).toEqual(["a1"]);
  });

  it("still unsubscribes a conversation once BOTH views let go of it", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.subscribe("e1", "whatsapp");
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
    });
    act(() => {
      view.result.current.closeConversationWindow("e1", "whatsapp");
      view.result.current.subscribe("e2", "whatsapp");
    });

    expect(socket.framesOfType("unsubscribe")).toEqual([
      { entry_id: "e1", entry_type: "whatsapp" },
    ]);
  });

  it("reopening a window does not leak a second subscription holder", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
    });
    act(() => {
      view.result.current.closeConversationWindow("e1", "whatsapp");
    });

    // One close must fully release it; otherwise the socket keeps streaming a
    // conversation nothing is showing, for the life of the session.
    expect(socket.framesOfType("unsubscribe")).toEqual([
      { entry_id: "e1", entry_type: "whatsapp" },
    ]);
  });

  it("brings every open window back after a reconnect", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
      view.result.current.openConversationWindow({
        entryId: "e2",
        entryType: "telegram",
      });
    });

    await act(async () => {
      socket.close();
    });
    // The controller retries on a flat 1000ms for the first attempt
    // (backoffDelay(0) with no jitter), plus the hook's own 50ms connect timer.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1200));
    });

    const reconnected = FakeWebSocket.instances[1];
    expect(reconnected).toBeDefined();
    await act(async () => {
      reconnected.simulateOpen();
    });

    expect(reconnected.framesOfType("subscribe")).toEqual(
      expect.arrayContaining([
        { entry_id: "e1", entry_type: "whatsapp" },
        { entry_id: "e2", entry_type: "telegram" },
      ]),
    );
  });

  it("retires the conversation opened longest ago once the cap is full", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      for (let i = 1; i <= MAX_OPEN_WINDOWS + 1; i++) {
        view.result.current.openConversationWindow({
          entryId: `e${i}`,
          entryType: "whatsapp",
        });
      }
    });

    expect(view.result.current.windowConversations.size).toBe(MAX_OPEN_WINDOWS);
    expect(
      view.result.current.windowConversations.has(windowKey("e1", "whatsapp")),
    ).toBe(false);
    // And the socket stops streaming the one that went away.
    expect(socket.framesOfType("unsubscribe")).toEqual([
      { entry_id: "e1", entry_type: "whatsapp" },
    ]);
  });

  /**
   * The feature is additive: an operator who never opens a window must see
   * exactly the behaviour they saw before it existed. This pins that — the
   * frames on the wire for a plain centre-pane session are unchanged.
   */
  it("sends the same frames as before when no window is ever opened", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.subscribe("e1", "whatsapp");
    });
    act(() => {
      view.result.current.subscribe("e2", "whatsapp");
    });
    act(() => {
      view.result.current.unsubscribe();
    });

    expect(socket.framesOfType("subscribe")).toEqual([
      { entry_id: "e1", entry_type: "whatsapp" },
      { entry_id: "e2", entry_type: "whatsapp" },
    ]);
    expect(socket.framesOfType("unsubscribe")).toEqual([
      { entry_id: "e1", entry_type: "whatsapp" },
      { entry_id: "e2", entry_type: "whatsapp" },
    ]);
    expect(view.result.current.windowConversations.size).toBe(0);
  });

  /**
   * The regression this pins, reported from the real app with NO windows open:
   *
   *   open A → a message arrives → marked read (right)
   *   switch to B → a message arrives for A → A was ALSO marked read (wrong)
   *
   * Cause: subscriptions were refcounted, and `subscribe()` is called again
   * every time an operator clicks the conversation they are already in. Each
   * of those raised a counter that only one later switch decremented, so A
   * never reached zero, `unsubscribe` was never sent, and A kept streaming —
   * and being receipted — while the operator worked B.
   */
  describe("leaving a conversation actually leaves it", () => {
    it("unsubscribes the previous conversation even after repeated clicks", async () => {
      const { view, socket } = await mountOpenSocket();

      act(() => {
        view.result.current.subscribe("e1", "whatsapp");
      });
      // The operator clicks the row they are already in. Twice.
      act(() => {
        view.result.current.subscribe("e1", "whatsapp");
        view.result.current.subscribe("e1", "whatsapp");
      });
      act(() => {
        view.result.current.subscribe("e2", "whatsapp");
      });

      expect(socket.framesOfType("unsubscribe")).toEqual([
        { entry_id: "e1", entry_type: "whatsapp" },
      ]);
    });

    it("stops receipting the conversation it left", async () => {
      const { view, socket } = await mountOpenSocket();

      act(() => {
        view.result.current.subscribe("e1", "whatsapp");
        view.result.current.subscribe("e1", "whatsapp");
      });
      act(() => {
        view.result.current.subscribe("e2", "whatsapp");
      });

      await act(async () => {
        socket.simulateMessage({
          type: "conversation:message",
          payload: {
            entry_id: "e1",
            entry_type: "whatsapp",
            message: msg("a1", "e1"),
          },
        });
      });

      expect(
        socket.framesOfType("mark_read").some((p) => p.entry_id === "e1"),
      ).toBe(false);
    });

    it("still receipts the conversation the operator moved TO", async () => {
      const { view, socket } = await mountOpenSocket();

      act(() => {
        view.result.current.subscribe("e1", "whatsapp");
      });
      act(() => {
        view.result.current.subscribe("e2", "whatsapp");
      });

      await act(async () => {
        socket.simulateMessage({
          type: "conversation:subscribed",
          payload: {
            entry_id: "e2",
            entry_type: "whatsapp",
            lead_name: "B",
            lead_number: "+2",
            unread_count: 0,
          },
        });
        socket.simulateMessage({
          type: "conversation:message",
          payload: {
            entry_id: "e2",
            entry_type: "whatsapp",
            message: msg("b1", "e2"),
          },
        });
      });

      expect(socket.framesOfType("mark_read")).toContainEqual({
        entry_id: "e2",
        entry_type: "whatsapp",
        message_ids: ["b1"],
      });
    });
  });

  it("leaves the centre pane's own conversation untouched", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.subscribe("e1", "whatsapp");
    });
    await act(async () => {
      socket.simulateMessage({
        type: "conversation:subscribed",
        payload: {
          entry_id: "e1",
          entry_type: "whatsapp",
          lead_name: "Ana",
          lead_number: "+5511",
          unread_count: 0,
          window_open: true,
        },
      });
      socket.simulateMessage({
        type: "conversation:history",
        payload: {
          entry_id: "e1",
          entry_type: "whatsapp",
          messages: [msg("a1", "e1")],
          has_more: false,
          page_size: 1,
        },
      });
    });

    // Opening an unrelated window must not disturb what the centre pane shows.
    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e2",
        entryType: "whatsapp",
      });
    });

    expect(view.result.current.activeConversation?.entry_id).toBe("e1");
    expect(
      view.result.current.activeConversation?.messages.map((m) => m.id),
    ).toEqual(["a1"]);
  });

  it("settles the spinners when the socket drops", async () => {
    const { view, socket } = await mountOpenSocket();

    act(() => {
      view.result.current.openConversationWindow({
        entryId: "e1",
        entryType: "whatsapp",
      });
    });

    await act(async () => {
      socket.close();
    });

    expect(
      view.result.current.windowConversations.get(windowKey("e1", "whatsapp"))!
        .loadingConversation,
    ).toBe(false);
  });
});
