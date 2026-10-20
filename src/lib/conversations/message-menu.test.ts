import { describe, expect, it } from "vitest";

import { NO_MESSAGE_ACTIONS } from "./message-actions";
import { messageMenuItems } from "./message-menu";
import type { ConversationMessage } from "./types";

function message(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: "m1",
    entry_id: "e1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "operator",
    from: "",
    to: "",
    text: "oi",
    sender_name: "",
    read: true,
    read_at: null,
    read_by: null,
    created_at: "2026-10-18T12:00:00Z",
    updated_at: "2026-10-18T12:00:00Z",
    ...overrides,
  };
}

const everything = { react: true, edit: true, delete: true, resend: true };
const handlers = { canReply: true, canResend: true };

describe("messageMenuItems", () => {
  it("lists every action the rule allows, in a fixed order", () => {
    expect(messageMenuItems(message(), everything, handlers)).toEqual(["reply", "react", "copy", "edit", "resend", "delete"]);
  });

  it("offers only what the rule allows", () => {
    expect(messageMenuItems(message(), NO_MESSAGE_ACTIONS, handlers)).toEqual(["reply", "copy"]);
  });

  it("leaves out replying and resending when the view cannot do them", () => {
    expect(messageMenuItems(message(), everything, { canReply: false, canResend: false })).toEqual(["react", "copy", "edit", "delete"]);
  });

  it("has nothing to copy without text", () => {
    expect(messageMenuItems(message({ text: "  " }), NO_MESSAGE_ACTIONS, handlers)).toEqual(["reply"]);
  });

  it("offers nothing on a deleted message, not even a reply", () => {
    expect(messageMenuItems(message({ retracted_at: "2026-10-18T12:01:00Z" }), everything, handlers)).toEqual([]);
  });

  it("offers only copying on a bubble still being sent", () => {
    expect(messageMenuItems(message({ local_send: { requestId: "r1", state: "pending" } }), NO_MESSAGE_ACTIONS, handlers)).toEqual(["copy"]);
  });
});
