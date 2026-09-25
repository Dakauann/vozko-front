import { describe, expect, it } from "vitest";

import type { ConversationMessage } from "@/lib/conversations/types";
import { isAgentMessage, isOutgoingMessage, senderBadge } from "@/lib/conversations/direction";
import { senderOf } from "@/lib/conversations/sender";

const LEAD = "+5511999999999";

function msg(over: Partial<ConversationMessage> & Record<string, unknown>): ConversationMessage {
  return {
    id: "m1",
    entry_id: "e1",
    entry_type: "unofficial_whatsapp",
    channel: "unofficial_whatsapp",
    message_type: "media",
    from: "instance",
    to: LEAD,
    text: "catalogo.pdf",
    sender_name: "",
    read: false,
    read_at: null,
    read_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  } as ConversationMessage;
}

describe("senderOf", () => {
  it("reads the sender the API sends", () => {
    expect(senderOf(msg({ sent_by: { kind: "workflow", id: "workflow:wf-1" } }))).toEqual({ kind: "workflow", id: "workflow:wf-1" });
    expect(senderOf(msg({ sentBy: { kind: "ai", id: "ai:a-1" } }))).toEqual({ kind: "ai", id: "ai:a-1" });
  });

  it("has no sender for a message stored before senders existed", () => {
    expect(senderOf(msg({}))).toBeNull();
    expect(senderOf(msg({ sent_by: { kind: "unknown", id: "" } }))).toBeNull();
    expect(senderOf(msg({ sent_by: { kind: "legacy", id: "" } }))).toBeNull();
  });
});

describe("direction by sender", () => {
  it("keeps workflow media on our side", () => {
    const media = msg({ message_type: "media", direction: "INBOUND", sent_by: { kind: "workflow", id: "workflow:wf-1" } });
    expect(isOutgoingMessage(media, LEAD)).toBe(true);
    expect(isAgentMessage(media, LEAD)).toBe(false);
  });

  it("puts the contact's message on their side", () => {
    expect(isOutgoingMessage(msg({ message_type: "user_message", sent_by: { kind: "contact", id: LEAD } }), LEAD)).toBe(false);
  });

  it("credits the AI only for what the AI sent", () => {
    expect(isAgentMessage(msg({ message_type: "ai_response", sent_by: { kind: "workflow", id: "workflow:wf-1" } }), LEAD)).toBe(false);
    expect(isAgentMessage(msg({ message_type: "ai_response", sent_by: { kind: "ai", id: "ai:a-1" } }), LEAD)).toBe(true);
  });
});

describe("senderBadge", () => {
  it("names who sent it", () => {
    expect(senderBadge(msg({ sent_by: { kind: "human", id: "u-1" } }), LEAD)).toBe("human");
    expect(senderBadge(msg({ sent_by: { kind: "ai", id: "ai:a-1" } }), LEAD)).toBe("ai");
    expect(senderBadge(msg({ sent_by: { kind: "workflow", id: "workflow:wf-1" } }), LEAD)).toBe("workflow");
    expect(senderBadge(msg({ sent_by: { kind: "campaign", id: "campaign:c-1" } }), LEAD)).toBe("campaign");
    expect(senderBadge(msg({ sent_by: { kind: "external", id: "" } }), LEAD)).toBe("external");
  });

  it("shows nothing for the contact or the system", () => {
    expect(senderBadge(msg({ sent_by: { kind: "contact", id: LEAD } }), LEAD)).toBeNull();
    expect(senderBadge(msg({ sent_by: { kind: "system", id: "" } }), LEAD)).toBeNull();
  });

  it("keeps the old reading for messages without a sender", () => {
    expect(senderBadge(msg({ message_type: "ai_response" }), LEAD)).toBe("ai");
    expect(senderBadge(msg({ message_type: "operator" }), LEAD)).toBe("human");
    expect(senderBadge(msg({ message_type: "template" }), LEAD)).toBeNull();
  });
});
