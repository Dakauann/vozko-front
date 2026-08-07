import { describe, expect, it } from "vitest";
import { isAgentMessage, isOutgoingMessage } from "@/lib/conversations/direction";

import type { ConversationMessage } from "@/lib/conversations/types";

/**
 * Which side of the thread a message is drawn on.
 *
 * The old rule read this off the message TYPE, which is the kind of content, not
 * who sent it. On unofficial WhatsApp the two came apart: a reply the owner
 * types on their own phone arrives as an ordinary text, so it was drawn
 * left-aligned and labelled with the CUSTOMER's name and picture. The operator
 * saw their own words attributed to the person they had just answered.
 */

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
  // The bug this exists to prevent.
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

  // Same type, same conversation, opposite side. Type alone could never tell.
  it("keeps the customer's message of the identical type on their side", () => {
    const received = msg({ message_type: "user_message", direction: "INBOUND" });
    expect(isOutgoingMessage(received, LEAD)).toBe(false);
  });

  it("trusts a stated direction over the type", () => {
    // An operator-typed row explicitly marked inbound stays inbound. Contrived,
    // but it pins that the stated value wins rather than merely being consulted.
    const odd = msg({ message_type: "operator", direction: "INBOUND" });
    expect(isOutgoingMessage(odd, LEAD)).toBe(false);
  });

  describe("legacy rows, with no direction stored", () => {
    // These must behave exactly as before, or every historical conversation
    // re-renders differently the day this ships.
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

    // A group's subject handle is empty, and an outbound group message
    // addressed an empty string too — so `"" === ""` made every such row read
    // as outgoing by accident. Without a stated direction we cannot know, and
    // guessing wrong draws the customer's message on our own side.
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

  // An agent's spoken reply is stored as audio, not ai_response, so an OUTBOUND
  // audio is the agent talking.
  it("marks outbound audio", () => {
    const spoken = msg({ message_type: "audio", direction: "OUTBOUND", to: LEAD });
    expect(isAgentMessage(spoken, LEAD)).toBe(true);
  });

  // A voice note the CUSTOMER recorded is the same type and must not wear the
  // AI badge.
  it("does not mark the customer's voice note", () => {
    const note = msg({ message_type: "audio", direction: "INBOUND", to: "Comercial" });
    expect(isAgentMessage(note, LEAD)).toBe(false);
  });
});
