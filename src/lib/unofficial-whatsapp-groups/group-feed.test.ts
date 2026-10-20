import { describe, expect, it } from "vitest";

import type { GroupFeedMessage, GroupMessagesPage } from "./types";

import { atHistoryStart, feedConversation, feedReducer, initialFeed, toThreadMessage } from "./group-feed";

const LABELS = { ourTeam: "Our team", unknown: "n/a" };

function message(id: string, overrides: Partial<GroupFeedMessage> = {}): GroupFeedMessage {
  return {
    id,
    entryId: "conv-1",
    channel: "unofficial_whatsapp",
    messageType: "user_message",
    direction: "INBOUND",
    from: "+5511970001234",
    senderName: "Ana",
    ourTeam: false,
    text: `text ${id}`,
    read: false,
    createdAt: `2026-10-18T10:0${id.slice(-1)}:00Z`,
    ...overrides,
  };
}

function page(messages: GroupFeedMessage[], nextBefore?: string): GroupMessagesPage {
  return { conversationId: "conv-1", messages, hasMore: Boolean(nextBefore), nextBefore };
}

describe("toThreadMessage", () => {
  it("maps an inbound message to a thread message of the group conversation", () => {
    const mapped = toThreadMessage(message("m1"), LABELS);
    expect(mapped).toMatchObject({
      id: "m1",
      entry_id: "conv-1",
      entry_type: "unofficial_whatsapp",
      channel: "unofficial_whatsapp",
      message_type: "user_message",
      direction: "INBOUND",
      from: "+5511970001234",
      sender_name: "Ana",
      text: "text m1",
      created_at: "2026-10-18T10:01:00Z",
      sent_by: null,
    });
  });

  it("names our messages as our team", () => {
    const mapped = toThreadMessage(message("m2", { direction: "OUTBOUND", ourTeam: true, senderName: "Nossa equipe", from: "" }), LABELS);
    expect(mapped.sender_name).toBe("Our team");
    expect(mapped.direction).toBe("OUTBOUND");
  });

  it("shows the empty value when the author has no name", () => {
    expect(toThreadMessage(message("m3", { senderName: "", from: "123@lid" }), LABELS).sender_name).toBe("n/a");
  });

  it("keeps the stored media with its layout", () => {
    const mapped = toThreadMessage(
      message("m4", {
        mediaId: "media-1",
        mediaType: "image",
        media: { url: "https://cdn/photo.jpg", layout: { width: 800, height: 600, thumbhash: "abc" } },
      }),
      LABELS,
    );
    expect(mapped.media_id).toBe("media-1");
    expect(mapped.media_type).toBe("image");
    expect(mapped.media_url).toBe("https://cdn/photo.jpg");
    expect(mapped.media_layout).toEqual({ width: 800, height: 600, thumbhash: "abc" });
  });

  it("keeps edits, retractions and replies", () => {
    const mapped = toThreadMessage(
      message("m5", { editedAt: "2026-10-18T11:00:00Z", retractedAt: "2026-10-18T12:00:00Z", replyToMessageId: "m1" }),
      LABELS,
    );
    expect(mapped.edited_at).toBe("2026-10-18T11:00:00Z");
    expect(mapped.retracted_at).toBe("2026-10-18T12:00:00Z");
    expect(mapped.reply_to_message_id).toBe("m1");
  });
});

describe("feedConversation", () => {
  it("is a read only group conversation", () => {
    expect(feedConversation("conv-1")).toMatchObject({ entry_id: "conv-1", entry_type: "unofficial_whatsapp", is_group: true, has_more: false });
  });
});

describe("feedReducer", () => {
  it("shows the latest page", () => {
    const state = feedReducer(initialFeed, { type: "latest", page: page([message("m1"), message("m2")], "2026-10-18T10:01:00Z") });
    expect(state.phase).toBe("ready");
    expect(state.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(state.nextBefore).toBe("2026-10-18T10:01:00Z");
    expect(atHistoryStart(state)).toBe(false);
  });

  it("prepends older messages once and reaches the start of the history", () => {
    const latest = feedReducer(initialFeed, { type: "latest", page: page([message("m3"), message("m4")], "2026-10-18T10:03:00Z") });
    const loading = feedReducer(latest, { type: "older-start" });
    expect(loading.loadingOlder).toBe(true);
    const older = feedReducer(loading, { type: "older", page: page([message("m1"), message("m2"), message("m3")]) });
    expect(older.messages.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(older.loadingOlder).toBe(false);
    expect(older.nextBefore).toBeNull();
    expect(atHistoryStart(older)).toBe(true);
  });

  it("keeps the loaded messages when an older page fails", () => {
    const latest = feedReducer(initialFeed, { type: "latest", page: page([message("m3")], "2026-10-18T10:03:00Z") });
    const failed = feedReducer(feedReducer(latest, { type: "older-start" }), { type: "older-failed" });
    expect(failed.phase).toBe("ready");
    expect(failed.olderFailed).toBe(true);
    expect(failed.loadingOlder).toBe(false);
    expect(failed.messages).toHaveLength(1);
    expect(feedReducer(failed, { type: "older-start" }).olderFailed).toBe(false);
  });

  it("fails the first page and starts over on refresh", () => {
    const failed = feedReducer(initialFeed, { type: "latest-failed" });
    expect(failed.phase).toBe("failed");
    const refreshing = feedReducer(failed, { type: "refresh" });
    expect(refreshing.phase).toBe("loading");
    expect(refreshing.messages).toEqual([]);
  });

  it("an empty group is ready with no messages and not at the start of a history", () => {
    const state = feedReducer(initialFeed, { type: "latest", page: page([]) });
    expect(state.phase).toBe("ready");
    expect(atHistoryStart(state)).toBe(false);
  });

  it("does not page while a page is loading", () => {
    const loading = feedReducer(initialFeed, { type: "older-start" });
    expect(loading).toBe(initialFeed);
  });
});
