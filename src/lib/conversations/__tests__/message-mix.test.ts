import { describe, expect, it } from "vitest";

import { messageMix } from "@/lib/conversations/message-mix";
import type { ConversationMessage } from "@/lib/conversations/types";

const msg = (over: Partial<ConversationMessage>): ConversationMessage =>
  ({
    id: Math.random().toString(36),
    entry_id: "e1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "user_message",
    from: "5511",
    to: "me",
    text: "",
    read: true,
    created_at: "2026-09-25T12:00:00Z",
    ...over,
  }) as ConversationMessage;

describe("messageMix", () => {
  it("counts authors by sender whatever the message type", () => {
    const mix = messageMix([
      msg({ sent_by: { kind: "contact", id: "" } }),
      msg({ message_type: "audio", sent_by: { kind: "contact", id: "" } }),
      msg({ message_type: "operator", sent_by: { kind: "human", id: "u1" } }),
      msg({ message_type: "media", media_type: "image", sent_by: { kind: "external", id: "" } }),
      msg({ message_type: "ai_response", sent_by: { kind: "ai", id: "ai:a1" } }),
      msg({ message_type: "media", media_type: "image", sent_by: { kind: "workflow", id: "workflow:w1" } }),
      msg({ message_type: "template", sent_by: { kind: "campaign", id: "campaign:c1" } }),
      msg({ message_type: "system", sent_by: { kind: "system", id: "" } }),
      msg({ message_type: "tool_call" }),
    ]);

    expect(mix).toEqual({ customer: 2, team: 2, ai: 1, automation: 2, media: 3, tools: 1 });
  });

  it("falls back to the message type for rows written before senders existed", () => {
    const mix = messageMix([
      msg({}),
      msg({ message_type: "operator" }),
      msg({ message_type: "ai_response" }),
      msg({ message_type: "tool_result" }),
      msg({ message_type: "system" }),
    ]);

    expect(mix).toEqual({ customer: 1, team: 1, ai: 1, automation: 0, media: 0, tools: 1 });
  });
});
