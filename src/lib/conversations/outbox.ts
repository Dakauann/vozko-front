import type { ConversationMessage, EntryType, MediaType, MessageChannel } from "./types";

export interface SendButtonWsInput {
  headerType?: string;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons: { id: string; title: string }[];
}

export type OutboxPayload =
  | { kind: "text"; text: string; signed: boolean; replyToMessageId?: string }
  | { kind: "media"; text: string; mediaId: string; mediaType: MediaType; signed: boolean; replyToMessageId?: string }
  | { kind: "buttons"; input: SendButtonWsInput; replyToMessageId?: string }
  | { kind: "resend"; messageId: string };

export interface OutboxItem {
  requestId: string;
  entryId: string;
  entryType: EntryType;
  payload: OutboxPayload;
  state: "pending" | "failed";
  failure?: string;
  queuedAt: string;
}

type BubblePayload = Exclude<OutboxPayload, { kind: "resend" }>;

type BubbleItem = OutboxItem & { payload: BubblePayload };

export type Outbox = readonly OutboxItem[];

export interface OutboxCommand {
  type: "send" | "send_button" | "resend_message";
  payload: Record<string, unknown>;
}

export const emptyOutbox: Outbox = [];

export function enqueueSend(outbox: Outbox, item: Omit<OutboxItem, "state">): Outbox {
  return [...outbox, { ...item, state: "pending" }];
}

export function settleSend(outbox: Outbox, requestId: string): Outbox {
  return outbox.some((item) => item.requestId === requestId)
    ? outbox.filter((item) => item.requestId !== requestId)
    : outbox;
}

export function settleDelivered(outbox: Outbox, messages: readonly ConversationMessage[]): Outbox {
  if (outbox.length === 0) return outbox;
  const delivered = new Set(messages.map((message) => message.client_request_id).filter(Boolean));
  if (delivered.size === 0) return outbox;
  const remaining = outbox.filter((item) => !delivered.has(item.requestId));
  return remaining.length === outbox.length ? outbox : remaining;
}

export function failSend(
  outbox: Outbox,
  requestId: string,
  failure: string,
): { outbox: Outbox; failed: OutboxItem | null } {
  const failed = outbox.find((item) => item.requestId === requestId) ?? null;
  if (!failed) return { outbox, failed: null };
  if (failed.payload.kind === "resend") return { outbox: settleSend(outbox, requestId), failed };
  return {
    outbox: outbox.map((item) => (item.requestId === requestId ? { ...item, state: "failed", failure } : item)),
    failed,
  };
}

export function retrySend(outbox: Outbox, requestId: string): { outbox: Outbox; item: OutboxItem | null } {
  const failed = outbox.find((item) => item.requestId === requestId && item.state === "failed");
  if (!failed) return { outbox, item: null };
  const item: OutboxItem = { ...failed, state: "pending" };
  delete item.failure;
  return { outbox: outbox.map((queued) => (queued === failed ? item : queued)), item };
}

export function replayableSends(outbox: Outbox): OutboxItem[] {
  return outbox.filter((item) => item.state === "pending");
}

function replyTo(replyToMessageId: string | undefined): Record<string, string> {
  return replyToMessageId ? { reply_to_message_id: replyToMessageId } : {};
}

export function outboxCommand(item: OutboxItem): OutboxCommand {
  const target = { entry_id: item.entryId, entry_type: item.entryType, request_id: item.requestId };
  const { payload } = item;
  switch (payload.kind) {
    case "text":
      return {
        type: "send",
        payload: { ...target, signed: payload.signed, text: payload.text, ...replyTo(payload.replyToMessageId) },
      };
    case "media":
      return {
        type: "send",
        payload: {
          ...target,
          text: payload.text,
          media_id: payload.mediaId,
          media_type: payload.mediaType,
          signed: payload.signed,
          ...replyTo(payload.replyToMessageId),
        },
      };
    case "buttons":
      return {
        type: "send_button",
        payload: {
          ...target,
          header_type: payload.input.headerType || "",
          header_text: payload.input.headerText || "",
          body_text: payload.input.bodyText,
          footer_text: payload.input.footerText || "",
          buttons: payload.input.buttons,
          ...replyTo(payload.replyToMessageId),
        },
      };
    case "resend":
      return {
        type: "resend_message",
        payload: { entry_id: item.entryId, entry_type: item.entryType, message_id: payload.messageId, request_id: item.requestId },
      };
  }
}

function belongsTo(item: OutboxItem, entryId: string, entryType: EntryType | string): boolean {
  return item.entryId === entryId && item.entryType === entryType;
}

function bubbleText(payload: BubblePayload): string {
  return payload.kind === "buttons" ? payload.input.bodyText : payload.text;
}

function bubbleReply(payload: BubblePayload): Record<string, string> {
  return payload.replyToMessageId ? { reply_to_message_id: payload.replyToMessageId } : {};
}

function bubbleOf(item: BubbleItem, channel: MessageChannel): ConversationMessage {
  const { payload } = item;
  return {
    id: `pending:${item.requestId}`,
    entry_id: item.entryId,
    entry_type: item.entryType,
    channel,
    message_type: "operator",
    direction: "OUTBOUND",
    sent_by: null,
    from: "",
    to: "",
    text: bubbleText(payload),
    ...(payload.kind === "media" ? { media_type: payload.mediaType } : {}),
    ...bubbleReply(payload),
    sender_name: "",
    read: false,
    read_at: null,
    read_by: null,
    client_request_id: item.requestId,
    local_send: { requestId: item.requestId, state: item.state, ...(item.failure ? { failure: item.failure } : {}) },
    created_at: item.queuedAt,
    updated_at: item.queuedAt,
  };
}

function isBubble(item: OutboxItem): item is BubbleItem {
  return item.payload.kind !== "resend";
}

export function pendingBubbles(
  outbox: Outbox,
  entryId: string,
  entryType: EntryType | string,
  channel: MessageChannel,
): ConversationMessage[] {
  return outbox
    .filter(isBubble)
    .filter((item) => belongsTo(item, entryId, entryType))
    .map((item) => bubbleOf(item, channel));
}

export function resendingMessageIds(outbox: Outbox, entryId: string, entryType: EntryType | string): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const item of outbox) {
    if (belongsTo(item, entryId, entryType) && item.payload.kind === "resend") ids.add(item.payload.messageId);
  }
  return ids;
}
