import { describe, expect, it } from "vitest";

import { normalizeWireMessage } from "./message-wire";

describe("normalizeWireMessage", () => {
  it("reads the server's camelCase rows into the thread shape", () => {
    const message = normalizeWireMessage({
      id: "m1",
      entryId: "e1",
      entryType: "whatsapp",
      messageType: "operator",
      text: "oi",
      deliveryStatus: "sent",
      replyToMessageId: "q1",
      createdAt: "2026-10-18T10:00:00.123456789Z",
      updatedAt: "2026-10-18T10:00:01Z",
    });
    expect(message).toMatchObject({
      id: "m1",
      entry_id: "e1",
      entry_type: "whatsapp",
      message_type: "operator",
      delivery_status: "sent",
      reply_to_message_id: "q1",
      created_at: "2026-10-18T10:00:00.123456789Z",
    });
  });

  it("keeps the fields that idempotent sends, resends and message actions rely on", () => {
    const reactions = [{ emoji: "👍", direction: "inbound", at: "2026-10-18T10:02:00Z" }];
    const message = normalizeWireMessage({
      id: "m1",
      client_request_id: "r1",
      sender_user_id: "u1",
      resent_as: "m2",
      reactions,
      edited_at: "2026-10-18T10:03:00Z",
      retracted_at: "2026-10-18T10:04:00Z",
      transcript: "olá",
      createdAt: "2026-10-18T10:00:00Z",
    });
    expect(message).toMatchObject({
      client_request_id: "r1",
      sender_user_id: "u1",
      resent_as: "m2",
      reactions,
      edited_at: "2026-10-18T10:03:00Z",
      retracted_at: "2026-10-18T10:04:00Z",
      transcript: "olá",
    });
  });

  it("keeps the id the channel knows the message by, so the action rule can tell an acknowledged message", () => {
    expect(normalizeWireMessage({ id: "m1", externalMessageId: "pm-1" }).provider_message_id).toBe("pm-1");
    expect(normalizeWireMessage({ id: "m1", whatsappMessageId: "wamid.1" }).provider_message_id).toBe("wamid.1");
    expect(normalizeWireMessage({ id: "m1", externalMessageId: "pm-1", whatsappMessageId: "wamid.1" }).provider_message_id).toBe("pm-1");
    expect(normalizeWireMessage({ id: "m1" })).not.toHaveProperty("provider_message_id");
  });

  it("reads a resend mark from the stored metadata when the row carries it there", () => {
    expect(normalizeWireMessage({ id: "m1", metadata: { resent_as: "m2" } }).resent_as).toBe("m2");
  });

  it("leaves absent optional fields out instead of filling them with empty values", () => {
    const message = normalizeWireMessage({ id: "m1", createdAt: "2026-10-18T10:00:00Z" });
    expect(message).not.toHaveProperty("client_request_id");
    expect(message).not.toHaveProperty("resent_as");
    expect(message).not.toHaveProperty("reactions");
  });
});
