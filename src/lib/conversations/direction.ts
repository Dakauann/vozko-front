import type { ConversationMessage } from "@/lib/conversations/types";

/**
 * Which side of the thread a message belongs on.
 *
 * This used to be inferred from the message TYPE, which is the kind of content,
 * not who sent it. The two agree on most channels only because those channels
 * make them agree: Telegram and Instagram store every outbound message as
 * `operator` whatever it contained, so direction survives and the content type
 * is thrown away.
 *
 * Unofficial WhatsApp does not, and cannot. A reply the owner types on their own
 * phone arrives over the webhook as an ordinary text message, because that is
 * what it is — so the type-based reading filed it on the CUSTOMER's side, drew
 * it left-aligned, and labelled it with the customer's own name and picture. The
 * operator saw their own words attributed to the person they were answering.
 *
 * The backend now states the direction, so this reads it. The inference is kept
 * only as a fallback for rows written before that field existed.
 */

/** The message types that are outbound by construction, whatever they contain. */
const ALWAYS_OUTGOING = new Set([
  "operator",
  "ai_response",
  "tool_call",
  "tool_result",
  "template",
]);

/** The content types a channel may use in EITHER direction. */
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

/**
 * isOutgoingMessage decides whether we sent this message.
 *
 * `leadNumber` is the conversation subject's handle, used only by the legacy
 * fallback. Pass it even when a direction is expected — a page can mix rows
 * written before and after the field landed.
 */
export function isOutgoingMessage(
  msg: ConversationMessage,
  leadNumber?: string | null,
): boolean {
  const direction = directionOf(msg);
  if (direction === "OUTBOUND") return true;
  if (direction === "INBOUND") return false;

  // ---- Legacy rows only, below. No direction was stored for these.

  const messageType = messageTypeOf(msg);
  if (messageType && ALWAYS_OUTGOING.has(messageType)) return true;

  // The old media-only special case, kept exactly as it was so historical
  // conversations render as they did before. It compares the recipient against
  // the subject: if we addressed the subject, we sent it.
  //
  // Guarded on a non-empty subject handle, which the original was not. A group's
  // handle is empty and an outbound group message addressed an empty string too,
  // so `"" === ""` made every such row read as outgoing by accident rather than
  // by reasoning.
  const subject = (leadNumber ?? "").trim();
  if (!subject) return false;
  if (!messageType || !AMBIGUOUS.has(messageType)) {
    return Boolean(msg.media_type) && msg.to === subject;
  }
  return (messageType === "audio" || Boolean(msg.media_type)) &&
    msg.to === subject;
}

/**
 * isAgentMessage reports whether an assistant produced this, for the AI badge.
 *
 * Audio is here because an agent's spoken reply is stored as `audio` rather than
 * `ai_response` — so an outbound audio is the agent talking.
 */
export function isAgentMessage(
  msg: ConversationMessage,
  leadNumber?: string | null,
): boolean {
  const messageType = messageTypeOf(msg);
  if (messageType === "ai_response") return true;
  return messageType === "audio" && isOutgoingMessage(msg, leadNumber);
}
