import type { ConversationMessage } from "@/lib/conversations/types";
import { senderOf, type SenderKind } from "@/lib/conversations/sender";

const ALWAYS_OUTGOING = new Set([
  "operator",
  "ai_response",
  "tool_call",
  "tool_result",
  "template",
]);

const AMBIGUOUS = new Set(["user_message", "audio", "media"]);

export function messageTypeOf(msg: ConversationMessage): string | undefined {
  return (
    msg.message_type ??
    (msg as unknown as { messageType?: string }).messageType
  );
}

function directionOf(msg: ConversationMessage): string | undefined {
  return (
    msg.direction ??
    (msg as unknown as { Direction?: string }).Direction
  );
}

export function isOutgoingMessage(
  msg: ConversationMessage,
  leadNumber?: string | null,
): boolean {
  const sender = senderOf(msg);
  if (sender) return sender.kind !== "contact";

  const direction = directionOf(msg);
  if (direction === "OUTBOUND") return true;
  if (direction === "INBOUND") return false;

  const messageType = messageTypeOf(msg);
  if (messageType && ALWAYS_OUTGOING.has(messageType)) return true;

  const subject = (leadNumber ?? "").trim();
  if (!subject) return false;
  if (!messageType || !AMBIGUOUS.has(messageType)) {
    return Boolean(msg.media_type) && msg.to === subject;
  }
  return (messageType === "audio" || Boolean(msg.media_type)) &&
    msg.to === subject;
}

export function isFromContact(msg: ConversationMessage): boolean {
  const sender = senderOf(msg);
  if (sender) return sender.kind === "contact";
  return messageTypeOf(msg) !== "system" && !isOutgoingMessage(msg);
}

export function isAgentMessage(
  msg: ConversationMessage,
  leadNumber?: string | null,
): boolean {
  const sender = senderOf(msg);
  if (sender) return sender.kind === "ai";

  const messageType = messageTypeOf(msg);
  if (messageType === "ai_response") return true;
  return messageType === "audio" && isOutgoingMessage(msg, leadNumber);
}

export type SenderBadge = "human" | "ai" | "workflow" | "campaign" | "external";

const BADGED: readonly SenderKind[] = ["human", "ai", "workflow", "campaign", "external"];

export function senderBadge(message: ConversationMessage, leadNumber?: string | null): SenderBadge | null {
  const sender = senderOf(message);
  if (sender) return BADGED.includes(sender.kind) ? (sender.kind as SenderBadge) : null;
  if (isAgentMessage(message, leadNumber)) return "ai";
  return message.message_type === "operator" ? "human" : null;
}
