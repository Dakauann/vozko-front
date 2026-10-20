import { describe, expect, it } from "vitest";

import {
  ANNOUNCE_GAP_MS,
  announcementFor,
  idleAnnouncer,
  planAnnouncement,
} from "./live-announcement";
import type { ConversationMessage } from "./types";

function msg(id: string, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id,
    entry_id: "e1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "user_message",
    from: "+5511999999999",
    to: "+5511888888888",
    text: `text ${id}`,
    sender_name: "Ana",
    read: false,
    read_at: null,
    read_by: null,
    created_at: "2026-10-18T10:00:00Z",
    updated_at: "2026-10-18T10:00:00Z",
    ...overrides,
  };
}

describe("announcement for arrived messages", () => {
  it("names the sender and a short preview of a single message", () => {
    expect(announcementFor([msg("a", { text: "  Olá,\n tudo bem?  " })])).toEqual({
      count: 1,
      sender: "Ana",
      preview: "Olá, tudo bem?",
      mediaKey: null,
    });
  });

  it("cuts a long message so the reader is not read a whole essay", () => {
    const preview = announcementFor([msg("a", { text: "x".repeat(300) })])?.preview ?? "";
    expect(preview.length).toBeLessThanOrEqual(80);
    expect(preview.endsWith("...")).toBe(true);
  });

  it("says what kind of media arrived when there is no caption", () => {
    expect(announcementFor([msg("a", { text: "", media_type: "image" })])).toMatchObject({ preview: null, mediaKey: "image" });
  });

  it("falls back to the number when the contact has no name", () => {
    expect(announcementFor([msg("a", { sender_name: "" })])?.sender).toBe("+5511999999999");
  });

  it("counts several messages and drops the name when different people wrote them", () => {
    expect(announcementFor([msg("a"), msg("b", { from: "+551102", sender_name: "Bia" })])).toMatchObject({ count: 2, sender: null });
  });

  it("announces nothing for our own outgoing messages", () => {
    expect(announcementFor([msg("a", { message_type: "operator" })])).toBeNull();
  });
});

describe("announcement throttle", () => {
  it("announces at once when nothing was said recently", () => {
    const plan = planAnnouncement(idleAnnouncer, [msg("a")], 10_000);
    expect(plan.announce?.count).toBe(1);
    expect(plan.flushAt).toBeNull();
  });

  it("holds messages that arrive within the gap and announces them together later", () => {
    const first = planAnnouncement(idleAnnouncer, [msg("a")], 10_000);
    const second = planAnnouncement(first.state, [msg("b")], 11_000);
    expect(second.announce).toBeNull();
    expect(second.flushAt).toBe(10_000 + ANNOUNCE_GAP_MS);

    const third = planAnnouncement(second.state, [msg("c")], 12_000);
    const flushed = planAnnouncement(third.state, [], 10_000 + ANNOUNCE_GAP_MS);
    expect(flushed.announce?.count).toBe(2);
    expect(flushed.state.pending).toEqual([]);
  });

  it("does nothing when only outgoing messages arrived", () => {
    const plan = planAnnouncement(idleAnnouncer, [msg("a", { message_type: "operator" })], 10_000);
    expect(plan.announce).toBeNull();
    expect(plan.state).toBe(idleAnnouncer);
  });
});
