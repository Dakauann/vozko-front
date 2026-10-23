import { messageLocation } from "./message-location";
import { messageMedia } from "./message-media";
import type {
  ConversationMessage,
  EntryType,
  InteractiveContent,
  InteractiveReply,
  MediaType,
  MessageChannel,
  MessageReaction,
} from "./types";

type WireRow = Record<string, unknown>;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function optional<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

function reactionsOf(value: unknown): MessageReaction[] | undefined {
  return Array.isArray(value) && value.length > 0 ? (value as MessageReaction[]) : undefined;
}

function trimmed(value: unknown): string | undefined {
  return text(typeof value === "string" ? value.trim() : value);
}

function providerMessageId(msg: WireRow): string | undefined {
  return trimmed(msg.provider_message_id) ?? trimmed(msg.externalMessageId) ?? trimmed(msg.whatsappMessageId);
}

function storedResentAs(msg: WireRow): string | undefined {
  const metadata = msg.metadata;
  return metadata && typeof metadata === "object" ? text((metadata as WireRow).resent_as) : undefined;
}

function record<T>(value: unknown): T | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : undefined;
}

function interactiveFields(msg: WireRow): Partial<ConversationMessage> {
  return {
    ...optional("interactive", record<InteractiveContent>(msg.interactive)),
    ...optional("interactive_reply", record<InteractiveReply>(msg.interactive_reply)),
  };
}

function actionFields(msg: WireRow): Partial<ConversationMessage> {
  return {
    ...optional("client_request_id", text(msg.client_request_id)),
    ...optional("provider_message_id", providerMessageId(msg)),
    ...optional("sender_user_id", text(msg.sender_user_id)),
    ...optional("resent_as", text(msg.resent_as) ?? storedResentAs(msg)),
    ...optional("reactions", reactionsOf(msg.reactions)),
    ...optional("edited_at", text(msg.edited_at)),
    ...optional("retracted_at", text(msg.retracted_at)),
    ...optional("transcript", text(msg.transcript)),
  };
}

export function normalizeWireMessage(message: ConversationMessage | WireRow): ConversationMessage {
  const msg = message as WireRow;
  return {
    id: (msg.id as string) ?? "",
    entry_id: (msg.entry_id as string) ?? (msg.entryId as string) ?? "",
    entry_type: (msg.entry_type as EntryType) ?? (msg.entryType as EntryType),
    channel: (msg.channel as MessageChannel) ?? "whatsapp",
    message_type: (msg.message_type as string) ?? (msg.messageType as string) ?? "user_message",
    direction: (msg.direction as ConversationMessage["direction"]) ?? (msg.Direction as ConversationMessage["direction"]),
    sent_by: (msg.sent_by ?? msg.sentBy ?? null) as ConversationMessage["sent_by"],
    from: (msg.from as string) ?? "",
    to: (msg.to as string) ?? "",
    text: (msg.text as string) ?? "",
    media_id: (msg.media_id as string) ?? (msg.mediaId as string),
    media_type: (msg.media_type as MediaType) ?? (msg.mediaType as MediaType),
    ...messageMedia(msg),
    sender_name: (msg.sender_name as string) ?? (msg.senderName as string) ?? "",
    sender_avatar: (msg.sender_avatar as string) ?? (msg.senderAvatar as string),
    read: (msg.read as boolean) ?? false,
    read_at: (msg.read_at as string) ?? (msg.readAt as string) ?? null,
    read_by: (msg.read_by as string) ?? (msg.readBy as string) ?? null,
    delivery_status:
      (msg.delivery_status as ConversationMessage["delivery_status"]) ??
      (msg.deliveryStatus as ConversationMessage["delivery_status"]) ??
      undefined,
    reply_to_message_id: (msg.reply_to_message_id as string) ?? (msg.replyToMessageId as string) ?? undefined,
    metadata: (msg.metadata as ConversationMessage["metadata"]) ?? undefined,
    ...messageLocation(msg),
    ...interactiveFields(msg),
    ...actionFields(msg),
    created_at: (msg.created_at as string) ?? (msg.createdAt as string) ?? "",
    updated_at: (msg.updated_at as string) ?? (msg.updatedAt as string) ?? "",
  } as ConversationMessage;
}
