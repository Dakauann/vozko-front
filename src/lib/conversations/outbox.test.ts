import { describe, expect, it } from "vitest";

import {
  emptyOutbox,
  enqueueSend,
  failSend,
  outboxCommand,
  pendingBubbles,
  replayableSends,
  resendingMessageIds,
  retrySend,
  settleDelivered,
  settleSend,
  type OutboxItem,
} from "./outbox";
import type { ConversationMessage } from "./types";

const QUEUED_AT = "2026-10-18T10:00:00.000Z";

function textSend(requestId: string, entryId = "e1"): Omit<OutboxItem, "state"> {
  return {
    requestId,
    entryId,
    entryType: "whatsapp",
    payload: { kind: "text", text: `hello ${requestId}`, signed: true },
    queuedAt: QUEUED_AT,
  };
}

function delivered(requestId: string): ConversationMessage {
  return {
    id: `m-${requestId}`,
    entry_id: "e1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "operator",
    from: "me",
    to: "5511",
    text: "hello",
    sender_name: "",
    read: false,
    read_at: null,
    read_by: null,
    client_request_id: requestId,
    created_at: QUEUED_AT,
    updated_at: QUEUED_AT,
  };
}

describe("outbox", () => {
  it("queues every send as pending until the server answers", () => {
    const outbox = enqueueSend(emptyOutbox, textSend("r1"));
    expect(outbox).toEqual([{ ...textSend("r1"), state: "pending" }]);
  });

  it("drops the send the server confirmed by its request id", () => {
    const outbox = settleSend(enqueueSend(enqueueSend(emptyOutbox, textSend("r1")), textSend("r2")), "r1");
    expect(outbox.map((item) => item.requestId)).toEqual(["r2"]);
  });

  it("drops a send whose message arrived some other way, a page or a live broadcast", () => {
    const outbox = settleDelivered(enqueueSend(emptyOutbox, textSend("r1")), [delivered("r1")]);
    expect(outbox).toEqual([]);
  });

  it("keeps the same array when no delivered message names a queued send", () => {
    const outbox = enqueueSend(emptyOutbox, textSend("r1"));
    expect(settleDelivered(outbox, [delivered("other")])).toBe(outbox);
  });

  it("turns a refused send failed with its reason, keeping the payload for the retry", () => {
    const { outbox, failed } = failSend(enqueueSend(emptyOutbox, textSend("r1")), "r1", "send_failed");
    expect(failed?.payload).toEqual(textSend("r1").payload);
    expect(outbox[0]).toMatchObject({ state: "failed", failure: "send_failed" });
  });

  it("forgets a failed resend, because the stored row keeps showing the failure", () => {
    const resend: Omit<OutboxItem, "state"> = {
      requestId: "r9",
      entryId: "e1",
      entryType: "whatsapp",
      payload: { kind: "resend", messageId: "m1" },
      queuedAt: QUEUED_AT,
    };
    const { outbox, failed } = failSend(enqueueSend(emptyOutbox, resend), "r9", "not_allowed");
    expect(failed?.payload).toEqual({ kind: "resend", messageId: "m1" });
    expect(outbox).toEqual([]);
  });

  it("ignores an error for a request id it never queued", () => {
    const outbox = enqueueSend(emptyOutbox, textSend("r1"));
    expect(failSend(outbox, "other", "send_failed")).toEqual({ outbox, failed: null });
  });

  it("retries a failed send with the same request id, so a late original cannot double send", () => {
    const failed = failSend(enqueueSend(emptyOutbox, textSend("r1")), "r1", "send_failed").outbox;
    const { outbox, item } = retrySend(failed, "r1");
    expect(item?.requestId).toBe("r1");
    expect(outbox[0].state).toBe("pending");
    expect(outbox[0].failure).toBeUndefined();
  });

  it("does not retry a send that is still pending", () => {
    const outbox = enqueueSend(emptyOutbox, textSend("r1"));
    expect(retrySend(outbox, "r1")).toEqual({ outbox, item: null });
  });

  it("replays only what is still pending after a reconnect", () => {
    let outbox = enqueueSend(enqueueSend(emptyOutbox, textSend("r1")), textSend("r2"));
    outbox = failSend(outbox, "r2", "send_failed").outbox;
    expect(replayableSends(outbox).map((item) => item.requestId)).toEqual(["r1"]);
  });

  it("builds the same wire command for the first try and every replay", () => {
    expect(outboxCommand({ ...textSend("r1"), payload: { kind: "text", text: "oi", signed: false, replyToMessageId: "q1" }, state: "pending" })).toEqual({
      type: "send",
      payload: { entry_id: "e1", entry_type: "whatsapp", request_id: "r1", signed: false, text: "oi", reply_to_message_id: "q1" },
    });
    expect(
      outboxCommand({
        ...textSend("r2"),
        payload: { kind: "media", text: "", mediaId: "md1", mediaType: "image", signed: true },
        state: "pending",
      }),
    ).toEqual({
      type: "send",
      payload: { entry_id: "e1", entry_type: "whatsapp", request_id: "r2", text: "", media_id: "md1", media_type: "image", signed: true },
    });
    expect(
      outboxCommand({
        ...textSend("r3"),
        payload: { kind: "buttons", input: { bodyText: "Escolha", buttons: [{ id: "b1", title: "Sim" }] } },
        state: "pending",
      }),
    ).toEqual({
      type: "send_button",
      payload: {
        entry_id: "e1",
        entry_type: "whatsapp",
        request_id: "r3",
        header_type: "",
        header_text: "",
        body_text: "Escolha",
        footer_text: "",
        buttons: [{ id: "b1", title: "Sim" }],
      },
    });
    expect(
      outboxCommand({ ...textSend("r4"), payload: { kind: "resend", messageId: "m1" }, state: "pending" }),
    ).toEqual({ type: "resend_message", payload: { entry_id: "e1", entry_type: "whatsapp", message_id: "m1", request_id: "r4" } });
  });

  it("renders each queued send of a conversation as an outgoing bubble keyed by its request id", () => {
    let outbox = enqueueSend(emptyOutbox, textSend("r1"));
    outbox = enqueueSend(outbox, textSend("r2", "other"));
    outbox = enqueueSend(outbox, {
      requestId: "r3",
      entryId: "e1",
      entryType: "whatsapp",
      payload: { kind: "media", text: "foto", mediaId: "md1", mediaType: "image", signed: true },
      queuedAt: QUEUED_AT,
    });
    outbox = failSend(outbox, "r3", "send_failed").outbox;

    const bubbles = pendingBubbles(outbox, "e1", "whatsapp", "whatsapp");
    expect(bubbles.map((bubble) => bubble.id)).toEqual(["pending:r1", "pending:r3"]);
    expect(bubbles[0]).toMatchObject({
      client_request_id: "r1",
      direction: "OUTBOUND",
      message_type: "operator",
      text: "hello r1",
      local_send: { requestId: "r1", state: "pending" },
    });
    expect(bubbles[1]).toMatchObject({
      text: "foto",
      media_type: "image",
      local_send: { requestId: "r3", state: "failed", failure: "send_failed" },
    });
    expect(bubbles[1].media_id).toBeUndefined();
  });

  it("shows no bubble for a resend, and names the stored message being resent", () => {
    const outbox = enqueueSend(emptyOutbox, {
      requestId: "r9",
      entryId: "e1",
      entryType: "whatsapp",
      payload: { kind: "resend", messageId: "m1" },
      queuedAt: QUEUED_AT,
    });
    expect(pendingBubbles(outbox, "e1", "whatsapp", "whatsapp")).toEqual([]);
    expect([...resendingMessageIds(outbox, "e1", "whatsapp")]).toEqual(["m1"]);
  });
});
