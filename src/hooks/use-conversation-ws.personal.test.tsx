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

import { useConversationWs } from "@/hooks/use-conversation-ws";
import { isPinned } from "@/lib/conversations/personal-marks";
import { FakeWebSocket } from "@/test/fake-websocket";

const ana = { entry_id: "e1", entry_type: "whatsapp" as const };

function inboxEntry(id: string, extra: Record<string, unknown> = {}) {
  return { entry_id: id, entry_type: "whatsapp", lead_name: id, lead_number: "5511", unread_count: 0, last_message_at: "2026-10-18T12:00:00Z", ...extra };
}

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

describe("personal marks through the conversation socket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeWebSocket.instances = [];
    hasUserDataCookie.mockReturnValue(true);
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the marks of the inbox page and the waiting time of each entry", async () => {
    const { view, socket } = await mountOpenSocket();
    await act(async () => {
      socket.receive("conversation:inbox", {
        entries: [inboxEntry("e1")],
        page: 1,
        page_size: 20,
        total_items: 1,
        total_pages: 1,
        personal_marks: [{ entry_id: "e1", entry_type: "whatsapp", pinned_at: "2026-10-18T10:00:00Z" }],
      });
      socket.receive("conversation:entry_update", {
        entry: inboxEntry("e1", { waiting_since: "2026-10-18T12:05:00Z" }),
      });
    });
    expect(isPinned(view.result.current.personalInbox.marks, ana)).toBe(true);
    expect(view.result.current.inbox[0]).toMatchObject({ waiting_since: "2026-10-18T12:05:00Z" });
  });

  it("pins with a request id, applies the server's mark and rolls back a refused one", async () => {
    const { view, socket } = await mountOpenSocket();
    act(() => void view.result.current.personalInbox.pin(ana, true));
    const [pin] = socket.sentOfType("pin_conversation");
    expect(pin).toMatchObject({ entry_id: "e1", entry_type: "whatsapp", pinned: true });
    await act(async () => {
      socket.receive("conversation:error", { code: "not_found", message: "x", request_id: pin.request_id, entry_id: "e1", entry_type: "whatsapp" });
    });
    expect(isPinned(view.result.current.personalInbox.marks, ana)).toBe(false);

    await act(async () => {
      socket.receive("conversation:personal_mark", { entry_id: "e1", entry_type: "whatsapp", mark: { pinned_at: "2026-10-18T10:00:00Z" } });
    });
    expect(isPinned(view.result.current.personalInbox.marks, ana)).toBe(true);
  });

  it("adds a conversation from the row the server sends after a mark change, without reloading the first page", async () => {
    const { view, socket } = await mountOpenSocket();
    await act(async () => {
      socket.receive("conversation:inbox", { entries: [inboxEntry("e1")], page: 1, page_size: 20, total_items: 1, total_pages: 1 });
      socket.receive("conversation:personal_mark", { entry_id: "e9", entry_type: "whatsapp", mark: { pinned_at: "2026-10-18T10:00:00Z" } });
      socket.receive("conversation:entry_update", { entry: inboxEntry("e9", { last_message_at: "2026-10-17T08:00:00Z" }) });
    });
    expect(socket.sentOfType("request_inbox_page")).toEqual([]);
    expect(view.result.current.inbox.map((row) => row.entry_id)).toContain("e9");
  });

  it("undoes mark unread with the command that clears only the personal mark", async () => {
    const { view, socket } = await mountOpenSocket();
    act(() => void view.result.current.personalInbox.clearUnreadMark(ana));
    expect(socket.sentOfType("clear_unread_mark")).toEqual([{ entry_id: "e1", entry_type: "whatsapp", request_id: expect.any(String) }]);
    expect(socket.sentOfType("mark_read")).toEqual([]);
  });

  it("keeps a waiting row in its place in the waiting sort when the customer writes again", async () => {
    const { view, socket } = await mountOpenSocket();
    act(() => view.result.current.searchInbox({ sort: "waiting" }));
    const rows = [
      inboxEntry("e1", { waiting_since: "2026-10-18T09:00:00Z" }),
      inboxEntry("e2", { waiting_since: "2026-10-18T10:00:00Z", last_message_at: "2026-10-18T10:00:00Z" }),
    ];
    await act(async () => {
      socket.receive("conversation:search_results", { entries: rows, page: 1, page_size: 20, total_items: 2, total_pages: 1 });
      socket.receive("conversation:entry_update", {
        entry: inboxEntry("e2", { waiting_since: "2026-10-18T10:00:00Z", last_message_at: "2026-10-18T12:30:00Z" }),
      });
    });
    expect(view.result.current.searchResults?.map((row) => row.entry_id)).toEqual(["e1", "e2"]);
  });

  it("zeroes unread counts locally after a bulk read, since the bulk call sends no read events", async () => {
    const { view, socket } = await mountOpenSocket();
    await act(async () => {
      socket.receive("conversation:inbox", { entries: [inboxEntry("e1", { unread_count: 3 })], page: 1, page_size: 20, total_items: 1, total_pages: 1 });
    });
    act(() => view.result.current.personalInbox.clearUnread([ana]));
    expect(view.result.current.inbox[0].unread_count).toBe(0);
  });
});
