import { describe, expect, it } from "vitest";

import type { ConversationMessage, WsServerEvent } from "@/lib/conversations/types";
import {
  applyWindowEvent,
  closeWindowConversation,
  emptyWindowConversations,
  incomingUnreadIds,
  openWindowConversation,
  windowConversation,
} from "@/lib/conversations/windowed-conversations";
import { windowKey } from "@/lib/conversations/window-deck";

const A = windowKey("e1", "whatsapp");
const B = windowKey("e2", "whatsapp");

const msg = (
  id: string,
  over: Partial<ConversationMessage> = {},
): ConversationMessage =>
  ({
    id,
    entry_id: "e1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "user_message",
    from: "5511",
    to: "me",
    text: id,
    read: false,
    created_at: "2026-09-01T10:00:00Z",
    ...over,
  }) as ConversationMessage;

function opened() {
  let state = emptyWindowConversations();
  state = openWindowConversation(state, {
    entryId: "e1",
    entryType: "whatsapp",
    leadName: "Ana",
  });
  state = openWindowConversation(state, {
    entryId: "e2",
    entryType: "whatsapp",
    leadName: "Bruno",
  });
  return state;
}

const subscribed = (entryId: string, leadName: string): WsServerEvent => ({
  type: "conversation:subscribed",
  payload: {
    entry_id: entryId,
    entry_type: "whatsapp",
    lead_name: leadName,
    lead_number: "+5511999",
    unread_count: 2,
    window_open: true,
    window_expires_at: null,
  },
});

describe("openWindowConversation", () => {
  it("shows the lead straight away and marks the thread as still loading", () => {
    const state = opened();
    const w = windowConversation(state, A)!;

    expect(w.conversation.lead_name).toBe("Ana");
    expect(w.conversation.messages).toEqual([]);
    expect(w.loadingConversation).toBe(true);
  });

  it("reopening keeps the transcript already in memory", () => {
    let state = opened();
    state = applyWindowEvent(state, {
      type: "conversation:message",
      payload: { entry_id: "e1", entry_type: "whatsapp", message: msg("m1") },
    });

    state = openWindowConversation(state, {
      entryId: "e1",
      entryType: "whatsapp",
      leadName: "Ana",
    });

    const w = windowConversation(state, A)!;
    expect(w.conversation.messages.map((m) => m.id)).toEqual(["m1"]);
    expect(w.loadingConversation).toBe(false);
  });
});

describe("routing frames to the right window", () => {
  it("delivers a message only to the window that entry belongs to", () => {
    let state = opened();
    state = applyWindowEvent(state, {
      type: "conversation:message",
      payload: { entry_id: "e1", entry_type: "whatsapp", message: msg("m1") },
    });

    expect(windowConversation(state, A)!.conversation.messages).toHaveLength(1);
    expect(windowConversation(state, B)!.conversation.messages).toHaveLength(0);
  });

  it("ignores frames for entries no window is holding", () => {
    const state = opened();
    const after = applyWindowEvent(state, {
      type: "conversation:message",
      payload: {
        entry_id: "somewhere-else",
        entry_type: "whatsapp",
        message: msg("m9"),
      },
    });

    expect(after).toBe(state);
  });

  it("keeps typing indicators inside their own window", () => {
    let state = opened();
    state = applyWindowEvent(state, {
      type: "conversation:typing",
      payload: {
        entry_id: "e1",
        entry_type: "whatsapp",
        user_id: "u1",
        is_typing: true,
      },
    });

    expect(windowConversation(state, A)!.typingUserIds).toEqual(["u1"]);
    expect(windowConversation(state, B)!.typingUserIds).toEqual([]);

    state = applyWindowEvent(state, {
      type: "conversation:typing",
      payload: {
        entry_id: "e1",
        entry_type: "whatsapp",
        user_id: "u1",
        is_typing: false,
      },
    });
    expect(windowConversation(state, A)!.typingUserIds).toEqual([]);
  });

  it("never lets a duplicate message id land twice", () => {
    let state = opened();
    const frame: WsServerEvent = {
      type: "conversation:message",
      payload: { entry_id: "e1", entry_type: "whatsapp", message: msg("m1") },
    };
    state = applyWindowEvent(state, frame);
    state = applyWindowEvent(state, frame);

    expect(windowConversation(state, A)!.conversation.messages).toHaveLength(1);
  });
});

describe("subscribed", () => {
  it("fills in the lead and the reply window the server reports", () => {
    let state = opened();
    state = applyWindowEvent(state, subscribed("e1", "Ana Souza"));

    const c = windowConversation(state, A)!.conversation;
    expect(c.lead_name).toBe("Ana Souza");
    expect(c.lead_number).toBe("+5511999");
    expect(c.window_open).toBe(true);
    expect(c.unread_count).toBe(2);
  });
});

/**
 * The window must show the same face the inbox row does. It carries its own
 * copy rather than reading the cached row, because a floating conversation can
 * outlive its row — a filter change, or a page of the inbox that never loaded.
 */
describe("the contact's picture", () => {
  it("opens with the picture the inbox row already had", () => {
    const state = openWindowConversation(emptyWindowConversations(), {
      entryId: "e1",
      entryType: "whatsapp",
      leadName: "Ana",
      leadPicture: "https://cdn/ana.jpg",
    });

    expect(windowConversation(state, A)!.conversation.lead_picture).toBe(
      "https://cdn/ana.jpg",
    );
  });

  it("takes the picture the server names on subscribe", () => {
    let state = opened();
    state = applyWindowEvent(state, {
      type: "conversation:subscribed",
      payload: {
        entry_id: "e1",
        entry_type: "whatsapp",
        lead_name: "Ana",
        lead_number: "+5511999",
        lead_picture: "https://cdn/ana.jpg",
        unread_count: 0,
      },
    });

    expect(windowConversation(state, A)!.conversation.lead_picture).toBe(
      "https://cdn/ana.jpg",
    );
  });

  // The bug: a later frame without a picture blanked the face, so the window
  // fell back to an initial while the inbox beside it still showed the photo.
  it("keeps the face when a later frame carries no picture", () => {
    let state = openWindowConversation(emptyWindowConversations(), {
      entryId: "e1",
      entryType: "whatsapp",
      leadPicture: "https://cdn/ana.jpg",
    });

    state = applyWindowEvent(state, {
      type: "conversation:subscribed",
      payload: {
        entry_id: "e1",
        entry_type: "whatsapp",
        lead_name: "Ana",
        lead_number: "+5511999",
        unread_count: 0,
      },
    });

    expect(windowConversation(state, A)!.conversation.lead_picture).toBe(
      "https://cdn/ana.jpg",
    );
  });

  it("picks up a picture the contact gains later", () => {
    let state = opened();
    state = applyWindowEvent(state, {
      type: "conversation:entry_update",
      payload: {
        entry: {
          entry_id: "e1",
          entry_type: "whatsapp",
          lead_name: "Ana",
          lead_number: "+5511999",
          lead_picture: "https://cdn/new.jpg",
        },
      },
    } as WsServerEvent);

    expect(windowConversation(state, A)!.conversation.lead_picture).toBe(
      "https://cdn/new.jpg",
    );
  });
});

describe("history", () => {
  it("seeds the thread on the first batch and stops the skeleton", () => {
    let state = opened();
    state = applyWindowEvent(state, {
      type: "conversation:history",
      payload: {
        entry_id: "e1",
        entry_type: "whatsapp",
        messages: [msg("m1"), msg("m2")],
        has_more: true,
        page_size: 2,
        total: 12,
      },
    });

    const w = windowConversation(state, A)!;
    expect(w.conversation.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(w.conversation.has_more).toBe(true);
    expect(w.loadingConversation).toBe(false);
  });

  it("prepends an older page when the window asked for more", () => {
    let state = opened();
    state = applyWindowEvent(state, {
      type: "conversation:history",
      payload: {
        entry_id: "e1",
        entry_type: "whatsapp",
        messages: [msg("m3")],
        has_more: true,
        page_size: 1,
      },
    });
    state = markLoadingMore(state);
    state = applyWindowEvent(state, {
      type: "conversation:history",
      payload: {
        entry_id: "e1",
        entry_type: "whatsapp",
        messages: [msg("m1"), msg("m2")],
        has_more: false,
        page_size: 2,
      },
    });

    const w = windowConversation(state, A)!;
    expect(w.conversation.messages.map((m) => m.id)).toEqual([
      "m1",
      "m2",
      "m3",
    ]);
    expect(w.conversation.has_more).toBe(false);
    expect(w.loadingHistory).toBe(false);
  });
});

describe("read receipts and delivery", () => {
  it("marks the named messages read", () => {
    let state = opened();
    state = applyWindowEvent(state, {
      type: "conversation:message",
      payload: { entry_id: "e1", entry_type: "whatsapp", message: msg("m1") },
    });
    state = applyWindowEvent(state, {
      type: "conversation:read",
      payload: {
        entry_id: "e1",
        entry_type: "whatsapp",
        message_ids: ["m1"],
        read_by: "u2",
        read_at: "2026-09-01T10:05:00Z",
      },
    });

    expect(windowConversation(state, A)!.conversation.messages[0].read).toBe(
      true,
    );
  });

  it("carries a delivery status onto the message it names", () => {
    let state = opened();
    state = applyWindowEvent(state, {
      type: "conversation:message_sent",
      payload: {
        entry_id: "e1",
        entry_type: "whatsapp",
        message: msg("m1", { message_type: "operator" }),
      },
    });
    state = applyWindowEvent(state, {
      type: "conversation:message_status",
      payload: {
        entry_id: "e1",
        entry_type: "whatsapp",
        message_id: "m1",
        status: "delivered",
      },
    });

    expect(
      windowConversation(state, A)!.conversation.messages[0].delivery_status,
    ).toBe("delivered");
  });
});

describe("closing", () => {
  it("drops only the window asked for", () => {
    const state = closeWindowConversation(opened(), A);

    expect(windowConversation(state, A)).toBeNull();
    expect(windowConversation(state, B)).not.toBeNull();
  });

  /**
   * The conversation was assigned to someone else and left this operator's
   * scope. The server only sends this to people who may no longer see it — not
   * the new assignee, and not anyone holding `conversations:view_others`, so a
   * supervisor's window stays put. For everyone else the window closes, the
   * same way the row leaves their inbox.
   */
  it("closes the window when the conversation is assigned away", () => {
    const state = applyWindowEvent(opened(), {
      type: "conversation:entry_removed",
      payload: { entry_id: "e1", entry_type: "whatsapp", reason: "assigned" },
    });

    expect(windowConversation(state, A)).toBeNull();
    // And only that one.
    expect(windowConversation(state, B)).not.toBeNull();
  });

  it("an unsubscribed frame closes that window's state", () => {
    const state = applyWindowEvent(opened(), {
      type: "conversation:unsubscribed",
      payload: { entry_id: "e1", entry_type: "whatsapp" },
    });

    expect(windowConversation(state, A)).toBeNull();
  });
});

describe("incomingUnreadIds", () => {
  it("names the inbound messages still unread", () => {
    expect(
      incomingUnreadIds([
        msg("m1"),
        msg("m2", { read: true }),
        msg("m3", { message_type: "operator" }),
        msg("m4", { message_type: "ai_response" }),
      ]),
    ).toEqual(["m1"]);
  });
});

/** Test helper: what the hook does before sending a load_history frame. */
function markLoadingMore(
  state: ReturnType<typeof emptyWindowConversations>,
): ReturnType<typeof emptyWindowConversations> {
  const next = new Map(state);
  const w = next.get(A)!;
  next.set(A, { ...w, loadingHistory: true, pendingLoadMore: true });
  return next;
}
