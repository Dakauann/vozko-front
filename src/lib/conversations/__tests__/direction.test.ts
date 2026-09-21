import { describe, expect, it } from "vitest";
import { isAgentMessage, isOutgoingMessage } from "@/lib/conversations/direction";

import type { ConversationMessage } from "@/lib/conversations/types";


const LEAD = "+5511999999999";

function msg(over: Partial<ConversationMessage>): ConversationMessage {
  return {
    id: "m1",
    entry_id: "e1",
    entry_type: "unofficial_whatsapp",
    channel: "unofficial_whatsapp",
    message_type: "user_message",
    from: LEAD,
    to: "Comercial",
    text: "oi",
    sender_name: "",
    read: false,
    read_at: null,
    read_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  } as ConversationMessage;
}

describe("isOutgoingMessage", () => {
  it("puts a reply typed on the owner's own phone on our side", () => {
    const sent = msg({
      message_type: "user_message",
      direction: "OUTBOUND",
      from: "Comercial",
      to: LEAD,
      text: "ja estou vendo",
    });
    expect(isOutgoingMessage(sent, LEAD)).toBe(true);
  });

  it("keeps the customer's message of the identical type on their side", () => {
    const received = msg({ message_type: "user_message", direction: "INBOUND" });
    expect(isOutgoingMessage(received, LEAD)).toBe(false);
  });

  it("trusts a stated direction over the type", () => {
    const odd = msg({ message_type: "operator", direction: "INBOUND" });
    expect(isOutgoingMessage(odd, LEAD)).toBe(false);
  });

  describe("legacy rows, with no direction stored", () => {
    it.each(["operator", "ai_response", "tool_call", "tool_result", "template"])(
      "%s is outgoing",
      (message_type) => {
        expect(
          isOutgoingMessage(msg({ message_type } as Partial<ConversationMessage>), LEAD),
        ).toBe(true);
      },
    );

    it("an inbound text is incoming", () => {
      expect(isOutgoingMessage(msg({ message_type: "user_message" }), LEAD)).toBe(
        false,
      );
    });

    it("media addressed to the subject is outgoing", () => {
      const photo = msg({ message_type: "media", media_type: "image", to: LEAD });
      expect(isOutgoingMessage(photo, LEAD)).toBe(true);
    });

    it("media addressed to us is incoming", () => {
      const photo = msg({
        message_type: "media",
        media_type: "image",
        to: "Comercial",
      });
      expect(isOutgoingMessage(photo, LEAD)).toBe(false);
    });

    it("does not guess in a group, where both handles are empty", () => {
      const inGroup = msg({ message_type: "media", media_type: "image", to: "" });
      expect(isOutgoingMessage(inGroup, "")).toBe(false);
    });

    it("does not guess when the subject handle is missing", () => {
      expect(isOutgoingMessage(msg({ to: "" }), undefined)).toBe(false);
      expect(isOutgoingMessage(msg({ to: "" }), null)).toBe(false);
    });
  });
});

describe("isAgentMessage", () => {
  it("marks an ai_response", () => {
    expect(isAgentMessage(msg({ message_type: "ai_response" }), LEAD)).toBe(true);
  });

  it("marks outbound audio", () => {
    const spoken = msg({ message_type: "audio", direction: "OUTBOUND", to: LEAD });
    expect(isAgentMessage(spoken, LEAD)).toBe(true);
  });

  it("does not mark the customer's voice note", () => {
    const note = msg({ message_type: "audio", direction: "INBOUND", to: "Comercial" });
    expect(isAgentMessage(note, LEAD)).toBe(false);
  });
});
